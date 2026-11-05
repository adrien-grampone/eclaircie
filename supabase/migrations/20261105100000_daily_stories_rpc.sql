-- Éclaircie — RPC publique « nouvelles du jour » pour le widget iOS.
--
-- Le widget se rafraîchit le matin sans session (clé anon seule) ; les policies RLS de `stories`
-- ne s'ouvrent qu'au rôle `authenticated`. Cette fonction est la seule porte publique en lecture :
--   - uniquement les nouvelles programmées (`scheduled`), validées (`approved_at` non nul),
--     jamais rétractées, datées d'AUJOURD'HUI en Europe/Paris (pas UTC) ;
--   - limitée aux thèmes demandés, parmi les thèmes existants et actifs, 10 au plus ;
--   - aucune colonne interne : titre, thème (id, libellé, palette), source affichée, id, image_path.
-- STABLE, sans effet de bord ; security definer avec search_path fixé.

create or replace function public.daily_stories(theme_ids text[])
returns table (
  id uuid,
  theme_id text,
  theme_label text,
  palette jsonb,
  title_main text,
  title_accent text,
  source_name text,
  image_path text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select s.id, s.theme_id, t.label, t.palette, s.title_main, s.title_accent, s.source_name, s.image_path
  from public.stories s
  join public.themes t on t.id = s.theme_id and t.active
  where s.status = 'scheduled'
    and s.status <> 'retracted'
    and s.approved_at is not null
    and s.publish_date = (now() at time zone 'Europe/Paris')::date
    and s.theme_id = any ((coalesce(theme_ids, '{}'))[1:10])
  order by t.position, s.theme_id;
$$;

comment on function public.daily_stories(text[]) is
  'Widget iOS : nouvelles programmées + validées du jour (Europe/Paris) pour les thèmes demandés (10 max). Lecture seule, colonnes publiques uniquement.';

revoke all on function public.daily_stories(text[]) from public;
grant execute on function public.daily_stories(text[]) to anon, authenticated;
