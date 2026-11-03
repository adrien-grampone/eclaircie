-- Éclaircie — illustrations à la main et back-office (décision du 2026-11-03 : pas d'API d'image).
-- 1. Palette « en mots » par thème, injectée dans le prompt de style que l'on copie dans l'app Gemini.
-- 2. Bucket public `illustrations` : <story_id>.webp pour les images faites, fallback/<theme_id>/… de secours.
-- 3. Alerte `image_missing` dans pipeline_alerts quand une story programmée à J-2 n'a pas d'image.
-- 4. Validation du texte par le back-office : stories.approved_at.

alter table themes add column if not exists palette_words text;
update themes set palette_words = v.words from (values
  ('planete',          'peach sky fading to cream, a warm orange sun, rolling fields in sage green, mid green and deep forest green'),
  ('animaux',          'warm apricot sky fading to pale cream, a soft pale-yellow sun, rolling hills in sand, caramel and deep brown'),
  ('science',          'lavender sky fading to pale lilac, a soft amber sun, layered ground in light violet, mid purple and deep indigo'),
  ('sante',            'soft rose sky fading to pale blush, a warm cream sun, rolling hills in dusty pink, terracotta and deep burgundy'),
  ('solidarite',       'golden yellow sky fading to pale cream, a warm orange sun, rolling hills in soft yellow, ochre and deep olive brown'),
  ('inventions',       'pale sky blue fading to misty white, a soft amber sun, rolling hills in powder blue, steel blue and deep navy'),
  ('culture',          'soft mauve sky fading to pale pink, a warm orange sun, rolling hills in lilac, plum and deep violet'),
  ('pres-de-chez-moi', 'soft grey sky fading to pale mist, a white sun, rolling hills in light grey, mid grey and deep slate')
) as v(id, words) where themes.id = v.id;
alter table themes alter column palette_words set not null;

alter table stories add column if not exists approved_at timestamptz;

-- Bucket public en lecture (l'app affiche les images par URL publique) ; écriture service_role seulement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('illustrations', 'illustrations', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = true;

drop policy if exists "illustrations: lecture publique" on storage.objects;
create policy "illustrations: lecture publique"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'illustrations');

alter table pipeline_alerts drop constraint if exists pipeline_alerts_kind_check;
alter table pipeline_alerts add constraint pipeline_alerts_kind_check
  check (kind in ('cron_failed', 'function_error', 'step_error', 'step_stale', 'stock_low', 'image_missing'));

-- Une story programmée dans moins de N jours sans image déclenche image_missing (vérifié par schedule, 4 h).
insert into pipeline_config (key, value) values ('image_alert_days', '2')
on conflict (key) do nothing;

-- Back-office, page santé : file d'articles par statut (service_role seulement, RLS de raw_articles).
create or replace view raw_articles_status_counts with (security_invoker = true) as
  select status, count(*)::int as count from raw_articles group by status;
