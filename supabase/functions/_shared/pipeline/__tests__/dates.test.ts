import { addDays, dateOfTimestamp, daysBetween, isIsoDate, toIsoDate, toUtcMs } from "../dates.ts";

describe("dates", () => {
  it("valide le format YYYY-MM-DD et rejette les dates impossibles", () => {
    expect(isIsoDate("2026-11-03")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("03/11/2026")).toBe(false);
    expect(isIsoDate("2026-11-3")).toBe(false);
  });

  it("lance sur une date invalide", () => {
    expect(() => toUtcMs("hier")).toThrow(/Date invalide/);
  });

  it("compte les jours entiers, dans les deux sens, en passant les mois", () => {
    expect(daysBetween("2026-10-28", "2026-11-03")).toBe(6);
    expect(daysBetween("2026-11-03", "2026-10-28")).toBe(-6);
    expect(daysBetween("2026-11-03", "2026-11-03")).toBe(0);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2); // passage à l'heure d'été
  });

  it("additionne des jours en gérant les fins d'année", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("ramène un timestamp ISO à sa date UTC", () => {
    expect(dateOfTimestamp("2026-10-01T12:00:00+00:00")).toBe("2026-10-01");
    expect(dateOfTimestamp("2026-10-01T23:30:00-02:00")).toBe("2026-10-02");
    expect(() => dateOfTimestamp("pas une date")).toThrow(/Timestamp invalide/);
  });

  it("formate une Date en UTC", () => {
    expect(toIsoDate(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01-05");
  });
});
