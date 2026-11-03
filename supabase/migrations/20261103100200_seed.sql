-- Éclaircie — seed des 7 thèmes (palettes §5) et des seuils du pipeline (§4).
-- Idempotent : rejouable sans doublon.

insert into themes (id, label, position, palette) values
  ('planete', 'Planète', 1, '{
    "sky_top": "#EFB98A", "sky_bottom": "#F4E5CC", "sun": "#EE8F48",
    "hill_light": "#B9D3B5", "hill_mid": "#6FA48A", "accent": "#2F6B5E"
  }'),
  ('animaux', 'Animaux', 2, '{
    "sky_top": "#F2C08E", "sky_bottom": "#F8E6CC", "sun": "#FFF1DA",
    "hill_light": "#E3B07A", "hill_mid": "#C08040", "accent": "#7A4E14"
  }'),
  ('science', 'Science', 3, '{
    "sky_top": "#B9B2EC", "sky_bottom": "#ECE6F6", "sun": "#F6B877",
    "hill_light": "#B3ADE6", "hill_mid": "#7F77CF", "accent": "#3E3880"
  }'),
  ('sante', 'Santé', 4, '{
    "sky_top": "#F1B9B0", "sky_bottom": "#FAE6DF", "sun": "#FFF2E4",
    "hill_light": "#EDB0A6", "hill_mid": "#D27A70", "accent": "#8E3535"
  }'),
  ('solidarite', 'Solidarité', 5, '{
    "sky_top": "#F3CF73", "sky_bottom": "#FBEFCB", "sun": "#EB8440",
    "hill_light": "#EDCF77", "hill_mid": "#D2A22B", "accent": "#6B4F00"
  }'),
  ('inventions', 'Inventions', 6, '{
    "sky_top": "#A9CBE6", "sky_bottom": "#E6F0F7", "sun": "#F6B877",
    "hill_light": "#B5D0E6", "hill_mid": "#6E9CC4", "accent": "#24506F"
  }'),
  ('culture', 'Culture', 7, '{
    "sky_top": "#DDB8E0", "sky_bottom": "#F5E6F3", "sun": "#F09A4E",
    "hill_light": "#D9B5DB", "hill_mid": "#AD70AF", "accent": "#5E2D60"
  }')
on conflict (id) do update
  set label = excluded.label,
      position = excluded.position,
      palette = excluded.palette;

-- « Près de chez moi » : affiché « bientôt » dans l'onboarding, sans contenu.
insert into themes (id, label, position, palette, active, coming_soon) values
  ('pres-de-chez-moi', 'Près de chez moi', 8, '{
    "sky_top": "#CFCFCF", "sky_bottom": "#EFEFEF", "sun": "#FFFFFF",
    "hill_light": "#D9D9D9", "hill_mid": "#A6A6A6", "accent": "#5C5C5C"
  }', false, true)
on conflict (id) do nothing;

-- Seuils du pipeline. Toutes les valeurs numériques utilisées par
-- _shared/pipeline viennent d'ici : rien n'est écrit en dur dans le code.
insert into pipeline_config (key, value) values
  ('collect_max_age_days',    '7'),                                                    -- §4.1
  ('triage_weights',         '{"positivity":0.35,"significance":0.35,"trust":0.30}'), -- §4.2
  ('triage_min_score',       '0.65'),                                                  -- §4.2
  ('extract_min_chars',      '800'),                                                   -- §4.3
  ('summary_max_chars',      '350'),                                                   -- §4.4
  ('dedup_similarity',       '0.88'),                                                  -- §4.6
  ('dedup_window_days',      '90'),                                                    -- §4.6
  ('auto_approve_min_score', '0.8'),                                                   -- §4.8
  ('auto_approve_min_trust', '3'),                                                     -- §4.8
  ('schedule_horizon_days',  '14'),                                                    -- §4.9
  ('schedule_recent_days',   '10'),                                                    -- §4.9
  ('schedule_max_age_days',  '30'),                                                    -- §4.9
  ('stock_alert_days',       '7')                                                      -- §4.9
on conflict (key) do nothing;
