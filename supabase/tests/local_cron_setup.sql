-- Stack locale : indique à pg_cron où joindre le runtime des Edge Functions
-- (`supabase functions serve` doit tourner). À rejouer après un `supabase db reset`.
-- Lancer : docker exec -i supabase_db_eclaircie psql -U postgres -d postgres < supabase/tests/local_cron_setup.sql
select vault.create_secret('http://host.docker.internal:54321/functions/v1', 'pipeline_functions_url');
select jobname, schedule, active from cron.job order by jobname;
