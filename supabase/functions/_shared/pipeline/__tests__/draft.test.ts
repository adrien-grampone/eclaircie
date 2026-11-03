import { buildDraftPrompt, buildRevisePrompt, decideRevise, parseDraft } from "../draft.ts";
import { CONFIG } from "./fixtures/config.ts";
import { OZONE, OZONE_DRAFT_JSON, loadOzoneDraft } from "./fixtures/articles.ts";

function withField(field: string, value: unknown): string {
  const draft = JSON.parse(OZONE_DRAFT_JSON) as Record<string, unknown>;
  draft[field] = value;
  return JSON.stringify(draft);
}

describe("parseDraft", () => {
  it("valide un brouillon complet", () => {
    const result = parseDraft(OZONE_DRAFT_JSON, CONFIG);
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.verdict !== "ok") throw new Error("brouillon attendu");
    expect(result.value.title_main).toBe("La couche d'ozone");
    expect(result.value.title_accent).toBe("se répare.");
    expect(result.value.claims).toHaveLength(2);
  });

  it("accepte le verdict not_good_news avec sa raison, sans les autres champs", () => {
    const result = parseDraft('{"verdict":"not_good_news","reason":"La moitié de la forêt est déjà détruite."}', CONFIG);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.verdict).toBe("not_good_news");
    expect(parseDraft('{"verdict":"not_good_news"}', CONFIG).ok).toBe(false);
  });

  it("exige le verdict ok sur un brouillon", () => {
    const draft = JSON.parse(OZONE_DRAFT_JSON) as Record<string, unknown>;
    delete draft["verdict"];
    expect(parseDraft(JSON.stringify(draft), CONFIG).ok).toBe(false);
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

  it("exige title_main et scene non vides, et nettoie les espaces de scene", () => {
    expect(parseDraft(withField("title_main", ""), CONFIG).ok).toBe(false);
    expect(parseDraft(withField("scene", ""), CONFIG).ok).toBe(false);
    expect(parseDraft(withField("scene", "   "), CONFIG).ok).toBe(false);
    const padded = parseDraft(withField("scene", "  three wind turbines on hills  "), CONFIG);
    expect(padded.ok).toBe(true);
    if (padded.ok && padded.value.verdict === "ok") expect(padded.value.scene).toBe("three wind turbines on hills");
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

  it("impose les règles du champ scene : sujet exact ou générique, peu d'éléments, silhouettes sans visage, aucun texte", () => {
    expect(prompt.system).toMatch(/scene : .*en anglais/);
    expect(prompt.system).toMatch(/EXACT .* ou GÉNÉRIQUE .*, jamais approximatif/);
    expect(prompt.system).toMatch(/peu d'éléments/);
    expect(prompt.system).toMatch(/petites silhouettes au loin, sans visage/);
    expect(prompt.system).toMatch(/aucun texte, aucune lettre, aucun logo/);
    // La révision partage les mêmes règles.
    expect(buildRevisePrompt(OZONE, loadOzoneDraft(), [], CONFIG).system).toMatch(/jamais approximatif/);
  });

  it("impose les règles produit : texte fourni uniquement, pas de copie, fidélité de ton et de précision", () => {
    expect(prompt.system).toMatch(/UNIQUEMENT à partir du texte/);
    expect(prompt.system).toMatch(/ne recopies JAMAIS/);
    expect(prompt.system).toMatch(/« could » reste « pourrait »/);
    expect(prompt.system).toMatch(/« beetles » ne devient pas « carabes »/);
    expect(prompt.system).not.toContain("why_good");
  });

  it("impose les règles de ton : nuance utile seulement, jamais en fin ni dans le titre, not_good_news sinon", () => {
    expect(prompt.system).toMatch(/QUE si elle change le sens de CETTE nouvelle/);
    expect(prompt.system).toMatch(/Pas de contexte général négatif/);
    expect(prompt.system).toMatch(/jamais la dernière phrase, jamais dans le titre/);
    expect(prompt.system).toMatch(/FINIT sur la bonne nouvelle/);
    expect(prompt.system).toMatch(/"verdict": "not_good_news"/);
    expect(prompt.system).toMatch(/nom français courant/);
    expect(prompt.system).toMatch(/JAMAIS un nom anglais brut/);
  });

  it("annonce la longueur maximale lue dans la config", () => {
    expect(prompt.system).toContain("350 caractères MAXIMUM");
    expect(buildDraftPrompt(OZONE, { summary_max_chars: 280 }).system).toContain("280 caractères MAXIMUM");
  });

  it("décrit les six champs attendus", () => {
    for (const field of ["verdict", "title_main", "title_accent", "summary", "claims", "scene"]) {
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
    const prompt = buildRevisePrompt(OZONE, loadOzoneDraft(), [
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
    expect(prompt.system).toMatch(/finir sur elle/);
  });
});

describe("decideRevise", () => {
  it("accepte une révision valide, sans le champ verdict", () => {
    const out = decideRevise(OZONE_DRAFT_JSON, 1, CONFIG);
    expect(out.action).toBe("accept");
    if (out.action === "accept") expect("verdict" in out.draft).toBe(false);
  });

  it("demande une seconde tentative plus courte quand seul le résumé dépasse", () => {
    const out = decideRevise(withField("summary", "a".repeat(380)), 1, CONFIG);
    expect(out).toEqual({ action: "retry_shorter", chars: 380 });
  });

  it("rejette si le résumé dépasse encore après les tentatives permises (revise_length_retries)", () => {
    const out = decideRevise(withField("summary", "a".repeat(380)), 2, CONFIG);
    expect(out.action).toBe("reject");
    if (out.action === "reject") expect(out.reason).toMatch(/revise_too_long: 380 caractères après 2 tentative/);
    expect(decideRevise(withField("summary", "a".repeat(380)), 2, { ...CONFIG, revise_length_retries: 2 }).action).toBe("retry_shorter");
    expect(decideRevise(withField("summary", "a".repeat(380)), 1, { ...CONFIG, revise_length_retries: 0 }).action).toBe("reject");
  });

  it("rejette toute autre erreur de parsing sans nouvelle tentative", () => {
    const out = decideRevise(withField("claims", []), 1, CONFIG);
    expect(out.action).toBe("reject");
    if (out.action === "reject") expect(out.reason).toMatch(/^revise_parse_error/);
    expect(decideRevise("pas du json", 1, CONFIG).action).toBe("reject");
  });

  it("remonte un verdict not_good_news de la révision", () => {
    expect(decideRevise('{"verdict":"not_good_news","reason":"trop de contreparties"}', 1, CONFIG)).toEqual({ action: "not_good_news", reason: "trop de contreparties" });
  });

  it("ajoute la consigne de raccourcir au prompt de révision quand on le demande", () => {
    const prompt = buildRevisePrompt(OZONE, loadOzoneDraft(), [], CONFIG, { shortenFrom: 380 });
    expect(prompt.user).toMatch(/CONSIGNE DE LONGUEUR : ta révision précédente faisait 380 caractères/);
    expect(prompt.user).toMatch(/RACCOURCIS le résumé sous 350 caractères/);
    expect(buildRevisePrompt(OZONE, loadOzoneDraft(), [], CONFIG).user).not.toContain("CONSIGNE DE LONGUEUR");
  });
});
