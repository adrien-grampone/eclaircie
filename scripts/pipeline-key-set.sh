#!/bin/zsh
# Génère le secret partagé du pipeline et l'installe aux DEUX endroits, sans jamais l'afficher ni l'écrire sur disque :
#   - secrets des Edge Functions (PIPELINE_FUNCTIONS_KEY) : chaque fonction refuse (401) un appel sans ce Bearer ;
#   - Vault (pipeline_functions_key) : invoke_pipeline_function (pg_cron) et scripts/pipeline-pass.sh l'envoient.
# Relancer le script fait tourner la clé (Vault mis à jour, secret des fonctions remplacé).
# Usage : scripts/pipeline-key-set.sh   (depuis la racine du dépôt, CLI supabase connectée au projet)
set -euo pipefail
cd "$(dirname "$0")/.."

KEY=$(openssl rand -hex 32)
[[ ${#KEY} -eq 64 ]] || { echo "génération du secret impossible" >&2; exit 1; }

supabase secrets set "PIPELINE_FUNCTIONS_KEY=$KEY" >/dev/null
echo "1/2 secret des Edge Functions : PIPELINE_FUNCTIONS_KEY posé"

supabase db query --linked "do \$\$ begin
  if exists (select 1 from vault.secrets where name = 'pipeline_functions_key') then
    perform vault.update_secret((select id from vault.secrets where name = 'pipeline_functions_key'), '$KEY');
  else
    perform vault.create_secret('$KEY', 'pipeline_functions_key', 'Bearer des Edge Functions du pipeline');
  end if;
end \$\$;" >/dev/null 2>&1
echo "2/2 Vault : pipeline_functions_key posé"
unset KEY
