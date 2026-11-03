-- Éclaircie — boucle de révision (§4.5) : why_good retiré (affiché nulle part),
-- journal des verdicts de verify sur la story, statut intermédiaire `to_revise`.

alter table stories drop column why_good;

-- Un élément par passe : { pass, model, decision, reason, verify: {claims, problems, verdict}, at }
alter table stories add column verify_log jsonb not null default '[]'::jsonb;

alter table stories drop constraint stories_status_check;
alter table stories add constraint stories_status_check
  check (status in ('drafted', 'to_revise', 'verified', 'illustrated', 'approved',
                    'scheduled', 'rejected', 'retracted'));

insert into pipeline_config (key, value) values
  ('verify_max_passes', '2')   -- draft → verify → revise → verify, puis rejet
on conflict (key) do nothing;
