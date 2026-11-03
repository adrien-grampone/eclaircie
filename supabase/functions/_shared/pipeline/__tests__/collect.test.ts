import { collectMaxAgeDays, isFreshEnough } from "../collect.ts";
import { CONFIG } from "./fixtures/config.ts";

const NOW = new Date("2026-11-03T12:00:00Z");

describe("collectMaxAgeDays", () => {
  it("donne 7 jours aux sources ordinaires et 30 aux sources trust_level 3, depuis la config", () => {
    expect(collectMaxAgeDays(1, CONFIG)).toBe(7);
    expect(collectMaxAgeDays(2, CONFIG)).toBe(7);
    expect(collectMaxAgeDays(3, CONFIG)).toBe(30);
    expect(collectMaxAgeDays(3, { collect_max_age_days: 5, collect_max_age_days_trust3: 60 })).toBe(60);
  });
});

describe("isFreshEnough", () => {
  it("garde un article récent, rejette un article trop vieux", () => {
    expect(isFreshEnough("2026-11-01T00:00:00Z", 7, NOW)).toBe(true);
    expect(isFreshEnough("2026-10-20T00:00:00Z", 7, NOW)).toBe(false);
    expect(isFreshEnough("2026-10-20T00:00:00Z", 30, NOW)).toBe(true);
  });

  it("garde un article sans date ou à date illisible", () => {
    expect(isFreshEnough(null, 7, NOW)).toBe(true);
    expect(isFreshEnough("bientôt", 7, NOW)).toBe(true);
  });
});
