import { continueLabel, formatHour, nextTrigger, paletteThemeId, parseNotifyTime, toNotifyTime, toggleTheme, validateProfile, type OnboardingTheme } from "../onboarding.ts";

const THEMES: OnboardingTheme[] = [
  { id: "planete", label: "Planète", active: true, coming_soon: false },
  { id: "science", label: "Science", active: true, coming_soon: false },
  { id: "local", label: "Près de chez moi", active: true, coming_soon: true },
  { id: "ancien", label: "Ancien", active: false, coming_soon: false },
];

describe("toggleTheme", () => {
  it("ajoute puis retire un thème, en gardant l'ordre de sélection", () => {
    const one = toggleTheme([], THEMES[0]!);
    expect(one).toEqual(["planete"]);
    expect(toggleTheme(one, THEMES[1]!)).toEqual(["planete", "science"]);
    expect(toggleTheme(["planete", "science"], THEMES[0]!)).toEqual(["science"]);
  });

  it("ignore un thème « bientôt » ou inactif", () => {
    expect(toggleTheme(["planete"], THEMES[2]!)).toEqual(["planete"]);
    expect(toggleTheme(["planete"], THEMES[3]!)).toEqual(["planete"]);
  });
});

describe("continueLabel", () => {
  it("accorde le nombre de thèmes", () => {
    expect(continueLabel(0)).toBe("Choisis au moins un thème");
    expect(continueLabel(1)).toBe("Continuer · 1 thème");
    expect(continueLabel(3)).toBe("Continuer · 3 thèmes");
  });
});

describe("paletteThemeId", () => {
  it("suit le dernier thème coché, revient au précédent quand on décoche, sinon la palette par défaut", () => {
    expect(paletteThemeId([], "planete")).toBe("planete");
    expect(paletteThemeId(["science"], "planete")).toBe("science");
    expect(paletteThemeId(["science", "animaux"], "planete")).toBe("animaux");
    expect(paletteThemeId(toggleTheme(["science", "animaux"], THEMES[1]!), "planete")).toBe("animaux");
    expect(paletteThemeId(toggleTheme(["science", "animaux"], { id: "animaux", label: "Animaux", active: true, coming_soon: false }), "planete")).toBe("science");
  });
});

describe("heures", () => {
  it("formate pour l'écran et pour Postgres, et relit", () => {
    expect(formatHour(8, 0)).toBe("8 h 00");
    expect(formatHour(18, 30)).toBe("18 h 30");
    expect(toNotifyTime(8, 0)).toBe("08:00:00");
    expect(parseNotifyTime("07:45:00")).toEqual({ hour: 7, minute: 45 });
    expect(parseNotifyTime("")).toEqual({ hour: 8, minute: 0 });
  });
});

describe("validateProfile", () => {
  const base = { themes: ["planete", "science"], hour: 8, minute: 0, timezone: "Europe/Paris" };

  it("met en forme un profil valide (thèmes dédoublonnés, heure en time)", () => {
    const result = validateProfile({ ...base, themes: ["planete", "science", "planete"] }, THEMES);
    expect(result).toEqual({ ok: true, row: { themes: ["planete", "science"], notify_time: "08:00:00", timezone: "Europe/Paris" } });
  });

  it("refuse zéro thème, un thème « bientôt » ou inconnu, une heure ou un fuseau invalides", () => {
    expect(validateProfile({ ...base, themes: [] }, THEMES).ok).toBe(false);
    expect(validateProfile({ ...base, themes: ["local"] }, THEMES).ok).toBe(false);
    expect(validateProfile({ ...base, themes: ["inconnu"] }, THEMES).ok).toBe(false);
    expect(validateProfile({ ...base, hour: 24 }, THEMES).ok).toBe(false);
    expect(validateProfile({ ...base, minute: 7.5 }, THEMES).ok).toBe(false);
    expect(validateProfile({ ...base, timezone: " " }, THEMES).ok).toBe(false);
  });
});

describe("nextTrigger", () => {
  it("vise aujourd'hui si l'heure n'est pas passée, sinon demain", () => {
    const morning = new Date(2026, 10, 3, 7, 30);
    expect(nextTrigger(morning, 8, 0)).toEqual(new Date(2026, 10, 3, 8, 0));
    const evening = new Date(2026, 10, 3, 20, 0);
    expect(nextTrigger(evening, 8, 0)).toEqual(new Date(2026, 10, 4, 8, 0));
  });

  it("passe à demain quand on est exactement à l'heure, et franchit un changement de mois", () => {
    expect(nextTrigger(new Date(2026, 10, 3, 8, 0), 8, 0)).toEqual(new Date(2026, 10, 4, 8, 0));
    expect(nextTrigger(new Date(2026, 10, 30, 9, 0), 8, 15)).toEqual(new Date(2026, 11, 1, 8, 15));
  });
});
