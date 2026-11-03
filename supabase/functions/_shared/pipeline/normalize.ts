/**
 * Normalisation de texte pour la recherche de sous-chaîne (contrôle des evidences, §4.5).
 * Le but : qu'une phrase recopiée par le modèle avec des guillemets droits, des
 * apostrophes simples ou des espaces ordinaires soit retrouvée dans un article
 * qui utilise la typographie française (« », ’, espaces insécables).
 */

const SINGLE_QUOTES = /[‘’‚‛′ʼ´`]/g;
/** Les guillemets sont supprimés : ils ne portent aucun fait et le modèle peut en ajouter autour d'une citation. */
const DOUBLE_QUOTES = /["“”„‟«»″]/g;
const DASHES = /[‐-―−]/g;
const ELLIPSIS = /…/g;
/** Tous les blancs Unicode, y compris les insécables (U+00A0, U+202F) et le zéro-largeur. */
const WHITESPACE = /[\s​﻿]+/g;
/** Espace (souvent insécable en français) avant une ponctuation : « chiffres : » → « chiffres: ». */
const SPACE_BEFORE_PUNCT = /\s+([;:!?,.])/g;

export function normalizeText(text: string): string {
  return text
    .normalize("NFC")
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, "")
    .replace(DASHES, "-")
    .replace(ELLIPSIS, "...")
    .replace(WHITESPACE, " ")
    .replace(SPACE_BEFORE_PUNCT, "$1")
    .trim()
    .toLowerCase();
}
