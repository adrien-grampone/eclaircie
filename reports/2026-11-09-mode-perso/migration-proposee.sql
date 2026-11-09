-- PROPOSITION, NON APPLIQUÉE (hors de supabase/migrations exprès). Mode perso du pipeline, réversible par config :
--   update pipeline_config set value = '"daily_window"' where key = 'run_mode';   -- mode perso
--   update pipeline_config set value = '"continuous"'   where key = 'run_mode';   -- retour au mode actuel
-- Un déclencheur réapplique les horaires cron du mode choisi ; aucun code n'est supprimé.

-- 1. Configuration
insert into pipeline_config (key, value) values
  ('run_mode', '"continuous"'),
  -- Horaires cron par mode (UTC). daily_window : passage entre 03:00 et 04:55 UTC, soit 04:00–05:55 à Paris
  -- en hiver, 05:00–06:55 en été ; tout est prêt avant la notification de 8 h.
  ('cron_schedules', '{
     "continuous":   {"collect": "5 */3 * * *", "triage": "*/10 * * * *", "extract": "3-59/10 * * * *", "dedup": "*/30 * * * *",
                      "draft": "*/15 * * * *", "verify": "5-59/15 * * * *", "revise": "10-59/15 * * * *", "schedule": "20 * * * *"},
     "daily_window": {"collect": "0 3 * * *", "triage": "*/5 3 * * *", "extract": "*/5 3-4 * * *", "dedup": "*/10 3-4 * * *",
                      "draft": "2-59/10 3-4 * * *", "verify": "5-59/10 3-4 * * *", "revise": "8-59/10 3-4 * * *", "schedule": "20,50 4 * * *"}
   }'),
  -- Plafonds par mode : continuous = valeurs actuelles.
  ('mode_caps', '{
     "continuous":   {"max_triage_per_day": 400, "max_draft_per_day": 40},
     "daily_window": {"max_triage_per_day": 50,  "max_draft_per_day": 6}
   }'),
  -- Thèmes suivis : null = tous (mode actuel) ; sinon collecte, tri et programmation limités à cette liste.
  ('followed_themes', 'null'),
  -- Surveillance : une étape est « muette » après N heures sans passage, selon le mode.
  ('stale_after_hours', '{"continuous": 3, "continuous_collect": 4, "daily_window": 26}'),
  -- Alerte « rien de prêt pour demain », vérifiée à partir de cette heure (Paris).
  ('next_day_alert_hour', '18')
on conflict (key) do nothing;

-- 2. Rattachement des sources aux thèmes (null = source généraliste, gardée quels que soient les thèmes suivis).
alter table sources add column if not exists themes text[];
-- (affectation source par source à valider : une ligne update par source thématique)

-- 3. Application du mode : horaires cron + plafonds, réappliqués à chaque changement de run_mode.
create or replace function apply_run_mode() returns void
language plpgsql security definer set search_path = public, cron as $$
declare
  v_mode text := (select value #>> '{}' from pipeline_config where key = 'run_mode');
  v_sched jsonb := (select value -> v_mode from pipeline_config where key = 'cron_schedules');
  v_caps jsonb := (select value -> v_mode from pipeline_config where key = 'mode_caps');
  r record;
begin
  if v_sched is null or v_caps is null then raise exception 'mode inconnu : %', v_mode; end if;
  for r in select key, value #>> '{}' as expr from jsonb_each(v_sched) loop
    perform cron.alter_job(job_id := (select jobid from cron.job where jobname = 'pipeline-' || r.key), schedule := r.expr);
  end loop;
  update pipeline_config set value = v_caps -> 'max_triage_per_day' where key = 'max_triage_per_day';
  update pipeline_config set value = v_caps -> 'max_draft_per_day' where key = 'max_draft_per_day';
end $$;
revoke execute on function apply_run_mode() from public, anon, authenticated;

create or replace function on_run_mode_change() returns trigger language plpgsql as $$
begin
  perform apply_run_mode();
  return new;
end $$;
create trigger pipeline_config_run_mode after update on pipeline_config
  for each row when (new.key = 'run_mode' and new.value is distinct from old.value) execute function on_run_mode_change();

-- 4. Surveillance (ajouts à pipeline_health_check, le reste inchangé) :
--    a. étape muette : seuil lu dans stale_after_hours selon run_mode (26 h en mode quotidien, sinon 3 h / 4 h) ;
--    b. nouvelle alerte « no_story_tomorrow » : après next_day_alert_hour (Paris), si aucune story programmée
--       ET validée (approved_at non nul) pour demain dans les thèmes suivis ; résolue dès qu'il y en a une.
--       empreinte 'tomorrow:<date>', visible dans la page Santé du back-office comme les autres alertes.
