-- Éclaircie — déclenchement du pipeline par pg_cron + pg_net (spec §4).
-- Chaque job appelle une Edge Function qui traite un petit lot. L'URL de base et,
-- en production, la clé d'autorisation sont lues dans Vault (jamais dans une migration) :
--   select vault.create_secret('http://host.docker.internal:54321/functions/v1', 'pipeline_functions_url');
--   select vault.create_secret('<clé>', 'pipeline_functions_key');   -- optionnel en local

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function invoke_pipeline_function(fn text)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  base_url text;
  api_key  text;
  headers  jsonb := '{"Content-Type": "application/json"}'::jsonb;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'pipeline_functions_url';
  if base_url is null then
    raise exception 'secret Vault « pipeline_functions_url » manquant';
  end if;
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'pipeline_functions_key';
  if api_key is not null then
    headers := headers || jsonb_build_object('Authorization', 'Bearer ' || api_key);
  end if;
  return net.http_post(
    url := base_url || '/' || fn,
    headers := headers,
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
end;
$$;

revoke execute on function invoke_pipeline_function(text) from public, anon, authenticated;

-- Fréquences : collect toutes les 3 h (§4.1) ; les étapes à lots tournent souvent,
-- chacune ne traite que batch_size éléments et s'arrête d'elle-même au plafond journalier.
select cron.schedule('pipeline-collect', '5 */3 * * *',    $$select invoke_pipeline_function('collect')$$);
select cron.schedule('pipeline-triage',  '*/10 * * * *',   $$select invoke_pipeline_function('triage')$$);
select cron.schedule('pipeline-extract', '3-59/10 * * * *', $$select invoke_pipeline_function('extract')$$);
select cron.schedule('pipeline-draft',   '*/15 * * * *',   $$select invoke_pipeline_function('draft')$$);
select cron.schedule('pipeline-verify',  '5-59/15 * * * *', $$select invoke_pipeline_function('verify')$$);
select cron.schedule('pipeline-revise',  '10-59/15 * * * *', $$select invoke_pipeline_function('revise')$$);
select cron.schedule('pipeline-dedup',   '*/30 * * * *',   $$select invoke_pipeline_function('dedup')$$);
