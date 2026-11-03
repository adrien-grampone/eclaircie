-- Rapport d'un cycle collect → triage → extract sur la stack locale.
-- Lancer : docker exec -i supabase_db_eclaircie psql -U postgres -d postgres < supabase/tests/report.sql
\pset footer off

\echo '=== 1. Articles collectés par source ==='
select s.name as source, s.trust_level as trust, count(a.id) as collectes,
       count(a.id) filter (where a.status = 'triaged' or a.status = 'extracted' or (a.status = 'failed' and a.reject_reason not in ('parse_error'))) as acceptes_triage,
       count(a.id) filter (where a.status = 'rejected') as rejetes_triage,
       count(a.id) filter (where a.status = 'new') as en_attente,
       s.last_error
from sources s left join raw_articles a on a.source_id = s.id
group by s.id order by collectes desc, s.name;

\echo '=== 2. Triage : acceptés / rejetés ==='
select
  count(*) filter (where status in ('triaged','extracted') or (status = 'failed' and reject_reason <> 'parse_error')) as acceptes,
  count(*) filter (where status = 'rejected') as rejetes,
  count(*) filter (where status = 'failed' and reject_reason = 'parse_error') as parse_error,
  count(*) filter (where status = 'new') as en_attente,
  count(*) as total
from raw_articles;

\echo '=== 3. Les 5 raisons de rejet les plus fréquentes ==='
select reject_reason as raison, count(*) as n, round(100.0 * count(*) / nullif(sum(count(*)) over (), 0), 1) as pct
from raw_articles where status = 'rejected'
group by reject_reason order by n desc limit 5;

\echo '=== 4. Extraction ==='
select
  count(*) filter (where status = 'extracted') as extraits,
  count(*) filter (where status = 'failed' and reject_reason = 'no_fulltext') as no_fulltext,
  count(*) filter (where status = 'failed' and reject_reason like 'fetch_error%') as fetch_error,
  count(*) filter (where status = 'triaged') as en_attente_extraction,
  round(avg(length(full_text)) filter (where status = 'extracted')) as longueur_moyenne
from raw_articles;

\echo '=== 5. Dix articles acceptés au triage (meilleurs scores) ==='
select left(a.title, 70) as titre, s.name as source, a.triage->>'themes' as themes,
       round((a.triage->>'score')::numeric, 2) as score, a.status
from raw_articles a join sources s on s.id = a.source_id
where a.status in ('triaged', 'extracted') or (a.status = 'failed' and a.reject_reason <> 'parse_error')
order by (a.triage->>'score')::numeric desc limit 10;

\echo '=== 6. Budget journalier ==='
select step, sum(processed) as traites_aujourdhui, count(*) as invocations
from pipeline_runs where started_at >= date_trunc('day', now() at time zone 'utc')
group by step order by step;
