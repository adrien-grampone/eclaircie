import * as Haptics from "expo-haptics";

/**
 * Retours haptiques de l'app, en un seul endroit.
 * tap : un bouton pressé (léger). threshold : franchissement du seuil de non-retour du geste (très léger).
 * land : fin de la transition signature (moyen, une seule fois).
 */
export function hapticTap(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function hapticLand(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function hapticThreshold(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
}
