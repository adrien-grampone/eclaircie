import { METHOD_TEXT, planReschedule } from "../settings.ts";

describe("planReschedule", () => {
  const now = new Date(2026, 10, 4, 10, 0);

  it("ne fait rien si l'heure ne change pas", () => {
    expect(planReschedule({ hour: 8, minute: 0 }, { hour: 8, minute: 0 }, true, now)).toEqual({ action: "none", reason: "unchanged" });
  });

  it("ne reprogramme pas sans autorisation, mais le dit", () => {
    expect(planReschedule({ hour: 8, minute: 0 }, { hour: 9, minute: 0 }, false, now)).toEqual({ action: "none", reason: "not_granted" });
  });

  it("reprogramme à la nouvelle heure et calcule le prochain déclenchement", () => {
    expect(planReschedule({ hour: 8, minute: 0 }, { hour: 9, minute: 30 }, true, now)).toEqual({ action: "schedule", hour: 9, minute: 30, next: new Date(2026, 10, 5, 9, 30) });
    expect(planReschedule({ hour: 8, minute: 0 }, { hour: 18, minute: 0 }, true, now)).toMatchObject({ action: "schedule", next: new Date(2026, 10, 4, 18, 0) });
  });
});

describe("METHOD_TEXT", () => {
  it("dit l'essentiel, honnêtement : sources, tri, IA, relecture humaine", () => {
    const text = METHOD_TEXT.join(" ");
    for (const word of ["source", "tri", "IA", "relecture humaine", "retirée"]) expect(text).toContain(word);
  });
});
