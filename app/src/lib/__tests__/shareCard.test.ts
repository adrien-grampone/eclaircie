import { SHARE_CARD, SHARE_MESSAGE, shareCardContent, shareFileName, shareMessage, shareTitleSize } from "../shareCard.ts";

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
  it("fixe le format story et nomme le fichier par jour et mois lisibles, sans accent", () => {
    expect(SHARE_CARD).toEqual({ width: 390, height: 693, scale: 3 });
    expect(shareFileName(STORY)).toBe("eclaircie-3-novembre.png");
    expect(shareFileName({ publish_date: "2026-12-25" })).toBe("eclaircie-25-decembre.png");
    expect(shareFileName({ publish_date: "2026-08-01" })).toBe("eclaircie-1-aout.png");
  });

  it("accompagne le partage d'un texte, avec le lien App Store quand il existe", () => {
    expect(shareMessage()).toBe(SHARE_MESSAGE);
    expect(shareMessage("https://apps.apple.com/app/id1")).toBe(`${SHARE_MESSAGE} https://apps.apple.com/app/id1`);
  });
});
