-- Éclaircie — sources RSS (spec §3), garde-fous de coût et suivi de collecte.
-- Les 44 flux ci-dessous ont été vérifiés le 2026-11-03 : HTTP 200 et RSS/Atom valide avec ≥ 1 item.
-- Écartés (404/403 ou flux vide) : CNRS — Actualités, Institut Pasteur, CNES, NIH — News Releases, Muséum national d'Histoire naturelle, UNESCO, Ministère de la Culture, Carenews.
--
-- trust_level : 3 = institution, agence ou revue scientifique ; 2 = média reconnu ou
-- média scientifique/constructif établi ; 1 = agrégateur (Google News) ou média plus petit.

-- Suivi de collecte : la fonction collect prend les sources les moins récemment lues.
alter table sources
  add column last_fetched_at timestamptz,
  add column last_error      text;

create index sources_active_last_fetched_idx on sources (active, last_fetched_at nulls first);

-- Garde-fous de coût (§4, étape 1) et taille des lots.
insert into pipeline_config (key, value) values
  ('max_triage_per_day', '200'),   -- appels Haiku par jour, toutes invocations confondues
  ('max_draft_per_day',  '40'),    -- appels Sonnet (draft) par jour
  ('batch_size',         '10')     -- éléments traités par invocation d'une Edge Function
on conflict (key) do nothing;

insert into sources (name, feed_url, trust_level) values
  -- planete
  ('ONU Info — Climat', 'https://news.un.org/feed/subscribe/fr/news/topic/climate-change/feed/rss.xml', 3),
  ('Le Monde — Planète', 'https://www.lemonde.fr/planete/rss_full.xml', 2),
  ('The Guardian — Environment', 'https://www.theguardian.com/environment/rss', 2),
  ('Phys.org — Earth', 'https://phys.org/rss-feed/earth-news/', 2),
  ('Carbon Brief', 'https://www.carbonbrief.org/feed', 2),
  ('Reporterre', 'https://reporterre.net/spip.php?page=backend', 2),
  ('Google News — Planète', 'https://news.google.com/rss/search?q=biodiversit%C3%A9%20OR%20climat%20(progr%C3%A8s%20OR%20record%20OR%20restauration%20OR%20r%C3%A9ussite)&hl=fr&gl=FR&ceid=FR:fr', 1),
  -- animaux
  ('The Guardian — Wildlife', 'https://www.theguardian.com/environment/wildlife/rss', 2),
  ('Phys.org — Biology', 'https://phys.org/rss-feed/biology-news/', 2),
  ('Mongabay', 'https://news.mongabay.com/feed/', 2),
  ('Google News — Animaux', 'https://news.google.com/rss/search?q=esp%C3%A8ce%20(sauv%C3%A9e%20OR%20r%C3%A9apparue%20OR%20%22de%20retour%22%20OR%20r%C3%A9introduction)&hl=fr&gl=FR&ceid=FR:fr', 1),
  -- science
  ('CNRS — Le Journal', 'https://lejournal.cnrs.fr/rss', 3),
  ('ESA — Space News', 'https://www.esa.int/rssfeed/Our_Activities/Space_News', 3),
  ('NASA — Breaking News', 'https://www.nasa.gov/rss/dyn/breaking_news.rss', 3),
  ('Nature — News', 'https://www.nature.com/nature.rss', 3),
  ('Le Monde — Sciences', 'https://www.lemonde.fr/sciences/rss_full.xml', 2),
  ('The Guardian — Science', 'https://www.theguardian.com/science/rss', 2),
  ('Sciences et Avenir', 'https://www.sciencesetavenir.fr/rss.xml', 2),
  ('Futura', 'https://www.futura-sciences.com/rss/actualites.xml', 2),
  ('Science Daily', 'https://www.sciencedaily.com/rss/all.xml', 2),
  ('Google News — Science', 'https://news.google.com/rss/search?q=d%C3%A9couverte%20scientifique%20(chercheurs%20OR%20%C3%A9tude)%20%22pour%20la%20premi%C3%A8re%20fois%22&hl=fr&gl=FR&ceid=FR:fr', 1),
  -- sante
  ('ONU Info — Santé', 'https://news.un.org/feed/subscribe/fr/news/topic/health/feed/rss.xml', 3),
  ('OMS — Communiqués', 'https://www.who.int/rss-feeds/news-english.xml', 3),
  ('Inserm — Salle de presse', 'https://presse.inserm.fr/feed/', 3),
  ('Le Monde — Santé', 'https://www.lemonde.fr/sante/rss_full.xml', 2),
  ('The Guardian — Health', 'https://www.theguardian.com/society/health/rss', 2),
  ('Medical Xpress', 'https://medicalxpress.com/rss-feed/', 2),
  ('Google News — Santé', 'https://news.google.com/rss/search?q=(traitement%20OR%20vaccin%20OR%20d%C3%A9pistage)%20(approuv%C3%A9%20OR%20efficace%20OR%20%22recul%20de%22)%20sant%C3%A9&hl=fr&gl=FR&ceid=FR:fr', 1),
  -- solidarite
  ('ONU Info', 'https://news.un.org/feed/subscribe/fr/news/all/rss.xml', 3),
  ('Positive News', 'https://www.positive.news/feed/', 2),
  ('Reasons to be Cheerful', 'https://reasonstobecheerful.world/feed/', 2),
  ('Good News Network', 'https://www.goodnewsnetwork.org/feed/', 1),
  ('Google News — Solidarité', 'https://news.google.com/rss/search?q=(association%20OR%20b%C3%A9n%C3%A9voles%20OR%20solidarit%C3%A9)%20(record%20OR%20r%C3%A9ussite%20OR%20%22a%20permis%22)&hl=fr&gl=FR&ceid=FR:fr', 1),
  -- inventions
  ('MIT News', 'https://news.mit.edu/rss/feed', 3),
  ('Le Monde — Pixels', 'https://www.lemonde.fr/pixels/rss_full.xml', 2),
  ('TechXplore', 'https://techxplore.com/rss-feed/', 2),
  ('Usbek & Rica', 'https://usbeketrica.com/fr/rss', 1),
  ('Google News — Inventions', 'https://news.google.com/rss/search?q=(invention%20OR%20innovation%20OR%20prototype)%20(chercheurs%20OR%20ing%C3%A9nieurs)%20r%C3%A9ussite&hl=fr&gl=FR&ceid=FR:fr', 1),
  -- culture
  ('ONU Info — Culture et éducation', 'https://news.un.org/feed/subscribe/fr/news/topic/culture-and-education/feed/rss.xml', 3),
  ('Le Monde — Culture', 'https://www.lemonde.fr/culture/rss_full.xml', 2),
  ('The Guardian — Culture', 'https://www.theguardian.com/uk/culture/rss', 2),
  ('France Culture', 'https://www.radiofrance.fr/franceculture/rss', 2),
  ('Télérama', 'https://www.telerama.fr/rss/une.xml', 2),
  ('Google News — Culture', 'https://news.google.com/rss/search?q=(patrimoine%20OR%20mus%C3%A9e%20OR%20biblioth%C3%A8que)%20(restaur%C3%A9%20OR%20rouvre%20OR%20inaugur%C3%A9%20OR%20record)&hl=fr&gl=FR&ceid=FR:fr', 1)
on conflict (feed_url) do nothing;
