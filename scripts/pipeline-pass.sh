#!/bin/zsh
# Passage complet du pipeline à la main, en production, sans attendre la fenêtre du matin.
# Appelle les Edge Functions une par une et ATTEND chaque réponse (pas de lots qui se chevauchent).
# Les plafonds du jour (pipeline_config) restent appliqués : un passage manuel consomme le budget du jour UTC.
# L'URL et la clé éventuelle sont lues dans Vault (comme pg_cron), jamais affichées.
# Usage : scripts/pipeline-pass.sh          (depuis la racine du dépôt, CLI supabase connectée au projet)
set -euo pipefail
cd "$(dirname "$0")/.."

secret() {
  supabase db query --linked -o json "select decrypted_secret as v from vault.decrypted_secrets where name = '$1'" 2>/dev/null \
    | sed -n '/^{/,$p' | jq -r '.rows[0].v // empty'
}
URL=$(secret pipeline_functions_url)
KEY=$(secret pipeline_functions_key)
[[ -n "$URL" ]] || { echo "URL introuvable dans Vault (pipeline_functions_url)" >&2; exit 1; }
# Clé facultative, comme pour pg_cron : sans elle, aucun en-tête Authorization.
AUTH=()
[[ -n "$KEY" ]] && AUTH=(-H "Authorization: Bearer $KEY")

# Appelle une étape, affiche un résumé d'une ligne, renvoie le nombre d'éléments traités.
call() {
  local out
  out=$(curl -sS --max-time 400 -X POST "$URL/$1" "${AUTH[@]}" -H "Content-Type: application/json" -d '{}')
  local line
  line=$(print -r -- "$out" | jq -c 'del(.results, .reports)' 2>/dev/null || print -r -- "${out:0:300}")
  print -r -- "  $1 → $line" >&2
  print -r -- "$out" | jq -r 'if .error then -1 elif .skipped then 0 else (.processed // ((.revise.processed // 0) + (.rework.processed // 0)) // .inserted // .scheduled // 0) end' 2>/dev/null || echo -1
}

echo "1. Collecte"
call collect >/dev/null

echo "2. Tri (jusqu'au plafond du jour)"
for i in {1..8}; do [[ $(call triage) -gt 0 ]] || break; done

echo "3. Extraction, doublons, rédaction, reprises, vérification, révision (jusqu'à ce que plus rien ne bouge)"
for round in {1..10}; do
  echo " tour $round"
  moved=0
  for step in extract dedup draft revise verify; do
    n=$(call $step)
    (( n > 0 )) && moved=$((moved + n))
  done
  (( moved > 0 )) || break
done

echo "4. Programmation (aujourd'hui et demain) et réserve"
call schedule >/dev/null
echo "Terminé."
