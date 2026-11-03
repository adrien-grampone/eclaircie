-- Éclaircie — dedup par comparaison Claude Haiku : plus d'embeddings.
-- Retire la colonne vectorielle, la fonction de recherche et pgvector (plus rien ne s'en sert),
-- et marque chaque story passée par dedup.

drop function if exists match_stories(vector, text, timestamptz, real, uuid);
drop index if exists stories_embedding_idx;
alter table stories drop column if exists embedding;
drop extension if exists vector;

-- Horodatage du contrôle de doublon : null = pas encore comparée.
alter table stories add column dedup_checked_at timestamptz;
create index stories_dedup_pending_idx on stories (status) where dedup_checked_at is null;

delete from pipeline_config where key in ('dedup_similarity', 'embedding_model');
update pipeline_config set value = '30' where key = 'dedup_window_days';   -- fenêtre de comparaison
