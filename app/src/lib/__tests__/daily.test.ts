import { formatDayLabel, formatSourceDate, readingMinutes, selectDailyStory, splitMeasuredLines, titleSize } from "../daily.ts";
import type { Story } from "../../types.ts";

const story = (id: string, theme_id: string, publish_date: string): Story => ({
  id, theme_id, publish_date, title_main: "T", title_accent: null, summary: "S", source_name: "src", source_url: "https://x", source_date: null, image_path: null,
});
const SIGNUP = "2026-11-01T09:30:00+00:00";

describe("selectDailyStory", () => {
  const themes = ["science", "planete", "animaux"]; // triés : animaux, planete, science
  it("suit la rotation du pipeline : jour 2 après inscription → 3e thème trié", () => {
    const stories = [story("a", "science", "2026-11-03"), story("b", "planete", "2026-11-03")];
    const pick = selectDailyStory(themes, SIGNUP, "2026-11-03", stories);
    expect(pick).toEqual({ themeId: "science", story: stories[0] });
    const next = [...stories, story("c", "animaux", "2026-11-04")];
    expect(selectDailyStory(themes, SIGNUP, "2026-11-04", next)?.story?.id).toBe("c");
  });

  it("sans nouvelle validée du jour pour le thème, prend le thème SUIVANT dans la rotation qui en a une", () => {
    // Jour 2 → science ; la rotation continue : animaux, puis planete.
    const stories = [story("p", "planete", "2026-11-03"), story("a", "animaux", "2026-11-03")];
    expect(selectDailyStory(themes, SIGNUP, "2026-11-03", stories)).toEqual({ themeId: "animaux", story: stories[1] });
    expect(selectDailyStory(themes, SIGNUP, "2026-11-03", [stories[0]!])).toEqual({ themeId: "planete", story: stories[0] });
  });

  it("n'affiche jamais une nouvelle d'un autre jour : sans nouvelle du jour, story null (« arrive bientôt »)", () => {
    const stories = [story("old", "science", "2026-10-30"), story("p", "planete", "2026-11-02")];
    expect(selectDailyStory(themes, SIGNUP, "2026-11-03", stories)).toEqual({ themeId: "science", story: null });
    expect(selectDailyStory(themes, SIGNUP, "2026-11-03", [])).toEqual({ themeId: "science", story: null });
  });

  it("ignore une nouvelle datée dans le futur et renvoie null sans thème", () => {
    expect(selectDailyStory(["science"], SIGNUP, "2026-11-03", [story("f", "science", "2026-11-04")])?.story).toBeNull();
    expect(selectDailyStory([], SIGNUP, "2026-11-03", [])).toBeNull();
  });
});

describe("formats", () => {
  it("affiche la date du jour en capitales françaises et la date de source en mois année", () => {
    expect(formatDayLabel("2026-11-03")).toBe("MARDI 3 NOVEMBRE");
    expect(formatSourceDate("2023-01-10")).toBe("janvier 2023");
    expect(formatSourceDate(null)).toBe("");
  });

  it("compte le temps de lecture, 1 minute minimum", () => {
    expect(readingMinutes("quelques mots seulement")).toBe(1);
    expect(readingMinutes(Array(401).fill("mot").join(" "))).toBe(3);
    expect(readingMinutes("")).toBe(1);
  });
});

describe("titleSize", () => {
  it("descend par paliers avec la longueur totale du titre, chute comprise", () => {
    expect(titleSize("La couche d'ozone", "se répare.")).toEqual({ fontSize: 36, lineHeight: 37 });
    expect(titleSize("Les cinq « lettres » de la vie", "ont été trouvées")).toEqual({ fontSize: 28, lineHeight: 29 });
    expect(titleSize("a".repeat(32), "b".repeat(11)).fontSize).toBe(32);
    expect(titleSize("a".repeat(32), null).fontSize).toBe(32);
  });
});

describe("splitMeasuredLines", () => {
  it("met exactement les deux premières lignes mesurées à côté de la lettrine, le reste ensuite, sans trou", () => {
    const lines = [{ text: "râce à l'abandon mondial " }, { text: "des gaz CFC, le trou se " }, { text: "résorbe peu à peu. Selon " }, { text: "l'ONU." }];
    expect(splitMeasuredLines(lines)).toEqual({ beside: "râce à l'abandon mondial des gaz CFC, le trou se", rest: "résorbe peu à peu. Selon l'ONU." });
    expect(splitMeasuredLines(lines.slice(0, 1))).toEqual({ beside: "râce à l'abandon mondial", rest: "" });
    expect(splitMeasuredLines([])).toEqual({ beside: "", rest: "" });
  });
});
