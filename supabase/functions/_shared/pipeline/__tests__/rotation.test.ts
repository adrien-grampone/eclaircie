import { themeOfTheDay } from "../rotation.ts";

const THEMES = ["science", "planete", "animaux"]; // ordre de cochage quelconque
const SIGNUP = "2026-11-01";

describe("themeOfTheDay", () => {
  it("est stable pour une même date", () => {
    const first = themeOfTheDay(THEMES, SIGNUP, "2026-11-15");
    for (let i = 0; i < 20; i++) {
      expect(themeOfTheDay(THEMES, SIGNUP, "2026-11-15")).toBe(first);
    }
  });

  it("ne dépend pas de l'ordre de cochage des thèmes", () => {
    const shuffled = ["animaux", "science", "planete"];
    for (let d = 0; d < 10; d++) {
      const day = `2026-11-${String(d + 1).padStart(2, "0")}`;
      expect(themeOfTheDay(shuffled, SIGNUP, day)).toBe(themeOfTheDay(THEMES, SIGNUP, day));
    }
  });

  it("suit la rotation themes_tries[jours_depuis_inscription % n]", () => {
    // tri par identifiant : animaux, planete, science
    expect(themeOfTheDay(THEMES, SIGNUP, "2026-11-01")).toBe("animaux");
    expect(themeOfTheDay(THEMES, SIGNUP, "2026-11-02")).toBe("planete");
    expect(themeOfTheDay(THEMES, SIGNUP, "2026-11-03")).toBe("science");
    expect(themeOfTheDay(THEMES, SIGNUP, "2026-11-04")).toBe("animaux");
    expect(themeOfTheDay(THEMES, SIGNUP, "2026-12-01")).toBe("animaux"); // 30 jours → 30 % 3 = 0
  });

  it("change chaque jour et revient au bout de n jours", () => {
    const seen = new Set<string>();
    for (let d = 0; d < THEMES.length; d++) {
      seen.add(themeOfTheDay(THEMES, SIGNUP, `2026-11-0${d + 1}`) ?? "");
    }
    expect(seen.size).toBe(THEMES.length);
  });

  it("renvoie toujours le même thème pour un seul thème choisi", () => {
    expect(themeOfTheDay(["sante"], SIGNUP, "2027-03-09")).toBe("sante");
  });

  it("dédoublonne les thèmes", () => {
    expect(themeOfTheDay(["sante", "sante", "culture"], SIGNUP, "2026-11-02")).toBe("sante");
    expect(themeOfTheDay(["sante", "sante", "culture"], SIGNUP, "2026-11-03")).toBe("culture");
  });

  it("renvoie null sans thème et traite un jour antérieur à l'inscription comme le jour 0", () => {
    expect(themeOfTheDay([], SIGNUP, "2026-11-02")).toBeNull();
    expect(themeOfTheDay(THEMES, SIGNUP, "2026-10-20")).toBe("animaux");
  });
});
