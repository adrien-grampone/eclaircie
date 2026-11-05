import { formatSourceDate, sourceLabel } from "./daily.ts";

/**
 * Carte story à partager (spec §8, maquette 04) : logique pure. 390×693 points, exportée à l'échelle
 * de l'appareil (×3 sur les iPhone récents).
 */
export const SHARE_CARD = { width: 390, height: 693, scale: 3 } as const;

export const SHARE_COPY = { appName: "éclaircie", kicker: "BONNE NOUVELLE DU JOUR", tagline: "Une bonne nouvelle par jour" } as const;

/** Texte d'accompagnement du partage (Messages, WhatsApp, Mail…). */
export const SHARE_MESSAGE = "Ma bonne nouvelle du jour, via Éclaircie.";
/** Lien App Store à renseigner à la publication : ajouté au texte d'accompagnement quand il existe. */
export const APP_STORE_URL = "";

export function shareMessage(storeUrl: string = APP_STORE_URL): string {
  return storeUrl ? `${SHARE_MESSAGE} ${storeUrl}` : SHARE_MESSAGE;
}

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
    source: `Source — ${sourceLabel(story.source_name)}${date ? `, ${date}` : ""}`,
    tagline: SHARE_COPY.tagline,
    titleFontSize: shareTitleSize(story.title_main, story.title_accent),
  };
}

/** Nom lisible du fichier exporté : « eclaircie-3-novembre.png ». */
export function shareFileName(story: Pick<ShareStory, "publish_date">, locale = "fr-FR"): string {
  const [y, m, d] = story.publish_date.split("-").map(Number) as [number, number, number];
  const label = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  const slug = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `eclaircie-${slug}.png`;
}
