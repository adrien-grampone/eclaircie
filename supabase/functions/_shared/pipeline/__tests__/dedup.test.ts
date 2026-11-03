import { embeddingInput, isDuplicate, resolveDuplicates, type DedupStory, type Neighbour } from "../dedup.ts";
import { CONFIG } from "./fixtures/config.ts";

const story: DedupStory = { id: "new", trustLevel: 2, status: "verified", createdAt: "2026-11-03T10:00:00Z" };
const near = (overrides: Partial<Neighbour> & { id: string }): Neighbour => ({
  trustLevel: 2, status: "verified", createdAt: "2026-11-01T10:00:00Z", similarity: 0.95, ...overrides,
});

describe("embeddingInput", () => {
  it("concatène le titre en deux parties et le résumé", () => {
    expect(embeddingInput({ title_main: "La couche d'ozone", title_accent: "se répare.", summary: "Résumé." })).toBe("La couche d'ozone se répare.\nRésumé.");
    expect(embeddingInput({ title_main: "Titre", title_accent: null, summary: "R" })).toBe("Titre\nR");
  });
});

describe("isDuplicate", () => {
  it("applique le seuil de la config (0,88)", () => {
    expect(isDuplicate(0.88, CONFIG)).toBe(true);
    expect(isDuplicate(0.879, CONFIG)).toBe(false);
    expect(isDuplicate(0.879, { dedup_similarity: 0.8 })).toBe(true);
  });
});

describe("resolveDuplicates", () => {
  it("est unique sans voisin au-dessus du seuil", () => {
    expect(resolveDuplicates(story, [near({ id: "a", similarity: 0.7 })], CONFIG)).toEqual({ decision: "unique" });
    expect(resolveDuplicates(story, [], CONFIG)).toEqual({ decision: "unique" });
  });

  it("rejette la story face à une source mieux notée", () => {
    const out = resolveDuplicates(story, [near({ id: "onu", trustLevel: 3 })], CONFIG);
    expect(out).toEqual({ decision: "reject_story", duplicateOf: "onu", similarity: 0.95 });
  });

  it("à égalité de confiance, la plus ancienne gagne", () => {
    expect(resolveDuplicates(story, [near({ id: "older" })], CONFIG).decision).toBe("reject_story");
    const newerNeighbour = near({ id: "newer", createdAt: "2026-11-04T00:00:00Z" });
    expect(resolveDuplicates(story, [newerNeighbour], CONFIG)).toEqual({ decision: "keep_story", rejectIds: ["newer"] });
  });

  it("garde la story mieux sourcée et rejette les doublons remplaçables", () => {
    const out = resolveDuplicates({ ...story, trustLevel: 3 }, [near({ id: "a" }), near({ id: "b", status: "approved", similarity: 0.9 }), near({ id: "loin", similarity: 0.5 })], CONFIG);
    expect(out).toEqual({ decision: "keep_story", rejectIds: ["a", "b"] });
  });

  it("ne remplace jamais une story déjà programmée, même moins bien sourcée", () => {
    const out = resolveDuplicates({ ...story, trustLevel: 3 }, [near({ id: "sched", trustLevel: 1, status: "scheduled" })], CONFIG);
    expect(out).toEqual({ decision: "reject_story", duplicateOf: "sched", similarity: 0.95 });
  });

  it("désigne comme doublon de référence le gagnant le plus similaire", () => {
    const out = resolveDuplicates(story, [near({ id: "a", trustLevel: 3, similarity: 0.9 }), near({ id: "b", trustLevel: 3, similarity: 0.97 })], CONFIG);
    expect(out).toEqual({ decision: "reject_story", duplicateOf: "b", similarity: 0.97 });
  });
});
