/**
 * Geste de tirage de la carte d'arrivée (logique pure, testée).
 * Le doigt tire la carte vers le haut ; `progress` suit le doigt entre 0 (en place) et 1 (feuille).
 * Au relâchement : on termine si la distance dépasse le seuil OU si le geste est assez rapide vers le haut.
 * Les fonctions sont des worklets : appelées depuis le fil UI (Reanimated) pendant le geste.
 */
export interface ReleaseConfig {
  /** Part du trajet au-delà de laquelle on ne revient plus (ex. 1/3). */
  distanceThreshold: number;
  /** Vitesse vers le haut (px/s, valeur positive) qui suffit à terminer, même sur un geste court. */
  velocityThreshold: number;
}

export const RELEASE_CONFIG: ReleaseConfig = { distanceThreshold: 1 / 3, velocityThreshold: 700 };

/** Progression d'un déplacement du doigt (translationY négatif vers le haut) sur un trajet de `travel` px. */
export function progressFromDrag(translationY: number, travel: number): number {
  "worklet";
  if (travel <= 0) return 0;
  return Math.min(1, Math.max(0, -translationY / travel));
}

export type ReleaseDecision = "complete" | "cancel";

/** `velocityY` au sens du geste : négatif vers le haut. */
export function decideRelease(progress: number, velocityY: number, config: ReleaseConfig = RELEASE_CONFIG): ReleaseDecision {
  "worklet";
  if (progress >= 1) return "complete";
  if (progress > config.distanceThreshold) return "complete";
  if (-velocityY >= config.velocityThreshold && progress > 0) return "complete";
  return "cancel";
}

/** Vrai quand `progress` vient de franchir le seuil de non-retour vers le haut (pour l'haptique, une seule fois). */
export function crossedThreshold(previous: number, current: number, config: ReleaseConfig = RELEASE_CONFIG): boolean {
  "worklet";
  return previous <= config.distanceThreshold && current > config.distanceThreshold;
}
