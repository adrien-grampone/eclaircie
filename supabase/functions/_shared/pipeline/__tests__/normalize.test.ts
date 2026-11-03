import { normalizeText } from "../normalize.ts";

describe("normalizeText", () => {
  it("unifie les apostrophes typographiques", () => {
    expect(normalizeText("l’ozone")).toBe(normalizeText("l'ozone"));
    expect(normalizeText("aujourd‘hui")).toBe("aujourd'hui");
  });

  it("supprime les guillemets, français comme anglais ou droits", () => {
    expect(normalizeText("« résultats »")).toBe("résultats");
    expect(normalizeText("“quote”")).toBe("quote");
    expect(normalizeText('"droits"')).toBe("droits");
  });

  it("réduit tous les blancs, y compris insécables, à un espace simple", () => {
    expect(normalizeText("99 %  des\tsubstances\n\nnocives")).toBe("99 % des substances nocives");
    expect(normalizeText("chiffres : 2066")).toBe("chiffres: 2066");
  });

  it("ignore la casse et les espaces en bordure", () => {
    expect(normalizeText("  La Couche D’Ozone ")).toBe("la couche d'ozone");
  });

  it("unifie tirets et points de suspension, et colle la ponctuation au mot", () => {
    expect(normalizeText("2012 – 2018 …")).toBe("2012 - 2018...");
    expect(normalizeText("2012—2018")).toBe("2012-2018");
  });

  it("est idempotente", () => {
    const once = normalizeText("« L’accord  de Kigali : un succès »");
    expect(normalizeText(once)).toBe(once);
  });
});
