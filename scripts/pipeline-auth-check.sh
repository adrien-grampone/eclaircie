#!/bin/zsh
# Vérifie la garde des Edge Functions du pipeline en production, sans rien déclencher d'utile :
#   - sans clé et avec une mauvaise clé, les 8 fonctions doivent répondre 401 ;
#   - avec la clé de Vault, `extract` (aucun appel au modèle) doit répondre 200.
# N'affiche que des codes HTTP. Usage : scripts/pipeline-auth-check.sh
set -euo pipefail
cd "$(dirname "$0")/.."

secret() {
  supabase db query --linked -o json "select decrypted_secret as v from vault.decrypted_secrets where name = '$1'" 2>/dev/null \
    | sed -n '/^{/,$p' | jq -r '.rows[0].v // empty'
}
URL=$(secret pipeline_functions_url)
KEY=$(secret pipeline_functions_key)
[[ -n "$URL" ]] || { echo "URL introuvable dans Vault" >&2; exit 1; }
[[ -n "$KEY" ]] || { echo "pipeline_functions_key absente de Vault : lancer scripts/pipeline-key-set.sh" >&2; exit 1; }

fail=0
for fn in collect triage extract dedup draft verify revise schedule; do
  none=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$URL/$fn" -H "Content-Type: application/json" -d '{}')
  wrong=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$URL/$fn" -H "Authorization: Bearer faux" -H "Content-Type: application/json" -d '{}')
  echo "$fn : sans clé $none, mauvaise clé $wrong"
  [[ $none == 401 && $wrong == 401 ]] || fail=1
done
ok=$(curl -s -o /dev/null -w "%{http_code}" --max-time 400 -X POST "$URL/extract" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{}')
echo "extract avec la clé : $ok"
[[ $ok == 200 ]] || fail=1
(( fail == 0 )) && echo "OK : garde en place" || { echo "ÉCHEC" >&2; exit 1; }
