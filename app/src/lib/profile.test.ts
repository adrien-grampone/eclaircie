import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase.ts", () => ({ supabase: {} }));
const { profileThemes, visibleThemes } = await import("./profile.ts");

const palette = { sky_top: "#000", sky_bottom: "#000", hill_light: "#000", hill_mid: "#000", accent: "#000", sun: "#000" };
const row = (id: string, followed: boolean, coming_soon = false) => ({ id, label: id, position: 1, palette, active: !coming_soon, coming_soon, followed });

describe("thèmes suivis dans l'app", () => {
  const rows = [row("planete", true), row("science", false), row("inventions", false), row("culture", true), row("pres-de-chez-moi", false, true)];

  it("ne propose que les thèmes suivis, plus les thèmes « bientôt »", () => {
    expect(visibleThemes(rows).map((t) => t.id)).toEqual(["planete", "culture", "pres-de-chez-moi"]);
    expect(visibleThemes(rows)[0]).not.toHaveProperty("followed");
  });

  it("retire du profil les thèmes qui ne sont plus suivis", () => {
    expect(profileThemes(["science", "culture", "planete"], visibleThemes(rows))).toEqual(["culture", "planete"]);
    expect(profileThemes(["pres-de-chez-moi"], visibleThemes(rows))).toEqual([]);
  });
});
