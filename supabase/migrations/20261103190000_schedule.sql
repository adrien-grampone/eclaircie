-- Éclaircie — schedule (§4.9) : chaque jour à 4 h UTC.
-- Tant qu'illustrate et review n'existent pas, schedule programme les stories `verified`.
-- On resserrera sur `approved` en changeant cette seule valeur.
insert into pipeline_config (key, value) values
  ('schedule_input_status', '"verified"')
on conflict (key) do nothing;

select cron.schedule('pipeline-schedule', '0 4 * * *', $$select invoke_pipeline_function('schedule')$$);
