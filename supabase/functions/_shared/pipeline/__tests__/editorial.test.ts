import { applyEditorialRules, mainTheme } from "../editorial.ts";
import type { Triage } from "../triage.ts";

function triage(overrides: Partial<Triage>): Triage {
  return {
    is_good_news: true, themes: ["planete"], kind: "achievement", study_subject: "not_a_study",
    is_fact: true, is_promotional: false, is_scheduled_event: false, is_food_health_claim: false,
    positivity: 0.8, significance: 0.7, evergreen: false, reason: "",
    ...overrides,
  };
}

describe("applyEditorialRules — discovery", () => {
  it("accepte une discovery classée science, et la restreint à science", () => {
    const out = applyEditorialRules(triage({ kind: "discovery", themes: ["science", "animaux"] }));
    expect(out.reason).toBeNull();
    expect(out.triage.themes).toEqual(["science"]);
  });

  it("rejette une discovery hors science, même si le modèle l'a acceptée", () => {
    const out = applyEditorialRules(triage({ kind: "discovery", themes: ["animaux", "planete"] }));
    expect(out.reason).toBe("discovery_outside_science");
  });

  it("laisse les autres kinds multi-thèmes intacts", () => {
    const out = applyEditorialRules(triage({ kind: "breakthrough", themes: ["science", "sante"], study_subject: "human" }));
    expect(out.reason).toBeNull();
    expect(out.triage.themes).toEqual(["science", "sante"]);
  });
});

describe("applyEditorialRules — santé", () => {
  it("retire sante d'une étude animale et garde les autres thèmes", () => {
    const out = applyEditorialRules(triage({ themes: ["sante", "science"], study_subject: "animal", kind: "breakthrough" }));
    expect(out.reason).toBeNull();
    expect(out.triage.themes).toEqual(["science"]);
  });

  it("retire sante d'une étude in vitro", () => {
    const out = applyEditorialRules(triage({ themes: ["science", "sante"], study_subject: "in_vitro", kind: "breakthrough" }));
    expect(out.triage.themes).toEqual(["science"]);
  });

  it("rejette si sante était le seul thème d'une étude non humaine", () => {
    const out = applyEditorialRules(triage({ themes: ["sante"], study_subject: "animal", kind: "breakthrough" }));
    expect(out.reason).toBe("health_requires_human");
  });

  it("garde sante pour un résultat chez l'humain ou hors étude", () => {
    expect(applyEditorialRules(triage({ themes: ["sante"], study_subject: "human", kind: "breakthrough" })).triage.themes).toEqual(["sante"]);
    expect(applyEditorialRules(triage({ themes: ["sante"], study_subject: "not_a_study", kind: "achievement" })).triage.themes).toEqual(["sante"]);
  });

  it("combine les deux règles : discovery animale avec science et sante → science seul", () => {
    const out = applyEditorialRules(triage({ kind: "discovery", themes: ["sante", "science"], study_subject: "animal" }));
    expect(out.reason).toBeNull();
    expect(out.triage.themes).toEqual(["science"]);
  });
});

describe("applyEditorialRules — thème principal", () => {
  it("conserve l'ordre et dédoublonne ; le premier est le thème principal", () => {
    const out = applyEditorialRules(triage({ themes: ["animaux", "planete", "animaux"] }));
    expect(out.triage.themes).toEqual(["animaux", "planete"]);
    expect(mainTheme(out.triage)).toBe("animaux");
  });

  it("rejette no_theme quand la liste est vide", () => {
    expect(applyEditorialRules(triage({ themes: [] })).reason).toBe("no_theme");
    expect(mainTheme({ themes: [] })).toBeNull();
  });
});

describe("applyEditorialRules — événements du calendrier", () => {
  it("rejette une remise de prix annuelle, même bien notée", () => {
    const out = applyEditorialRules(triage({ is_scheduled_event: true, themes: ["culture"], kind: "culture_win", positivity: 0.95 }));
    expect(out.reason).toBe("scheduled_event");
  });

  it("laisse passer un prix pour une avancée concrète quand le modèle a mis faux", () => {
    const out = applyEditorialRules(triage({ is_scheduled_event: false, themes: ["sante"], kind: "breakthrough" }));
    expect(out.reason).toBeNull();
  });
});

describe("applyEditorialRules — études nutritionnelles", () => {
  it("rejette une étude « tel aliment est bon pour… » quel que soit le thème", () => {
    for (const themes of [["sante"], ["science"], ["planete"]]) {
      const out = applyEditorialRules(triage({ is_food_health_claim: true, themes, study_subject: "human" }));
      expect(out.reason).toBe("food_health_claim");
    }
  });

  it("passe avant les autres règles", () => {
    const out = applyEditorialRules(triage({ is_food_health_claim: true, kind: "discovery", themes: ["animaux"] }));
    expect(out.reason).toBe("food_health_claim");
  });
});
