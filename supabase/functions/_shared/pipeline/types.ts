/**
 * Types partagés par la logique pure du pipeline.
 * Aucun accès réseau ni base ici : les Edge Functions lisent, appellent, écrivent.
 */

/** Date calendaire au format 'YYYY-MM-DD' (comme une colonne `date` Postgres). */
export type IsoDate = string;

/** Résultat d'un parsing : soit une valeur validée, soit un message d'erreur lisible. */
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** Un prompt prêt à être envoyé à l'API Claude. */
export interface Prompt {
  system: string;
  user: string;
}

/** Un article dont le texte complet a été extrait (étape `extract`). */
export interface Article {
  title: string;
  sourceName: string;
  url: string;
  /** Date de publication ISO (timestamptz) ou null si inconnue. */
  publishedAt: string | null;
  fullText: string;
}

/** Une affirmation du résumé et la phrase exacte de l'article qui la soutient. */
export interface Claim {
  claim: string;
  evidence: string;
}

/** Un thème tel que lu dans la table `themes`, réduit à ce dont les prompts ont besoin. */
export interface ThemeRef {
  id: string;
  label: string;
}
