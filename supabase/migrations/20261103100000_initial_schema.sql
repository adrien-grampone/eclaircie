-- Éclaircie — schéma initial (spec §6)
-- Tout le pipeline vit côté service_role ; l'app ne lit que themes et les stories publiées.

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Référentiel
-- ---------------------------------------------------------------------------

create table themes (
  id          text primary key,              -- 'planete', 'science'…
  label       text not null,
  position    int  not null,
  palette     jsonb not null,                -- 6 couleurs, cf. §5
  active      boolean not null default true,
  coming_soon boolean not null default false
);

create table sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  feed_url    text not null unique,
  trust_level int  not null check (trust_level between 1 and 3),
  active      boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Pipeline
-- ---------------------------------------------------------------------------

create table raw_articles (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid references sources(id),
  url           text not null unique,
  title         text not null,
  snippet       text,
  published_at  timestamptz,
  fetched_at    timestamptz not null default now(),
  status        text not null default 'new'
    check (status in ('new', 'triaged', 'rejected', 'extracted', 'drafted', 'failed')),
  reject_reason text,
  triage        jsonb,
  full_text     text
);

create index raw_articles_status_idx on raw_articles (status, fetched_at);

create table stories (
  id             uuid primary key default gen_random_uuid(),
  raw_article_id uuid not null references raw_articles(id),
  theme_id       text not null references themes(id),
  title_main     text not null,
  title_accent   text,
  summary        text not null,
  why_good       text,
  claims         jsonb not null,
  scene          text,
  source_name    text not null,
  source_url     text not null,
  source_date    date,
  score          real not null,
  evergreen      boolean not null default false,
  embedding      vector(1024),
  image_path     text,                       -- bucket 'illustrations'
  status         text not null default 'drafted'
    check (status in ('drafted', 'verified', 'illustrated', 'approved',
                      'scheduled', 'rejected', 'retracted')),
  reject_reason  text,
  publish_date   date,
  created_at     timestamptz not null default now(),
  unique (theme_id, publish_date)
);

create index stories_theme_status_idx on stories (theme_id, status);
create index stories_publish_date_idx on stories (publish_date) where publish_date is not null;
-- Dedup §4.6 : recherche par similarité cosinus sur les 90 derniers jours d'un thème.
create index stories_embedding_idx on stories
  using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Utilisateurs (auth anonyme Supabase)
-- ---------------------------------------------------------------------------

create table profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  themes       text[] not null,
  notify_time  time not null default '08:00',
  timezone     text not null default 'Europe/Paris',
  created_at   timestamptz not null default now()
);

create table saved_stories (
  user_id  uuid references auth.users(id) on delete cascade,
  story_id uuid references stories(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create table error_reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  story_id   uuid references stories(id),
  message    text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Exploitation
-- ---------------------------------------------------------------------------

create table pipeline_config (
  key   text primary key,
  value jsonb not null
);

create table pipeline_runs (
  id         bigserial primary key,
  step       text not null,
  started_at timestamptz not null default now(),
  processed  int,
  succeeded  int,
  failed     int,
  error      text
);
