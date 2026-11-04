-- Rapport du matin : une seule requête, lisible dans l'éditeur SQL du dashboard
-- ou via `supabase db query --linked --file supabase/tests/morning.sql`.
-- En local : docker exec -i supabase_db_eclaircie psql -U postgres -d postgres < supabase/tests/morning.sql
with today as (select (now() at time zone 'utc')::date as d),
runs as (
  select 1 as sec, 'runs 24h' as section, step as item,
         format('%s runs, %s traités, %s ok, %s rejetés, %s en erreur, dernier %s',
                count(*), coalesce(sum(processed), 0), coalesce(sum(succeeded), 0), coalesce(sum(failed), 0),
                count(*) filter (where error is not null), to_char(max(started_at), 'DD/MM HH24:MI'))::text as value
  from pipeline_runs where started_at > now() - interval '24 hours' group by step
),
run_errors as (
  select 2, 'erreurs 24h', step, to_char(started_at, 'DD/MM HH24:MI') || ' ' || left(error, 160)
  from pipeline_runs where error is not null and started_at > now() - interval '24 hours'
  order by started_at desc limit 10
),
cron_state as (
  select 3, 'cron', j.jobname,
         format('%s — dernier run %s %s', case when j.active then 'actif' else 'INACTIF' end,
                to_char(d.start_time, 'DD/MM HH24:MI'), coalesce(d.status, 'jamais'))
  from cron.job j
  left join lateral (
    select status, start_time from cron.job_run_details where jobid = j.jobid order by start_time desc limit 1
  ) d on true
  where j.jobname like 'pipeline-%'
),
alerts as (
  select 4, 'alertes ouvertes', kind || coalesce(' ' || theme_id, ''),
         to_char(created_at, 'DD/MM HH24:MI') || ' ' || message
  from pipeline_alerts where resolved_at is null
),
raw as (
  select 5, 'articles', status, count(*)::text from raw_articles group by status
),
queue as (
  select 6, 'file de triage', 'new en attente',
         format('%s articles, le plus vieux publié il y a %s j (%s)',
                count(*), coalesce(extract(day from now() - min(published_at))::int, 0),
                coalesce(to_char(min(published_at), 'DD/MM'), 'sans date'))
  from raw_articles where status = 'new'
),
triage_rate as (
  select 7, 'triage 24h par source', s.name,
         format('%s triés, %s acceptés (%s %%)', count(*),
                count(*) filter (where a.status in ('triaged', 'extracted', 'drafted') or (a.status = 'failed' and a.reject_reason <> 'parse_error')),
                round(100.0 * count(*) filter (where a.status in ('triaged', 'extracted', 'drafted') or (a.status = 'failed' and a.reject_reason <> 'parse_error')) / count(*)))
  from raw_articles a join sources s on s.id = a.source_id
  where a.triaged_at > now() - interval '24 hours'
  group by s.name order by count(*) desc
),
sources_review as (
  select 7, 'sources à revoir (≥ seuil triés sur la fenêtre, 0 accepté — décision humaine)', y.source_name,
         format('%s triés, 0 accepté sur %s j%s', y.triaged,
                (select (value::text)::int from pipeline_config where key = 'triage_source_window_days'),
                case when y.active then '' else ' (déjà inactive)' end)
  from source_yield y
  where y.accepted = 0 and y.triaged >= (select (value::text)::int from pipeline_config where key = 'triage_source_review_min')
  order by y.triaged desc
),
stories_by_theme as (
  select 8, 'stories par thème', t.id,
         format('%s drafted, %s to_revise, %s verified, %s scheduled, %s rejected',
                count(s.id) filter (where s.status = 'drafted'), count(s.id) filter (where s.status = 'to_revise'),
                count(s.id) filter (where s.status = 'verified'), count(s.id) filter (where s.status = 'scheduled'),
                count(s.id) filter (where s.status = 'rejected'))
  from themes t left join stories s on s.theme_id = t.id
  where t.active and not t.coming_soon group by t.id, t.position order by t.position
),
stock as (
  select 9, 'stock programmé', t.id,
         format('%s jour(s) à partir d''aujourd''hui, prochain trou %s',
                count(s.id) filter (where s.publish_date >= today.d),
                coalesce((select min(g::date)::text from generate_series(today.d, today.d + 13, interval '1 day') g
                          where not exists (select 1 from stories x where x.theme_id = t.id and x.status = 'scheduled' and x.publish_date = g::date)),
                         'aucun sur 14 jours'))
  from themes t cross join today
  left join stories s on s.theme_id = t.id and s.status = 'scheduled'
  where t.active and not t.coming_soon group by t.id, t.position, today.d order by t.position
),
images as (
  select 10, 'images à faire', 'programmées sans image',
         format('%s sur 14 jours, prochaine échéance %s, %s alerte(s) J-2 ouverte(s)',
                count(*), coalesce(min(s.publish_date)::text, 'aucune'),
                (select count(*) from pipeline_alerts a where a.kind = 'image_missing' and a.resolved_at is null))
  from stories s cross join today
  where s.status = 'scheduled' and s.image_path is null and s.publish_date between today.d and today.d + 13
),
next_days as (
  select 11, 'à paraître', s.publish_date::text || ' ' || s.theme_id,
         s.title_main || coalesce(' ' || s.title_accent, '') || ' (' || s.source_name || ')'
  from stories s cross join today
  where s.status = 'scheduled' and s.publish_date between today.d and today.d + 2
  order by s.publish_date, s.theme_id
)
select section, item, value from (
  select * from runs union all select * from run_errors union all select * from cron_state
  union all select * from alerts union all select * from raw union all select * from queue
  union all select * from triage_rate union all select * from sources_review union all select * from stories_by_theme
  union all select * from stock union all select * from images union all select * from next_days
) r(sec, section, item, value)
order by sec, item;
