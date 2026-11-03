import { buildDedupPrompt, matchedCandidate, parseDedup, resolveDuplicate, type DedupCard, type DedupStory } from "../dedup.ts";
import { CONFIG } from "./fixtures/config.ts";

const story: DedupStory = { id: "new", trustLevel: 2, status: "verified", createdAt: "2026-11-03T10:00:00Z" };
const dup = (overrides: Partial<DedupStory> & { id: string }): DedupStory => ({
  trustLevel: 2, status: "verified", createdAt: "2026-11-01T10:00:00Z", ...overrides,
});

describe("parseDedup", () => {
  it("accepte un identifiant ou null, avec une raison", () => {
    expect(parseDedup('{"duplicate_of":"abc","reason":"même rapport de l\'ONU"}').ok).toBe(true);
    const none = parseDedup('{"duplicate_of":null,"reason":"événements distincts"}');
    expect(none.ok).toBe(true);
    if (none.ok) expect(none.value.duplicate_of).toBeNull();
  });

  it("refuse une raison vide ou un champ manquant", () => {
    expect(parseDedup('{"duplicate_of":null,"reason":""}').ok).toBe(false);
    expect(parseDedup('{"duplicate_of":null}').ok).toBe(false);
    expect(parseDedup('{"reason":"x"}').ok).toBe(false);
  });
});

describe("matchedCandidate", () => {
  const candidates = [{ id: "a" }, { id: "b" }];
  it("retrouve la candidate désignée, ou null", () => {
    expect(matchedCandidate({ duplicate_of: "b", reason: "r" }, candidates)).toEqual({ id: "b" });
    expect(matchedCandidate({ duplicate_of: null, reason: "r" }, candidates)).toBeNull();
  });
  it("traite un identifiant inconnu comme l'absence de doublon", () => {
    expect(matchedCandidate({ duplicate_of: "halluciné", reason: "r" }, candidates)).toBeNull();
  });
});

describe("resolveDuplicate", () => {
  it("est unique sans doublon", () => {
    expect(resolveDuplicate(story, null)).toEqual({ decision: "unique" });
  });

  it("rejette la story face à une source mieux notée", () => {
    expect(resolveDuplicate(story, dup({ id: "onu", trustLevel: 3 }))).toEqual({ decision: "reject_story", duplicateOf: "onu" });
  });

  it("à égalité de confiance, la plus ancienne gagne", () => {
    expect(resolveDuplicate(story, dup({ id: "older" })).decision).toBe("reject_story");
    expect(resolveDuplicate(story, dup({ id: "newer", createdAt: "2026-11-04T00:00:00Z" }))).toEqual({ decision: "keep_story", rejectIds: ["newer"] });
  });

  it("garde la story mieux sourcée et rejette le doublon remplaçable", () => {
    expect(resolveDuplicate({ ...story, trustLevel: 3 }, dup({ id: "a", status: "approved" }))).toEqual({ decision: "keep_story", rejectIds: ["a"] });
  });

  it("ne remplace jamais une story déjà programmée, même moins bien sourcée", () => {
    expect(resolveDuplicate({ ...story, trustLevel: 3 }, dup({ id: "sched", trustLevel: 1, status: "scheduled" }))).toEqual({ decision: "reject_story", duplicateOf: "sched" });
  });
});

describe("buildDedupPrompt", () => {
  const me: DedupCard = { id: "new", title: "La couche d'ozone se répare.", summary: "Résumé A", sourceName: "ONU", sourceDate: "2026-10-28" };
  const others: DedupCard[] = [
    { id: "c1", title: "L'ozone va mieux", summary: "Résumé B", sourceName: "Le Monde", sourceDate: null },
    { id: "c2", title: "Mangroves au Sénégal", summary: "Résumé C", sourceName: "Reporterre", sourceDate: "2026-10-30" },
  ];

  it("présente la story à tester puis les candidates avec leur id", () => {
    const prompt = buildDedupPrompt(me, others, CONFIG);
    expect(prompt.user).toMatch(/NOUVELLE À TESTER\nid : new/);
    expect(prompt.user).toMatch(/--- candidate 1 ---\nid : c1/);
    expect(prompt.user).toMatch(/--- candidate 2 ---\nid : c2/);
    expect(prompt.user).toContain("source : ONU (2026-10-28)");
    expect(prompt.user).toContain("source : Le Monde\n");
  });

  it("explique le critère du même événement, la fenêtre de la config et le doute en faveur de null", () => {
    const prompt = buildDedupPrompt(me, others, CONFIG);
    expect(prompt.system).toMatch(/MÊME ÉVÉNEMENT/);
    expect(prompt.system).toContain(`ces ${CONFIG.dedup_window_days} derniers jours`);
    expect(prompt.system).toMatch(/réponds null/);
    expect(prompt.system).toContain('"duplicate_of"');
  });

  it("signale l'absence de candidates", () => {
    expect(buildDedupPrompt(me, [], CONFIG).user).toContain("NOUVELLES DÉJÀ RETENUES : aucune");
  });
});
