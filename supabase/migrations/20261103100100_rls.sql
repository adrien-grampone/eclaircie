-- Éclaircie — Row Level Security (spec §6)
--
-- Principe : RLS activée sur toutes les tables. Sans policy, une table n'est
-- accessible qu'au service_role (qui contourne la RLS). Les utilisateurs de
-- l'app sont authentifiés (auth anonyme Supabase => rôle `authenticated`).

alter table themes          enable row level security;
alter table sources         enable row level security;
alter table raw_articles    enable row level security;
alter table stories         enable row level security;
alter table profiles        enable row level security;
alter table saved_stories   enable row level security;
alter table error_reports   enable row level security;
alter table pipeline_config enable row level security;
alter table pipeline_runs   enable row level security;

-- Thèmes : lecture pour tout utilisateur authentifié (anonyme compris).
create policy "themes: lecture authentifiée"
  on themes for select
  to authenticated
  using (true);

-- Stories : seules les nouvelles programmées et déjà publiées sont visibles.
-- Une story `retracted` disparaît donc de l'app au prochain rafraîchissement.
create policy "stories: lecture des nouvelles publiées"
  on stories for select
  to authenticated
  using (status = 'scheduled' and publish_date <= current_date);

-- Profils : chacun ne voit et ne modifie que le sien.
create policy "profiles: lecture de son profil"
  on profiles for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "profiles: création de son profil"
  on profiles for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "profiles: mise à jour de son profil"
  on profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "profiles: suppression de son profil"
  on profiles for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Nouvelles gardées : idem, limitées à son propre user_id.
create policy "saved_stories: lecture des siennes"
  on saved_stories for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "saved_stories: ajout pour soi"
  on saved_stories for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "saved_stories: retrait des siennes"
  on saved_stories for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Signalements : insertion seulement, au nom de l'utilisateur connecté.
create policy "error_reports: insertion seulement"
  on error_reports for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- sources, raw_articles, pipeline_config, pipeline_runs : aucune policy,
-- donc service_role uniquement.
