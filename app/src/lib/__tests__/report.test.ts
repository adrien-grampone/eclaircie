import { REPORT_MESSAGE_MAX, REPORT_REASONS, UNIQUE_VIOLATION, buildReport, reportFailureMessage } from "../report.ts";

const base = { userId: "u1", storyId: "s1", reason: null, message: "" };

describe("buildReport", () => {
  it("accepte une raison seule, un message seul, ou les deux ; nettoie le message", () => {
    expect(buildReport({ ...base, reason: "inaccurate" })).toEqual({ ok: true, row: { user_id: "u1", story_id: "s1", reason: "inaccurate", message: null } });
    expect(buildReport({ ...base, message: "  Le chiffre est faux.  " })).toEqual({ ok: true, row: { user_id: "u1", story_id: "s1", reason: null, message: "Le chiffre est faux." } });
    const both = buildReport({ ...base, reason: "source_missing", message: "404" });
    expect(both.ok && both.row.reason === "source_missing" && both.row.message === "404").toBe(true);
  });

  it("refuse un signalement vide, un message trop long, une raison inconnue", () => {
    expect(buildReport({ ...base, message: "   " }).ok).toBe(false);
    expect(buildReport({ ...base, message: "x".repeat(REPORT_MESSAGE_MAX + 1) }).ok).toBe(false);
    expect(buildReport({ ...base, reason: "spam" as never }).ok).toBe(false);
  });

  it("propose exactement les trois raisons rapides", () => {
    expect(REPORT_REASONS.map((r) => r.label)).toEqual(["Fait inexact", "Source introuvable", "Pas une bonne nouvelle"]);
  });
});

describe("reportFailureMessage", () => {
  it("explique le doublon, sinon un message générique", () => {
    expect(reportFailureMessage(UNIQUE_VIOLATION)).toMatch(/déjà signalé/);
    expect(reportFailureMessage("42501")).toMatch(/impossible/);
    expect(reportFailureMessage(undefined)).toMatch(/impossible/);
  });
});
