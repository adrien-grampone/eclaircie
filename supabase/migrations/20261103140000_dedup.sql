-- Éclaircie — dedup (§4.6) : recherche des stories voisines par similarité cosinus,
-- côté SQL, pour un thème et une fenêtre donnés. La décision reste en code.

create or replace function match_stories(
  query_embedding  vector(1024),
  p_theme_id       text,
  p_since          timestamptz,
  p_min_similarity real,
  p_exclude        uuid
)
returns table (id uuid, similarity real, status text, trust_level int, created_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select s.id,
         (1 - (s.embedding <=> query_embedding))::real as similarity,
         s.status,
         coalesce(src.trust_level, 1) as trust_level,
         s.created_at
  from stories s
  join raw_articles a on a.id = s.raw_article_id
  left join sources src on src.id = a.source_id
  where s.theme_id = p_theme_id
    and s.embedding is not null
    and s.id <> p_exclude
    and s.created_at >= p_since
    and s.status in ('verified', 'illustrated', 'approved', 'scheduled')
    and 1 - (s.embedding <=> query_embedding) >= p_min_similarity
  order by s.embedding <=> query_embedding
  limit 5;
$$;

-- Réservée au pipeline (service_role) : rien pour l'app.
revoke execute on function match_stories(vector, text, timestamptz, real, uuid) from public, anon, authenticated;

insert into pipeline_config (key, value) values
  ('embedding_model', '"voyage-3.5"')   -- API Voyage AI, 1024 dimensions par défaut
on conflict (key) do nothing;
