import { describe, expect, it } from "vitest";
import { chroma } from "./color.ts";
import {
  CHROMA_MIN, DAWN, HILL_PLANES, HOLD_AT, NIGHT, PINK, PLANETE_PALETTE, SILHOUETTE, SUNRISE, WORD_CONTRAST_MIN, WORD_IN, WORD_OUT,
  creamWeight, crestCrossingT, haloOpacity, hillColor, overlayOpacity, revealDiameter, revealSize, skyBehindWord, skyColorAt, skyStages,
  stageOpacity, sunLayout, sunTranslate, sunrise, wordContrast, wordDarkColor, wordOpacity,
} from "./splash.ts";

const INK = "#1F1B16", PAPER = "#F5EFE4";

describe("sunrise", () => {
  it("est nul avant la fenêtre, plein après, croissant et adouci en sortie", () => {
    expect(sunrise(0)).toBe(0);
    expect(sunrise(SUNRISE[0])).toBe(0);
    expect(sunrise(SUNRISE[1])).toBe(1);
    const mid = (SUNRISE[0] + SUNRISE[1]) / 2;
    expect(sunrise(mid)).toBeGreaterThan(0.5);
    expect(sunrise(mid)).toBeLessThan(sunrise(mid + 0.05));
  });
});

describe("ciel par étapes", () => {
  const stages = skyStages(PLANETE_PALETTE);
  it("les étapes se fondent l'une après l'autre, la nuit reste au fond", () => {
    expect(stageOpacity(0, 0)).toBe(1);
    expect(stageOpacity(1, 0)).toBe(0);
    expect(stageOpacity(1, 1 / 3)).toBeCloseTo(1);
    expect(stageOpacity(2, 1 / 3)).toBeCloseTo(0);
    expect(stageOpacity(3, 1)).toBe(1);
    expect(skyColorAt(stages, 0, "top")).toBe(NIGHT.top);
    expect(skyColorAt(stages, 1, "horizon").toLowerCase()).toBe(stages[3]?.horizon.toLowerCase());
  });
  it("aucune couleur ni aucun milieu de fondu ne descend sous la chroma minimale (pas de gris ni de kaki)", () => {
    for (const stage of [NIGHT, DAWN, PINK]) for (const key of ["top", "horizon"] as const) expect(chroma(stage[key]), `${key} ${stage[key]}`).toBeGreaterThanOrEqual(CHROMA_MIN);
    for (let i = 0; i <= 30; i++) {
      const rise = i / 30;
      for (const key of ["top", "horizon"] as const) {
        const c = skyColorAt(stages, rise, key);
        expect(chroma(c), `rise ${rise.toFixed(2)} ${key} ${c}`).toBeGreaterThanOrEqual(CHROMA_MIN);
      }
    }
  });
  it("l'horizon est plus chaud (plus clair et plus rouge) que le haut à chaque étape", () => {
    for (const stage of stages) {
      const top = parseInt(stage.top.slice(1, 3), 16), horizon = parseInt(stage.horizon.slice(1, 3), 16);
      expect(horizon).toBeGreaterThan(top);
    }
  });
});

describe("soleil centré derrière la crête", () => {
  const layout = sunLayout(393, 852);
  it("fait 28 % de la largeur, centré, entièrement dans l'écran à la fin", () => {
    expect(layout.size).toBeCloseTo(393 * 0.28);
    expect(layout.cx).toBe(196.5);
    expect(layout.cy - layout.size / 2).toBeGreaterThan(0);
    expect(layout.cy + layout.size / 2).toBeLessThan(852);
  });
  it("est caché sous la crête au départ et en dépasse aux deux tiers à la fin", () => {
    expect(layout.cy - layout.size / 2 + sunTranslate(0, layout.hideOffset)).toBeGreaterThan(layout.crestY);
    expect(sunTranslate(1, layout.hideOffset)).toBe(0);
    expect(layout.crestY - layout.cy).toBeCloseTo(layout.size * 0.2);
  });
  it("se cache derrière le plan le plus haut au centre, pas forcément le premier", () => {
    const tops = HILL_PLANES.map((p) => 852 - 852 * p.heightShare * (1 - p.crestShare));
    expect(layout.crestY).toBeCloseTo(Math.min(...tops));
  });
  it("franchit la crête pendant le lever, halo absent la nuit", () => {
    const t = crestCrossingT(layout);
    expect(t).toBeGreaterThan(SUNRISE[0]);
    expect(t).toBeLessThan(SUNRISE[1]);
    expect(haloOpacity(0)).toBe(0);
    expect(haloOpacity(1)).toBeGreaterThan(0);
  });
});

describe("collines et textes", () => {
  it("les collines partent de la silhouette et arrivent sur leur couleur", () => {
    expect(hillColor(PLANETE_PALETTE.hill_mid, 0)).toBe(SILHOUETTE);
    expect(hillColor(PLANETE_PALETTE.hill_mid, 1)).toBe(PLANETE_PALETTE.hill_mid.toLowerCase());
  });
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
  it("couvre l'écran entier à la fin, et part du diamètre du soleil", () => {
    const full = revealDiameter(196, 600, 393, 852);
    expect(full).toBeCloseTo(2 * Math.hypot(197, 600));
    expect(revealSize(0, 55, full)).toBe(110);
    expect(revealSize(1, 55, full)).toBe(full);
    expect(revealSize(2, 55, full)).toBe(full);
  });
});

describe("contraste du mot", () => {
  const stages = skyStages(PLANETE_PALETTE);
  const dark = wordDarkColor(PLANETE_PALETTE, INK);
  it("à chaque instant où le mot est visible, la variante retenue contraste à au moins 3:1 contre le ciel", () => {
    for (let i = 0; i <= 40; i++) {
      const t = WORD_IN[0] + ((WORD_OUT[1] - WORD_IN[0]) * i) / 40;
      const sky = skyBehindWord(stages, sunrise(t));
      expect(wordContrast(sky, dark, PAPER), `t=${t.toFixed(3)} ciel ${sky}`).toBeGreaterThanOrEqual(WORD_CONTRAST_MIN);
    }
  });
  it("choisit la crème sur un ciel sombre et le sombre sur un ciel clair, avec un fondu entre les deux", () => {
    expect(creamWeight(NIGHT.top, dark, PAPER)).toBe(1);
    expect(creamWeight(PLANETE_PALETTE.sky_bottom, dark, PAPER)).toBe(0);
    const w = creamWeight("#868686", dark, PAPER);
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThan(1);
  });
});
