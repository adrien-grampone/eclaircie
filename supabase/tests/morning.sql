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
stories_by_theme as (
  select 6, 'stories par thème', t.id,
         format('%s drafted, %s to_revise, %s verified, %s scheduled, %s rejected',
                count(s.id) filter (where s.status = 'drafted'), count(s.id) filter (where s.status = 'to_revise'),
                count(s.id) filter (where s.status = 'verified'), count(s.id) filter (where s.status = 'scheduled'),
                count(s.id) filter (where s.status = 'rejected'))
  from themes t left join stories s on s.theme_id = t.id
  where t.active and not t.coming_soon group by t.id, t.position order by t.position
),
stock as (
  select 7, 'stock programmé', t.id,
         format('%s jour(s) à partir d''aujourd''hui, prochain trou %s',
                count(s.id) filter (where s.publish_date >= today.d),
                coalesce((select min(g::date)::text from generate_series(today.d, today.d + 13, interval '1 day') g
                          where not exists (select 1 from stories x where x.theme_id = t.id and x.status = 'scheduled' and x.publish_date = g::date)),
                         'aucun sur 14 jours'))
  from themes t cross join today
  left join stories s on s.theme_id = t.id and s.status = 'scheduled'
  where t.active and not t.coming_soon group by t.id, t.position, today.d order by t.position
),
next_days as (
  select 8, 'à paraître', s.publish_date::text || ' ' || s.theme_id,
         s.title_main || coalesce(' ' || s.title_accent, '') || ' (' || s.source_name || ')'
  from stories s cross join today
  where s.status = 'scheduled' and s.publish_date between today.d and today.d + 2
  order by s.publish_date, s.theme_id
)
select section, item, value from (
  select * from runs union all select * from run_errors union all select * from cron_state
  union all select * from alerts union all select * from raw union all select * from stories_by_theme
  union all select * from stock union all select * from next_days
) r(sec, section, item, value)
order by sec, item;
