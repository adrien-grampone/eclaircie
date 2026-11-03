import { isStockLow, pickForSchedule, scheduleHorizon, sourceWithinShare, stockDays, storyAgeDays, type ScheduleCandidate, type ScheduledStory } from "../schedule.ts";
import { CONFIG } from "./fixtures/config.ts";

const DAY = "2026-11-10";

function candidate(overrides: Partial<ScheduleCandidate> & { id: string }): ScheduleCandidate {
  return {
    sourceName: "Le Quotidien Vert",
    sourceDate: "2026-11-08",
    createdAt: "2026-11-08T10:00:00+00:00",
    evergreen: false,
    score: 0.8,
    ...overrides,
  };
}

function daysAgo(n: number): string {
  const [y, m, d] = DAY.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d - n));
  return date.toISOString().slice(0, 10);
}

describe("storyAgeDays", () => {
  it("compte depuis source_date, sinon depuis created_at, jamais négatif", () => {
    expect(storyAgeDays(candidate({ id: "a", sourceDate: daysAgo(12) }), DAY)).toBe(12);
    expect(storyAgeDays(candidate({ id: "b", sourceDate: null, createdAt: "2026-11-05T23:00:00+00:00" }), DAY)).toBe(5);
    expect(storyAgeDays(candidate({ id: "c", sourceDate: "2026-11-12" }), DAY)).toBe(0);
  });
});

describe("pickForSchedule", () => {
  it("ne choisit JAMAIS une story non intemporelle de 45 jours, même seule", () => {
    const stale = candidate({ id: "stale", sourceDate: daysAgo(45), score: 0.99 });
    expect(pickForSchedule([stale], [], DAY, CONFIG)).toBeNull();
  });

  it("refuse une non-intemporelle à 31 jours et accepte à 30 (seuil de la config)", () => {
    expect(pickForSchedule([candidate({ id: "x", sourceDate: daysAgo(31) })], [], DAY, CONFIG)).toBeNull();
    expect(pickForSchedule([candidate({ id: "y", sourceDate: daysAgo(30) })], [], DAY, CONFIG)?.id).toBe("y");
    expect(pickForSchedule([candidate({ id: "y", sourceDate: daysAgo(30) })], [], DAY, { ...CONFIG, schedule_max_age_days: 20 })).toBeNull();
  });

  it("accepte une intemporelle de 45 jours", () => {
    const evergreen = candidate({ id: "ever", sourceDate: daysAgo(45), evergreen: true });
    expect(pickForSchedule([evergreen], [], DAY, CONFIG)?.id).toBe("ever");
  });

  it("préfère une récente moins bien notée à une intemporelle mieux notée", () => {
    const recent = candidate({ id: "recent", sourceDate: daysAgo(3), score: 0.7 });
    const evergreen = candidate({ id: "ever", sourceDate: daysAgo(40), evergreen: true, score: 0.95 });
    expect(pickForSchedule([evergreen, recent], [], DAY, CONFIG)?.id).toBe("recent");
  });

  it("une story de 10 jours n'est plus « récente » (seuil strict) et passe après une intemporelle", () => {
    const tenDays = candidate({ id: "ten", sourceDate: daysAgo(10), score: 0.95 });
    const nineDays = candidate({ id: "nine", sourceDate: daysAgo(9), score: 0.5 });
    const evergreen = candidate({ id: "ever", sourceDate: daysAgo(60), evergreen: true, score: 0.6 });
    expect(pickForSchedule([tenDays, evergreen], [], DAY, CONFIG)?.id).toBe("ever");
    expect(pickForSchedule([tenDays, nineDays], [], DAY, CONFIG)?.id).toBe("nine");
  });

  it("entre deux récentes, choisit le meilleur score puis la plus fraîche puis l'id", () => {
    const a = candidate({ id: "a", sourceDate: daysAgo(5), score: 0.7 });
    const b = candidate({ id: "b", sourceDate: daysAgo(2), score: 0.9 });
    const c = candidate({ id: "c", sourceDate: daysAgo(1), score: 0.9 });
    const d = candidate({ id: "d", sourceDate: daysAgo(1), score: 0.9 });
    expect(pickForSchedule([a, b, c, d], [], DAY, CONFIG)?.id).toBe("c");
    expect(pickForSchedule([d, c, b, a], [], DAY, CONFIG)?.id).toBe("c");
  });

  it("ne programme pas la même source que la veille ni que le lendemain", () => {
    const sameSource = candidate({ id: "same", sourceName: "Le Monde", score: 0.95 });
    const other = candidate({ id: "other", sourceName: "CNRS", score: 0.6 });
    const yesterday: ScheduledStory[] = [{ publishDate: daysAgo(1), sourceName: "Le Monde" }];
    const tomorrow: ScheduledStory[] = [{ publishDate: "2026-11-11", sourceName: "le monde " }];
    expect(pickForSchedule([sameSource, other], yesterday, DAY, CONFIG)?.id).toBe("other");
    expect(pickForSchedule([sameSource, other], tomorrow, DAY, CONFIG)?.id).toBe("other");
    expect(pickForSchedule([sameSource], yesterday, DAY, CONFIG)).toBeNull();
  });

  it("autorise la même source à deux jours d'écart (part restant sous 30 %)", () => {
    const sameSource = candidate({ id: "same", sourceName: "Le Monde" });
    const already: ScheduledStory[] = [
      { publishDate: daysAgo(2), sourceName: "Le Monde" },
      ...["A", "B", "C", "D", "E", "F"].map((s, i) => ({ publishDate: daysAgo(i + 3), sourceName: s })),
    ];
    expect(pickForSchedule([sameSource], already, DAY, CONFIG)?.id).toBe("same");
  });

  it("renvoie null sans candidat ou si le jour est déjà programmé", () => {
    expect(pickForSchedule([], [], DAY, CONFIG)).toBeNull();
    const taken: ScheduledStory[] = [{ publishDate: DAY, sourceName: "X" }];
    expect(pickForSchedule([candidate({ id: "a" })], taken, DAY, CONFIG)).toBeNull();
  });

  it("ne modifie pas les tableaux d'entrée", () => {
    const list = [candidate({ id: "b", score: 0.5 }), candidate({ id: "a", score: 0.9 })];
    pickForSchedule(list, [], DAY, CONFIG);
    expect(list.map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("pickForSchedule — part maximale d'une source (30 % sur 14 jours)", () => {
  const scheduled = (names: string[]): ScheduledStory[] =>
    names.map((sourceName, i) => ({ publishDate: daysAgo(i + 2), sourceName }));

  it("laisse passer la première nouvelle d'un thème vide", () => {
    expect(pickForSchedule([candidate({ id: "a", sourceName: "Mongabay" })], [], DAY, CONFIG)?.id).toBe("a");
  });

  it("bloque une source déjà à 30 % de la fenêtre, et préfère une autre source", () => {
    // 10 programmées dans la fenêtre dont 3 Mongabay : 4/11 = 36 % > 30 %
    const already = scheduled(["Mongabay", "A", "Mongabay", "B", "C", "Mongabay", "D", "E", "F", "G"]);
    const mongabay = candidate({ id: "m", sourceName: "Mongabay", score: 0.99 });
    const other = candidate({ id: "o", sourceName: "Reporterre", score: 0.5 });
    expect(pickForSchedule([mongabay, other], already, DAY, CONFIG)?.id).toBe("o");
  });

  it("préfère un jour avec une source répétée à un jour vide : sans autre candidat, Mongabay passe", () => {
    const already = scheduled(["Mongabay", "A", "Mongabay", "B", "C", "Mongabay", "D", "E", "F", "G"]);
    const best = candidate({ id: "m1", sourceName: "Mongabay", score: 0.6 });
    const better = candidate({ id: "m2", sourceName: "Mongabay", score: 0.9 });
    expect(pickForSchedule([best, better], already, DAY, CONFIG)?.id).toBe("m2");
    // La règle d'âge et celle du voisin restent strictes.
    const old = candidate({ id: "old", sourceName: "Mongabay", sourceDate: daysAgo(45) });
    expect(pickForSchedule([old], already, DAY, CONFIG)).toBeNull();
    const neighbour: ScheduledStory[] = [{ publishDate: daysAgo(1), sourceName: "Mongabay" }];
    expect(pickForSchedule([better], neighbour, DAY, CONFIG)).toBeNull();
  });

  it("autorise la source tant qu'elle reste sous le seuil", () => {
    // 10 programmées dont 2 Mongabay : 3/11 = 27 % ≤ 30 %
    const already = scheduled(["Mongabay", "A", "Mongabay", "B", "C", "D", "E", "F", "G", "H"]);
    expect(pickForSchedule([candidate({ id: "m", sourceName: "Mongabay" })], already, DAY, CONFIG)?.id).toBe("m");
  });

  it("ne compte que la fenêtre glissante de la config", () => {
    const old: ScheduledStory[] = [
      { publishDate: daysAgo(20), sourceName: "Mongabay" },
      { publishDate: daysAgo(16), sourceName: "Mongabay" },
      { publishDate: daysAgo(15), sourceName: "Mongabay" },
    ];
    expect(pickForSchedule([candidate({ id: "m", sourceName: "Mongabay" })], old, DAY, CONFIG)?.id).toBe("m");
    expect(sourceWithinShare("Mongabay", old, DAY, { ...CONFIG, schedule_source_window_days: 30 })).toBe(false);
  });

  it("suit le seuil de la config", () => {
    const already = scheduled(["Mongabay", "A", "B", "C"]);
    expect(sourceWithinShare("Mongabay", already, DAY, CONFIG)).toBe(false); // 2/5 = 40 %
    expect(sourceWithinShare("Mongabay", already, DAY, { ...CONFIG, schedule_max_source_share: 0.5 })).toBe(true);
    expect(sourceWithinShare("mongabay ", already, DAY, { ...CONFIG, schedule_max_source_share: 0.5 })).toBe(true);
  });
});

describe("scheduleHorizon", () => {
  it("part d'aujourd'hui inclus et couvre schedule_horizon_days jours", () => {
    const days = scheduleHorizon(DAY, { schedule_horizon_days: 3 });
    expect(days).toEqual(["2026-11-10", "2026-11-11", "2026-11-12"]);
  });
});

describe("stockDays / isStockLow", () => {
  const scheduled: ScheduledStory[] = [
    { publishDate: daysAgo(1), sourceName: "A" },
    { publishDate: DAY, sourceName: "A" },
    { publishDate: "2026-11-11", sourceName: "B" },
    { publishDate: "2026-11-11", sourceName: "C" },
    { publishDate: "2026-11-13", sourceName: "B" },
  ];

  it("compte les jours distincts à partir d'aujourd'hui, sans le passé", () => {
    expect(stockDays(scheduled, DAY)).toBe(3);
    expect(stockDays([], DAY)).toBe(0);
  });

  it("alerte strictement sous stock_alert_days", () => {
    expect(isStockLow(3, { stock_alert_days: 7 })).toBe(true);
    expect(isStockLow(7, { stock_alert_days: 7 })).toBe(false);
  });
});
