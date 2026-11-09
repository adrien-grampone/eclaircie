import { planBatch, remainingBudget } from "../budget.ts";
import { triageRejectReason, type Triage } from "../triage.ts";
import { CONFIG } from "./fixtures/config.ts";

describe("budget journalier", () => {
  it("calcule ce qui reste, jamais négatif", () => {
    expect(remainingBudget(200, 0)).toBe(200);
    expect(remainingBudget(200, 195)).toBe(5);
    expect(remainingBudget(200, 200)).toBe(0);
    expect(remainingBudget(200, 240)).toBe(0);
  });

  it("borne le lot par la taille de lot puis par le budget restant", () => {
    expect(planBatch(CONFIG.max_triage_per_day, 0, CONFIG.batch_size)).toBe(10);
    expect(planBatch(200, 195, 10)).toBe(5);
    expect(planBatch(200, 200, 10)).toBe(0);
    expect(planBatch(0, 0, 10)).toBe(0);
  });

  it("lit les plafonds depuis la config", () => {
    expect(CONFIG.max_triage_per_day).toBe(200);
    expect(CONFIG.max_draft_per_day).toBe(40);
  });
});

describe("triageRejectReason", () => {
  const base: Triage = {
    is_good_news: true, themes: ["science"], kind: "breakthrough", study_subject: "not_a_study", is_fact: true, is_promotional: false, is_scheduled_event: false, is_food_health_claim: false,
    positivity: 0.9, significance: 0.8, evergreen: false, reason: "",
    concrete: 0.8, accomplished: 0.8, closeness: 0.7, magnitude: 0.6, before_after: 0.7, preliminary: false, too_technical: false,
  };

  it("renvoie null quand le triage est accepté", () => {
    expect(triageRejectReason(base, 0.9, CONFIG)).toBeNull();
  });

  it("nomme la première condition qui disqualifie", () => {
    expect(triageRejectReason({ ...base, is_good_news: false }, 0.9, CONFIG)).toBe("not_good_news");
    expect(triageRejectReason({ ...base, is_fact: false }, 0.9, CONFIG)).toBe("not_fact");
    expect(triageRejectReason({ ...base, is_promotional: true }, 0.9, CONFIG)).toBe("promotional");
    expect(triageRejectReason({ ...base, themes: [] }, 0.9, CONFIG)).toBe("no_theme");
    expect(triageRejectReason(base, 0.64, CONFIG)).toBe("low_score");
  });
});
