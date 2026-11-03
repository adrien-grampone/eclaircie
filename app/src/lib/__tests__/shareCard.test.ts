import { SHARE_CARD, shareCardContent, shareFileName, shareTitleSize } from "../shareCard.ts";

const STORY = { title_main: "La couche d'ozone", title_accent: "se répare.", source_name: "ONU / OMM", source_date: "2023-01-09", publish_date: "2026-11-03" };

describe("shareCardContent", () => {
  it("assemble la carte : nom de l'app, accroche, thème, titre en deux parties, source datée, slogan", () => {
    const card = shareCardContent(STORY, "Planète");
    expect(card).toMatchObject({ appName: "éclaircie", kicker: "BONNE NOUVELLE DU JOUR", themeLabel: "Planète", titleMain: "La couche d'ozone", titleAccent: "se répare.", source: "Source — ONU / OMM, janvier 2023", tagline: "Une bonne nouvelle par jour" });
  });

  it("omet la date de source quand elle manque", () => {
    expect(shareCardContent({ ...STORY, source_date: null }, "Planète").source).toBe("Source — ONU / OMM");
  });
});

describe("shareTitleSize", () => {
  it("décroît par paliers avec la longueur totale", () => {
    expect(shareTitleSize("L'ozone", "revient.")).toBe(46);
    expect(shareTitleSize("La couche d'ozone", "se répare.")).toBe(40);
    expect(shareTitleSize("Les cinq « lettres » de la vie", "ont été trouvées")).toBe(34);
  });
});

describe("format", () => {
  it("fixe le format story et nomme le fichier par date", () => {
    expect(SHARE_CARD).toEqual({ width: 390, height: 693, scale: 3 });
    expect(shareFileName(STORY)).toBe("eclaircie-2026-11-03.png");
  });
});
