-- Éclaircie — seconde tentative de révision quand seul le résumé dépasse la longueur.
insert into pipeline_config (key, value) values
  ('revise_length_retries', '1')
on conflict (key) do nothing;
