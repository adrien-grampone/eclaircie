# Mode perso du pipeline (proposition, rien de déployé)

Réversible par configuration : `run_mode` passe de `continuous` (aujourd'hui) à `daily_window` ; un déclencheur
réapplique les horaires cron et les plafonds du mode. SQL complet : `migration-proposee.sql`.

| | Aujourd'hui (mesuré sur 7 jours) | Mode perso |
|---|---|---|
| Passages | collecte toutes les 3 h, étapes toutes les 10 à 30 min | une fenêtre par jour, 04:00–05:55 à Paris (05:00–06:55 en été) |
| Collecte | toutes les sources | sources des thèmes suivis + sources généralistes |
| Tri | 400 articles/jour | 50 articles/jour |
| Rédaction + révisions | 34 + 16 par jour (plafond 40) | plafond 6 (≈ 4 rédactions + 2 révisions) |
| Vérification | inchangée (2 passes max) | inchangée |
| Alertes | cron, HTTP, étape en erreur, étape muette > 3 h | idem, étape muette > 26 h, + « rien de validé pour demain » après 18 h |

Code à modifier (après accord) : collect (filtre des sources par thèmes suivis), règles éditoriales du tri (rejet
`theme_not_followed`), schedule (créneaux des seuls thèmes suivis), pipeline_health_check (seuils et nouvelle alerte),
tests correspondants.

## Coût estimé (Haiku 5.5, tailles mesurées : prompts, article moyen de 7 862 caractères, volumes réels sur 7 jours)

| | Par jour | Par mois |
|---|---|---|
| Aujourd'hui | 0,155 $ | 4,65 $ (tri 2,43, rédaction 1,01, vérification 0,61, révision 0,51, dédoublonnage 0,10) |
| Mode perso | 0,022 $ | 0,66 $ (tri 0,30, rédaction 0,12, vérification 0,15, révision 0,06, dédoublonnage 0,03) |
| Mode perso + score d'impact | | + 0,08 $ |

Estimation (≈ 3,5 caractères par token, raisonnement de la rédaction et de la vérification compté à ~800 tokens) ;
à confronter à la facture Anthropic du mois. Supabase reste dans l'offre gratuite.

## Déploiement retenu (2026-11-09, après validation)

La proposition `migration-proposee.sql` est remplacée par `supabase/migrations/20261109100000_mode_perso.sql`
(testée sur la base locale, bascule continu ↔ perso vérifiée dans les deux sens). Différences avec la proposition :
thèmes suivis fixés en config (Planète, Animaux, Santé, Solidarité, Culture), exception pour les percées déjà
utiles à des gens (rangées en Santé par défaut), validation automatique des nouvelles vérifiées, programmation
d'UNE nouvelle par jour avec une réserve (alerte sous 3) au lieu d'une alerte « rien de prêt la veille »,
révision budgétée à part (4 rédactions + 3 révisions par jour), collecte à 4 h UTC.

### Ajustements demandés avant la migration

- Sources : chacune est rattachée à tous les thèmes suivis qu'elle peut alimenter (le filtre d'impact écarte le
  labo). Seule 01net n'en alimente aucun (0 article et 0 pépite sur les 365 du test).
- Réserve de départ : les 24 anciennes nouvelles des thèmes suivis passent en `to_rework` (réécriture selon la
  consigne actuelle, puis double vérification) ; seules celles qui passent sont validées. Coût estimé ≈ 0,18 $
  (0,25 $ au plus avec les relances), budget `max_rework_per_day` = 50, traité dès le premier passage du matin.
- Widget : les variantes du titre n'ont plus de lineLimit (sauf la dernière) ; la coupe tombe toujours après un
  mot entier. Rendus actuels du moyen format inchangés au pixel près.
