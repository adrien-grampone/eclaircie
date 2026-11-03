import { formatSourceDate } from "./daily.ts";

/**
 * Carte story à partager (spec §8, maquette 04) : logique pure. 390×693 points, exportée à l'échelle
 * de l'appareil (×3 sur les iPhone récents).
 */
export const SHARE_CARD = { width: 390, height: 693, scale: 3 } as const;

export const SHARE_COPY = { appName: "éclaircie", kicker: "BONNE NOUVELLE DU JOUR", tagline: "Une bonne nouvelle par jour" } as const;

/** Paliers du titre sur la carte : plus grand que dans la feuille, 3 lignes max. */
const SHARE_TITLE_TIERS = [
  { maxChars: 24, fontSize: 46 },
  { maxChars: 36, fontSize: 40 },
  { maxChars: Number.POSITIVE_INFINITY, fontSize: 34 },
] as const;

export interface ShareCardContent {
  appName: string;
  kicker: string;
  themeLabel: string;
  titleMain: string;
  titleAccent: string | null;
  source: string;
  tagline: string;
  titleFontSize: number;
}

export interface ShareStory {
  title_main: string;
  title_accent: string | null;
  source_name: string;
  source_date: string | null;
  publish_date: string;
}

export function shareTitleSize(titleMain: string, titleAccent: string | null): number {
  const total = titleMain.trim().length + (titleAccent ? titleAccent.trim().length + 1 : 0);
  const last = SHARE_TITLE_TIERS[SHARE_TITLE_TIERS.length - 1] as (typeof SHARE_TITLE_TIERS)[number];
  return (SHARE_TITLE_TIERS.find((t) => total <= t.maxChars) ?? last).fontSize;
}

export function shareCardContent(story: ShareStory, themeLabel: string): ShareCardContent {
  const date = formatSourceDate(story.source_date);
  return {
    appName: SHARE_COPY.appName,
    kicker: SHARE_COPY.kicker,
    themeLabel,
    titleMain: story.title_main,
    titleAccent: story.title_accent,
    source: `Source — ${story.source_name}${date ? `, ${date}` : ""}`,
    tagline: SHARE_COPY.tagline,
    titleFontSize: shareTitleSize(story.title_main, story.title_accent),
  };
}

/** Nom du fichier exporté : « eclaircie-2026-11-03.png ». */
export function shareFileName(story: Pick<ShareStory, "publish_date">): string {
  return `eclaircie-${story.publish_date}.png`;
}
