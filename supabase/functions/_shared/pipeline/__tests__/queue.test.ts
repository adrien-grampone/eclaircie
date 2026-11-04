import { orderQueue, sourceYield, sourcesToReview, yieldBySource } from "../queue.ts";
import { CONFIG } from "./fixtures/config.ts";

describe("sourceYield", () => {
  it("vaut l'a priori (10 %) pour une source sans historique", () => {
    expect(sourceYield({ triaged: 0, accepted: 0 }, CONFIG)).toBeCloseTo(0.1, 10);
  });

  it("tend vers le taux réel quand la source est très triée, et reste lissée sur peu d'articles", () => {
    expect(sourceYield({ triaged: 1000, accepted: 500 }, CONFIG)).toBeCloseTo(0.496, 3);
    // 2 acceptés sur 2 : pas 100 %, l'a priori pèse 10 articles à 10 %.
    expect(sourceYield({ triaged: 2, accepted: 2 }, CONFIG)).toBeCloseTo(3 / 12, 10);
    expect(sourceYield({ triaged: 50, accepted: 0 }, CONFIG)).toBeCloseTo(1 / 60, 10);
  });

  it("lit l'a priori et son poids dans la config", () => {
    expect(sourceYield({ triaged: 0, accepted: 0 }, { triage_source_prior_rate: 0.3, triage_source_prior_weight: 5 })).toBeCloseTo(0.3, 10);
    expect(sourceYield({ triaged: 5, accepted: 5 }, { triage_source_prior_rate: 0, triage_source_prior_weight: 0 })).toBe(1);
  });
});

describe("orderQueue", () => {
  const yields = yieldBySource([
    { source_id: "bonne", triaged: 40, accepted: 20 },
    { source_id: "faible", triaged: 60, accepted: 1 },
  ], CONFIG);
  const c = (id: string, source_id: string, published_at: string | null) => ({ id, source_id, published_at });

  it("passe d'abord la source au meilleur rendement, puis les plus récents, une source inconnue vaut l'a priori", () => {
    const ordered = orderQueue([
      c("f-new", "faible", "2026-11-04T08:00:00Z"),
      c("b-old", "bonne", "2026-11-01T08:00:00Z"),
      c("b-new", "bonne", "2026-11-03T08:00:00Z"),
      c("inconnue", "neuve", "2026-11-04T09:00:00Z"),
      c("sans-date", "bonne", null),
    ], yields, CONFIG);
    expect(ordered.map((x) => x.id)).toEqual(["b-new", "b-old", "sans-date", "inconnue", "f-new"]);
  });

  it("ne modifie pas le tableau d'entrée", () => {
    const input = [c("a", "bonne", "2026-11-01T00:00:00Z"), c("b", "bonne", "2026-11-02T00:00:00Z")];
    orderQueue(input, yields, CONFIG);
    expect(input.map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("sourcesToReview", () => {
  it("retient les sources avec au moins le seuil de triés et aucun accepté", () => {
    const stats = [
      { source_id: "a", triaged: 50, accepted: 0 },
      { source_id: "b", triaged: 49, accepted: 0 },
      { source_id: "c", triaged: 200, accepted: 1 },
    ];
    expect(sourcesToReview(stats, CONFIG).map((s) => s.source_id)).toEqual(["a"]);
    expect(sourcesToReview(stats, { triage_source_review_min: 20 }).map((s) => s.source_id)).toEqual(["a", "b"]);
  });
});
