import { parseConfig } from "../config.ts";
import { CONFIG_ROWS } from "./fixtures/config.ts";

describe("parseConfig", () => {
  it("assemble les lignes de pipeline_config en objet validé", () => {
    const result = parseConfig(CONFIG_ROWS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.triage_min_score).toBe(0.65);
    expect(result.value.triage_weights).toEqual({ positivity: 0.35, significance: 0.35, trust: 0.3 });
    expect(result.value.schedule_max_age_days).toBe(30);
  });

  it("refuse une clé manquante : aucun seuil par défaut dans le code", () => {
    const rows = CONFIG_ROWS.filter((r) => r.key !== "triage_min_score");
    const result = parseConfig(rows);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/triage_min_score/);
  });

  it("refuse une valeur hors bornes", () => {
    const rows = CONFIG_ROWS.map((r) =>
      r.key === "triage_min_score" ? { key: r.key, value: 1.5 } : r,
    );
    const result = parseConfig(rows);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/triage_min_score/);
  });

  it("ignore les clés inconnues", () => {
    const result = parseConfig([...CONFIG_ROWS, { key: "future_key", value: 42 }]);
    expect(result.ok).toBe(true);
  });
});
