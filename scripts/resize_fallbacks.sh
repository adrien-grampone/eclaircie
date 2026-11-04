#!/bin/zsh
# Redimensionne les images de secours du bucket `illustrations` (prod) sous 1290×1720 (ILLUSTRATION_MAX_SIZE)
# et les remplace. Authentification : la session du CLI Supabase (`supabase login`, projet lié) ; aucune clé
# service_role n'est lue ni affichée.
#
#   scripts/resize_fallbacks.sh            sauvegarde, vérifie, redimensionne, remplace
#   scripts/resize_fallbacks.sh --dry-run  liste ce qui serait remplacé, n'écrit rien (ni local, ni bucket)
set -euo pipefail
cd "$(dirname "$0")/.."

MAX="1290x1720>"
THEMES=(animaux culture inventions planete sante science solidarite)
BACKUP="backups/fallbacks-$(date +%F)"
DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1

# 1. Inventaire du bucket.
typeset -a FILES
for theme in $THEMES; do
  for f in $(supabase storage ls "ss:///illustrations/fallback/$theme/" --linked --experimental 2>/dev/null | grep -o '"[^"]*\.webp"' | tr -d '"'); do
    FILES+=("$theme/$f")
  done
done
echo "${#FILES} image(s) de secours dans le bucket"
(( ${#FILES} > 0 )) || { echo "rien à faire" >&2; exit 1; }

if (( DRY )); then
  for p in $FILES; do echo "remplacerait fallback/$p (→ sous 1290×1720, WebP qualité 90)"; done
  echo "--dry-run : rien n'a été écrit"
  exit 0
fi

# 2. Sauvegarde des originaux (dossier ignoré par git), puis vérification qu'elle est complète.
#    Un fichier déjà sauvegardé n'est JAMAIS retéléchargé : après un passage partiel, le bucket
#    contiendrait déjà la version réduite.
mkdir -p "$BACKUP"
for p in $FILES; do
  mkdir -p "$BACKUP/${p%/*}"
  [[ -s "$BACKUP/$p" ]] && continue
  supabase storage cp "ss:///illustrations/fallback/$p" "$BACKUP/$p" --linked --experimental 2>&1 | grep -v "new version\|recommend updating" || true
done
missing=0
for p in $FILES; do
  if [[ ! -s "$BACKUP/$p" ]] || ! magick identify "$BACKUP/$p" >/dev/null 2>&1; then
    echo "sauvegarde absente ou illisible : $BACKUP/$p" >&2; missing=1
  fi
done
(( missing == 0 )) || { echo "sauvegarde incomplète : aucune écriture dans le bucket" >&2; exit 1; }
echo "sauvegarde complète : $BACKUP (${#FILES} fichiers)"

# 3. Redimensionnement et remplacement, fichier par fichier.
W=$(mktemp -d)
for p in $FILES; do
  before=$(magick identify -format '%wx%h' "$BACKUP/$p")
  out="$W/${p//\//_}"
  magick "$BACKUP/$p" -resize "$MAX" -quality 90 "$out"
  # Le CLI ne sait pas écraser un objet existant (pas d'upsert) : suppression puis envoi, erreurs visibles.
  supabase storage rm "ss:///illustrations/fallback/$p" --linked --experimental 2>&1 | grep -v "new version\|recommend updating" || true
  supabase storage cp "$out" "ss:///illustrations/fallback/$p" --content-type image/webp --linked --experimental 2>&1 | grep -v "new version\|recommend updating" || true
  echo "fallback/$p : $before → $(magick identify -format '%wx%h' "$out")"
done
rm -rf "$W"
echo "terminé ; originaux conservés dans $BACKUP"
