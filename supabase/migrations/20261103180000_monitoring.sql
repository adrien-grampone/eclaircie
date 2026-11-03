-- Éclaircie — surveillance du pipeline.
-- pipeline_alerts : une alerte ouverte par empreinte (fingerprint) ; résolue quand la cause disparaît.
-- pipeline_health_check() : toutes les heures, relève les jobs cron en échec, les réponses HTTP
-- non 200 de pg_net, les runs en erreur et les étapes muettes. Service_role seulement.

create table pipeline_alerts (
  id          bigserial primary key,
  kind        text not null
    check (kind in ('cron_failed', 'function_error', 'step_error', 'step_stale', 'stock_low')),
  fingerprint text not null,
  theme_id    text references themes(id),
  message     text not null,
  details     jsonb,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index pipeline_alerts_open_idx on pipeline_alerts (fingerprint) where resolved_at is null;
create index pipeline_alerts_created_idx on pipeline_alerts (created_at desc);
alter table pipeline_alerts enable row level security;   -- aucune policy : service_role seulement

create or replace function raise_pipeline_alert(
  p_kind text, p_fingerprint text, p_message text, p_details jsonb default null, p_theme_id text default null
) returns void language sql security definer set search_path = public as $$
  insert into pipeline_alerts (kind, fingerprint, theme_id, message, details)
  values (p_kind, p_fingerprint, p_theme_id, left(p_message, 1000), p_details)
  on conflict (fingerprint) where resolved_at is null do nothing;
$$;

create or replace function resolve_pipeline_alert(p_fingerprint text)
returns void language sql security definer set search_path = public as $$
  update pipeline_alerts set resolved_at = now() where fingerprint = p_fingerprint and resolved_at is null;
$$;

create or replace function pipeline_health_check()
returns void
language plpgsql
security definer
set search_path = public, cron, net
as $$
declare
  r record;
  stale_steps text[] := array['triage', 'extract', 'draft', 'verify', 'revise', 'dedup'];
  v_step text;
begin
  -- 1. Jobs cron en échec sur la dernière heure ; résolu dès qu'un run réussit.
  for r in
    select j.jobname, d.status, d.return_message, d.start_time
    from cron.job j
    join lateral (
      select status, return_message, start_time from cron.job_run_details
      where jobid = j.jobid order by start_time desc limit 1
    ) d on true
    where j.jobname like 'pipeline-%'
  loop
    if r.status = 'failed' then
      perform raise_pipeline_alert('cron_failed', 'cron:' || r.jobname,
        format('job %s en échec : %s', r.jobname, coalesce(r.return_message, '?')),
        jsonb_build_object('start_time', r.start_time));
    else
      perform resolve_pipeline_alert('cron:' || r.jobname);
    end if;
  end loop;

  -- 2. Réponses HTTP non 200 ou erreurs réseau (pg_net) sur la dernière heure.
  for r in
    select status_code, error_msg, left(content::text, 400) as body, created
    from net._http_response
    where created > now() - interval '1 hour'
      and (status_code is distinct from 200 or error_msg is not null)
    order by created desc
  loop
    perform raise_pipeline_alert('function_error',
      'http:' || coalesce(r.status_code::text, 'network'),
      format('réponse %s : %s', coalesce(r.status_code::text, 'réseau'), coalesce(r.error_msg, r.body)),
      jsonb_build_object('created', r.created, 'body', r.body));
  end loop;
  if not exists (
    select 1 from net._http_response
    where created > now() - interval '1 hour' and (status_code is distinct from 200 or error_msg is not null)
  ) then
    update pipeline_alerts set resolved_at = now() where kind = 'function_error' and resolved_at is null;
  end if;

  -- 3. Dernier run de chaque étape en erreur ; résolu dès qu'un run passe sans erreur.
  for r in
    select distinct on (p.step) p.step, p.error, p.started_at
    from pipeline_runs p order by p.step, p.started_at desc
  loop
    if r.error is not null then
      perform raise_pipeline_alert('step_error', 'step:' || r.step,
        format('étape %s en erreur : %s', r.step, r.error), jsonb_build_object('started_at', r.started_at));
    else
      perform resolve_pipeline_alert('step:' || r.step);
    end if;
  end loop;

  -- 4. Étapes muettes : aucun run depuis 3 h (collect : 4 h) alors que leur job est actif.
  foreach v_step in array stale_steps || array['collect'] loop
    if exists (select 1 from cron.job where jobname = 'pipeline-' || v_step and active)
       and not exists (
         select 1 from pipeline_runs
         where pipeline_runs.step = v_step
           and started_at > now() - (case when v_step = 'collect' then interval '4 hours' else interval '3 hours' end)
       )
    then
      perform raise_pipeline_alert('step_stale', 'stale:' || v_step,
        format('aucun run de %s depuis plus de %s h', v_step, case when v_step = 'collect' then 4 else 3 end));
    else
      perform resolve_pipeline_alert('stale:' || v_step);
    end if;
  end loop;
end;
$$;

revoke execute on function raise_pipeline_alert(text, text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function resolve_pipeline_alert(text) from public, anon, authenticated;
revoke execute on function pipeline_health_check() from public, anon, authenticated;

select cron.schedule('pipeline-health', '30 * * * *', $$select pipeline_health_check()$$);
