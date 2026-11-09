-- Hors circuit : les nouvelles et articles des thèmes non suivis (mode perso : Science, Inventions, Près de chez moi)
-- sortent du pipeline et de l'app, sans rien supprimer.
--   * statut `rejected`, raison `theme_not_followed` : aucune fonction ne les reprend (aucun quota consommé) et la
--     politique RLS de lecture (status = 'scheduled' ou 'retracted') les rend invisibles dans l'app ;
--   * l'état d'avant est gardé dans `parked_from`, pour pouvoir les récupérer (restore_unfollowed, plus bas) si l'on
--     repasse en mode continu avec ces thèmes.
-- Les nouvelles déjà publiées (publish_date < aujourd'hui) ne sont pas touchées : elles font partie de l'historique.

alter table stories add column if not exists parked_from jsonb;
comment on column stories.parked_from is
  'État avant la mise hors circuit (thème non suivi) : {status, publish_date, approved_at}. Non nul = récupérable par restore_unfollowed().';
alter table raw_articles add column if not exists parked_from text;
comment on column raw_articles.parked_from is
  'Statut avant la mise hors circuit (thème non suivi). Non nul = récupérable par restore_unfollowed().';

-- Nouvelles en cours de pipeline ou programmées à partir d'aujourd'hui. publish_date est libéré (contrainte
-- unique (theme_id, publish_date)) et gardé dans parked_from.
update stories
set parked_from = jsonb_build_object('status', status, 'publish_date', publish_date, 'approved_at', approved_at),
    status = 'rejected', reject_reason = 'theme_not_followed', publish_date = null, approved_at = null
where theme_id in (select id from themes where not followed)
  and (status in ('drafted', 'to_revise', 'to_rework', 'verified', 'illustrated', 'approved')
       or (status = 'scheduled' and publish_date >= current_date));

-- Articles déjà triés ou extraits dont le thème principal n'est pas suivi : la rédaction (4 par jour) s'y épuiserait.
update raw_articles
set parked_from = status, status = 'rejected', reject_reason = 'theme_not_followed'
where status in ('triaged', 'extracted')
  and triage->'themes'->>0 in (select id from themes where not followed);

-- Récupération : remet dans leur état d'avant les nouvelles et articles mis hors circuit pour les thèmes donnés.
-- Une nouvelle programmée retrouve sa date si elle n'est pas passée et que la case (thème, date) est libre ;
-- sinon elle revient en `verified` (elle repassera par la programmation). À lancer après avoir remis ces thèmes
-- dans `themes.followed` (ou en mode continu), par exemple : select restore_unfollowed(array['science', 'inventions']);
create or replace function restore_unfollowed(p_themes text[])
returns jsonb
language plpgsql
as $$
declare
  n_stories int;
  n_articles int;
begin
  update stories s
  set status = case
        when s.parked_from->>'status' = 'scheduled'
             and (s.parked_from->>'publish_date')::date >= current_date
             and not exists (select 1 from stories o where o.theme_id = s.theme_id
                             and o.publish_date = (s.parked_from->>'publish_date')::date)
          then 'scheduled'
        when s.parked_from->>'status' = 'scheduled' then 'verified'
        else s.parked_from->>'status' end,
      publish_date = case
        when s.parked_from->>'status' = 'scheduled'
             and (s.parked_from->>'publish_date')::date >= current_date
             and not exists (select 1 from stories o where o.theme_id = s.theme_id
                             and o.publish_date = (s.parked_from->>'publish_date')::date)
          then (s.parked_from->>'publish_date')::date end,
      approved_at = (s.parked_from->>'approved_at')::timestamptz,
      reject_reason = null,
      parked_from = null
  where s.parked_from is not null and s.reject_reason = 'theme_not_followed' and s.theme_id = any(p_themes);
  get diagnostics n_stories = row_count;

  update raw_articles
  set status = parked_from, reject_reason = null, parked_from = null
  where parked_from is not null and reject_reason = 'theme_not_followed' and triage->'themes'->>0 = any(p_themes);
  get diagnostics n_articles = row_count;

  return jsonb_build_object('stories', n_stories, 'raw_articles', n_articles);
end;
$$;

revoke all on function restore_unfollowed(text[]) from public, anon, authenticated;
