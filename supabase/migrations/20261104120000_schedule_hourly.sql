-- Éclaircie — schedule toutes les heures (à h+20) au lieu d'une fois par nuit :
-- une story validée dans le back-office est programmée dans l'heure, sans attendre le lendemain.
-- Le job est idempotent : il ne touche qu'aux jours libres d'aujourd'hui à l'horizon, jamais au passé,
-- et ne prend que des stories sans publish_date (une story programmée ne l'est jamais deux fois).
select cron.unschedule('pipeline-schedule');
select cron.schedule('pipeline-schedule', '20 * * * *', $$select invoke_pipeline_function('schedule')$$);
