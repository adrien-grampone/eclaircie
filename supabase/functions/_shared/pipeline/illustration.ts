import { daysBetween } from "./dates.ts";
import type { IsoDate } from "./types.ts";

/**
 * Illustrations faites à la main dans l'app Gemini (décision du 2026-11-03, pas d'API d'image).
 * Le back-office affiche le prompt complet à copier : prompt de style fixe (§5, validé au test
 * de cohérence) + palette en mots du thème (themes.palette_words) + scene du brouillon.
 * Ce module n'a aucune dépendance : il est importé par le back-office Next.js et par schedule.
 */

export const ILLUSTRATION_STYLE_PROMPT = [
  "Full-bleed editorial illustration, edge to edge, no border, no frame, no paper margin.",
  "Gouache and risograph style with the texture of warm paper and visible grain across the whole image.",
  "Flat layered shapes with soft, slightly irregular painted edges. Calm, optimistic early-morning light.",
  "Limited palette: {palette}. Any sun or moon is a perfect circle.",
  "Wide, airy composition: keep the top 35% of the image as open sky with no detail, for a title overlay.",
  "No text, no letters, no logos, no close-up faces, no photorealism, no 3D render.",
].join(" ");

/** Format cible des illustrations, portrait 3:4 (app Gemini, mode Pro). */
export const ILLUSTRATION_ASPECT = { width: 3, height: 4 } as const;
export const ILLUSTRATION_MAX_SIZE = { width: 1792, height: 2400 } as const;
const ASPECT_TOLERANCE = 0.01;

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Prompt complet prêt à coller : style + palette du thème, puis la scène sur sa propre ligne. */
export function buildIllustrationPrompt(input: { paletteWords: string; scene: string }): string {
  const palette = clean(input.paletteWords).replace(/[.\s]+$/, "");
  const scene = clean(input.scene);
  if (!palette) throw new Error("palette_words vide");
  if (!scene) throw new Error("scene vide");
  return `${ILLUSTRATION_STYLE_PROMPT.replace("{palette}", palette)}\nScene: ${scene}`;
}

/** Chemin dans le bucket `illustrations` de l'image d'une story. */
export function illustrationPath(storyId: string): string {
  return `${storyId}.webp`;
}

/** Préfixe des images de secours d'un thème dans le bucket. */
export function fallbackPrefix(themeId: string): string {
  return `fallback/${themeId}/`;
}

function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

/**
 * Image de secours d'une story publiée sans image_path : choix déterministe parmi les fichiers
 * `fallback/<theme_id>/` (même story → même image), réparti entre les images disponibles.
 * `files` sont des noms de fichiers ou des chemins complets ; les fichiers d'un autre thème sont ignorés.
 */
export function pickFallbackImage(themeId: string, files: readonly string[], seed: string): string | null {
  const prefix = fallbackPrefix(themeId);
  const candidates = files
    .map((f) => f.trim())
    .filter((f) => f !== "" && !f.endsWith("/") && !/(^|\/)\.[^/]*$/.test(f))
    .map((f) => (f.startsWith(prefix) ? f : `${prefix}${f.replace(/^\/+/, "")}`))
    .filter((f) => f.length > prefix.length && !f.slice(prefix.length).includes("/"))
    .sort();
  if (candidates.length === 0) return null;
  return candidates[hashString(seed) % candidates.length] ?? null;
}

export interface ImageStatusStory {
  id: string;
  themeId: string;
  publishDate: IsoDate;
  hasImage: boolean;
}

export interface ImageAlertPlan {
  /** Stories programmées dans moins de `image_alert_days` jours, sans image. */
  raise: { fingerprint: string; story: ImageStatusStory }[];
  /** Empreintes ouvertes dont la story a désormais une image, ou n'est plus concernée. */
  resolve: string[];
}

export function imageAlertFingerprint(storyId: string): string {
  return `image:${storyId}`;
}

/**
 * Alerte J-N (§ illustrations à la main) : une story programmée (aujourd'hui inclus) dont la date de
 * publication est à `image_alert_days` jours ou moins et qui n'a pas d'image ouvre `image_missing`.
 * Les alertes ouvertes dont la story a une image, est passée, ou n'est plus programmée sont résolues.
 */
export function planImageAlerts(
  scheduled: readonly ImageStatusStory[],
  openFingerprints: readonly string[],
  today: IsoDate,
  config: { image_alert_days: number },
): ImageAlertPlan {
  const raise: ImageAlertPlan["raise"] = [];
  const stillMissing = new Set<string>();
  for (const story of scheduled) {
    const inDays = daysBetween(today, story.publishDate);
    if (story.hasImage || inDays < 0 || inDays > config.image_alert_days) continue;
    const fingerprint = imageAlertFingerprint(story.id);
    stillMissing.add(fingerprint);
    raise.push({ fingerprint, story });
  }
  raise.sort((a, b) => a.story.publishDate.localeCompare(b.story.publishDate) || a.story.id.localeCompare(b.story.id));
  const resolve = openFingerprints.filter((f) => f.startsWith("image:") && !stillMissing.has(f)).sort();
  return { raise, resolve };
}

export interface ImageFit {
  /** Zone à découper dans l'image source, en pixels, centrée. */
  crop: { x: number; y: number; width: number; height: number };
  /** Dimensions de sortie, au format cible, bornées par ILLUSTRATION_MAX_SIZE sans agrandir. */
  output: { width: number; height: number };
}

/**
 * Recadrage centré au format 3:4 puis réduction (jamais d'agrandissement) sous le maximum.
 * Utilisé par le back-office avant conversion WebP ; pur pour être testé.
 */
export function fitImage(
  source: { width: number; height: number },
  aspect: { width: number; height: number } = ILLUSTRATION_ASPECT,
  max: { width: number; height: number } = ILLUSTRATION_MAX_SIZE,
): ImageFit {
  if (source.width <= 0 || source.height <= 0) throw new Error("image vide");
  const ratio = aspect.width / aspect.height;
  let cropWidth = source.width;
  let cropHeight = source.height;
  // Les sorties « 3:4 » des générateurs (896×1200, 3584×4800) s'écartent du format de moins de 1 % :
  // on les garde entières plutôt que de rogner deux pixels.
  if (Math.abs(source.width / source.height - ratio) / ratio > ASPECT_TOLERANCE) {
    cropHeight = Math.round(source.width / ratio);
    if (cropHeight > source.height) {
      cropHeight = source.height;
      cropWidth = Math.round(source.height * ratio);
    }
  }
  const x = Math.floor((source.width - cropWidth) / 2);
  const y = Math.floor((source.height - cropHeight) / 2);
  const scale = Math.min(1, max.width / cropWidth, max.height / cropHeight);
  const width = Math.round(cropWidth * scale);
  const height = Math.round(cropHeight * scale);
  return { crop: { x, y, width: cropWidth, height: cropHeight }, output: { width, height } };
}
