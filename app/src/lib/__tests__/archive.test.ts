import { alsoToday, isRetracted, paginate, pastEntries, toggleSaved } from "../archive.ts";
import type { Story } from "../../types.ts";

const story = (id: string, theme_id: string, publish_date: string, status: Story["status"] = "scheduled"): Story => ({
  id, theme_id, publish_date, status, title_main: "T", title_accent: null, summary: "S", source_name: "src", source_url: "https://x", source_date: null, image_path: null,
});
const TODAY = "2026-11-04";
const ALL = [
  story("sci-today", "science", TODAY), story("pla-today", "planete", TODAY), story("ani-today", "animaux", TODAY),
  story("sci-old", "science", "2026-11-02"), story("pla-yest", "planete", "2026-11-03"), story("ret", "sante", "2026-11-01", "retracted"),
  story("ret-today", "culture", TODAY, "retracted"),
];

describe("alsoToday", () => {
  it("liste les nouvelles du jour des autres thèmes, triées par thème, sans celle affichée ni les retirées", () => {
    expect(alsoToday(ALL, TODAY, "sci-today").map((s) => s.id)).toEqual(["ani-today", "pla-today"]);
    expect(alsoToday(ALL, TODAY, null).map((s) => s.id)).toEqual(["ani-today", "pla-today", "sci-today"]);
    expect(alsoToday(ALL, "2026-11-05", null)).toEqual([]);
  });
});

describe("pastEntries", () => {
  it("garde les jours passés, du plus récent au plus ancien, retirées comprises", () => {
    expect(pastEntries(ALL, TODAY).map((s) => s.id)).toEqual(["pla-yest", "sci-old", "ret"]);
    expect(isRetracted(ALL[5]!)).toBe(true);
    expect(isRetracted(ALL[0]!)).toBe(false);
  });
});

describe("paginate", () => {
  it("rend les pages cumulées et signale s'il en reste", () => {
    const items = Array.from({ length: 45 }, (_, i) => i);
    expect(paginate(items, 0)).toEqual({ items: items.slice(0, 20), hasMore: true });
    expect(paginate(items, 1).items.length).toBe(40);
    expect(paginate(items, 2)).toEqual({ items, hasMore: false });
    expect(paginate([], 0)).toEqual({ items: [], hasMore: false });
  });
});

describe("toggleSaved", () => {
  it("ajoute puis retire sans modifier l'ensemble d'origine", () => {
    const base = new Set(["a"]);
    const added = toggleSaved(base, "b");
    expect([...added]).toEqual(["a", "b"]);
    expect([...toggleSaved(added, "a")]).toEqual(["b"]);
    expect([...base]).toEqual(["a"]);
  });
});
