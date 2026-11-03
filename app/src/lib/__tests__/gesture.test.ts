import { crossedThreshold, decideRelease, progressFromDrag } from "../gesture.ts";

const CFG = { distanceThreshold: 1 / 3, velocityThreshold: 700 };

describe("progressFromDrag", () => {
  it("suit le doigt vers le haut, borné entre 0 et 1, et ignore un trajet nul", () => {
    expect(progressFromDrag(-50, 200)).toBeCloseTo(0.25);
    expect(progressFromDrag(30, 200)).toBe(0);
    expect(progressFromDrag(-500, 200)).toBe(1);
    expect(progressFromDrag(-50, 0)).toBe(0);
  });
});

describe("decideRelease", () => {
  it("termine au-delà du tiers du trajet, même lentement", () => {
    expect(decideRelease(0.34, 0, CFG)).toBe("complete");
    expect(decideRelease(0.34, 300, CFG)).toBe("complete");
  });

  it("termine sur un geste rapide vers le haut, même court", () => {
    expect(decideRelease(0.1, -900, CFG)).toBe("complete");
    expect(decideRelease(0.1, -700, CFG)).toBe("complete");
  });

  it("revient en place sinon : court et lent, ou rapide vers le bas, ou sans mouvement", () => {
    expect(decideRelease(0.2, -300, CFG)).toBe("cancel");
    expect(decideRelease(0.2, 900, CFG)).toBe("cancel");
    expect(decideRelease(0, -2000, CFG)).toBe("cancel");
    expect(decideRelease(1 / 3, 0, CFG)).toBe("cancel");
  });

  it("suit les seuils de la config", () => {
    expect(decideRelease(0.2, 0, { distanceThreshold: 0.15, velocityThreshold: 700 })).toBe("complete");
    expect(decideRelease(0.1, -500, { distanceThreshold: 1 / 3, velocityThreshold: 400 })).toBe("complete");
  });
});

describe("crossedThreshold", () => {
  it("ne signale le franchissement qu'une fois, vers le haut", () => {
    expect(crossedThreshold(0.3, 0.4, CFG)).toBe(true);
    expect(crossedThreshold(0.4, 0.5, CFG)).toBe(false);
    expect(crossedThreshold(0.4, 0.3, CFG)).toBe(false);
    expect(crossedThreshold(1 / 3, 1 / 3 + 0.001, CFG)).toBe(true);
  });
});
