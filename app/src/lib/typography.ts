/**
 * Typographie française à l'affichage (jamais en base) : espaces insécables là où un retour à la ligne
 * serait fautif. Appliquée aux titres, résumés, sources, à la carte de partage ; même règle en Swift
 * dans le widget (WidgetModel.swift, `frenchTypography`).
 *  - espace fine insécable (U+202F) entre les groupes de chiffres (« 1 000 °C », « 500 000 tonnes »),
 *    avant ; ? ! » et après « ;
 *  - espace insécable (U+00A0) avant : (sauf heures et URL) et entre un nombre et son unité (°C, %, km, kg, €…).
 */
export const THIN_NBSP = " ";
export const NBSP = " ";
const SP = "[   ]";
/** Unités reconnues après un nombre ; l'espace existant devient insécable. Pour %, ° et €, un espace absent est ajouté. */
const UNITS = "°C|°F|km\\/h|km|kg|cm|mm|mg|ha|min|ms|Mo|Go|ko|kW|MW|m|g|h|s|L|l|W";
const TIGHT_UNITS = "%|°|€";

export function frenchTypography(text: string): string {
  let t = text;
  // Groupes de chiffres : « 1 000 000 » → deux passes pour les groupes successifs.
  for (let i = 0; i < 2; i++) t = t.replace(new RegExp(`(\\d)${SP}(?=\\d{3}(?!\\d))`, "g"), `$1${THIN_NBSP}`);
  // Ponctuation haute et guillemets.
  t = t.replace(new RegExp(`(\\S)${SP}*([;?!»])`, "gu"), `$1${THIN_NBSP}$2`);
  t = t.replace(new RegExp(`(«)${SP}*`, "g"), `$1${THIN_NBSP}`);
  // Deux-points : pas avant une heure (10:30) ni dans une URL (http://).
  t = t.replace(new RegExp(`(\\S)${SP}*:(?![/\\d])`, "g"), `$1${NBSP}:`);
  // Unités après un nombre.
  t = t.replace(new RegExp(`(\\d)${SP}(${UNITS})(?![\\p{L}\\d])`, "gu"), `$1${NBSP}$2`);
  t = t.replace(new RegExp(`(\\d)${SP}?(${TIGHT_UNITS})`, "gu"), `$1${NBSP}$2`);
  return t;
}
