import { describe, expect, it } from "vitest";
import { INITIAL_LAUNCH_GATE, LAUNCH_URL_REPLAY_MS, SPLASH_HOLD_MAX_MS, backHref, duplicateOnTop, gateSystemPath, isStoryId, resolveStoryOpen, splashHoldAction, splashPlays, storyIdFromUrl } from "./deepLink.ts";

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
  it("retour : écran précédent s'il existe (Archives, Arrivée), sinon l'Arrivée par remplacement", () => {
    expect(backHref([{ name: "archives" }, { name: "story/[id]", id: ID }])).toBe("back");
    expect(backHref([{ name: "index" }, { name: "story/[id]", id: ID }])).toBe("back");
    expect(backHref([{ name: "story/[id]", id: ID }])).toBe("/");
    expect(backHref([])).toBe("/");
  });
  it("lien traité deux fois : la pile ne garde qu'une entrée, le retour ne ramène jamais au même article", () => {
    const twice = [{ name: "story/[id]", id: ID }, { name: "story/[id]", id: ID }];
    expect(duplicateOnTop(twice)).toBe(true);
    expect(backHref(twice)).toBe("/");
    expect(duplicateOnTop([{ name: "index" }, { name: "story/[id]", id: ID }])).toBe(false);
    expect(duplicateOnTop([{ name: "story/[id]", id: "autre" }, { name: "story/[id]", id: ID }])).toBe(false);
    // Retap du widget sur l'article déjà affiché, app ouverte : même règle.
    expect(duplicateOnTop([{ name: "index" }, { name: "story/[id]", id: ID }, { name: "story/[id]", id: ID }])).toBe(true);
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

describe("URL de lancement consommée une seule fois", () => {
  const url = `eclaircie://story/${ID}`;
  it("démarrage à froid par le widget : suivie la première fois, l'Arrivée ensuite", () => {
    const first = gateSystemPath(INITIAL_LAUNCH_GATE, { path: url, initial: true, atMs: 0 });
    expect(first.path).toBe(url);
    const again = gateSystemPath(first.gate, { path: url, initial: true, atMs: 4000 });
    expect(again.path).toBe("/");
    expect(gateSystemPath(first.gate, { path: url, initial: true, atMs: 60_000 }).path).toBe("/");
  });
  it("relivraison de la même URL en événement url juste après le lancement : ignorée", () => {
    const first = gateSystemPath(INITIAL_LAUNCH_GATE, { path: url, initial: true, atMs: 0 });
    expect(gateSystemPath(first.gate, { path: url, initial: false, atMs: 300 }).path).toBeNull();
    expect(gateSystemPath(first.gate, { path: url, initial: false, atMs: LAUNCH_URL_REPLAY_MS - 1 }).path).toBeNull();
  });
  it("retap du widget app ouverte, plus tard : suivi (la route évite elle-même le doublon)", () => {
    const first = gateSystemPath(INITIAL_LAUNCH_GATE, { path: url, initial: true, atMs: 0 });
    expect(gateSystemPath(first.gate, { path: url, initial: false, atMs: LAUNCH_URL_REPLAY_MS + 1 }).path).toBe(url);
    expect(gateSystemPath(first.gate, { path: "eclaircie://story/autre", initial: false, atMs: 100 }).path).toBe("eclaircie://story/autre");
  });
  it("ouverture normale par l'icône : aucune URL, rien à consommer", () => {
    expect(gateSystemPath(INITIAL_LAUNCH_GATE, { path: "eclaircie://archives", initial: false, atMs: 0 }).path).toBe("eclaircie://archives");
  });
});
