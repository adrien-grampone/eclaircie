-- §4.4 — longueurs maximales du titre en deux parties, pour tenir en 3 lignes dans l'app.
-- Un dépassement seul relance le rédacteur avec la consigne de raccourcir (revise_length_retries).
insert into pipeline_config (key, value) values
  ('title_main_max_chars',   '32'),
  ('title_accent_max_chars', '28')
on conflict (key) do nothing;
