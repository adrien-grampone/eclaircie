-- Contrôle de la RPC daily_stories (widget) sur la stack locale, migration appliquée.
-- Tout est rejoué dans une transaction annulée.
-- Lancer : docker exec -i supabase_db_eclaircie psql -U postgres -d postgres < supabase/tests/daily_stories_check.sql
-- Attendu : chaque ligne « attendu N » affiche n = N et ok = t.

\set ON_ERROR_STOP on
\pset footer off
begin;

-- === Données de test (en tant que postgres, hors RLS) : aujourd'hui = Europe/Paris ===
-- Un seul créneau par thème et par jour : on libère ceux des thèmes de test (transaction annulée à la fin).
delete from stories where theme_id in ('planete','science','animaux','culture','sante')
  and publish_date between (now() at time zone 'Europe/Paris')::date - 1 and (now() at time zone 'Europe/Paris')::date + 1;
insert into sources (id, name, feed_url, trust_level) values ('aaaaaaaa-0000-0000-0000-000000000009','ONU','https://x/feed',3);
insert into raw_articles (id, source_id, url, title, status) values
 ('bbbbbbbb-0000-0000-0000-000000000009','aaaaaaaa-0000-0000-0000-000000000009','https://x/9','t9','drafted');
insert into stories (id, raw_article_id, theme_id, title_main, title_accent, summary, claims, source_name, source_url, score, status, publish_date, approved_at, image_path) values
 ('dddddddd-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000009','planete','Planète du jour','accent.','s','[]','ONU','https://x/1',0.9,'scheduled',(now() at time zone 'Europe/Paris')::date, now(),'p.webp'),
 ('dddddddd-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000009','science','Science du jour',null,'s','[]','ONU','https://x/2',0.9,'scheduled',(now() at time zone 'Europe/Paris')::date, now(),null),
 ('dddddddd-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000009','animaux','Animaux NON validée',null,'s','[]','ONU','https://x/3',0.9,'scheduled',(now() at time zone 'Europe/Paris')::date, null,null),
 ('dddddddd-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000009','culture','Culture rétractée',null,'s','[]','ONU','https://x/4',0.9,'retracted',(now() at time zone 'Europe/Paris')::date, now(),null),
 ('dddddddd-0000-0000-0000-000000000005','bbbbbbbb-0000-0000-0000-000000000009','sante','Santé d''hier',null,'s','[]','ONU','https://x/5',0.9,'scheduled',(now() at time zone 'Europe/Paris')::date - 1, now(),null),
 ('dddddddd-0000-0000-0000-000000000006','bbbbbbbb-0000-0000-0000-000000000009','sante','Santé de demain',null,'s','[]','ONU','https://x/6',0.9,'scheduled',(now() at time zone 'Europe/Paris')::date + 1, now(),null);

-- === Signature : aucune colonne interne ===
select 'rpc: colonnes exposées' as check, 1 as n,
  (select proargnames from pg_proc where proname = 'daily_stories' and pronamespace = 'public'::regnamespace)
    = array['theme_ids','id','theme_id','theme_label','palette','title_main','title_accent','source_name','image_path'] as ok
union all select 'rpc: STABLE + security definer', 1,
  (select provolatile = 's' and prosecdef from pg_proc where proname = 'daily_stories' and pronamespace = 'public'::regnamespace)
union all select 'rpc: search_path fixé', 1,
  (select proconfig @> array['search_path=pg_catalog, public'] from pg_proc where proname = 'daily_stories' and pronamespace = 'public'::regnamespace)
union all select 'rpc: public sans EXECUTE', 1, not has_function_privilege('public', 'public.daily_stories(text[])', 'execute')
union all select 'rpc: anon et authenticated avec EXECUTE', 1,
  has_function_privilege('anon', 'public.daily_stories(text[])', 'execute') and has_function_privilege('authenticated', 'public.daily_stories(text[])', 'execute');

-- === Rôle anon (clé anon, sans session) ===
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select 'anon: stories en lecture directe (attendu 0)' as check, count(*) as n, count(*) = 0 as ok from stories
union all select 'anon: themes en lecture directe (attendu 0)', count(*), count(*) = 0 from themes
union all select 'anon: rpc tous thèmes (attendu 2 : planète, science)', count(*), bool_and(title_main in ('Planète du jour','Science du jour'))
  from daily_stories(array['planete','science','animaux','culture','sante'])
union all select 'anon: rpc exclut la non validée (attendu 0)', count(*), count(*) = 0 from daily_stories(array['animaux'])
union all select 'anon: rpc exclut la rétractée (attendu 0)', count(*), count(*) = 0 from daily_stories(array['culture'])
union all select 'anon: rpc exclut hier et demain (attendu 0)', count(*), count(*) = 0 from daily_stories(array['sante'])
union all select 'anon: rpc ignore un thème inconnu (attendu 1)', count(*), bool_and(theme_id = 'planete') from daily_stories(array['inconnu','planete'])
union all select 'anon: rpc coupe à 10 thèmes (attendu 0 : planete en 11e)', count(*), count(*) = 0
  from daily_stories(array['x1','x2','x3','x4','x5','x6','x7','x8','x9','x10','planete'])
union all select 'anon: rpc null (attendu 0)', count(*), count(*) = 0 from daily_stories(null)
union all select 'anon: rpc renvoie libellé, palette, image_path (attendu 1)', count(*),
  bool_and(theme_label = 'Planète' and palette ? 'accent' and image_path = 'p.webp' and title_accent = 'accent.') from daily_stories(array['planete']);

-- === Rôle authenticated : même réponse ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":true}';
select 'auth: rpc (attendu 2)' as check, count(*) as n, count(*) = 2 as ok from daily_stories(array['planete','science','animaux','culture','sante']);

rollback;
