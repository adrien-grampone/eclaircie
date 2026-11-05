import { describe, expect, it } from "vitest";
import { SPLASH_HOLD_MAX_MS, backHref, isStoryId, resolveStoryOpen, splashHoldAction, splashPlays, storyIdFromUrl } from "./deepLink.ts";

const ID = "1f4e4b94-1a86-49b2-9982-64f681732348";

describe("lien profond du widget", () => {
  it("résout l'id (uuid de la RPC daily_stories) depuis le schéma de l'app, Expo Go et un lien web", () => {
    expect(storyIdFromUrl(`eclaircie://story/${ID}`)).toBe(ID);
    expect(storyIdFromUrl(`exp://127.0.0.1:8082/--/story/${ID}`)).toBeNull();
    expect(storyIdFromUrl(`https://eclaircie.app/story/${ID.toUpperCase()}`)).toBe(ID);
    expect(storyIdFromUrl(`eclaircie://story/${ID}?from=widget`)).toBe(ID);
  });
  it("refuse un lien sans nouvelle ou un id qui n'est pas un uuid", () => {
    expect(storyIdFromUrl("eclaircie://")).toBeNull();
    expect(storyIdFromUrl("eclaircie://archives")).toBeNull();
    expect(storyIdFromUrl("eclaircie://story/sample")).toBeNull();
    expect(isStoryId(undefined)).toBe(false);
    expect(isStoryId(ID)).toBe(true);
  });
});

describe("resolveStoryOpen : jamais un écran vide", () => {
  it("ouvre la nouvelle quand la base la renvoie", () => {
    expect(resolveStoryOpen(ID, { story: { id: ID } })).toEqual({ kind: "story" });
  });
  it("id inconnu ou nouvelle plus disponible → Arrivée du jour", () => {
    expect(resolveStoryOpen(ID, { story: null })).toEqual({ kind: "redirect", href: "/" });
    expect(resolveStoryOpen("preview", { story: null })).toEqual({ kind: "redirect", href: "/" });
    expect(resolveStoryOpen(undefined, { story: { id: ID } })).toEqual({ kind: "redirect", href: "/" });
  });
  it("erreur réseau → message, pas de redirection silencieuse", () => {
    expect(resolveStoryOpen(ID, { error: "nouvelle : timeout" })).toEqual({ kind: "error", message: "nouvelle : timeout" });
  });
  it("retour : écran précédent s'il existe (Archives), sinon l'Arrivée (démarrage à froid par le widget)", () => {
    expect(backHref(true)).toBe("back");
    expect(backHref(false)).toBe("/");
  });
});

describe("garde-fou du splash", () => {
  it("finit dès qu'une issue est signalée, attend sinon, et force le fondu après 2,5 s", () => {
    expect(splashHoldAction(0, { kind: "fade" })).toBe("finish");
    expect(splashHoldAction(5000, { kind: "fade" })).toBe("finish");
    expect(splashHoldAction(0, null)).toBe("wait");
    expect(splashHoldAction(SPLASH_HOLD_MAX_MS - 1, null)).toBe("wait");
    expect(splashHoldAction(SPLASH_HOLD_MAX_MS, null)).toBe("force");
    expect(SPLASH_HOLD_MAX_MS).toBe(2500);
  });
  it("app déjà ouverte en arrière-plan + tap widget : aucun splash, navigation directe", () => {
    expect(splashPlays(true)).toBe(true);
    expect(splashPlays(false)).toBe(false);
  });
});
