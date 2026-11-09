import { buildTriagePrompt, isTriageAccepted, parseTriage, triageRejectReason, triageScore, type Triage } from "../triage.ts";
import { CONFIG } from "./fixtures/config.ts";

const GOOD: Triage = {
  is_good_news: true,
  is_scheduled_event: false,
  is_food_health_claim: false,
  themes: ["planete"],
  kind: "protection",
  study_subject: "not_a_study",
  is_fact: true,
  is_promotional: false,
  positivity: 0.9,
  significance: 0.8,
  evergreen: true,
  concrete: 0.8, accomplished: 0.8, closeness: 0.7, magnitude: 0.6, before_after: 0.7, preliminary: false, too_technical: false,
  reason: "Résultat mesuré par l'ONU",
};

describe("triageScore", () => {
  it("applique la formule 0,35·p + 0,35·s + 0,30·(trust/3) depuis la config", () => {
    expect(triageScore(GOOD, 3, CONFIG)).toBeCloseTo(0.35 * 0.9 + 0.35 * 0.8 + 0.3, 10);
    expect(triageScore(GOOD, 1, CONFIG)).toBeCloseTo(0.35 * 0.9 + 0.35 * 0.8 + 0.1, 10);
  });

  it("suit des pondérations différentes sans rien de codé en dur", () => {
    const custom = { triage_weights: { positivity: 1, significance: 0, trust: 0 } };
    expect(triageScore(GOOD, 3, custom)).toBeCloseTo(0.9, 10);
  });

  it("borne un trust_level hors contrainte à [0, 3]", () => {
    expect(triageScore(GOOD, 7, CONFIG)).toBeCloseTo(triageScore(GOOD, 3, CONFIG), 10);
    expect(triageScore(GOOD, -2, CONFIG)).toBeCloseTo(triageScore(GOOD, 0, CONFIG), 10);
  });
});

describe("isTriageAccepted", () => {
  it("accepte une bonne nouvelle factuelle au-dessus du seuil", () => {
    expect(isTriageAccepted(GOOD, 0.65, CONFIG)).toBe(true);
    expect(isTriageAccepted(GOOD, 0.9, CONFIG)).toBe(true);
  });

  it("refuse juste sous le seuil de la config", () => {
    expect(isTriageAccepted(GOOD, 0.6499, CONFIG)).toBe(false);
    expect(isTriageAccepted(GOOD, 0.6499, { triage_min_score: 0.6 })).toBe(true);
  });

  it("refuse si l'un des drapeaux disqualifie", () => {
    expect(isTriageAccepted({ ...GOOD, is_good_news: false }, 0.9, CONFIG)).toBe(false);
    expect(isTriageAccepted({ ...GOOD, is_fact: false }, 0.9, CONFIG)).toBe(false);
    expect(isTriageAccepted({ ...GOOD, is_promotional: true }, 0.9, CONFIG)).toBe(false);
  });

  it("refuse une nouvelle sans thème", () => {
    expect(isTriageAccepted({ ...GOOD, themes: [] }, 0.9, CONFIG)).toBe(false);
  });
});

describe("parseTriage", () => {
  it("valide la sortie JSON stricte et met evergreen à false par défaut", () => {
    const result = parseTriage(
      '{"is_good_news":true,"themes":["science"],"kind":"discovery","study_subject":"not_a_study","is_fact":true,"is_promotional":false,"positivity":0.7,"significance":0.6,"reason":"ok"}',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.evergreen).toBe(false);
    expect(result.value.themes).toEqual(["science"]);
  });

  it("exige kind et study_subject parmi les valeurs autorisées", () => {
    const noKind = parseTriage('{"is_good_news":true,"themes":["science"],"study_subject":"human","is_fact":true,"is_promotional":false,"positivity":0.7,"significance":0.6,"reason":"ok"}');
    expect(noKind.ok).toBe(false);
    const badKind = parseTriage('{"is_good_news":true,"themes":["science"],"kind":"miracle","study_subject":"human","is_fact":true,"is_promotional":false,"positivity":0.7,"significance":0.6,"reason":"ok"}');
    expect(badKind.ok).toBe(false);
    if (!badKind.ok) expect(badKind.error).toMatch(/kind/);
  });

  it("met is_scheduled_event et is_food_health_claim à false quand ils manquent", () => {
    const result = parseTriage('{"is_good_news":true,"themes":["science"],"kind":"discovery","study_subject":"not_a_study","is_fact":true,"is_promotional":false,"positivity":0.7,"significance":0.6,"reason":"ok"}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.is_scheduled_event).toBe(false);
      expect(result.value.is_food_health_claim).toBe(false);
    }
  });

  it("tolère un kind ou un study_subject invalide quand ce n'est pas une bonne nouvelle", () => {
    for (const kind of ['""', "null", '"not_applicable"']) {
      const result = parseTriage(`{"is_good_news":false,"themes":[],"kind":${kind},"study_subject":"","is_fact":true,"is_promotional":false,"positivity":0.1,"significance":0.2,"reason":"mauvaise nouvelle"}`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBeNull();
        expect(result.value.study_subject).toBeNull();
        expect(triageRejectReason(result.value, 0.9, CONFIG)).toBe("not_good_news");
      }
    }
  });

  it("refuse une positivité hors de [0, 1] ou un champ manquant", () => {
    const outOfRange = parseTriage(
      '{"is_good_news":true,"themes":["science"],"kind":"discovery","study_subject":"not_a_study","is_fact":true,"is_promotional":false,"positivity":1.4,"significance":0.6,"reason":"ok"}',
    );
    expect(outOfRange.ok).toBe(false);
    if (!outOfRange.ok) expect(outOfRange.error).toMatch(/positivity/);

    const missing = parseTriage('{"is_good_news":true,"themes":["science"]}');
    expect(missing.ok).toBe(false);
  });

  it("tolère une réponse entourée de prose ou de clôtures markdown", () => {
    const result = parseTriage(
      'Voici le tri :\n```json\n{"is_good_news":false,"themes":[],"kind":"achievement","study_subject":"not_a_study","is_fact":true,"is_promotional":false,"positivity":0.1,"significance":0.2,"reason":"mauvaise nouvelle"}\n```',
    );
    expect(result.ok).toBe(true);
  });
});

describe("buildTriagePrompt", () => {
  it("liste les thèmes autorisés et injecte titre, extrait et source", () => {
    const prompt = buildTriagePrompt(
      { title: "Titre test", snippet: "Extrait test", sourceName: "CNRS" },
      [{ id: "science", label: "Science" }, { id: "sante", label: "Santé" }],
    );
    expect(prompt.system).toContain('"science" : Science');
    expect(prompt.system).toContain('"sante" : Santé');
    expect(prompt.system).toContain("evergreen");
    expect(prompt.system).toMatch(/discovery.*QUE pour le thème science/);
    expect(prompt.system).toMatch(/animal ou in vitro ne peut JAMAIS avoir le thème sante/);
    expect(prompt.system).toMatch(/PREMIER élément est le thème principal/);
    expect(prompt.user).toContain("Source : CNRS");
    expect(prompt.user).toContain("Titre : Titre test");
    expect(prompt.user).toContain("Extrait : Extrait test");
  });

  it("signale l'absence d'extrait au lieu d'écrire null", () => {
    const prompt = buildTriagePrompt({ title: "T", snippet: null, sourceName: "S" }, []);
    expect(prompt.user).toContain("(aucun extrait)");
    expect(prompt.user).not.toContain("null");
  });
});
