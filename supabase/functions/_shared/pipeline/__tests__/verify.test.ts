import { parseDraft, type Draft } from "../draft.ts";
import { buildVerifyPrompt, isVerifyPassed, parseVerify, type Verify } from "../verify.ts";
import { CONFIG } from "./fixtures/config.ts";
import { OZONE, OZONE_DRAFT_JSON, OZONE_VERIFY_JSON } from "./fixtures/articles.ts";

function loadDraft(): Draft {
  const result = parseDraft(OZONE_DRAFT_JSON, CONFIG);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function loadVerify(): Verify {
  const result = parseVerify(OZONE_VERIFY_JSON);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe("parseVerify", () => {
  it("valide une réponse complète et met note à vide par défaut", () => {
    const result = parseVerify('{"claims":[{"index":0,"supported":true}],"facts_in_article":true,"no_exaggeration":true,"problems":[],"verdict":"approve"}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.claims[0]?.note).toBe("");
  });

  it("refuse un verdict inconnu ou un champ manquant", () => {
    expect(parseVerify('{"claims":[],"facts_in_article":true,"no_exaggeration":true,"problems":[],"verdict":"maybe"}').ok).toBe(false);
    expect(parseVerify('{"claims":[],"verdict":"approve"}').ok).toBe(false);
  });
});

describe("isVerifyPassed", () => {
  const draft = loadDraft();

  it("passe quand tout est irréprochable", () => {
    expect(isVerifyPassed(loadVerify(), draft)).toBe(true);
  });

  it("échoue au moindre doute : verdict, drapeaux, problèmes", () => {
    expect(isVerifyPassed({ ...loadVerify(), verdict: "reject" }, draft)).toBe(false);
    expect(isVerifyPassed({ ...loadVerify(), facts_in_article: false }, draft)).toBe(false);
    expect(isVerifyPassed({ ...loadVerify(), no_exaggeration: false }, draft)).toBe(false);
    expect(isVerifyPassed({ ...loadVerify(), problems: ["Le résumé dit « va » là où l'article dit « devrait »"] }, draft)).toBe(false);
  });

  it("échoue si un claim n'est pas soutenu", () => {
    const verify = loadVerify();
    const claims = verify.claims.map((c, i) => (i === 1 ? { ...c, supported: false } : c));
    expect(isVerifyPassed({ ...verify, claims }, draft)).toBe(false);
  });

  it("échoue si le vérificateur n'a pas évalué chaque claim exactement une fois", () => {
    const verify = loadVerify();
    expect(isVerifyPassed({ ...verify, claims: verify.claims.slice(0, 1) }, draft)).toBe(false);
    const duplicated = [{ index: 0, supported: true, note: "" }, { index: 0, supported: true, note: "" }];
    expect(isVerifyPassed({ ...verify, claims: duplicated }, draft)).toBe(false);
    const outOfRange = [{ index: 0, supported: true, note: "" }, { index: 5, supported: true, note: "" }];
    expect(isVerifyPassed({ ...verify, claims: outOfRange }, draft)).toBe(false);
  });
});

describe("buildVerifyPrompt", () => {
  const prompt = buildVerifyPrompt(OZONE, loadDraft());

  it("transmet l'article et le brouillon, claims numérotés à partir de 0", () => {
    expect(prompt.user).toContain(OZONE.fullText);
    expect(prompt.user).toContain("Titre : La couche d'ozone se répare.");
    expect(prompt.user).toMatch(/0\. CLAIM : l'ozone retrouvera/);
    expect(prompt.user).toMatch(/1\. CLAIM : le Protocole de Montréal/);
    expect(prompt.user).toContain("EVIDENCE : la couche d'ozone devrait retrouver");
  });

  it("ne contient aucun raisonnement du premier appel, seulement ses sorties", () => {
    expect(prompt.user).not.toMatch(/scene/i);
    expect(prompt.system).not.toContain("title_main");
  });

  it("impose la sévérité et les trois contrôles de la spec", () => {
    expect(prompt.system).toMatch(/le moindre doute = reject/);
    expect(prompt.system).toMatch(/chiffre, date et nom propre/);
    expect(prompt.system).toMatch(/étude sur la souris/);
    expect(prompt.system).toContain('"verdict": "approve"');
  });
});
