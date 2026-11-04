-- Archives (spec §8, écran 6) : une nouvelle retirée après vérification reste listée comme
-- « Nouvelle retirée après vérification ». L'app lit donc aussi les stories `retracted` déjà publiées
-- (leur contenu avait été public) ; elle n'en affiche que le statut.
drop policy "stories: lecture des nouvelles publiées et validées" on stories;
create policy "stories: lecture des nouvelles publiées et validées"
  on stories for select
  to authenticated
  using (publish_date <= current_date and ((status = 'scheduled' and approved_at is not null) or status = 'retracted'));
