-- Rapport du matin du 2026-11-04 : rendement des sources au triage, publication validée uniquement.

-- Triage par rendement de la source : taux d'acceptation lissé sur une fenêtre, avec un a priori
-- pour les sources nouvelles ; seuil de la section « sources à revoir » du rapport du matin.
insert into pipeline_config (key, value) values
  ('triage_source_window_days',  '7'),     -- fenêtre du taux d'acceptation
  ('triage_source_prior_rate',   '0.1'),   -- taux supposé d'une source sans historique (10 %)
  ('triage_source_prior_weight', '10'),    -- poids de cet a priori, en articles équivalents
  ('triage_source_review_min',   '50')     -- « à revoir » : au moins N triés sur la fenêtre et 0 accepté
on conflict (key) do nothing;

-- Rendement par source sur la fenêtre (service_role : RLS de raw_articles et sources).
-- « accepté » = passé le triage (triaged, extracted, drafted) ou échoué après le triage (hors parse_error).
create view source_yield with (security_invoker = true) as
  with window as (
    select (value::text)::int as days from pipeline_config where key = 'triage_source_window_days'
  )
  select s.id as source_id, s.name as source_name, s.active,
         count(a.id)::int as triaged,
         count(a.id) filter (where a.status in ('triaged', 'extracted', 'drafted') or (a.status = 'failed' and a.reject_reason <> 'parse_error'))::int as accepted
  from sources s
  left join raw_articles a on a.source_id = s.id and a.triaged_at > now() - make_interval(days => (select days from window))
  group by s.id, s.name, s.active;

-- La file de triage expose la source pour l'ordre par rendement (calculé en code, seuils de pipeline_config).
drop view triage_queue;
create view triage_queue with (security_invoker = true) as
  select a.id, a.title, a.snippet, a.status, a.triage, a.published_at, a.fetched_at, a.source_id,
         s.name as source_name, s.trust_level
  from raw_articles a join sources s on s.id = a.source_id;

-- Publication validée uniquement : l'app ne lit que les stories programmées, publiées ET approuvées.
drop policy "stories: lecture des nouvelles publiées" on stories;
create policy "stories: lecture des nouvelles publiées et validées"
  on stories for select
  to authenticated
  using (status = 'scheduled' and approved_at is not null and publish_date <= current_date);
