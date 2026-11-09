-- Réserve : les anciennes nouvelles reprises (ancien tri) passent au score d'impact du nouveau tri.
-- Calcul : reports/2026-11-09-reserve (même prompt, modèle et règle que triage en production ; aucun appel ici).
-- Sur 15 nouvelles de la réserve, 2 passent (score ≥ 0,65 et impact ≥ 0,5). Pour ne pas descendre sous 3, la
-- meilleure des recalées est gardée (Picasso, 0,64). Les 12 autres sortent du circuit, réversiblement :
-- statut `rejected`, raison `low_impact`, état d'avant dans parked_from (restore_parked, plus bas).
-- La nouvelle de demain (thérapie génique, 0,69) passe et reste programmée.

-- Garde-fou : si la mise hors circuit faisait descendre la réserve sous reserve_min, rien n'est appliqué.
-- (Sur une base sans ces nouvelles, ex. locale, aucune ligne n'est touchée et le garde-fou ne s'applique pas.)
do $$
declare
  parked int;
  remaining int;
  floor_n int;
begin
  update stories
  set parked_from = jsonb_build_object('status', status, 'publish_date', publish_date, 'approved_at', approved_at),
      status = 'rejected', reject_reason = 'low_impact', approved_at = null
  where status = 'verified' and publish_date is null
    and id in (
      '85a9c3c3-42f2-45d8-93a2-a53b7c15eb41', -- 0,62 oiseaux des champs, ferme britannique
      'a54d0cf5-03c2-4c1a-bf1b-57004eeec5e8', -- 0,62 tableau saisi par les nazis rendu
      '3dc6aa69-8dde-483c-bd2e-d696f71d0c9b', -- 0,61 serpents relâchés en Australie
      'cfae4d82-2b26-49ba-9072-2b539f33d3c0', -- 0,60 bilan économique des vaccins anti-Covid
      'd4e7bb15-fbd8-460a-b47b-da37eccd2038', -- 0,46 analyse des tumeurs en Italie
      '8766c253-230c-4899-b59e-bbc58fc516cf', -- 0,40 phages à Francfort
      '13581a43-61ed-4cd3-9a76-047b609e10e9', -- 0,37 médicament prometteur, cancer de la prostate
      '4713ca64-b268-4bc5-aff1-d61a7fd8f700', -- 0,37 robot souple chez l'animal
      'af2dcbf4-73ec-4847-a0a4-c55bdd4263d4', -- 0,33 déchet radioactif retiré d'un liquide
      '84b469eb-7d70-41ee-953a-d3ced8871406', -- 0,32 pales d'éoliennes recyclées
      '0b5f1b2f-4b72-4eda-85d3-33cf6bcebb24', -- 0,31 cerveau et protéines pendant l'éveil
      '7b8ba0cf-13a8-4b65-af22-32260567436a'  -- 0,30 IA et questionnaires Parkinson
    );
  get diagnostics parked = row_count;

  select count(*) into remaining from stories
  where status = 'verified' and publish_date is null and approved_at is not null
    and theme_id in (select id from themes where followed);
  select (value #>> '{}')::int into floor_n from pipeline_config where key = 'reserve_min';
  if parked > 0 and remaining < coalesce(floor_n, 3) then
    raise exception 'réserve à % nouvelle(s), sous reserve_min (%) : migration annulée', remaining, floor_n;
  end if;
  raise notice 'réserve : % mise(s) hors circuit, % restante(s)', parked, remaining;
end $$;

-- Fraîches avant la réserve (one_per_day) : une nouvelle rédigée depuis moins de 24 h passe toujours avant la
-- réserve, et reprend un jour à venir que la réserve tenait.
insert into pipeline_config (key, value) values ('schedule_fresh_hours', '24')
on conflict (key) do update set value = excluded.value;

-- Récupération générique d'une mise hors circuit, par raison (et éventuellement par identifiants) :
--   select restore_parked('low_impact');                       -- toute la réserve écartée
--   select restore_parked('low_impact', array['…']::uuid[]);   -- quelques-unes
-- Même règle que restore_unfollowed pour une nouvelle qui était programmée.
create or replace function restore_parked(p_reason text, p_ids uuid[] default null)
returns int
language plpgsql
as $$
declare
  n int;
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
  where s.parked_from is not null and s.reject_reason = p_reason
    and (p_ids is null or s.id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function restore_parked(text, uuid[]) from public, anon, authenticated;
