import { classifyExtraction, extractMainText } from "../extract.ts";
import { CONFIG } from "./fixtures/config.ts";
import { ARTICLE_HTML, PAYWALL_HTML } from "./fixtures/feeds.ts";

describe("extractMainText", () => {
  it("isole le corps de l'article sans navigation ni pied de page", () => {
    const result = extractMainText(ARTICLE_HTML, "https://example.org/planete/ozone");
    expect(result).not.toBeNull();
    expect(result?.text).toContain("la couche d’ozone se reconstitue");
    expect(result?.text).not.toContain("Mentions légales");
    expect(result?.text).not.toContain("Accueil");
    expect(result?.title).toContain("La couche d’ozone se répare");
  });

  it("ne plante pas sur une URL invalide ou un HTML vide", () => {
    expect(() => extractMainText(ARTICLE_HTML, "pas une url")).not.toThrow();
    expect(extractMainText("", "https://example.org/x")).toBeNull();
  });
});

describe("classifyExtraction", () => {
  it("accepte un article complet au-dessus de extract_min_chars", () => {
    const outcome = classifyExtraction(extractMainText(ARTICLE_HTML, "https://example.org/a"), CONFIG);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.text.length).toBeGreaterThan(CONFIG.extract_min_chars);
  });

  it("rejette un paywall ou un texte trop court avec la raison no_fulltext", () => {
    const paywall = classifyExtraction(extractMainText(PAYWALL_HTML, "https://example.org/p"), CONFIG);
    expect(paywall).toEqual({ ok: false, reason: "no_fulltext" });
    expect(classifyExtraction(null, CONFIG)).toEqual({ ok: false, reason: "no_fulltext" });
    expect(classifyExtraction({ title: null, text: "a".repeat(799) }, CONFIG).ok).toBe(false);
    expect(classifyExtraction({ title: null, text: "a".repeat(800) }, CONFIG).ok).toBe(true);
  });

  it("suit le seuil de la config, pas une valeur codée", () => {
    expect(classifyExtraction({ title: null, text: "a".repeat(300) }, { extract_min_chars: 200 }).ok).toBe(true);
  });
});
