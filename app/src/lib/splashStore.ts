import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { PLANETE_PALETTE } from "./splash.ts";
import type { Palette } from "@/theme/tokens.ts";

/**
 * Ce que le splash doit faire quand l'écran d'entrée est prêt : `arrival` (l'écran « Arrivée du jour »
 * est dessous, sa palette est celle-ci, son illustration `image` est révélée en cercle depuis le soleil) ou `fade`
 * (onboarding, Nouvelle directe, erreur : simple fondu). `null` tant que rien n'est prêt.
 */
export type SplashOutcome = { kind: "arrival"; palette: Palette; image: string | null } | { kind: "fade" };

let outcome: SplashOutcome | null = null;
const listeners = new Set<() => void>();

export function settleSplash(next: SplashOutcome): void {
  outcome = next;
  listeners.forEach((l) => l());
}

/** Rejoue le splash (dev). */
export function resetSplash(): void {
  outcome = null;
  listeners.forEach((l) => l());
}

export function useSplashOutcome(): SplashOutcome | null {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => outcome, () => outcome);
}

const LAST_PALETTE_KEY = "eclaircie.last_palette";
const PALETTE_KEYS: (keyof Palette)[] = ["sky_top", "sky_bottom", "sun", "hill_light", "hill_mid", "accent"];

function isPalette(value: unknown): value is Palette {
  return typeof value === "object" && value !== null && PALETTE_KEYS.every((k) => typeof (value as Record<string, unknown>)[k] === "string");
}

/**
 * Palette du dernier thème affiché, pour que le lever du soleil parte dans les bonnes couleurs avant
 * que les données du jour n'arrivent. Planète sinon.
 */
export async function readSplashPalette(): Promise<Palette> {
  try {
    const raw = await AsyncStorage.getItem(LAST_PALETTE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isPalette(parsed) ? parsed : PLANETE_PALETTE;
  } catch {
    return PLANETE_PALETTE;
  }
}

export async function writeSplashPalette(palette: Palette): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_PALETTE_KEY, JSON.stringify(palette));
  } catch {
    // Sans stockage, le prochain splash partira sur Planète.
  }
}
