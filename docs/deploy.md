# Déploiement et exploitation du pipeline

Projet hébergé : `hrnvtcqoywxggnkevxxc` (Eclaircie, eu-north-1). Tout le pipeline vit dans Supabase :
Postgres (migrations), Edge Functions (Deno), pg_cron + pg_net pour le déclenchement, Vault pour les secrets SQL.

## Mise en production

```sh
supabase link --project-ref hrnvtcqoywxggnkevxxc        # une fois
supabase db push                                         # migrations manquantes
supabase functions deploy                                # toutes les fonctions (ou une : deploy dedup)
supabase secrets set ANTHROPIC_API_KEY=…                 # seule clé utilisée en prod (jamais commitée)
```

Les Edge Functions n'utilisent que `ANTHROPIC_API_KEY` : ne pas pousser tout `supabase/functions/.env`
en secrets (il peut contenir des clés locales sans usage en prod, comme `GEMINI_API_KEY`).

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
| pipeline-schedule | `20 * * * *` | programme `publish_date` sur 14 jours (jours libres seulement, dès validation), alerte de stock |
| pipeline-health | `30 * * * *` | ouvre/résout les alertes techniques |

Chaque fonction traite `batch_size` éléments et s'arrête d'elle-même au plafond journalier
(compté dans `pipeline_runs`). Tous les seuils sont dans `pipeline_config`, aucun dans le code.

Modèles : tout sur `claude-haiku-5-5` (décision budget du 2026-11-03 ; la spec §4 prévoyait Sonnet
pour draft/verify). Changer un modèle = `supabase/functions/_shared/claude.ts`, puis redéployer.

Statut d'entrée de schedule : `pipeline_config.schedule_input_status` vaut `verified` : schedule
programme les stories vérifiées, puis le texte est validé et l'image déposée dans le back-office
(décision du 2026-11-03 : pas d'Edge Function illustrate, illustrations faites à la main).

## Illustrations à la main et back-office

Les illustrations sont générées à la main dans l'app Gemini (mode Pro, 3:4) à partir du prompt
affiché par le back-office (prompt de style fixe de `_shared/pipeline/illustration.ts` + palette en
mots du thème, `themes.palette_words` + `scene` du brouillon). Une story programmée sans `image_path`
est « en attente d'image » ; à J-`image_alert_days` (config, 2) sans image, schedule ouvre une alerte
`image_missing`, résolue au dépôt. Si une nouvelle est publiée sans image, l'app affiche une image de
secours du thème : `fallback/<theme_id>/*.webp` dans le bucket public `illustrations`
(`pickFallbackImage`, choix déterministe par story).

Le back-office est l'application Next.js du dossier `admin/` (une page par onglet : Images à faire,
À valider, Stock, Signalements, Santé). Il tourne **en local, branché sur la prod** (pas de Vercel
pour l'instant) :

```sh
cd admin && npm install
cp .env.example .env.local     # puis remplir les valeurs (fichier ignoré par git)
# Pour viser la pile locale (supabase start) : cp .env.local.example .env.local
```

Sur la prod, le lien magique doit pouvoir revenir sur `http://localhost:3000/auth/callback` : cette URL doit figurer dans
Authentication → URL Configuration → Redirect URLs du projet hébergé (`supabase config diff` montre la liste distante).

```sh
npm run dev                    # http://localhost:3000
```

- `admin/.env.local` : `SUPABASE_URL` (https://hrnvtcqoywxggnkevxxc.supabase.co), `SUPABASE_ANON_KEY`
  (clé anon ou publishable, sert uniquement à la session de connexion), `SUPABASE_SERVICE_ROLE_KEY`
  (toutes les lectures et écritures, côté serveur seulement, jamais `NEXT_PUBLIC_`), `ADMIN_EMAILS`
  (emails autorisés, séparés par des virgules). Clés : dashboard → Project Settings → API Keys.
- Auth Supabase : connexion par lien magique (OTP email). Dans Authentication → URL Configuration →
  Redirect URLs, ajouter `http://localhost:3000/auth/callback`. Tout compte hors `ADMIN_EMAILS` est
  refusé par `admin/proxy.ts`, même connecté.
- Dépôt d'image : recadrage 3:4, réduction sous 1290×1720 (largeur d'un écran iPhone à 3×, rien de plus à décoder) et conversion WebP se font dans le
  navigateur (canvas, `fitImage`), puis la Server Action écrit `<story_id>.webp` dans le bucket avec
  la clé service_role et remplit `image_path`. Le navigateur n'écrit jamais dans le bucket : la seule
  policy de `storage.objects` est la lecture publique, toute écriture avec la clé anon est refusée.
  Taille d'envoi : 8 Mo (`next.config.ts`).
- Contre le stack local : mêmes variables avec les valeurs de `supabase status`, et Mailpit
  (`http://127.0.0.1:54324`) reçoit les liens de connexion.

Option pour plus tard, Vercel : Root Directory `admin`, activer « Include source files outside of the
Root Directory » (le module pur d'illustration est importé depuis `supabase/functions/_shared/pipeline/`),
mêmes variables, et ajouter `https://<domaine>/auth/callback` aux Redirect URLs.

## Surveillance

- `pipeline_runs` : une ligne par invocation, même en échec (`error` renseigné).
- `pipeline_alerts` : une alerte ouverte par empreinte, résolue automatiquement quand la cause
  disparaît. Types : `cron_failed`, `function_error` (HTTP non 200 vu par pg_net), `step_error`
  (dernier run en erreur), `step_stale` (étape muette depuis 3 h, collect 4 h), `stock_low`
  (stock programmé d'un thème sous `stock_alert_days`), `image_missing` (story programmée à
  J-`image_alert_days` sans illustration).
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

## Build iPhone (test de deux semaines)

Profil EAS `preview` (`app/eas.json`) : distribution interne ad hoc, installable directement sur
un iPhone enregistré, sans passer par TestFlight ni App Store Connect. La notification
quotidienne est locale (expo-notifications, déclencheur DAILY) : elle marche dans ce build sans
clé APNs. Les variables `EXPO_PUBLIC_DEMO_*` sont ignorées hors `__DEV__` (`app/src/lib/demo.ts`).

`expo.name` est `Eclaircie` (ASCII : le nom de la cible Xcode en dérive, et un accent cassait le build) ;
le nom affiché sous l'icône est `ios.infoPlist.CFBundleDisplayName` = « Éclaircie ». L'archive envoyée à
EAS est réduite par `.easignore` à la racine du dépôt : `app/` et le module pur du pipeline (`supabase/functions/_shared/pipeline/`, importé via `@pipeline`), sans tests ni captures.

`app/.env` est ignoré par git, donc jamais envoyé à EAS : l'URL et la clé anon Supabase se
poussent une fois dans l'environnement EAS `preview`.

Commandes, depuis `app/`, une seule fois :

```
eas login                                   # compte Expo (déjà connecté : eas whoami)
eas init                                    # crée le projet EAS, écrit extra.eas.projectId dans app.json
eas env:push --environment preview --path .env
eas device:create                           # enregistre l'iPhone : ouvrir le lien sur l'iPhone, installer le profil
```

Puis à chaque build :

```
eas build --platform ios --profile preview
```

Au premier build, EAS demande l'identifiant Apple Developer, crée le certificat de distribution
et le profil de provisionnement ad hoc (répondre oui aux propositions par défaut). À la fin, ouvrir
le lien du build sur l'iPhone (ou le QR code) : Réglages → l'installation se fait comme une app.
Pour une nouvelle version, incrémenter `ios.buildNumber` dans `app/app.json` avant le build.

Si un iPhone est ajouté plus tard : `eas device:create` puis `eas build` (le profil est régénéré).

## Widget iOS (écran d'accueil et écran verrouillé)

Cible SwiftUI `app/targets/widget/` générée par `@bacons/apple-targets` au prebuild (`app.eclaircie.widget`,
App Group `group.app.eclaircie`, iOS 17). Trois formats : petit, moyen, rectangulaire verrouillé. Tap → `eclaircie://story/<id>`.

- Données : à chaque ouverture, l'app écrit dans l'App Group (module local `app/modules/widget-bridge`, clé `eclaircie.widget`) la
  nouvelle du jour, le profil et l'illustration réduite à 600 px (même module), puis
  `reloadWidget`. Le matin (7 h 05 Europe/Paris), le widget appelle seul la RPC publique `daily_stories` avec la
  clé anon, applique la même rotation que l'app, télécharge et réduit l'illustration. Réseau en échec : dernière
  nouvelle connue. Aucune nouvelle : « Ta bonne nouvelle arrive demain matin » sur une illustration de secours.
- RPC : `supabase/migrations/20261105100000_daily_stories_rpc.sql` ; test `supabase/tests/daily_stories_check.sql`
  (stack locale, transaction annulée) : `docker exec -i supabase_db_eclaircie psql -U postgres -d postgres < supabase/tests/daily_stories_check.sql`.
- Captures sans Xcode : `design/widget/snapshot.sh` compile les vues avec ImageRenderer sur macOS
  (3 thèmes × 3 formats × clair/sombre) dans `design/widget/out/`. Le mode teinté d'iOS 18 ne se simule pas.
- Vérification native : `cd app && npx expo prebuild --platform ios --clean`, build Xcode ou
  `xcodebuild -workspace ios/Eclaircie.xcworkspace -scheme Eclaircie -sdk iphonesimulator ...`, puis `rm -rf ios && git checkout package.json`.
  Expo Go n'affiche pas les widgets.
- EAS : au premier build après l'ajout, répondre oui à l'enregistrement du bundle identifier `app.eclaircie.widget`,
  de son profil de provisionnement et de l'App Group sur les deux identifiants. `eas.json` ne change pas.
