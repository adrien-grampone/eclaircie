-- Rapport draft → verify : chaque story avec titre en deux parties, résumé, claims/evidence, verdict.
-- Lancer : docker exec -i supabase_db_eclaircie psql -U postgres -d postgres < supabase/tests/stories_report.sql
\pset footer off
\pset format unaligned
\pset fieldsep ' '
\pset tuples_only on
select
  E'\n==== ' || row_number() over (order by s.created_at) || '. ' || upper(s.status) || ' — ' || s.theme_id || ' — ' || s.source_name || E'\n'
  || 'TITRE    : ' || s.title_main || ' / ' || coalesce(s.title_accent, '') || E'\n'
  || 'RÉSUMÉ   : ' || s.summary || ' (' || length(s.summary) || ' car.)' || E'\n'
  || (select string_agg('CLAIM    : ' || (c->>'claim') || E'\n  EVIDENCE : « ' || (c->>'evidence') || ' »', E'\n') from jsonb_array_elements(s.claims) c) || E'\n'
  || 'VERDICT  : ' || s.status || coalesce(' — ' || s.reject_reason, '') || E'\n'
  || coalesce((select string_agg('PASSE ' || (e->>'pass') || ' → ' || (e->>'decision') || ' : ' || coalesce((select string_agg('[' || (p->>'type') || '] « ' || (p->>'passage') || ' » → ' || (p->>'correction'), ' ; ') from jsonb_array_elements(e->'verify'->'problems') p), 'aucun problème'), E'\n') from jsonb_array_elements(s.verify_log) e), 'PASSE    : aucune') || E'\n'
  || 'SOURCE   : ' || s.source_url
from stories s order by s.created_at;
