# Déploiement et exploitation du pipeline

Projet hébergé : `hrnvtcqoywxggnkevxxc` (Eclaircie, eu-north-1). Tout le pipeline vit dans Supabase :
Postgres (migrations), Edge Functions (Deno), pg_cron + pg_net pour le déclenchement, Vault pour les secrets SQL.

## Mise en production

```sh
supabase link --project-ref hrnvtcqoywxggnkevxxc        # une fois
supabase db push                                         # migrations manquantes
supabase functions deploy                                # toutes les fonctions (ou une : deploy dedup)
supabase secrets set --env-file supabase/functions/.env  # ANTHROPIC_API_KEY (jamais commitée)
```

Puis, une seule fois, dans l'éditeur SQL du dashboard, l'URL que pg_cron appelle :

```sql
select vault.create_secret('https://hrnvtcqoywxggnkevxxc.supabase.co/functions/v1', 'pipeline_functions_url');
-- optionnel, si les fonctions passent en verify_jwt = true :
select vault.create_secret('<clé anon ou service>', 'pipeline_functions_key');
```

`config.toml` déclare chaque fonction avec `verify_jwt = false` et l'import map `functions/deno.json`.

## Étapes et fréquences (pg_cron, UTC)

| Job | Horaire | Rôle |
|---|---|---|
| pipeline-collect | `5 */3 * * *` | lit les flux RSS, insère `raw_articles` |
| pipeline-triage | `*/10 * * * *` | Haiku classe un lot, plafond `max_triage_per_day` |
| pipeline-extract | `3-59/10 * * * *` | texte complet (Readability) |
| pipeline-draft | `*/15 * * * *` | Haiku rédige, plafond `max_draft_per_day` |
| pipeline-verify | `5-59/15 * * * *` | contrôle des evidences en code + relecture Haiku |
| pipeline-revise | `10-59/15 * * * *` | corrige les problèmes relevés, puis re-verify |
| pipeline-dedup | `*/30 * * * *` | Haiku compare aux stories du thème sur 30 jours |
| pipeline-schedule | `0 4 * * *` | programme `publish_date` sur 14 jours, alerte de stock |
| pipeline-health | `30 * * * *` | ouvre/résout les alertes techniques |

Chaque fonction traite `batch_size` éléments et s'arrête d'elle-même au plafond journalier
(compté dans `pipeline_runs`). Tous les seuils sont dans `pipeline_config`, aucun dans le code.

Modèles : tout sur `claude-haiku-5-5` (décision budget du 2026-11-03 ; la spec §4 prévoyait Sonnet
pour draft/verify). Changer un modèle = `supabase/functions/_shared/claude.ts`, puis redéployer.

Statut d'entrée de schedule : `pipeline_config.schedule_input_status` vaut `verified` tant
qu'illustrate et review n'existent pas ; passer à `approved` quand ils seront en place.

## Surveillance

- `pipeline_runs` : une ligne par invocation, même en échec (`error` renseigné).
- `pipeline_alerts` : une alerte ouverte par empreinte, résolue automatiquement quand la cause
  disparaît. Types : `cron_failed`, `function_error` (HTTP non 200 vu par pg_net), `step_error`
  (dernier run en erreur), `step_stale` (étape muette depuis 3 h, collect 4 h), `stock_low`
  (stock programmé d'un thème sous `stock_alert_days`).
- Rapport du matin, une seule requête :

```sh
supabase db query --linked --file supabase/tests/morning.sql
```

  ou le même fichier collé dans l'éditeur SQL. Autres diagnostics : `cron.job_run_details`,
  `net._http_response` (6 h de rétention), et les logs des fonctions dans le dashboard (Edge Functions → Logs).

## Stack locale

```sh
supabase start
supabase migration up                       # ou db reset
docker exec -i supabase_db_eclaircie psql -U postgres -d postgres < supabase/tests/local_cron_setup.sql
supabase functions serve --env-file supabase/functions/.env --no-verify-jwt
curl -X POST http://127.0.0.1:54321/functions/v1/triage     # une étape à la main
docker exec -i supabase_db_eclaircie psql -U postgres -d postgres < supabase/tests/morning.sql
```

En local les jobs pg_cron sont désactivés par `local_cron_setup.sql` : chaque tick dépenserait du
budget API. Relancer `supabase functions serve` après toute modification du code (pas de rechargement
à chaud fiable). Tests de la logique pure : `npx vitest run`, typage : `npx tsc --noEmit`.

## Budget API

Haiku 5.5 : 0,10 $ / 0,50 $ par million de tokens (entrée / sortie). Garde-fous : `max_triage_per_day`
(400) et `max_draft_per_day` (40) ; draft entraîne verify, parfois revise + verify, et dedup.
Les replays locaux coûtent autant que la prod : les limiter à quelques stories.
