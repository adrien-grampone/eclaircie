-- Contenu et mode perso (validés le 2026-11-09, reports/2026-11-09-contenu et reports/2026-11-09-mode-perso).
--
-- 1. Tri : score d'impact. Garder si éligible, 0,5 × impact + 0,5 × score historique ≥ triage_min_score (0,65)
--    et impact ≥ 0,5.
-- 2. Écriture : titre ~12 mots (40 + 40 caractères), résumé en trois temps (480 caractères).
-- 3. Thèmes suivis (followed_themes) : sources rattachées à des thèmes (sources.themes), thèmes non suivis ni
--    collectés ni programmés, et masqués dans l'app (themes.followed). Exception : une percée déjà utile à des gens.
-- 4. Mode de fonctionnement (run_mode) : `continuous` (comportement d'avant) ou `daily_window` (un passage par
--    jour vers 5 h). apply_run_mode() pose les horaires cron et les réglages du mode ; il est relancé dès que
--    run_mode, mode_settings ou followed_themes changent. Revenir en arrière :
--      update pipeline_config set value = '"continuous"' where key = 'run_mode';
--      update pipeline_config set value = 'null' where key = 'followed_themes';
-- 5. Données (une fois) : nouvelles sources, profils, reprise des anciennes nouvelles (réserve de départ).

-- ---------------------------------------------------------------------------
-- 1. et 2. Réglages du tri et de l'écriture
-- ---------------------------------------------------------------------------
insert into pipeline_config (key, value) values
  ('impact_weights',   '{"concrete": 0.25, "accomplished": 0.25, "closeness": 0.2, "magnitude": 0.15, "before_after": 0.15}'),
  ('impact_penalties', '{"non_human_study": 0.4, "preliminary": 0.5, "too_technical": 0.6}'),
  ('impact_mix',       '0.5'),
  ('impact_min',       '0.5')
on conflict (key) do update set value = excluded.value;

update pipeline_config set value = '480' where key = 'summary_max_chars';
update pipeline_config set value = '40'  where key = 'title_main_max_chars';
update pipeline_config set value = '40'  where key = 'title_accent_max_chars';

-- ---------------------------------------------------------------------------
-- 3. Thèmes suivis
-- ---------------------------------------------------------------------------
alter table themes add column if not exists followed boolean not null default true;
comment on column themes.followed is 'Thème suivi (pipeline_config.followed_themes, posé par apply_run_mode). Non suivi : ni collecté, ni programmé, ni proposé dans l''app.';

alter table sources add column if not exists themes text[];
comment on column sources.themes is 'Thèmes que la source alimente. Null : toujours collectée. Sinon collectée seulement si un de ces thèmes est suivi.';

insert into pipeline_config (key, value) values
  ('followed_themes',      '["planete", "animaux", "sante", "solidarite", "culture"]'),
  ('unfollowed_exception', '{"min_accomplished": 0.7, "fallback_theme": "sante"}')
on conflict (key) do update set value = excluded.value;

-- Rattachement des sources existantes : TOUS les thèmes suivis qu'une source peut alimenter (c'est le filtre
-- d'impact, au tri, qui écarte le labo et le prototype), plus science/inventions pour mémoire. Seule 01net
-- (high-tech grand public) n'alimente aucun thème suivi.
update sources s set themes = m.themes from (values
  ('01net', array['inventions']),
  ('Archaeology Magazine', array['culture', 'science']),
  ('Artnet News', array['culture']),
  ('BBC — Entertainment & Arts', array['culture']),
  ('Carbon Brief', array['planete']),
  ('CNRS — Le Journal', array['planete', 'animaux', 'sante', 'science']),
  ('Connaissance des Arts', array['culture']),
  ('ESA — Space News', array['planete', 'science']),
  ('France Culture', array['culture', 'solidarite', 'planete', 'sante']),
  ('Franceinfo — Culture', array['culture']),
  ('Futura', array['planete', 'animaux', 'sante', 'science', 'inventions']),
  ('Good News Network', array['solidarite', 'animaux', 'planete', 'sante', 'culture']),
  ('Google News — Animaux', array['animaux']),
  ('Google News — Archéologie', array['culture']),
  ('Google News — Culture', array['culture']),
  ('Google News — Inventé', array['sante', 'planete', 'inventions']),
  ('Google News — Inventions', array['sante', 'planete', 'inventions']),
  ('Google News — Langues', array['culture']),
  ('Google News — Musées', array['culture']),
  ('Google News — Patrimoine restauré', array['culture']),
  ('Google News — Planète', array['planete', 'animaux']),
  ('Google News — Première mondiale', array['sante', 'planete', 'inventions', 'science']),
  ('Google News — Prototype', array['sante', 'planete', 'inventions']),
  ('Google News — Restitutions', array['culture']),
  ('Google News — Santé', array['sante']),
  ('Google News — Science', array['sante', 'planete', 'animaux', 'science']),
  ('Google News — Solidarité', array['solidarite']),
  ('Hyperallergic', array['culture']),
  ('IEEE Spectrum', array['sante', 'planete', 'inventions']),
  ('Inserm — Salle de presse', array['sante', 'science']),
  ('Interesting Engineering', array['animaux', 'planete', 'sante', 'inventions', 'science']),
  ('Le Figaro — Culture', array['culture']),
  ('Le Journal des Arts', array['culture']),
  ('Le Monde — Culture', array['culture']),
  ('Le Monde — Pixels', array['culture', 'solidarite', 'inventions']),
  ('Le Monde — Planète', array['planete', 'animaux']),
  ('Le Monde — Santé', array['sante']),
  ('Le Monde — Sciences', array['sante', 'planete', 'animaux', 'science']),
  ('Medical Xpress', array['sante', 'science']),
  ('MIT News', array['sante', 'planete', 'science', 'inventions']),
  ('MIT Technology Review', array['sante', 'planete', 'inventions']),
  ('Mongabay', array['planete', 'animaux', 'solidarite']),
  ('NASA — Breaking News', array['planete', 'science']),
  ('Nature — News', array['sante', 'planete', 'animaux', 'science']),
  ('New Atlas', array['sante', 'planete', 'animaux', 'inventions']),
  ('OMS — Communiqués', array['sante']),
  ('ONU Info', array['solidarite', 'planete', 'sante', 'culture']),
  ('ONU Info — Climat', array['planete']),
  ('ONU Info — Culture et éducation', array['culture', 'solidarite']),
  ('ONU Info — Santé', array['sante']),
  ('Phys.org — Biology', array['animaux', 'planete', 'science']),
  ('Phys.org — Earth', array['planete', 'animaux', 'science']),
  ('Phys.org — Technology', array['planete', 'sante', 'inventions']),
  ('Positive News', array['solidarite', 'planete', 'animaux', 'sante', 'culture']),
  ('Reasons to be Cheerful', array['solidarite', 'planete', 'sante', 'culture']),
  ('Reporterre', array['planete', 'animaux', 'solidarite']),
  ('Science Daily', array['sante', 'planete', 'animaux', 'science']),
  ('Sciences et Avenir', array['animaux', 'sante', 'planete', 'science']),
  ('Smithsonian — Arts & Culture', array['culture']),
  ('Smithsonian — History', array['culture']),
  ('TechXplore', array['planete', 'sante', 'inventions']),
  ('Télérama', array['culture']),
  ('The Art Newspaper', array['culture']),
  ('The Guardian — Culture', array['culture']),
  ('The Guardian — Environment', array['planete', 'animaux']),
  ('The Guardian — Health', array['sante']),
  ('The Guardian — Science', array['sante', 'planete', 'animaux', 'science']),
  ('The Guardian — Wildlife', array['animaux', 'planete']),
  ('UNESCO — Patrimoine mondial', array['culture', 'planete']),
  ('Usbek & Rica', array['planete', 'solidarite', 'inventions'])
) as m(name, themes)
where s.name = m.name;

-- Nouvelles sources (flux vérifiés le 2026-11-09).
insert into sources (name, feed_url, trust_level, active, themes) values
  ('The Guardian — The Upside', 'https://www.theguardian.com/world/series/the-upside/rss', 2, true, array['solidarite', 'planete', 'sante', 'culture']),
  ('Rewilding Europe',          'https://rewildingeurope.com/feed/',                       2, true, array['animaux', 'planete']),
  ('BirdLife International',    'https://www.birdlife.org/feed/',                          2, true, array['animaux', 'planete'])
on conflict (feed_url) do update set themes = excluded.themes, active = true;

-- ---------------------------------------------------------------------------
-- 4. Mode de fonctionnement
-- ---------------------------------------------------------------------------
-- Horaires en UTC. daily_window : collecte à 4 h UTC (5 h à Paris l'hiver, 6 h l'été), tout est fini avant 6 h UTC.
-- Les nouvelles produites servent le LENDEMAIN (horizon de 2 jours) : celle du jour est prête depuis la veille.
insert into pipeline_config (key, value) values
  ('run_mode', '"daily_window"'),
  ('mode_settings', $json${
    "continuous": {
      "cron": {
        "collect": "5 */3 * * *", "triage": "*/10 * * * *", "extract": "3-59/10 * * * *", "dedup": "*/30 * * * *",
        "draft": "*/15 * * * *", "verify": "5-59/15 * * * *", "revise": "10-59/15 * * * *", "schedule": "20 * * * *"
      },
      "config": {
        "max_triage_per_day": 400, "max_draft_per_day": 40, "max_revise_per_day": 20,
        "schedule_horizon_days": 14, "schedule_strategy": "per_theme", "auto_approve_verified": false,
        "stale_after_hours": {"default": 3, "collect": 4}
      }
    },
    "daily_window": {
      "cron": {
        "collect": "0 4 * * *", "triage": "*/5 4 * * *", "extract": "2-59/5 4-5 * * *", "dedup": "*/10 4-5 * * *",
        "draft": "4-59/10 4-5 * * *", "verify": "7-59/10 4-5 * * *", "revise": "9-59/10 4-5 * * *", "schedule": "30,55 5 * * *"
      },
      "config": {
        "max_triage_per_day": 50, "max_draft_per_day": 4, "max_revise_per_day": 3,
        "schedule_horizon_days": 2, "schedule_strategy": "one_per_day", "auto_approve_verified": true,
        "stale_after_hours": {"default": 26, "collect": 26}
      }
    }
  }$json$),
  ('reserve_min', '3')
on conflict (key) do update set value = excluded.value;

create or replace function apply_run_mode()
returns void
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  v_mode text := (select value #>> '{}' from pipeline_config where key = 'run_mode');
  v_settings jsonb := (select value -> v_mode from pipeline_config where key = 'mode_settings');
  v_followed jsonb := (select value from pipeline_config where key = 'followed_themes');
  v_job bigint;
  r record;
begin
  if v_settings is null then
    raise exception 'apply_run_mode : mode « % » absent de mode_settings', v_mode;
  end if;

  for r in select key, value #>> '{}' as schedule from jsonb_each(v_settings -> 'cron') loop
    select jobid into v_job from cron.job where jobname = 'pipeline-' || r.key;
    if v_job is null then raise exception 'apply_run_mode : job cron pipeline-% introuvable', r.key; end if;
    perform cron.alter_job(job_id := v_job, schedule := r.schedule);
  end loop;

  insert into pipeline_config (key, value)
  select key, value from jsonb_each(v_settings -> 'config')
  on conflict (key) do update set value = excluded.value;

  update themes set followed = (v_followed is null or jsonb_typeof(v_followed) = 'null' or v_followed ? id);
end;
$$;

revoke execute on function apply_run_mode() from public, anon, authenticated;

create or replace function pipeline_config_apply_run_mode()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform apply_run_mode();
  return null;
end;
$$;

drop trigger if exists pipeline_config_run_mode on pipeline_config;
create trigger pipeline_config_run_mode
  after insert or update on pipeline_config
  for each row when (new.key in ('run_mode', 'mode_settings', 'followed_themes'))
  execute function pipeline_config_apply_run_mode();

select apply_run_mode();

-- Surveillance : le seuil « étape muette » suit le mode (3 h en continu, 26 h pour un passage par jour).
create or replace function pipeline_health_check()
returns void
language plpgsql
security definer
set search_path = public, cron, net
as $$
declare
  r record;
  stale_steps text[] := array['triage', 'extract', 'draft', 'verify', 'revise', 'dedup', 'collect'];
  v_step text;
  v_stale jsonb := coalesce((select value from pipeline_config where key = 'stale_after_hours'), '{"default": 3, "collect": 4}');
  v_hours int;
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

  -- 4. Étapes muettes : aucun run depuis stale_after_hours (par étape, sinon `default`) alors que leur job est actif.
  foreach v_step in array stale_steps loop
    v_hours := coalesce((v_stale ->> v_step)::int, (v_stale ->> 'default')::int, 3);
    if exists (select 1 from cron.job where jobname = 'pipeline-' || v_step and active)
       and not exists (
         select 1 from pipeline_runs
         where pipeline_runs.step = v_step and started_at > now() - make_interval(hours => v_hours)
       )
    then
      perform raise_pipeline_alert('step_stale', 'stale:' || v_step,
        format('aucun run de %s depuis plus de %s h', v_step, v_hours));
    else
      perform resolve_pipeline_alert('stale:' || v_step);
    end if;
  end loop;
end;
$$;

revoke execute on function pipeline_health_check() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Données, une fois
-- ---------------------------------------------------------------------------
-- Profils : seuls les thèmes suivis restent (ordre conservé) ; un profil vidé reçoit tous les thèmes suivis.
update profiles p set themes = coalesce(
  nullif(array(select t from unnest(p.themes) with ordinality as u(t, i) where t in (select id from themes where followed) order by i), '{}'),
  array(select id from themes where followed and active and not coming_soon order by position)
)
where exists (select 1 from unnest(p.themes) t where t not in (select id from themes where followed));

-- Réserve de départ : les anciennes nouvelles des thèmes suivis (vérifiées, ou programmées à partir d'aujourd'hui)
-- NE sont PAS validées telles quelles. Elles repassent par la nouvelle consigne : réécriture (`to_rework`, traitée
-- par revise avec son propre budget), puis double vérification comme un brouillon neuf. Seules celles qui passent
-- sont validées (auto_approve_verified) et rejoignent la réserve. L'ancien journal de vérification est conservé.
alter table stories drop constraint stories_status_check;
alter table stories add constraint stories_status_check
  check (status in ('drafted', 'to_revise', 'to_rework', 'verified', 'illustrated', 'approved',
                    'scheduled', 'rejected', 'retracted'));
alter table stories add column if not exists previous_verify_log jsonb;
comment on column stories.previous_verify_log is 'Journal de vérification d''avant une reprise (to_rework). Non nul : la nouvelle est reprise, budget max_rework_per_day.';

insert into pipeline_config (key, value) values ('max_rework_per_day', '50')
on conflict (key) do update set value = excluded.value;

update stories set status = 'to_rework', publish_date = null, approved_at = null,
  previous_verify_log = verify_log, verify_log = '[]'::jsonb, reject_reason = null
where theme_id in (select id from themes where followed)
  and (status = 'verified' or (status = 'scheduled' and publish_date >= current_date));

-- Articles en attente de tri venant de sources qui n'alimentent aucun thème suivi : écartés (le plafond de 50 tris
-- par jour ne doit pas s'y épuiser ; ils seraient de toute façon expirés sous 7 jours).
update raw_articles r set status = 'expired'
from sources s
where r.source_id = s.id and r.status = 'new'
  and s.themes is not null
  and not (s.themes && array(select id from themes where followed));
