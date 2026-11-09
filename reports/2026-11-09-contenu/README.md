# Contenu : pourquoi pas de « waouh », et quoi changer (analyse du 2026-11-09, rien de déployé)

## 1. Analyse des nouvelles des 14 derniers jours

Seules 17 nouvelles ont été validées (toutes le 4 novembre). Pour voir la tendance du tri, l'analyse porte aussi sur
les 97 nouvelles rédigées et vérifiées par le pipeline sur la période. Classement fait à la main d'après titre, source
et tri enregistré (détail par nouvelle : `classement.json`).

| Type | Rédigées (97) | Validées (17) |
|---|---|---|
| Étude de labo, sur l'animal ou prototype | 36 % | 29 % |
| Découverte fondamentale (astro, physique, paléo) | 21 % | 24 % |
| Étude humaine | 14 % | 12 % |
| Conservation, espèces | 10 % | 6 % |
| Histoire humaine, solidarité, culture | 8 % | 18 % |
| Record, innovation déployée | 5 % | 0 % |
| Politique publique | 5 % | 12 % |
| **Déjà arrivé / promesse** | **48 % / 52 %** | **59 % / 41 %** |

Sources des 97 : Science Daily 22 %, Medical Xpress 18 %, TechXplore 11 %, MIT News 10 % (61 % à elles quatre),
Mongabay 8 %, Nature 5 %, Phys.org Biology 5 %, puis 13 sources à 1 à 3 % chacune. Thèmes : science 47, santé 17,
planète 12, inventions 8, animaux 5, solidarité 4, culture 4.

Causes : les fils scientifiques publient beaucoup et passent le tri (score = positivité + importance + confiance ;
une étude de labo est « importante » et sa source « fiable ») ; rien ne mesure le concret ni le fait accompli.
L'écriture suit des consignes de prudence (titre court de 60 caractères, nuance) qui produisent des titres
allusifs (« Deux astéroïdes, enfin distincts. », « Des bactéries calculent plusieurs pistes à la fois. »).

## 2. Score d'impact (proposé)

Même appel Haiku que le tri actuel (même budget : le prompt système grossit de ~250 tokens, mis en cache), sept
champs de plus. Prompt : `prompts.ts` (`buildImpactTriagePrompt`).

- Critères notés de 0 à 1 : concret (0,25), déjà arrivé (0,25), proche de la vie des gens (0,20), ampleur (0,15),
  effet avant/après (0,15).
- Pénalités multiplicatives : étude in vitro ou animale hors thème Animaux × 0,4 ; « piste », premiers résultats,
  prototype × 0,5 ; trop technique pour un ado de 15 ans × 0,6.
- Score final = 0,5 × impact + 0,5 × score actuel ; une nouvelle à impact < 0,5 est écartée même si le tri actuel
  la garde. Tous ces nombres iraient dans `pipeline_config`.

## 3. Nouvelle consigne de rédaction (proposée)

Texte complet : `prompts.ts` (`newDraftRules`). Règles de vérification inchangées (aucun fait hors article, jamais
plus fort ni plus précis que la source). Changements :

- Titre : ce qui s'est passé, sujet concret, mots simples, sans jargon, 12 mots max ; alternance droit/italique
  gardée, le sens prime. Limites proposées : 40 + 40 caractères (au lieu de 32 + 28).
- Résumé en trois temps : problème de départ, ce qui a changé (chiffres rendus parlants sans comparaison
  extérieure), pourquoi c'est une bonne nouvelle pour les gens. 480 caractères (au lieu de 350).
- Nuance : une seule courte phrase, en fin de texte, si elle change le sens ; jamais dans le titre.
- Sans fait réellement arrivé à raconter : verdict « pas une bonne nouvelle ».

À vérifier si on déploie : l'app dimensionne le titre selon sa longueur (paliers), la carte de partage et le widget
limitent les lignes ; des titres de 12 mots passeront plus souvent par la réduction ou la coupe en fin de mot.

## 4. Nouvelles sources (flux testés le 2026-11-09)

| Source | Flux | Note |
|---|---|---|
| The Guardian — The Upside | https://www.theguardian.com/world/series/the-upside/rss | journalisme de solutions, reportage original |
| YES! Magazine | https://www.yesmagazine.org/feed | journalisme de solutions (rythme : quelques articles par semaine) |
| Rewilding Europe | https://rewildingeurope.com/feed/ | conservation, résultats sur le terrain |
| BirdLife International | https://www.birdlife.org/feed/ | conservation des oiseaux, programmes nommés |
| BBC — Science & Environment | https://feeds.bbci.co.uk/news/science_and_environment/rss.xml | grand public, à trier |
| Ouest-France, Nice-Matin, ici (France Bleu), La Croix | flux généraux | presse régionale et solidarité : beaucoup de volume pour peu de bonnes nouvelles ; mieux vaut des requêtes Google News ciblées sur ces titres |
| Fix The News, Positivr, The Optimist Daily | flux OK | agrégateurs : à n'utiliser qu'en suivant le lien vers la source primaire (non géré par le pipeline aujourd'hui) |
| Conservation Optimism, Kaizen | flux OK | publient peu |

Écartés (flux en erreur ou vide) : LPO, OFB, WWF France, Unicef, Euronews Green, Fauna & Flora, Le Télégramme.
Rééquilibrage suggéré : baisser la part des fils scientifiques (plafond par source déjà prévu dans `schedule`,
à appliquer aussi au tri) plutôt que les retirer.

## 5. Test à blanc

`run.ts` réécrit les 20 dernières nouvelles (17 validées + les 3 dernières vérifiées) avec la nouvelle consigne,
les fait relire par le vérificateur actuel, puis re-trie les 374 articles triés ces 2 derniers jours avec le score
d'impact. Aucune écriture en base. Coût estimé ~0,25 $ (Haiku 5.5 : 0,10 $ / 0,50 $ par million de tokens).
`report.ts` produit le tableau avant/après (`rapport.md`).

Fait le 2026-11-09 (Haiku 5.5, coût réel 0,24 $). Tableau complet avant/après : `rapport.md`.

Réécriture (boucle complète du pipeline : rédaction, vérification, révision, seconde vérification, décision
`decideVerify`) : 13 vérifiées, 5 rejetées par le vérificateur, 1 refusée par le rédacteur (article sans résultat),
1 erreur de format. Les 20 « avant » étaient toutes vérifiées. Titres de 7 à 13 mots, nettement plus lisibles ;
résumés de 302 à 547 caractères (7 au-dessus de 480).

Causes des rejets, à traiter avant tout déploiement :
- le vérificateur garde sa règle « titre vague » qui exige le nom propre (« Ryugu ») : contradictoire avec
  « pas de jargon » ; à réécrire (sujet concret et compréhensible, nom propre non exigé) ;
- la tentation de « rendre concret » produit des généralisations que l'article ne dit pas (« traces de sang »,
  « une juge », « l'université de Washington ») : ajouter un exemple explicite d'erreur à ne pas faire ;
- longueur : appliquer la contrainte de 480 caractères (le pipeline réessaie déjà en plus court).

Re-tri (365 articles des 2 derniers jours ; 9 erreurs de format) : le tri actuel en garde 14 ; le filtre d'impact
en écarte 2, les plus abstraits (un modèle d'IA qui simule des matériaux, deux galaxies satellites). Mais 13
articles à fort impact (≥ 0,6) sont rejetés DÈS AUJOURD'HUI par le seuil de 0,65, dont de vraies petites joies :
un doberman qui détecte le cœur emballé d'un bébé (score actuel 0,63), une femme qui retrouve 30 ans après le
garçon qui lui avait donné son manteau (0,63), un baleineau de baleine franche découvert (0,61), un chimpanzé
nourri par drone pendant une inondation (0,59). Ils perdent sur « importance » et sur la confiance de la source.
Proposition révisée : garder si la nouvelle est éligible (bonne nouvelle, fait, non publicitaire, thème) et si
0,5 × impact + 0,5 × score actuel ≥ 0,65, avec impact ≥ 0,5. Le score d'impact sert alors autant à repêcher ces
nouvelles qu'à écarter les sujets abstraits.

## 6. Second test à blanc (consigne corrigée, prompts de production)

18 vérifiées sur 20 (13 au premier test), 1 rejetée (fact_error), 1 refusée (article sans texte). Correctifs :
critère `vague_title` sans nom propre exigé, exemples réels du piège des généralisations, longueurs 40/40/480
appliquées avec relances, et `maxTokens` de draft/revise porté à 8 192 (la nouvelle consigne faisait réfléchir
Haiku au-delà de 4 096 jetons : 5 rédactions coupées net au premier essai). Coût du second test : 0,15 $.
