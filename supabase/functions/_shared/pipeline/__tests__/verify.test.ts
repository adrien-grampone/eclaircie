import { buildVerifyPrompt, decideVerify, parseVerify, type Verify, type VerifyProblem } from "../verify.ts";
import { CONFIG } from "./fixtures/config.ts";
import { OZONE, OZONE_VERIFY_JSON, loadOzoneDraft } from "./fixtures/articles.ts";

const loadDraft = loadOzoneDraft;

function clean(): Verify {
  const result = parseVerify(OZONE_VERIFY_JSON);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

const over: VerifyProblem = { type: "overstatement", passage: "se répare.", correction: "est en voie de guérison." };
const caveat: VerifyProblem = { type: "missing_caveat", passage: "99 %", correction: "mentionner les émissions non déclarées de CFC-11" };
const translation: VerifyProblem = { type: "translation_issue", passage: "carabes", correction: "coléoptères" };
const fact: VerifyProblem = { type: "fact_error", passage: "vers 2050", correction: "vers 2066" };
const tone: VerifyProblem = { type: "tone_negative", passage: "(résumé entier)", correction: "la nouvelle se lit comme une perte" };

describe("parseVerify", () => {
  it("valide une réponse complète et met note à vide par défaut", () => {
    const result = parseVerify('{"claims":[{"index":0,"supported":true}],"problems":[],"verdict":"approve"}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.claims[0]?.note).toBe("");
  });

  it("exige un type de problème connu, un passage et une correction", () => {
    expect(parseVerify('{"claims":[],"problems":[{"type":"style","passage":"x","correction":"y"}],"verdict":"reject"}').ok).toBe(false);
    expect(parseVerify('{"claims":[],"problems":[{"type":"overstatement","passage":"x"}],"verdict":"reject"}').ok).toBe(false);
    expect(parseVerify('{"claims":[],"problems":[{"type":"overstatement","passage":"x","correction":"y"}],"verdict":"reject"}').ok).toBe(true);
  });

  it("refuse un verdict inconnu ou un champ manquant", () => {
    expect(parseVerify('{"claims":[],"problems":[],"verdict":"maybe"}').ok).toBe(false);
    expect(parseVerify('{"claims":[],"verdict":"approve"}').ok).toBe(false);
  });
});

describe("decideVerify", () => {
  const draft = loadDraft();

  it("valide quand aucun problème et verdict approve", () => {
    expect(decideVerify(clean(), draft, 1, CONFIG)).toEqual({ decision: "verified", reason: null });
    expect(decideVerify(clean(), draft, 2, CONFIG).decision).toBe("verified");
  });

  it("rejette définitivement au moindre fact_error, dès la première passe", () => {
    const out = decideVerify({ ...clean(), problems: [over, fact], verdict: "reject" }, draft, 1, CONFIG);
    expect(out.decision).toBe("rejected");
    expect(out.reason).toMatch(/^fact_error: vers 2050/);
  });

  it("rejette si un claim n'est pas soutenu : c'est un fait", () => {
    const verify = clean();
    const claims = verify.claims.map((c, i) => (i === 1 ? { ...c, supported: false, note: "l'article dit 2066" } : c));
    const out = decideVerify({ ...verify, claims, verdict: "reject" }, draft, 1, CONFIG);
    expect(out.decision).toBe("rejected");
    expect(out.reason).toMatch(/fact_error: claim 1: l'article dit 2066/);
  });

  it("demande une révision pour overstatement, missing_caveat ou translation_issue en première passe", () => {
    for (const problem of [over, caveat, translation]) {
      const out = decideVerify({ ...clean(), problems: [problem], verdict: "reject" }, draft, 1, CONFIG);
      expect(out.decision).toBe("revise");
      expect(out.reason).toContain(problem.type);
    }
  });

  it("rejette définitivement un tone_negative, à n'importe quelle passe", () => {
    expect(decideVerify({ ...clean(), problems: [tone], verdict: "reject" }, draft, 1, CONFIG).decision).toBe("rejected");
    const pass2 = decideVerify({ ...clean(), problems: [tone], previous_problems: [{ index: 0, fixed: true, note: "" }], verdict: "reject" }, draft, 2, CONFIG, [over]);
    expect(pass2.decision).toBe("rejected");
    expect(pass2.reason).toMatch(/^tone_negative/);
  });

  it("passe 2 : valide quand chaque problème précédent est corrigé, même si le modèle liste un nouvel overstatement", () => {
    const verify: Verify = { ...clean(), problems: [caveat], previous_problems: [{ index: 0, fixed: true, note: "" }, { index: 1, fixed: true, note: "" }], verdict: "reject" };
    expect(decideVerify(verify, draft, 2, CONFIG, [over, translation])).toEqual({ decision: "verified", reason: null });
  });

  it("passe 2 : rejette si un problème précédent n'est pas corrigé ou n'a pas été évalué", () => {
    const notFixed: Verify = { ...clean(), previous_problems: [{ index: 0, fixed: true, note: "" }, { index: 1, fixed: false, note: "toujours « carabes »" }], verdict: "reject" };
    const out = decideVerify(notFixed, draft, 2, CONFIG, [over, translation]);
    expect(out.decision).toBe("rejected");
    expect(out.reason).toMatch(/non corrigé : translation_issue: carabes \(toujours « carabes »\)/);
    const missing: Verify = { ...clean(), previous_problems: [{ index: 0, fixed: true, note: "" }], verdict: "approve" };
    expect(decideVerify(missing, draft, 2, CONFIG, [over, translation]).decision).toBe("rejected");
  });

  it("passe 2 : un fact_error nouveau rejette même si tout l'ancien est corrigé", () => {
    const verify: Verify = { ...clean(), problems: [fact], previous_problems: [{ index: 0, fixed: true, note: "" }], verdict: "reject" };
    expect(decideVerify(verify, draft, 2, CONFIG, [over]).decision).toBe("rejected");
  });

  it("passe 1 au-delà de verify_max_passes (config à 1) : les problèmes non fatals rejettent", () => {
    const out = decideVerify({ ...clean(), problems: [over], verdict: "reject" }, draft, 1, { verify_max_passes: 1 });
    expect(out.decision).toBe("rejected");
    expect(out.reason).toMatch(/après 1 passe/);
  });

  it("révise même si le modèle dit approve avec des problèmes listés", () => {
    expect(decideVerify({ ...clean(), problems: [caveat], verdict: "approve" }, draft, 1, CONFIG).decision).toBe("revise");
  });

  it("rejette un verdict reject sans problème : le doute l'emporte", () => {
    expect(decideVerify({ ...clean(), verdict: "reject" }, draft, 1, CONFIG).decision).toBe("rejected");
  });

  it("rejette une liste de claims incohérente", () => {
    const verify = clean();
    expect(decideVerify({ ...verify, claims: verify.claims.slice(0, 1) }, draft, 1, CONFIG).decision).toBe("rejected");
    const dup = [{ index: 0, supported: true, note: "" }, { index: 0, supported: true, note: "" }];
    expect(decideVerify({ ...verify, claims: dup }, draft, 1, CONFIG).decision).toBe("rejected");
    const out = [{ index: 0, supported: true, note: "" }, { index: 7, supported: true, note: "" }];
    expect(decideVerify({ ...verify, claims: out }, draft, 1, CONFIG).decision).toBe("rejected");
  });
});

describe("buildVerifyPrompt", () => {
  const prompt = buildVerifyPrompt(OZONE, loadDraft());

  it("transmet l'article et le brouillon, claims numérotés à partir de 0", () => {
    expect(prompt.user).toContain(OZONE.fullText);
    expect(prompt.user).toContain("Titre : La couche d'ozone se répare.");
    expect(prompt.user).toMatch(/0\. CLAIM : l'ozone retrouvera/);
    expect(prompt.user).toMatch(/1\. CLAIM : le Protocole de Montréal/);
  });

  it("ne contient aucun raisonnement du premier appel, seulement ses sorties", () => {
    expect(prompt.user).not.toMatch(/scene/i);
    expect(prompt.system).not.toContain("RÈGLES ABSOLUES"); // pas les consignes du rédacteur
  });

  it("décrit les cinq types de problèmes et exempte la traduction fidèle", () => {
    for (const t of ["fact_error", "overstatement", "missing_caveat", "translation_issue", "tone_negative"]) {
      expect(prompt.system).toContain(`- ${t} :`);
    }
    expect(prompt.system).toMatch(/traduction FIDÈLE d'un mot anglais n'est JAMAIS un translation_issue/);
    expect(prompt.system).toMatch(/« folly » → « insensé » est correct/);
    expect(prompt.system).toMatch(/passage fautif/);
    expect(prompt.system).toContain('"correction": "…"');
  });

  it("ne juge le titre que sur deux points et protège son ton", () => {
    expect(prompt.system).toMatch(/LE TITRE .* DEUX points/);
    expect(prompt.system).toMatch(/ne signale jamais un titre pour son ton/);
    expect(prompt.system).toMatch(/PREMIÈRE PASSE/);
    expect(prompt.user).not.toContain("PROBLÈMES DE LA PASSE PRÉCÉDENTE");
  });

  it("en seconde passe, demande l'état de chaque problème précédent et limite la recherche aux fact_error", () => {
    const second = buildVerifyPrompt(OZONE, loadDraft(), { pass: 2, previousProblems: [over, translation] });
    expect(second.system).toMatch(/SECONDE PASSE/);
    expect(second.system).toMatch(/UNIQUEMENT des fact_error ou un tone_negative/);
    expect(second.system).toContain('"previous_problems": [ { "index": 0, "fixed": true, "note": "" } ]');
    expect(second.user).toContain("PROBLÈMES DE LA PASSE PRÉCÉDENTE");
    expect(second.user).toMatch(/0\. \[overstatement\] « se répare\. » → correction demandée : est en voie de guérison\./);
    expect(second.user).toMatch(/1\. \[translation_issue\]/);
  });
});
