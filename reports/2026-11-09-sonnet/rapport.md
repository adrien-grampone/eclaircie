# Test Sonnet 5.5 en rédaction et révision (2026-11-09, rien de déployé)

Tri et vérification restent sur Haiku 5.5. Quatre nouvelles (les 3 de la réserve et celle du 10 novembre) sont
rédigées de zéro par chaque modèle, avec les prompts, options et règles de décision de production. Le cycle complet
est rejoué : rédaction, vérification, révision si besoin, puis seconde vérification. Script : `run.ts` ; textes et
tokens : `resultats.json`.

## Passage

| Nouvelle | Haiku | Sonnet |
|---|---|---|
| Lancaster, boulevard arboré | validée | rejetée (fact_error : « au milieu du désert de Mojave », que l'article ne dit pas du boulevard) |
| Thérapie génique, foie (10 nov.) | validée | validée |
| Analyses de sang, trait génétique | validée | rejetée (exagération « d'où » maintenue après révision) |
| Gravures de Picasso | validée | validée |

## Coût mesuré, par nouvelle

| Étape | Haiku 5.5 | Sonnet 5.5 |
|---|---|---|
| Rédaction (relances de longueur comprises) | 0,0035 $ | 0,023 $ |
| Révision (par appel) | 0,0016 $ | 0,021 $ |

Sonnet produit environ 4 fois moins de tokens de sortie (moins de raisonnement), mais son prix au token est 20 fois
plus élevé.

## Surcoût mensuel en mode perso

Plafonds : 4 rédactions et 3 révisions par jour, soit au plus 120 rédactions et 90 révisions par mois.
- Haiku : 120 × 0,0035 + 90 × 0,0016 ≈ 0,56 $ par mois.
- Sonnet : 120 × 0,023 + 90 × 0,021 ≈ 4,65 $ par mois.
- Surcoût maximal : environ 4 $ par mois.

Estimation tirée de 4 nouvelles et d'un seul passage : c'est un ordre de grandeur.
