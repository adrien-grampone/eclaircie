import { buildDraftPrompt, buildRevisePrompt, parseDraft } from "../draft.ts";
import { CONFIG } from "./fixtures/config.ts";
import { OZONE, OZONE_DRAFT_JSON } from "./fixtures/articles.ts";

function withField(field: string, value: unknown): string {
  const draft = JSON.parse(OZONE_DRAFT_JSON) as Record<string, unknown>;
  draft[field] = value;
  return JSON.stringify(draft);
}

describe("parseDraft", () => {
  it("valide un brouillon complet", () => {
    const result = parseDraft(OZONE_DRAFT_JSON, CONFIG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title_main).toBe("La couche d'ozone");
    expect(result.value.title_accent).toBe("se répare.");
    expect(result.value.claims).toHaveLength(2);
  });

  it("refuse un résumé au-delà de summary_max_chars (350 dans la config)", () => {
    const tooLong = parseDraft(withField("summary", "a".repeat(351)), CONFIG);
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.error).toMatch(/summary/);

    const atLimit = parseDraft(withField("summary", "a".repeat(350)), CONFIG);
    expect(atLimit.ok).toBe(true);
  });

  it("suit la limite de la config, pas une valeur codée", () => {
    const short = parseDraft(withField("summary", "a".repeat(120)), { summary_max_chars: 100 });
    expect(short.ok).toBe(false);
  });

  it("exige au moins un claim, chacun avec claim et evidence non vides", () => {
    expect(parseDraft(withField("claims", []), CONFIG).ok).toBe(false);
    expect(parseDraft(withField("claims", [{ claim: "x", evidence: "   " }]), CONFIG).ok).toBe(false);
    expect(parseDraft(withField("claims", [{ claim: "x" }]), CONFIG).ok).toBe(false);
  });

  it("exige title_main et scene non vides", () => {
    expect(parseDraft(withField("title_main", ""), CONFIG).ok).toBe(false);
    expect(parseDraft(withField("scene", ""), CONFIG).ok).toBe(false);
  });

  it("ignore un why_good résiduel : le champ n'existe plus", () => {
    const result = parseDraft(withField("why_good", "ancien champ"), CONFIG);
    expect(result.ok).toBe(true);
    if (result.ok) expect("why_good" in result.value).toBe(false);
  });

  it("accepte un title_accent vide (la chute est optionnelle dans le design)", () => {
    expect(parseDraft(withField("title_accent", ""), CONFIG).ok).toBe(true);
  });

  it("rejette un JSON malformé ou absent avec un message exploitable", () => {
    const malformed = parseDraft("{title_main: oups", CONFIG);
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.error).toMatch(/JSON/);

    const none = parseDraft("Je ne peux pas rédiger ce brouillon.", CONFIG);
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.error).toMatch(/Aucun objet JSON/);
  });

  it("tolère les clôtures ```json et du texte autour", () => {
    const wrapped = `Voici le brouillon demandé :\n\`\`\`json\n${OZONE_DRAFT_JSON}\n\`\`\`\nBonne journée.`;
    expect(parseDraft(wrapped, CONFIG).ok).toBe(true);
  });
});

describe("buildDraftPrompt", () => {
  const prompt = buildDraftPrompt(OZONE, CONFIG);

  it("fournit le texte complet et les métadonnées de l'article", () => {
    expect(prompt.user).toContain(OZONE.fullText);
    expect(prompt.user).toContain(`Source : ${OZONE.sourceName}`);
    expect(prompt.user).toContain(`URL : ${OZONE.url}`);
    expect(prompt.user).toContain(`Titre : ${OZONE.title}`);
  });

  it("impose les règles produit : texte fourni uniquement, pas de copie, fidélité de ton et de précision", () => {
    expect(prompt.system).toMatch(/UNIQUEMENT à partir du texte/);
    expect(prompt.system).toMatch(/ne recopies JAMAIS/);
    expect(prompt.system).toMatch(/« could » reste « pourrait »/);
    expect(prompt.system).toMatch(/« beetles » ne devient pas « carabes »/);
    expect(prompt.system).toMatch(/limite, une opposition ou une contrepartie/);
    expect(prompt.system).toMatch(/title_accent peut être évocateur, mais n'apporte AUCUN fait/);
    expect(prompt.system).not.toContain("why_good");
  });

  it("annonce la longueur maximale lue dans la config", () => {
    expect(prompt.system).toContain("350 caractères MAXIMUM");
    expect(buildDraftPrompt(OZONE, { summary_max_chars: 280 }).system).toContain("280 caractères MAXIMUM");
  });

  it("décrit les six champs attendus", () => {
    for (const field of ["title_main", "title_accent", "summary", "claims", "scene"]) {
      expect(prompt.system).toContain(`"${field}"`);
    }
  });

  it("indique une date inconnue plutôt que null", () => {
    const noDate = buildDraftPrompt({ ...OZONE, publishedAt: null }, CONFIG);
    expect(noDate.user).toContain("(date inconnue)");
  });
});

describe("buildRevisePrompt", () => {
  it("fournit l'article, le brouillon et les problèmes numérotés avec leur correction", () => {
    const draft = parseDraft(OZONE_DRAFT_JSON, CONFIG);
    if (!draft.ok) throw new Error(draft.error);
    const prompt = buildRevisePrompt(OZONE, draft.value, [
      { type: "overstatement", passage: "se répare.", correction: "est en voie de guérison." },
      { type: "missing_caveat", passage: "Le Protocole de Montréal a éliminé", correction: "mentionner le ralentissement dû au CFC-11" },
    ], CONFIG);
    expect(prompt.user).toContain(OZONE.fullText);
    expect(prompt.user).toContain('"title_main": "La couche d\'ozone"');
    expect(prompt.user).toMatch(/1\. \[overstatement\] passage : « se répare\. »/);
    expect(prompt.user).toMatch(/2\. \[missing_caveat\]/);
    expect(prompt.user).toContain("correction : est en voie de guérison.");
    expect(prompt.system).toMatch(/Corrige-les TOUS/);
    expect(prompt.system).toMatch(/sans introduire aucun fait nouveau/);
    expect(prompt.system).toMatch(/« could » reste « pourrait »/); // mêmes règles que le draft
  });
});
