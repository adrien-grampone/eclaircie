import type { Article } from "../../types.ts";

/**
 * Articles de fixture, écrits pour les tests (ce ne sont pas des articles réels),
 * avec la typographie française courante : guillemets « », apostrophes ’,
 * espaces insécables avant « : » et « % ».
 */

export const OZONE: Article = {
  title: "La couche d’ozone est en voie de guérison, confirme l’ONU",
  sourceName: "Programme des Nations unies pour l’environnement",
  url: "https://example.org/onu/ozone-2026",
  publishedAt: "2026-10-28T09:00:00+01:00",
  fullText: [
    "Le rapport quadriennal publié ce lundi par le Programme des Nations unies pour l’environnement (PNUE) et l’Organisation météorologique mondiale confirme une tendance qui se dessine depuis une décennie : la couche d’ozone se reconstitue.",
    "« Si les politiques actuelles sont maintenues, la couche d’ozone devrait retrouver son niveau de 1980 vers 2066 au-dessus de l’Antarctique », écrivent les auteurs. Pour l’Arctique, l’échéance est fixée à 2045, et pour le reste du monde à 2040.",
    "Le Protocole de Montréal, signé en 1987, a permis d’éliminer près de 99 % des substances appauvrissant la couche d’ozone, dont les chlorofluorocarbures utilisés autrefois dans les réfrigérateurs et les aérosols.",
    "Les scientifiques soulignent que cet accord a aussi un effet sur le climat : l’amendement de Kigali, entré en vigueur en 2019, pourrait éviter jusqu’à 0,5 °C de réchauffement d’ici à 2100 en limitant les hydrofluorocarbures.",
    "« C’est la preuve que lorsque les pays agissent ensemble sur la base de la science, ils obtiennent des résultats », a déclaré la secrétaire générale de l’OMM lors de la présentation du rapport à Nairobi.",
    "Le rapport appelle toutefois à la vigilance : certaines émissions non déclarées de CFC-11, détectées entre 2012 et 2018 en Asie de l’Est, ont ralenti la reprise d’environ un an avant d’être stoppées.",
  ].join("\n\n"),
};

export const MANGROVES: Article = {
  title: "Au Sénégal, 80 millions de mangroves replantées en quinze ans",
  sourceName: "Le Quotidien Vert",
  url: "https://example.org/quotidien-vert/mangroves-senegal",
  publishedAt: "2026-10-30T06:30:00+01:00",
  fullText: [
    "Dans le delta du Saloum, les palétuviers ont repris leurs droits. Depuis 2009, les habitants de 350 villages ont replanté près de 80 millions de mangroves sur 12 000 hectares, selon le bilan publié jeudi par l’association Océanium et ses partenaires.",
    "Les mangroves protègent les côtes de l’érosion, abritent les juvéniles de poissons et stockent jusqu’à quatre fois plus de carbone qu’une forêt tropicale de même surface.",
    "« Les prises de poissons ont augmenté de 20 % dans les zones replantées », indique le rapport, qui s’appuie sur les relevés des coopératives de pêche locales entre 2015 et 2025.",
    "Le programme a été financé par un mécanisme de crédits carbone certifiés, qui a permis de rémunérer les villages participants à hauteur de 1,2 million d’euros sur la période.",
    "Les chercheurs de l’université Cheikh Anta Diop qui ont suivi les parcelles notent un taux de survie des jeunes plants de 68 %, supérieur à la moyenne observée dans d’autres programmes de restauration en Afrique de l’Ouest.",
    "La riziculture, qui avait souffert de la salinisation des sols, repart elle aussi : les rendements ont progressé dans une dizaine de villages où la mangrove restaurée fait de nouveau barrage à l’eau de mer.",
  ].join("\n\n"),
};

export const PAYWALLED: Article = {
  title: "Un vaccin contre le paludisme déployé dans douze pays",
  sourceName: "Dépêche santé",
  url: "https://example.org/depeche/paludisme",
  publishedAt: "2026-10-31T12:00:00+01:00",
  fullText: "Cet article est réservé aux abonnés. Connectez-vous pour lire la suite.",
};

/** Un brouillon valide pour OZONE, tel qu'un modèle pourrait le renvoyer. */
export const OZONE_DRAFT_JSON = JSON.stringify({
  title_main: "La couche d'ozone",
  title_accent: "se répare.",
  summary:
    "Bonne nouvelle venue du ciel : la couche d'ozone se reconstitue. Selon le rapport de l'ONU publié ce lundi, elle devrait retrouver son niveau de 1980 vers 2066 au-dessus de l'Antarctique. Le Protocole de Montréal a éliminé près de 99 % des substances qui l'abîmaient.",
  why_good:
    "C'est la preuve qu'un accord mondial fondé sur la science peut réparer un dommage planétaire.",
  claims: [
    {
      claim: "l'ozone retrouvera son niveau de 1980 vers 2066 au-dessus de l'Antarctique",
      evidence:
        "la couche d'ozone devrait retrouver son niveau de 1980 vers 2066 au-dessus de l'Antarctique",
    },
    {
      claim: "le Protocole de Montréal a éliminé près de 99 % des substances nocives",
      evidence:
        "a permis d'éliminer près de 99 % des substances appauvrissant la couche d'ozone",
    },
  ],
  scene:
    "A wide calm sky at dawn over the Antarctic ice shelf, a thin luminous veil high above, a perfect circular sun rising, soft layered clouds",
});

/** Une réponse de vérification irréprochable pour OZONE_DRAFT_JSON. */
export const OZONE_VERIFY_JSON = JSON.stringify({
  claims: [
    { index: 0, supported: true, note: "" },
    { index: 1, supported: true, note: "" },
  ],
  facts_in_article: true,
  no_exaggeration: true,
  problems: [],
  verdict: "approve",
});
