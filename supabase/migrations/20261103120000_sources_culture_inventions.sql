-- Éclaircie — sources dédiées culture et inventions, fenêtre de collecte par confiance,
-- plafond de part d'une source par thème (schedule).
-- 26 flux vérifiés le 2026-11-03 (HTTP 200, RSS/Atom valide, ≥ 1 item).
-- Écartés : La Croix — Culture (HTTP 404), ICOM (), UNESCO — Articles (pas du RSS/Atom), INRAP (HTTP 403), BnF — Actualités (HTTP 404), EurekAlert — Technology & Engineering (HTTP 404), Inria (pas du RSS/Atom), CEA — Actualités (HTTP 404), Industrie & Technologies (UND_ERR_CONNECT_TIMEOUT), L'Usine Nouvelle — Innovation (HTTP 404), Les Echos — Tech & Médias (HTTP 403).

insert into pipeline_config (key, value) values
  ('collect_max_age_days_trust3',  '30'),   -- §4.1 : fenêtre élargie pour les sources trust_level 3
  ('schedule_max_source_share',    '0.3'),  -- §4.9 : part maximale d'une source sur un thème…
  ('schedule_source_window_days',  '14')    -- …sur cette fenêtre glissante
on conflict (key) do nothing;

insert into sources (name, feed_url, trust_level) values
  -- culture
  ('Connaissance des Arts', 'https://www.connaissancedesarts.com/feed/', 2),
  ('Le Journal des Arts', 'https://www.lejournaldesarts.fr/rss.xml', 2),
  ('The Art Newspaper', 'https://www.theartnewspaper.com/rss.xml', 2),
  ('Artnet News', 'https://news.artnet.com/feed', 2),
  ('Hyperallergic', 'https://hyperallergic.com/feed/', 2),
  ('Archaeology Magazine', 'https://www.archaeology.org/feed', 2),
  ('Smithsonian — History', 'https://www.smithsonianmag.com/rss/history/', 2),
  ('Smithsonian — Arts & Culture', 'https://www.smithsonianmag.com/rss/arts-culture/', 2),
  ('Le Figaro — Culture', 'https://www.lefigaro.fr/rss/figaro_culture.xml', 2),
  ('Franceinfo — Culture', 'https://www.francetvinfo.fr/culture.rss', 2),
  ('BBC — Entertainment & Arts', 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', 2),
  ('UNESCO — Patrimoine mondial', 'https://whc.unesco.org/en/news/rss/', 3),
  ('Google News — Restitutions', 'https://news.google.com/rss/search?q=(restitution%20OR%20restitu%C3%A9%20OR%20restitu%C3%A9e)%20(%C5%93uvre%20OR%20objets%20OR%20patrimoine)%20mus%C3%A9e&hl=fr&gl=FR&ceid=FR:fr', 1),
  ('Google News — Patrimoine restauré', 'https://news.google.com/rss/search?q=(patrimoine%20OR%20monument%20OR%20cath%C3%A9drale%20OR%20ch%C3%A2teau)%20(restaur%C3%A9%20OR%20restaur%C3%A9e%20OR%20rouvre%20OR%20r%C3%A9ouverture%20OR%20inaugur%C3%A9)&hl=fr&gl=FR&ceid=FR:fr', 1),
  ('Google News — Musées', 'https://news.google.com/rss/search?q=mus%C3%A9e%20(ouvre%20OR%20ouverture%20OR%20inaugure%20OR%20record%20OR%20fr%C3%A9quentation%20OR%20gratuit)&hl=fr&gl=FR&ceid=FR:fr', 1),
  ('Google News — Langues', 'https://news.google.com/rss/search?q=(langue%20r%C3%A9gionale%20OR%20langue%20autochtone%20OR%20breton%20OR%20occitan%20OR%20basque%20OR%20cr%C3%A9ole)%20(renaissance%20OR%20sauv%C3%A9e%20OR%20enseignement%20OR%20locuteurs)&hl=fr&gl=FR&ceid=FR:fr', 1),
  ('Google News — Archéologie', 'https://news.google.com/rss/search?q=arch%C3%A9ologues%20(d%C3%A9couverte%20OR%20d%C3%A9couvrent%20OR%20mis%20au%20jour%20OR%20exceptionnelle)&hl=fr&gl=FR&ceid=FR:fr', 1),
  -- inventions
  ('Phys.org — Technology', 'https://phys.org/rss-feed/technology-news/', 2),
  ('New Atlas', 'https://newatlas.com/index.rss', 2),
  ('IEEE Spectrum', 'https://spectrum.ieee.org/feeds/feed.rss', 2),
  ('MIT Technology Review', 'https://www.technologyreview.com/feed/', 2),
  ('01net', 'https://www.01net.com/feed/', 1),
  ('Interesting Engineering', 'https://interestingengineering.com/feed', 1),
  ('Google News — Inventé', 'https://news.google.com/rss/search?q=%22ont%20invent%C3%A9%22%20OR%20%22a%20invent%C3%A9%22%20OR%20%22invente%20un%22%20OR%20%22invente%20une%22%20(chercheurs%20OR%20ing%C3%A9nieurs%20OR%20%C3%A9tudiants%20OR%20startup)&hl=fr&gl=FR&ceid=FR:fr', 1),
  ('Google News — Prototype', 'https://news.google.com/rss/search?q=prototype%20(chercheurs%20OR%20ing%C3%A9nieurs%20OR%20laboratoire)%20(fonctionne%20OR%20test%C3%A9%20OR%20r%C3%A9ussi%20OR%20d%C3%A9voile)&hl=fr&gl=FR&ceid=FR:fr', 1),
  ('Google News — Première mondiale', 'https://news.google.com/rss/search?q=%22premi%C3%A8re%20mondiale%22%20(chercheurs%20OR%20ing%C3%A9nieurs%20OR%20m%C3%A9decins%20OR%20h%C3%B4pital%20OR%20laboratoire)&hl=fr&gl=FR&ceid=FR:fr', 1)
on conflict (feed_url) do nothing;
