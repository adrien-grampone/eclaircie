import { describe, expect, it } from "vitest";
import { buildReworkPrompt, decideDraftOutput } from "../draft.ts";
import { isRework } from "../../stories.ts";
import { CONFIG } from "./fixtures/config.ts";
import { OZONE, loadOzoneDraft } from "./fixtures/articles.ts";

describe("reprise d'une ancienne nouvelle (to_rework)", () => {
  it("réécrit selon la consigne actuelle, à partir de l'article, sans fait nouveau", () => {
    const prompt = buildReworkPrompt(OZONE, loadOzoneDraft(), CONFIG);
    expect(prompt.system).toMatch(/ancienne consigne/);
    expect(prompt.system).toMatch(/aucun fait nouveau/);
    expect(prompt.system).toMatch(/RÉSUMÉ EN TROIS TEMPS/);
    expect(prompt.system).toMatch(/PIÈGE DES GÉNÉRALISATIONS/);
    expect(prompt.user).toContain("ANCIEN BROUILLON");
    expect(prompt.user).toContain(OZONE.fullText.slice(0, 40));
  });

  it("relance en plus court comme une rédaction, et préfixe ses rejets « rework »", () => {
    expect(buildReworkPrompt(OZONE, loadOzoneDraft(), CONFIG, { shorten: [{ field: "summary", label: "le résumé", chars: 400, max: 350 }] }).user).toMatch(/CONSIGNE DE LONGUEUR/);
    const out = decideDraftOutput("pas de json", 1, CONFIG, "rework");
    expect(out.action === "reject" && out.reason.startsWith("rework_parse_error")).toBe(true);
  });

  it("compte sur le budget des reprises la reprise et les révisions qui en découlent", () => {
    expect(isRework({ status: "to_rework", previous_verify_log: null })).toBe(true);
    expect(isRework({ status: "to_revise", previous_verify_log: [] })).toBe(true);
    expect(isRework({ status: "to_revise", previous_verify_log: null })).toBe(false);
  });
});
