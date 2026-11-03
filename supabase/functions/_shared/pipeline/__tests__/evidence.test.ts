import { checkEvidence } from "../evidence.ts";
import { parseDraft } from "../draft.ts";
import { CONFIG } from "./fixtures/config.ts";
import { MANGROVES, OZONE, OZONE_DRAFT_JSON } from "./fixtures/articles.ts";

describe("checkEvidence", () => {
  it("retrouve les evidences d'un brouillon réaliste malgré la typographie de l'article", () => {
    const draft = parseDraft(OZONE_DRAFT_JSON, CONFIG);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    // Le brouillon écrit « d'ozone » et « 99 % » ; l'article a « d’ozone » et « 99 % » insécable.
    const result = checkEvidence(draft.value.claims, OZONE.fullText);
    expect(result).toEqual({ ok: true, missing: [] });
  });

  it("échoue si une evidence est absente du texte, et la liste", () => {
    const claims = [
      { claim: "ok", evidence: "la couche d’ozone se reconstitue" },
      { claim: "inventé", evidence: "le trou dans la couche d'ozone a totalement disparu en 2025" },
    ];
    const result = checkEvidence(claims, OZONE.fullText);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([claims[1]]);
  });

  it("ignore casse, guillemets, apostrophes et espaces insécables", () => {
    const claims = [
      { claim: "a", evidence: "LES PRISES DE POISSONS ONT AUGMENTÉ DE 20 % DANS LES ZONES REPLANTÉES" },
      { claim: "b", evidence: '"Les prises de poissons ont augmenté de 20 %"' },
      { claim: "c", evidence: "l'association Océanium et ses partenaires" },
      { claim: "d", evidence: "stockent   jusqu’à quatre fois\nplus de carbone" },
    ];
    expect(checkEvidence(claims, MANGROVES.fullText)).toEqual({ ok: true, missing: [] });
  });

  it("ne tolère pas une paraphrase, même proche", () => {
    const claims = [{ claim: "x", evidence: "les prises de poisson ont augmenté de 20 %" }]; // « poisson » sans s
    expect(checkEvidence(claims, MANGROVES.fullText).ok).toBe(false);
  });

  it("considère une evidence vide ou blanche comme manquante", () => {
    const result = checkEvidence([{ claim: "x", evidence: "   " }], MANGROVES.fullText);
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(1);
  });

  it("accepte une liste vide (rien à contredire) — le schéma du brouillon exige par ailleurs ≥ 1 claim", () => {
    expect(checkEvidence([], MANGROVES.fullText)).toEqual({ ok: true, missing: [] });
  });

  it("échoue sur un texte paywall qui ne contient pas l'article", () => {
    const claims = [{ claim: "x", evidence: "déployé dans douze pays" }];
    expect(checkEvidence(claims, "Cet article est réservé aux abonnés.").ok).toBe(false);
  });
});
