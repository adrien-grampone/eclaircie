import { describe, expect, it } from "vitest";
import { SUN_DROP, SUN_ZOOM } from "./arrivalBackdrop.ts";
import { BOTTOM_END, arrivalZoom, cardGeometry, cardPieces, cardRect, coverRect, imageFrames, lerpRect, motionTransform, rectMotion, skyFrames, skyRects } from "./arrivalMotion.ts";
import { FULL_SKY, HILL } from "./skyLayout.ts";

const SCREEN = { w: 390, h: 844 };
const IMAGE_HEIGHT = 427;

describe("rectMotion", () => {
  it("est l'identité quand la vue est déjà à sa place", () => {
    const r = { x: 10, y: 20, w: 100, h: 50 };
    expect(rectMotion(r, r)).toEqual({ translateX: 0, translateY: 0, scaleX: 1, scaleY: 1 });
  });
  it("déplace le centre et met à l'échelle autour de lui", () => {
    const m = rectMotion({ x: 0, y: 0, w: 100, h: 100 }, { x: 100, y: 200, w: 50, h: 200 });
    expect(m).toEqual({ translateX: 75, translateY: 250, scaleX: 0.5, scaleY: 2 });
    expect(motionTransform(m)).toEqual([{ translateX: 75 }, { translateY: 250 }, { scaleX: 0.5 }, { scaleY: 2 }]);
  });
  it("lerpRect interpole chaque composante", () => {
    expect(lerpRect({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 20, w: 30, h: 50 }, 0.5)).toEqual({ x: 5, y: 10, w: 20, h: 30 });
  });
});

describe("illustration", () => {
  it("cover : remplit le cadre, centré, sans déformer", () => {
    const full = coverRect(SCREEN, { w: 3, h: 4 });
    expect(full.h).toBe(844);
    expect(full.w).toBeCloseTo(633);
    expect(full.x).toBeCloseTo(-121.5);
    expect(full.y).toBe(0);
    const area = coverRect({ w: 390, h: IMAGE_HEIGHT }, { w: 3, h: 4 });
    expect(area.w).toBe(390);
    expect(area.h).toBe(520);
    expect(area.y).toBeCloseTo((IMAGE_HEIGHT - 520) / 2);
  });
  it("arrivée et finale sont deux cadrages cover de la même image (mouvement uniforme)", () => {
    const { arrival, final } = imageFrames(SCREEN, IMAGE_HEIGHT, { w: 1290, h: 1720 });
    const m = rectMotion(arrival, final);
    expect(m.scaleX).toBeCloseTo(m.scaleY);
    expect(m.scaleX).toBeLessThan(1);
  });
});

describe("ciel dessiné", () => {
  it("skyRects suit les règles du composant Sky (soleil à droite, collines ancrées en bas)", () => {
    const r = skyRects(FULL_SKY, SCREEN);
    expect(r.sun).toEqual({ x: 390 - 0.12 * 390 - 150, y: 0.36 * 844, w: 150, h: 150 });
    expect(r.hill0).toEqual({ x: -0.45 * 390, y: 844 - 190, w: 1.7 * 390, h: HILL });
    expect(r.gradient).toEqual({ x: 0, y: 0, w: 390, h: 844 });
  });
  it("arrivalZoom reproduit le zoom et la descente de l'arrivée", () => {
    const z = arrivalZoom({ x: 0, y: 0, w: 390, h: 844 }, SCREEN);
    expect(z.w).toBeCloseTo(390 * SUN_ZOOM);
    expect(z.h).toBeCloseTo(844 * SUN_ZOOM);
    expect(z.x + z.w / 2).toBeCloseTo(195);
    expect(z.y + z.h / 2).toBeCloseTo(422 + 844 * SUN_DROP);
  });
  it("skyFrames : le soleil garde son ratio (échelle uniforme) et finit dans la zone d'illustration", () => {
    const f = skyFrames(FULL_SKY, SCREEN, IMAGE_HEIGHT);
    const m = rectMotion(f.sun.final, f.sun.arrival);
    expect(m.scaleX).toBeCloseTo(SUN_ZOOM);
    expect(m.scaleY).toBeCloseTo(SUN_ZOOM);
    expect(f.sun.final.y).toBeCloseTo(0.36 * IMAGE_HEIGHT);
    expect(f.hill2.final.y).toBe(IMAGE_HEIGHT - 70);
  });
});

describe("carte", () => {
  const g = cardGeometry(SCREEN, { insetBottom: 34, margin: 16, cardHeight: 250, sheetTop: IMAGE_HEIGHT - 30, radius: 30 });
  it("repos en bas avec marges, feuille finale pleine largeur dépassant du bas", () => {
    expect(g.rest).toEqual({ x: 16, y: 844 - 34 - 16 - 250, w: 358, h: 250 });
    expect(g.final).toEqual({ x: 0, y: IMAGE_HEIGHT - 30, w: 390, h: 844 + 30 - (IMAGE_HEIGHT - 30) });
  });
  it("cardRect : repos à 0, feuille à 1, bas sous l'écran dès BOTTOM_END", () => {
    expect(cardRect(g, 0)).toEqual(g.rest);
    expect(cardRect(g, 1)).toEqual(g.final);
    const mid = cardRect(g, BOTTOM_END);
    expect(mid.y + mid.h).toBeCloseTo(g.final.y + g.final.h);
    expect(mid.w).toBeCloseTo(358 + 32 * BOTTOM_END);
  });
  it("cardPieces : calottes de la hauteur du rayon, corps chevauchant", () => {
    const p = cardPieces({ x: 16, y: 500, w: 358, h: 250 }, 30, 2);
    expect(p.top).toEqual({ x: 16, y: 500, w: 358, h: 30 });
    expect(p.bottom).toEqual({ x: 16, y: 720, w: 358, h: 30 });
    expect(p.body).toEqual({ x: 16, y: 528, w: 358, h: 194 });
  });
});
