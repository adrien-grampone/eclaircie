import { describe, expect, it } from "vitest";
import { VEIL_ACCENT, VEIL_INK } from "./arrivalBackdrop.ts";
import { mix } from "./color.ts";
import {
  HOLD_AT, NIGHT, PLANETE_PALETTE, SUNRISE, WORD_OUT, arrivalBand, crestCrossingT, haloOpacity, hillColor, nightBand,
  overlayOpacity, revealDiameter, revealSize, skyBand, sunGeometry, sunHideOffset, sunOnScreen, sunTranslate, sunrise, wordOpacity,
} from "./splash.ts";

const INK = "#1F1B16";
const g = sunGeometry(852, 0.36, 150, 420);

describe("sunrise", () => {
  it("est nul avant la fenêtre, plein après, croissant et adouci en sortie", () => {
    expect(sunrise(0)).toBe(0);
    expect(sunrise(SUNRISE[0])).toBe(0);
    expect(sunrise(SUNRISE[1])).toBe(1);
    expect(sunrise(1)).toBe(1);
    const mid = (SUNRISE[0] + SUNRISE[1]) / 2;
    expect(sunrise(mid)).toBeGreaterThan(0.5);
    expect(sunrise(mid)).toBeLessThan(sunrise(mid + 0.05));
  });
});

describe("couleurs", () => {
  it("la bande finale est le dégradé du thème sous le voile de l'arrivée (accent puis encre)", () => {
    const expected = mix(mix(mix(PLANETE_PALETTE.sky_top, PLANETE_PALETTE.sky_bottom, 5 / 23), PLANETE_PALETTE.accent, VEIL_ACCENT), INK, VEIL_INK);
    expect(arrivalBand(5, PLANETE_PALETTE, INK)).toBe(expected);
  });
  it("part de la nuit et arrive exactement sur la bande de l'arrivée", () => {
    expect(skyBand(0, PLANETE_PALETTE, INK, 0)).toBe(nightBand(0));
    expect(nightBand(0)).toBe(NIGHT.top);
    expect(skyBand(23, PLANETE_PALETTE, INK, 1)).toBe(arrivalBand(23, PLANETE_PALETTE, INK));
    expect(hillColor(PLANETE_PALETTE.hill_mid, 1)).toBe(PLANETE_PALETTE.hill_mid.toLowerCase());
  });
});

describe("soleil", () => {
  it("est entièrement caché au départ et à sa place à la fin", () => {
    const offset = sunHideOffset(g);
    expect(g.sunTop + sunTranslate(0, offset)).toBeGreaterThan(g.crest);
    expect(sunTranslate(1, offset)).toBe(0);
  });
  it("franchit la crête pendant le lever", () => {
    const t = crestCrossingT(g);
    expect(t).toBeGreaterThan(SUNRISE[0]);
    expect(t).toBeLessThan(SUNRISE[1]);
  });
  it("halo absent au début et à la fin du lever", () => {
    expect(haloOpacity(0)).toBe(0);
    expect(haloOpacity(SUNRISE[1])).toBeCloseTo(0, 6);
    expect(haloOpacity((SUNRISE[0] + SUNRISE[1]) / 2)).toBeGreaterThan(0);
  });
});

describe("séquence des textes", () => {
  it("le mot est parti avant que l'écran apparaisse : jamais deux textes à la fois", () => {
    expect(wordOpacity(0)).toBe(0);
    expect(wordOpacity(0.5)).toBe(1);
    expect(wordOpacity(WORD_OUT[1])).toBe(0);
    expect(WORD_OUT[1]).toBeLessThanOrEqual(HOLD_AT);
    expect(overlayOpacity(HOLD_AT)).toBe(1);
    expect(overlayOpacity(1)).toBe(0);
  });
});

describe("révélé circulaire", () => {
  const sun = { topShare: 0.36, rightShare: 0.12, size: 150 };
  it("place le soleil à l'écran avec le zoom et le décalage de l'arrivée", () => {
    const { cx, cy, r } = sunOnScreen(400, 800, sun, 0.2, 1.5);
    expect(r).toBe(112.5);
    // Centre du soleil dans le cadre : x = 400·0,88 − 75 = 277, y = 288 + 75 = 363 ; puis zoom 1,5 autour du centre et +160.
    expect(cx).toBeCloseTo(200 + 77 * 1.5);
    expect(cy).toBeCloseTo(400 + (363 - 400) * 1.5 + 160);
  });
  it("couvre l'écran entier à la fin, et part du diamètre du soleil", () => {
    const full = revealDiameter(300, 600, 400, 800);
    expect(full).toBeCloseTo(2 * Math.hypot(300, 600));
    expect(revealSize(0, 112.5, full)).toBe(225);
    expect(revealSize(1, 112.5, full)).toBe(full);
    expect(revealSize(2, 112.5, full)).toBe(full);
  });
});
