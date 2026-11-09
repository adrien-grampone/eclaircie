import { describe, expect, it } from "vitest";
import { MIN_GUTTER, SINGLE, foldLayout, pairRows } from "./fold.ts";

/** Écran intérieur de l'iPhone Duo en paysage (2853 × 2007 px à 3x). */
const INNER = { width: 951, height: 669 };

describe("foldLayout", () => {
  it("deux panneaux côte à côte de part et d'autre du pli → double page, gouttière centrée sur la frontière", () => {
    const l = foldLayout(INNER, { x: 0, y: 0, width: 460, height: 669 }, { x: 491, y: 0, width: 376, height: 669 });
    expect(l).toEqual({ kind: "spread", left: { x: 0, width: 460 }, gutter: { x: 460, width: 31 }, right: { x: 491, width: 460 } });
  });
  it("panneaux jointifs : gouttière minimale centrée sur la jonction", () => {
    const l = foldLayout(INNER, { x: 0, y: 0, width: 475, height: 669 }, { x: 475, y: 0, width: 476, height: 669 });
    expect(l.kind).toBe("spread");
    if (l.kind !== "spread") return;
    expect(l.gutter.width).toBe(MIN_GUTTER);
    expect(l.gutter.x + l.gutter.width / 2).toBe(475);
    expect(l.left.width + l.gutter.width + l.right.width).toBe(INNER.width);
  });
  it("l'ordre des mesures n'importe pas", () => {
    expect(foldLayout(INNER, { x: 491, y: 0, width: 376, height: 669 }, { x: 0, y: 0, width: 460, height: 669 }).kind).toBe("spread");
  });
  it("page unique : iPhone, Duo plié, panneaux empilés ou superposés, mesures absentes", () => {
    expect(foldLayout({ width: 402, height: 874 }, { x: 0, y: 0, width: 200, height: 874 }, { x: 202, y: 0, width: 200, height: 874 })).toEqual(SINGLE);
    expect(foldLayout(INNER, { x: 0, y: 0, width: 951, height: 330 }, { x: 0, y: 339, width: 951, height: 330 })).toEqual(SINGLE);
    expect(foldLayout(INNER, { x: 0, y: 0, width: 951, height: 669 }, { x: 0, y: 0, width: 951, height: 669 })).toEqual(SINGLE);
    expect(foldLayout(INNER, null, { x: 0, y: 0, width: 400, height: 669 })).toEqual(SINGLE);
    expect(foldLayout(INNER, { x: 0, y: 0, width: 0, height: 669 }, { x: 0, y: 0, width: 951, height: 669 })).toEqual(SINGLE);
  });
});

describe("pairRows", () => {
  it("range les éléments par lignes, la dernière peut être incomplète", () => {
    expect(pairRows([1, 2, 3])).toEqual([[1, 2], [3, null]]);
    expect(pairRows([])).toEqual([]);
  });
});
