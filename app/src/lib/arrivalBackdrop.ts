/**
 * Géométrie et voile du fond de l'écran « Arrivée du jour » avec un ciel dessiné : partagés entre la
 * transition Arrivée → Nouvelle (DailyFlow) et le splash animé, dont la dernière image doit coïncider.
 */
/** À l'arrivée, le ciel est agrandi et décalé vers le bas pour que le soleil soit bas. */
export const SUN_DROP = 0.2;
export const SUN_ZOOM = 1.5;
/** Voile sombre de l'arrivée sur les bandes du ciel (sous le soleil et les collines) : part d'accent, part d'encre. */
export const VEIL_ACCENT = 0.5;
export const VEIL_INK = 0.2;
