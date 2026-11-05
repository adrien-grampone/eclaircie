import { describe, expect, it } from "vitest";
import { buildWidgetPayload } from "./widgetPayload.ts";
import type { DailyView } from "./stories.ts";
import type { Profile, Story, Theme } from "@/types.ts";

const palette = { sky_top: "#1", sky_bottom: "#2", sun: "#3", hill_light: "#4", hill_mid: "#5", accent: "#6" };
const themes: Theme[] = [
  { id: "science", label: "Science", position: 3, palette, active: true, coming_soon: false, palette_words: "" },
  { id: "animaux", label: "Animaux", position: 2, palette, active: true, coming_soon: false, palette_words: "" },
  { id: "culture", label: "Culture", position: 7, palette, active: true, coming_soon: false, palette_words: "" },
] as unknown as Theme[];
const profile: Profile = { user_id: "u", themes: ["science", "animaux", "science"], notify_time: "07:30", timezone: "Europe/Paris", created_at: "2026-10-30T23:30:00+02:00" };
const story = { id: "s1", theme_id: "animaux", title_main: "Pour les chiens,", title_accent: "des plaquettes.", summary: "x", source_name: "Phys.org — Biology", source_url: "https://x", source_date: null, image_path: "s1.webp", publish_date: "2026-11-05", status: "scheduled" } as unknown as Story;
const base = { supabaseUrl: "https://p.supabase.co", anonKey: "anon", profile, themes };

describe("buildWidgetPayload", () => {
  it("thèmes dédoublonnés et triés, infos limitées aux thèmes choisis, date d'inscription calendaire", () => {
    const view: DailyView = { pick: { themeId: "animaux", story }, theme: themes[1]!, image: { url: "https://img", fallback: false }, today: "2026-11-05" };
    const p = buildWidgetPayload({ ...base, view, imagePath: "/group/widget-app/illustration.jpg" });
    expect(p.themes).toEqual(["animaux", "science"]);
    expect(Object.keys(p.themeInfo).sort()).toEqual(["animaux", "science"]);
    expect(p.signupDate).toBe("2026-10-30");
    expect(p.storyDate).toBe("2026-11-05");
    expect(p.story).toEqual({
      id: "s1", themeId: "animaux", themeLabel: "Animaux", titleMain: "Pour les chiens,", titleAccent: "des plaquettes.", source: "Phys.org",
      palette, imagePath: "/group/widget-app/illustration.jpg", remoteImagePath: "s1.webp",
    });
    // Aucune colonne interne.
    expect(JSON.stringify(p)).not.toMatch(/summary|source_url|score|verify_log/);
  });
  it("sans nouvelle du jour : story et date nulles, le widget affichera la promesse du lendemain", () => {
    const view: DailyView = { pick: { themeId: "science", story: null }, theme: themes[0]!, image: null, today: "2026-11-05" };
    const p = buildWidgetPayload({ ...base, view, imagePath: null });
    expect(p.story).toBeNull();
    expect(p.storyDate).toBeNull();
    expect(p.anonKey).toBe("anon");
  });
});
