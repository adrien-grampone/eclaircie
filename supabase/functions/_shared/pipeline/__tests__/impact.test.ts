import { describe, expect, it } from "vitest";
import { sourceIsFollowed } from "../collect.ts";
import { applyEditorialRules, assessTriage, isUnfollowedException, type FollowedThemes } from "../editorial.ts";
import { finalScore, impactScore, isNonHumanStudy, type ImpactFields } from "../impact.ts";
import { isFresh, isReserveLow, pickFreshFirst, reserveSize, upcomingToRelease, type ScheduleCandidate } from "../schedule.ts";
import type { Triage } from "../triage.ts";
import { resolveThemeMismatch } from "../verify.ts";
import { CONFIG } from "./fixtures/config.ts";

const FULL: ImpactFields = { concrete: 1, accomplished: 1, closeness: 1, magnitude: 1, before_after: 1, preliminary: false, too_technical: false };

function triage(overrides: Partial<Triage>): Triage {
  return {
    is_good_news: true, themes: ["animaux"], kind: "protection", study_subject: "not_a_study",
    is_fact: true, is_promotional: false, is_scheduled_event: false, is_food_health_claim: false,
    positivity: 0.8, significance: 0.6, evergreen: false, reason: "",
    concrete: 0.9, accomplished: 0.9, closeness: 0.7, magnitude: 0.4, before_after: 0.8, preliminary: false, too_technical: false,
    ...overrides,
  };
}

const PERSO: FollowedThemes = {
  themes: ["planete", "animaux", "sante", "solidarite", "culture"],
  exception: { min_accomplished: 0.7, fallback_theme: "sante" },
};

describe("impactScore", () => {
  it("vaut la somme pondérée des cinq critères", () => {
    expect(impactScore(FULL, false, CONFIG)).toBe(1);
    expect(impactScore({ ...FULL, concrete: 0, accomplished: 0 }, false, CONFIG)).toBe(0.5);
  });

  it("applique les pénalités multiplicatives", () => {
    expect(impactScore({ ...FULL, preliminary: true }, false, CONFIG)).toBe(0.5);
    expect(impactScore({ ...FULL, too_technical: true }, false, CONFIG)).toBe(0.6);
    expect(impactScore(FULL, true, CONFIG)).toBe(0.4);
    expect(impactScore({ ...FULL, preliminary: true, too_technical: true }, true, CONFIG)).toBe(0.12);
  });

  it("ne pénalise pas une étude animale quand le sujet EST l'animal", () => {
    expect(isNonHumanStudy("animal", "animaux", "animaux")).toBe(false);
    expect(isNonHumanStudy("animal", "sante", "animaux")).toBe(true);
    expect(isNonHumanStudy("human", "sante", "animaux")).toBe(false);
  });

  it("mélange impact et score historique à parts égales", () => {
    expect(finalScore(0.8, 0.6, CONFIG)).toBe(0.7);
  });
});

describe("assessTriage — règle validée le 2026-11-09", () => {
  it("repêche une petite joie que le seuil historique rejetait (doberman, score 0,63)", () => {
    const t = triage({ positivity: 0.9, significance: 0.3, concrete: 0.9, accomplished: 1, closeness: 0.8, magnitude: 0.3, before_after: 0.8 });
    const out = assessTriage(t, 1, CONFIG);
    expect(out.base).toBeLessThan(0.65);
    expect(out.score).toBeGreaterThanOrEqual(0.65);
    expect(out.reason).toBeNull();
  });

  it("écarte un résultat abstrait bien noté par le score historique", () => {
    const t = triage({ themes: ["science"], kind: "breakthrough", positivity: 0.8, significance: 0.9, concrete: 0.1, accomplished: 0.2, closeness: 0.1, magnitude: 0.3, before_after: 0.1, too_technical: true });
    const out = assessTriage(t, 3, CONFIG);
    expect(out.base).toBeGreaterThanOrEqual(0.65);
    expect(out.reason).toBe("low_score");
  });

  it("exige un impact minimal même quand le score final passe", () => {
    const t = triage({ positivity: 1, significance: 1, concrete: 0.5, accomplished: 0.4, closeness: 0.4, magnitude: 0.5, before_after: 0.45 });
    const out = assessTriage(t, 3, CONFIG);
    expect(out.impact).toBeLessThan(0.5);
    expect(out.reason).toBe("low_impact");
  });

  it("garde les raisons d'éligibilité en premier", () => {
    expect(assessTriage(triage({ is_good_news: false }), 3, CONFIG).reason).toBe("not_good_news");
  });
});

describe("applyEditorialRules — thèmes suivis", () => {
  it("ne change rien sans liste de thèmes suivis", () => {
    expect(applyEditorialRules(triage({ themes: ["science"], kind: "breakthrough" })).reason).toBeNull();
    expect(applyEditorialRules(triage({ themes: ["science"], kind: "breakthrough" }), { ...PERSO, themes: null }).reason).toBeNull();
  });

  it("retire les thèmes secondaires non suivis", () => {
    const out = applyEditorialRules(triage({ themes: ["planete", "inventions"] }), PERSO);
    expect(out.reason).toBeNull();
    expect(out.triage.themes).toEqual(["planete"]);
  });

  it("rejette une nouvelle dont le thème principal n'est pas suivi", () => {
    const out = applyEditorialRules(triage({ themes: ["inventions"], kind: "breakthrough", accomplished: 0.3 }), PERSO);
    expect(out.reason).toBe("theme_not_followed");
  });

  it("rejette toujours une découverte (thème science forcé)", () => {
    expect(applyEditorialRules(triage({ themes: ["science", "sante"], kind: "discovery", study_subject: "human", accomplished: 1 }), PERSO).reason).toBe("theme_not_followed");
  });

  it("laisse passer une percée déjà utile à des gens, rangée dans le thème suivi le plus proche", () => {
    const out = applyEditorialRules(triage({ themes: ["inventions", "planete"], kind: "achievement", accomplished: 0.9 }), PERSO);
    expect(out.reason).toBeNull();
    expect(out.triage.themes).toEqual(["planete"]);
  });

  it("range l'exception en Santé quand aucun thème suivi n'est proposé", () => {
    const out = applyEditorialRules(triage({ themes: ["science"], kind: "breakthrough", study_subject: "human", accomplished: 0.8 }), PERSO);
    expect(out.reason).toBeNull();
    expect(out.triage.themes).toEqual(["sante"]);
  });

  it("n'accorde jamais l'exception à une étude animale, in vitro, préliminaire ou à un « pourrait »", () => {
    const base = triage({ themes: ["science"], kind: "breakthrough", study_subject: "human", accomplished: 0.9 });
    expect(isUnfollowedException(base, PERSO.exception)).toBe(true);
    expect(isUnfollowedException({ ...base, study_subject: "animal" }, PERSO.exception)).toBe(false);
    expect(isUnfollowedException({ ...base, study_subject: "in_vitro" }, PERSO.exception)).toBe(false);
    expect(isUnfollowedException({ ...base, preliminary: true }, PERSO.exception)).toBe(false);
    expect(isUnfollowedException({ ...base, accomplished: 0.5 }, PERSO.exception)).toBe(false);
    expect(isUnfollowedException({ ...base, kind: "discovery" }, PERSO.exception)).toBe(false);
  });
});

describe("sourceIsFollowed", () => {
  it("collecte une source qui alimente au moins un thème suivi", () => {
    expect(sourceIsFollowed(["science", "sante"], PERSO.themes)).toBe(true);
    expect(sourceIsFollowed(["inventions"], PERSO.themes)).toBe(false);
  });

  it("collecte tout sans liste, et une source sans thèmes renseignés", () => {
    expect(sourceIsFollowed(["inventions"], null)).toBe(true);
    expect(sourceIsFollowed(null, PERSO.themes)).toBe(true);
    expect(sourceIsFollowed([], PERSO.themes)).toBe(true);
  });
});

describe("réserve (one_per_day)", () => {
  const story = (id: string, sourceDate: string, evergreen: boolean): ScheduleCandidate => ({ id, sourceName: "S", sourceDate, createdAt: `${sourceDate}T08:00:00Z`, evergreen, score: 0.7 });

  it("compte les nouvelles encore programmables (intemporelles ou assez récentes)", () => {
    const day = "2026-12-01";
    const candidates = [story("a", "2026-11-25", false), story("b", "2026-10-01", false), story("c", "2026-10-01", true)];
    expect(reserveSize(candidates, day, CONFIG)).toBe(2);
    expect(isReserveLow(2, CONFIG)).toBe(true);
    expect(isReserveLow(3, CONFIG)).toBe(false);
  });
});

describe("fraîches avant la réserve (one_per_day)", () => {
  const now = new Date("2026-11-10T05:30:00Z");
  const cand = (id: string, createdAt: string, score: number, sourceName = id): ScheduleCandidate =>
    ({ id, sourceName, sourceDate: createdAt.slice(0, 10), createdAt, evergreen: true, score });
  const reserve = cand("reserve", "2026-11-08T05:00:00Z", 0.9);
  const fresh = cand("fraiche", "2026-11-10T04:40:00Z", 0.66);

  it("est fraîche une nouvelle rédigée depuis moins de schedule_fresh_hours", () => {
    expect(isFresh(fresh.createdAt, now, CONFIG)).toBe(true);
    expect(isFresh(reserve.createdAt, now, CONFIG)).toBe(false);
  });

  it("prend la fraîche même quand la réserve a un meilleur score", () => {
    expect(pickFreshFirst([reserve, fresh], [], "2026-11-11", now, CONFIG)?.id).toBe("fraiche");
  });

  it("pioche dans la réserve quand aucune fraîche n'est programmable", () => {
    expect(pickFreshFirst([reserve], [], "2026-11-11", now, CONFIG)?.id).toBe("reserve");
    const sameSourceNextDay = cand("fraiche", "2026-11-10T04:40:00Z", 0.66, "Voisine");
    expect(pickFreshFirst([reserve, sameSourceNextDay], [{ publishDate: "2026-11-12", sourceName: "Voisine" }], "2026-11-11", now, CONFIG)?.id).toBe("reserve");
  });

  it("libère un jour à venir tenu par la réserve, jamais aujourd'hui ni une fraîche, au plus autant que de fraîches", () => {
    const upcoming = [
      { id: "auj", publishDate: "2026-11-10", createdAt: "2026-11-08T05:00:00Z" },
      { id: "j2", publishDate: "2026-11-12", createdAt: "2026-11-08T05:00:00Z" },
      { id: "j1", publishDate: "2026-11-11", createdAt: "2026-11-08T05:00:00Z" },
      { id: "j1f", publishDate: "2026-11-11", createdAt: "2026-11-10T04:00:00Z" },
    ];
    expect(upcomingToRelease(upcoming, 1, "2026-11-10", now, CONFIG)).toEqual(["j1"]);
    expect(upcomingToRelease(upcoming, 5, "2026-11-10", now, CONFIG)).toEqual(["j1", "j2"]);
    expect(upcomingToRelease(upcoming, 0, "2026-11-10", now, CONFIG)).toEqual([]);
  });
});

describe("resolveThemeMismatch — thèmes non suivis", () => {
  it("ignore une proposition vers un thème non suivi", () => {
    const problems = [{ type: "theme_mismatch" as const, passage: "…", correction: "…", theme: "science" }];
    const themes = [{ id: "sante", label: "Santé" }];
    expect(resolveThemeMismatch(problems, "sante", { kind: "breakthrough", study_subject: "human" }, themes, ["science", "inventions"])).toEqual({ action: "keep" });
  });
});
