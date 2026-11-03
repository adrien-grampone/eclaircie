-- Éclaircie — file de triage : les plus récents d'abord, expiration sans appel modèle.
alter table raw_articles drop constraint raw_articles_status_check;
alter table raw_articles add constraint raw_articles_status_check
  check (status in ('new', 'triaged', 'rejected', 'extracted', 'drafted', 'failed', 'expired'));

-- Horodatage du tri, pour mesurer le taux d'acceptation par source sur 24 h.
alter table raw_articles add column triaged_at timestamptz;
create index raw_articles_triaged_at_idx on raw_articles (triaged_at desc) where triaged_at is not null;
create index raw_articles_queue_idx on raw_articles (status, published_at desc);

-- Vue de la file : un article `new` avec la confiance de sa source, pour trier
-- published_at desc puis trust_level desc. security_invoker : mêmes droits que raw_articles.
create view triage_queue with (security_invoker = true) as
  select a.id, a.title, a.snippet, a.status, a.triage, a.published_at, a.fetched_at,
         s.name as source_name, s.trust_level
  from raw_articles a join sources s on s.id = a.source_id;

update pipeline_config set value = '400' where key = 'max_triage_per_day';
