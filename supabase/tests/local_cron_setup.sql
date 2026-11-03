-- Stack locale : indique à pg_cron où joindre le runtime des Edge Functions
-- (`supabase functions serve` doit tourner). À rejouer après un `supabase db reset`.
-- Lancer : docker exec -i supabase_db_eclaircie psql -U postgres -d postgres < supabase/tests/local_cron_setup.sql
select vault.create_secret('http://host.docker.internal:54321/functions/v1', 'pipeline_functions_url');

-- En local, les jobs restent DÉSACTIVÉS par défaut : chaque tick consommerait du budget API.
-- Les étapes se lancent à la main (curl -X POST http://127.0.0.1:54321/functions/v1/<étape>).
-- Pour les réactiver ponctuellement : select cron.alter_job(jobid, active := true) from cron.job where jobname like 'pipeline-%';
select cron.alter_job(jobid, active := false) from cron.job where jobname like 'pipeline-%';
select jobname, schedule, active from cron.job order by jobname;
