import { shouldShowArrival } from "../arrival.ts";

describe("shouldShowArrival", () => {
  it("s'affiche à la première ouverture de la journée, puis plus jusqu'au lendemain", () => {
    expect(shouldShowArrival(null, "2026-11-03")).toBe(true);
    expect(shouldShowArrival("2026-11-02", "2026-11-03")).toBe(true);
    expect(shouldShowArrival("2026-11-03", "2026-11-03")).toBe(false);
    expect(shouldShowArrival("2026-11-03", "2026-11-04")).toBe(true);
  });
});
