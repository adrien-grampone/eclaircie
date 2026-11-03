import { CARD_COLOR_QUARTER, cardColor, darkGlassColor, mix, mixOklab, saturation } from "../color.ts";

const INK = "#1F1B16";
const PAPER = "#F5EFE4";
const SCIENCE = "#3E3880";

describe("mix", () => {
  it("rend les bornes aux extrémités et le milieu arrondi", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("mixOklab", () => {
  it("rend les bornes exactes aux extrémités (aller-retour sRGB ↔ OKLab)", () => {
    expect(mixOklab(SCIENCE, PAPER, 0)).toBe(SCIENCE.toLowerCase());
    expect(mixOklab(SCIENCE, PAPER, 1)).toBe(PAPER.toLowerCase());
  });

  it("ne passe pas par un gris désaturé à mi-parcours, contrairement au RGB", () => {
    const dark = darkGlassColor(SCIENCE, INK);
    const mid = mixOklab(dark, PAPER, 0.5);
    expect(saturation(mid)).toBeGreaterThan(saturation(mix(dark, PAPER, 0.5)));
    expect(saturation(mid)).toBeGreaterThan(0.1);
  });
});

describe("cardColor", () => {
  it("fait l'essentiel du changement dans le premier quart et est quasi crème à mi-parcours", () => {
    const dark = darkGlassColor(SCIENCE, INK);
    const lum = (h: string) => [1, 3, 5].reduce((s, i) => s + parseInt(h.slice(i, i + 2), 16), 0) / 3;
    const span = lum(PAPER) - lum(dark);
    expect((lum(cardColor(dark, PAPER, CARD_COLOR_QUARTER)) - lum(dark)) / span).toBeGreaterThan(0.7);
    const mid = cardColor(dark, PAPER, 0.5);
    expect((lum(mid) - lum(dark)) / span).toBeGreaterThan(0.95);
    expect(saturation(mid)).toBeLessThan(0.15);
    expect(cardColor(dark, PAPER, 1)).toBe(PAPER.toLowerCase());
  });
});

describe("darkGlassColor", () => {
  it("assombrit l'accent et reste déterministe", () => {
    const glass = darkGlassColor(SCIENCE, INK);
    expect(glass).toMatch(/^#[0-9a-f]{6}$/);
    expect(saturation(glass)).toBeGreaterThan(0);
    expect(glass).toBe(darkGlassColor(SCIENCE, INK));
  });
});
