-- Contrôle RLS et seed sur la stack locale. Tout est rejoué dans une transaction annulée.
-- Lancer : docker exec -i supabase_db_eclaircie psql -U postgres -d postgres < supabase/tests/rls_check.sql
-- Attendu : les compteurs « attendu N » correspondent, les écritures interdites donnent ERROR ou 0 ligne.

\set ON_ERROR_STOP on
\pset footer off
begin;

-- === Seed ===
select 'themes' as check, count(*) as n, bool_and(palette ?& array['sky_top','sky_bottom','sun','hill_light','hill_mid','accent']) as palettes_ok from themes
union all select 'themes actifs', count(*), null from themes where active
union all select 'config', count(*), null from pipeline_config;

-- === Données de test (en tant que postgres, hors RLS) ===
insert into auth.users (id, instance_id, aud, role, email, is_anonymous)
values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated',null,true),
       ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated',null,true);
insert into sources (id, name, feed_url, trust_level) values ('aaaaaaaa-0000-0000-0000-000000000001','ONU','https://x/feed',3);
insert into raw_articles (id, source_id, url, title, status) values
 ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','https://x/1','t1','drafted');
insert into stories (id, raw_article_id, theme_id, title_main, summary, claims, source_name, source_url, score, status, publish_date, approved_at) values
 ('cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','planete','Publiée hier','s','[]','ONU','https://x/1',0.9,'scheduled',current_date - 1, now()),
 ('cccccccc-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001','planete','Publiée aujourd''hui','s','[]','ONU','https://x/1',0.9,'scheduled',current_date, now()),
 ('cccccccc-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000001','planete','Demain','s','[]','ONU','https://x/1',0.9,'scheduled',current_date + 1, now()),
 ('cccccccc-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000001','science','Approuvée non programmée','s','[]','ONU','https://x/1',0.9,'approved',null, now()),
 ('cccccccc-0000-0000-0000-000000000005','bbbbbbbb-0000-0000-0000-000000000001','science','Retirée','s','[]','ONU','https://x/1',0.9,'retracted',current_date - 2, now()),
 ('cccccccc-0000-0000-0000-000000000006','bbbbbbbb-0000-0000-0000-000000000001','science','Programmée NON validée','s','[]','ONU','https://x/1',0.9,'scheduled',current_date, null);
insert into profiles (user_id, themes) values ('11111111-1111-1111-1111-111111111111', '{planete}'), ('22222222-2222-2222-2222-222222222222', '{science}');
insert into saved_stories (user_id, story_id) values ('11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001'), ('22222222-2222-2222-2222-222222222222','cccccccc-0000-0000-0000-000000000001');

-- === Utilisateur authentifié n°1 ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":true}';

select 'auth: themes visibles' as check, count(*) as n, null::boolean from themes
union all select 'auth: stories visibles (attendu 3 : hier, aujourd''hui, retirée)', count(*), null from stories
union all select 'auth: stories = publiées ET (validées ou retirées)', count(*), bool_and(publish_date<=current_date and ((status='scheduled' and approved_at is not null) or status='retracted')) from stories
union all select 'auth: story retirée visible (attendu 1)', count(*), null from stories where status = 'retracted'
union all select 'auth: story programmée non validée invisible (attendu 0)', count(*), null from stories where id = 'cccccccc-0000-0000-0000-000000000006'
union all select 'auth: profiles visibles (attendu 1, le sien)', count(*), bool_and(user_id = auth.uid()) from profiles
union all select 'auth: saved_stories visibles (attendu 1)', count(*), bool_and(user_id = auth.uid()) from saved_stories
union all select 'auth: sources (attendu 0)', count(*), null from sources
union all select 'auth: raw_articles (attendu 0)', count(*), null from raw_articles
union all select 'auth: pipeline_config (attendu 0)', count(*), null from pipeline_config
union all select 'auth: pipeline_runs (attendu 0)', count(*), null from pipeline_runs
union all select 'auth: error_reports lecture (attendu 0)', count(*), null from error_reports;

-- écritures autorisées
update profiles set notify_time = '07:30' where user_id = auth.uid();
insert into saved_stories (user_id, story_id) values (auth.uid(), 'cccccccc-0000-0000-0000-000000000002');
insert into error_reports (user_id, story_id, message) values (auth.uid(), 'cccccccc-0000-0000-0000-000000000002', 'coquille');
select 'auth: écritures propres OK' as check, 1 as n, null::boolean;

-- écritures interdites : chacune doit échouer (ERROR) ou n'affecter aucune ligne (0)
\set ON_ERROR_STOP off
savepoint s0;
update profiles set notify_time = '06:00' where user_id = '22222222-2222-2222-2222-222222222222';
rollback to savepoint s0;
savepoint s1;
insert into profiles (user_id, themes) values ('22222222-2222-2222-2222-222222222222', '{culture}');
rollback to savepoint s1;
savepoint s2;
insert into saved_stories (user_id, story_id) values ('22222222-2222-2222-2222-222222222222','cccccccc-0000-0000-0000-000000000002');
rollback to savepoint s2;
savepoint s3;
insert into error_reports (user_id, story_id, message) values ('22222222-2222-2222-2222-222222222222', 'cccccccc-0000-0000-0000-000000000002', 'usurpé');
rollback to savepoint s3;
savepoint s4;
update stories set title_main = 'hack' where id = 'cccccccc-0000-0000-0000-000000000002';
rollback to savepoint s4;
savepoint s5;
insert into pipeline_config values ('triage_min_score', '0');
rollback to savepoint s5;
savepoint s6;
delete from themes;
rollback to savepoint s6;
\set ON_ERROR_STOP on

-- === anon (non connecté) ===
reset role;
set local role anon;
select 'anon: themes (attendu 0)' as check, count(*) as n, null::boolean from themes
union all select 'anon: stories (attendu 0)', count(*), null from stories;

-- === contrôle final en postgres ===
reset role;
select 'final: profil n°2 intact' as check, count(*) as n, bool_and(notify_time = '08:00') from profiles where user_id = '22222222-2222-2222-2222-222222222222'
union all select 'final: profil n°1 modifié', count(*), bool_and(notify_time = '07:30') from profiles where user_id = '11111111-1111-1111-1111-111111111111'
union all select 'final: saved_stories total (attendu 3)', count(*), null from saved_stories
union all select 'final: error_reports (attendu 1, du n°1)', count(*), bool_and(user_id='11111111-1111-1111-1111-111111111111') from error_reports
union all select 'final: story non modifiée', count(*), bool_and(title_main <> 'hack') from stories
union all select 'final: triage_min_score intact', count(*), bool_and(value = '0.65') from pipeline_config where key='triage_min_score';

rollback;
