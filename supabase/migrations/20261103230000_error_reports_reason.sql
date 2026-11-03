-- Signalements depuis l'app : raison rapide, message facultatif, un seul signalement par utilisateur et par nouvelle.
alter table error_reports
  add column reason text check (reason in ('inaccurate', 'source_missing', 'not_good_news'));

alter table error_reports
  add constraint error_reports_reason_or_message check (reason is not null or message is not null);

alter table error_reports
  add constraint error_reports_one_per_user_story unique (user_id, story_id);
