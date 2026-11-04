import {
  fitImage,
  ILLUSTRATION_STYLE_PROMPT, buildIllustrationPrompt, fallbackPrefix, illustrationPath,
  imageAlertFingerprint, pickFallbackImage, planImageAlerts, type ImageStatusStory,
} from "../illustration.ts";

const PALETTE = "warm apricot sky fading to pale cream, a soft pale-yellow sun, rolling hills in sand, caramel and deep brown";

describe("buildIllustrationPrompt", () => {
  it("assemble le prompt de style validé, la palette du thème et la scène sur sa propre ligne", () => {
    const prompt = buildIllustrationPrompt({ paletteWords: PALETTE, scene: "three tall wind turbines on gentle hills" });
    expect(prompt).toBe(
      "Full-bleed editorial illustration, edge to edge, no border, no frame, no paper margin. " +
      "Gouache and risograph style with the texture of warm paper and visible grain across the whole image. " +
      "Flat layered shapes with soft, slightly irregular painted edges. Calm, optimistic early-morning light. " +
      `Limited palette: ${PALETTE}. Any sun or moon is a perfect circle. ` +
      "Wide, airy composition: keep the top 35% of the image as open sky with no detail, for a title overlay. " +
      "No text, no letters, no logos, no close-up faces, no photorealism, no 3D render.\n" +
      "Scene: three tall wind turbines on gentle hills",
    );
    expect(prompt).not.toContain("{palette}");
    expect(ILLUSTRATION_STYLE_PROMPT).toContain("{palette}");
  });

  it("nettoie espaces, retours à la ligne et point final de la palette", () => {
    const prompt = buildIllustrationPrompt({ paletteWords: "  peach sky,\n  a warm sun. ", scene: " a  farm\nwith hedgerows " });
    expect(prompt).toContain("Limited palette: peach sky, a warm sun. Any sun");
    expect(prompt.endsWith("\nScene: a farm with hedgerows")).toBe(true);
  });

  it("refuse une palette ou une scène vide", () => {
    expect(() => buildIllustrationPrompt({ paletteWords: "", scene: "x" })).toThrow(/palette/);
    expect(() => buildIllustrationPrompt({ paletteWords: PALETTE, scene: "  " })).toThrow(/scene/);
  });
});

describe("chemins du bucket", () => {
  it("nomme l'image d'une story par son id en WebP et le dossier de secours par thème", () => {
    expect(illustrationPath("abc-123")).toBe("abc-123.webp");
    expect(fallbackPrefix("planete")).toBe("fallback/planete/");
  });
});

describe("pickFallbackImage", () => {
  const files = ["fallback/planete/a.webp", "fallback/planete/b.webp", "fallback/planete/c.webp"];

  it("est déterministe pour une même story et répartit entre les images", () => {
    const first = pickFallbackImage("planete", files, "story-1");
    expect(first).toBe(pickFallbackImage("planete", files, "story-1"));
    expect(files).toContain(first);
    const picks = new Set(Array.from({ length: 50 }, (_, i) => pickFallbackImage("planete", files, `story-${i}`)));
    expect(picks.size).toBe(3);
  });

  it("accepte des noms nus, ignore les autres thèmes, les dossiers, les fichiers cachés et les sous-dossiers", () => {
    expect(pickFallbackImage("planete", ["a.webp"], "s")).toBe("fallback/planete/a.webp");
    expect(pickFallbackImage("planete", ["fallback/science/a.webp"], "s")).toBeNull();
    expect(pickFallbackImage("planete", ["fallback/planete/", ".emptyFolderPlaceholder", "fallback/planete/old/x.webp"], "s")).toBeNull();
  });

  it("renvoie null sans image de secours", () => {
    expect(pickFallbackImage("planete", [], "s")).toBeNull();
  });
});

describe("planImageAlerts", () => {
  const TODAY = "2026-11-10";
  const story = (id: string, publishDate: string, hasImage = false): ImageStatusStory => ({ id, themeId: "planete", publishDate, hasImage });

  it("ouvre une alerte pour une story sans image à J-2 ou moins, aujourd'hui inclus, pas au-delà", () => {
    const plan = planImageAlerts(
      [story("j0", "2026-11-10"), story("j2", "2026-11-12"), story("j3", "2026-11-13"), story("ok", "2026-11-11", true)],
      [], TODAY, { image_alert_days: 2 },
    );
    expect(plan.raise.map((r) => r.story.id)).toEqual(["j0", "j2"]);
    expect(plan.raise[0]?.fingerprint).toBe(imageAlertFingerprint("j0"));
    expect(plan.resolve).toEqual([]);
  });

  it("suit le seuil de la config et ignore les dates passées", () => {
    const stories = [story("past", "2026-11-09"), story("j3", "2026-11-13")];
    expect(planImageAlerts(stories, [], TODAY, { image_alert_days: 2 }).raise).toEqual([]);
    expect(planImageAlerts(stories, [], TODAY, { image_alert_days: 3 }).raise.map((r) => r.story.id)).toEqual(["j3"]);
  });

  it("résout les alertes ouvertes dont la story a reçu une image ou n'est plus programmée, et laisse les autres", () => {
    const open = ["image:done", "image:gone", "image:still", "stock:planete"];
    const plan = planImageAlerts([story("done", "2026-11-11", true), story("still", "2026-11-11")], open, TODAY, { image_alert_days: 2 });
    expect(plan.resolve).toEqual(["image:done", "image:gone"]);
    expect(plan.raise.map((r) => r.fingerprint)).toEqual(["image:still"]);
  });
});

describe("fitImage", () => {
  it("recadre au centre en 3:4 une image trop large, sans agrandir", () => {
    const fit = fitImage({ width: 1000, height: 1000 });
    expect(fit.crop).toEqual({ x: 125, y: 0, width: 750, height: 1000 });
    expect(fit.output).toEqual({ width: 750, height: 1000 });
  });

  it("recadre en hauteur une image trop haute", () => {
    const fit = fitImage({ width: 900, height: 2000 });
    expect(fit.crop).toEqual({ x: 0, y: 400, width: 900, height: 1200 });
    expect(fit.output).toEqual({ width: 900, height: 1200 });
  });

  it("réduit une grande image 3:4 sous 1290×1720 et laisse une image exacte intacte", () => {
    // Les sorties Gemini 3:4 (3584×4800, 896×1200) sont à moins de 1 % du format : gardées entières.
    expect(fitImage({ width: 3584, height: 4800 }).output).toEqual({ width: 1284, height: 1720 });
    expect(fitImage({ width: 1500, height: 2000 }).output).toEqual({ width: 1290, height: 1720 });
    const exact = fitImage({ width: 896, height: 1200 });
    expect(exact.crop).toEqual({ x: 0, y: 0, width: 896, height: 1200 });
    expect(exact.output).toEqual({ width: 896, height: 1200 });
  });

  it("suit le format et le maximum passés en paramètres et refuse une image vide", () => {
    const fit = fitImage({ width: 2000, height: 1000 }, { width: 1, height: 1 }, { width: 500, height: 500 });
    expect(fit.crop).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
    expect(fit.output).toEqual({ width: 500, height: 500 });
    expect(() => fitImage({ width: 0, height: 10 })).toThrow(/vide/);
  });
});
