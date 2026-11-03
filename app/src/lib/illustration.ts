import { pickFallbackImage } from "@pipeline/illustration.ts";

/**
 * Image à afficher pour une nouvelle : son illustration si elle existe, sinon une image de secours
 * du thème (même choix déterministe que le back-office : pickFallbackImage, graine = id de la story),
 * sinon rien (l'écran dessine alors un ciel avec la palette du thème).
 */
export function publicImageUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/illustrations/${path}`;
}

export function storyImageUrl(
  supabaseUrl: string,
  story: { id: string; theme_id: string; image_path: string | null },
  fallbackFiles: readonly string[],
): { url: string; fallback: boolean } | null {
  if (story.image_path) return { url: publicImageUrl(supabaseUrl, story.image_path), fallback: false };
  const fallback = pickFallbackImage(story.theme_id, fallbackFiles, story.id);
  return fallback ? { url: publicImageUrl(supabaseUrl, fallback), fallback: true } : null;
}
