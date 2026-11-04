/**
 * Variables de démonstration (captures sur simulateur sans tap). Lues littéralement pour qu'Expo
 * les inline, mais seulement honorées en développement : dans un build preview ou production,
 * elles sont ignorées même si elles sont définies.
 */
const RAW = {
  /** show force l'Arrivée, auto lance aussi la transition. */
  arrival: process.env.EXPO_PUBLIC_DEMO_ARRIVAL,
  /** show|time|auto rejoue l'onboarding. */
  onboarding: process.env.EXPO_PUBLIC_DEMO_ONBOARDING,
  /** capture : exporte la carte de partage au chargement. */
  share: process.env.EXPO_PUBLIC_DEMO_SHARE,
  /** show : ouvre la feuille « Signaler une erreur ». */
  report: process.env.EXPO_PUBLIC_DEMO_REPORT,
  /** on : appuie sur le signet. */
  save: process.env.EXPO_PUBLIC_DEMO_SAVE,
  /** end fait défiler une liste jusqu'au bas, open ouvre la première nouvelle de la dernière section. */
  list: process.env.EXPO_PUBLIC_DEMO_LIST,
} as const;

export type DemoKey = keyof typeof RAW;

/** Valeur effective d'une variable DEMO : celle définie en dev, rien hors dev (logique pure, testée). */
export function demoValue(value: string | undefined, dev: boolean): string | undefined {
  return dev && value !== undefined && value !== "" ? value : undefined;
}

export function demo(key: DemoKey): string | undefined {
  return demoValue(RAW[key], __DEV__);
}
