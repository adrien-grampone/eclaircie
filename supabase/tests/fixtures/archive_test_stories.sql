-- Stories de TEST pour capturer les Archives (deux validées, une retirée), dans des créneaux libres.
-- Lancer : supabase db query --linked --file supabase/tests/fixtures/archive_test_stories.sql
-- Retirer ensuite : supabase db query --linked "delete from stories where id::text like 'eeeeeeee-%'"
insert into stories (id, raw_article_id, theme_id, title_main, title_accent, summary, claims, source_name, source_url, source_date, score, status, publish_date, approved_at)
select v.id::uuid, (select id from raw_articles limit 1), v.theme, v.main, v.accent, 'Résumé de test.', '[]'::jsonb, v.src,
       'https://test.invalid/' || v.id, v.day::date - 30, 0.9, v.status, v.day::date, case when v.status = 'scheduled' then now() else null end
from (values
  ('eeeeeeee-0000-0000-0000-000000000001', 'planete', 'Le trou dans la couche d''ozone', 'continue de se refermer.', 'ONU / OMM', '2026-11-03', 'scheduled'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'animaux', 'Le lynx ibérique', 'sort de la liste des espèces en danger.', 'UICN', '2026-11-02', 'scheduled'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'science', 'Nouvelle retirée', '', 'test', '2026-11-01', 'retracted')
) as v(id, theme, main, accent, src, day, status)
where not exists (select 1 from stories s where s.theme_id = v.theme and s.publish_date = v.day::date)
returning theme_id, publish_date, status;
