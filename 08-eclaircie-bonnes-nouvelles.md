# Spec MVP #8 — App « une bonne nouvelle par jour »

> **Nom de code : Éclaircie.** Tu choisis tes thèmes (Planète, Science, Animaux…). Chaque matin, une bonne nouvelle **vraie, vérifiée et sourcée** t'attend, illustrée et résumée en une minute de lecture. Derrière, un pipeline IA collecte, trie, vérifie, résume et illustre l'actualité positive, et la met en stock.

Maquettes de référence : la toile « Éclaircie — maquettes », **rangée V2** (choix des thèmes, arrivée du jour, nouvelle du jour, carte à partager).

---

## 0. Le cadre — le risque n'est pas l'app, c'est le contenu

L'interface est simple. Ce qui peut tuer le projet, c'est le contenu :

1. **Pas assez de bonnes nouvelles solides** sur certains thèmes. Tu te retrouves à publier du remplissage.
2. **Une nouvelle fausse ou déformée** publiée sous le label « vérifié et sourcé ». La promesse produit est détruite.

D'où la règle de construction : **le pipeline d'abord, l'app ensuite.** Tu le fais tourner deux semaines avant d'écrire le moindre écran.

**Test go/no-go (fin de la phase 0) :**

- Au moins **5 thèmes sur 7** produisent ≥ 1 nouvelle validée par jour en moyenne
- Moins de **30 %** des nouvelles vérifiées par l'IA sont rejetées à ta relecture manuelle
- **Zéro** erreur factuelle repérée dans les nouvelles que tu as validées

Si un thème ne tient pas le rythme, il ne sort pas au lancement. Mieux vaut 5 thèmes impeccables que 7 thèmes dont 2 tièdes.

**Ce qui différencie l'app** (le marché « good news » existe déjà) :

- Les thèmes au choix, et **une seule** nouvelle par jour : un rituel, pas un fil à scroller
- La source affichée et vérifiée sur chaque nouvelle
- Le soin visuel : une illustration originale par nouvelle, une direction éditoriale de magazine

---

## 1. Périmètre v1

### Dans le scope

- Pipeline de collecte, tri, vérification, résumé et illustration, avec un stock tampon par thème
- Mini back-office pour relire, valider ou rejeter, et régénérer une illustration
- App iOS (Expo) :
  - onboarding : choix des thèmes, puis heure de notification
  - écran d'arrivée du jour (la carte « Ta bonne nouvelle t'attend »)
  - nouvelle du jour
  - partage en image (format story)
  - archives des jours passés sur tes thèmes
  - nouvelles gardées
  - réglages
- Notification locale quotidienne à l'heure choisie
- Bouton « Signaler une erreur » sur chaque nouvelle

### Hors scope — explicitement

- ❌ Compte avec email ou mot de passe : auth **anonyme** Supabase, invisible pour l'utilisateur
- ❌ Android (le code Expo le permet, mais on ne teste et ne publie que l'iOS en v1)
- ❌ Thème « Près de chez moi » (affiché « bientôt » dans l'onboarding, c'est tout)
- ❌ Widget iOS (phase 2, priorité n° 1)
- ❌ Paiement, abonnement, publicité
- ❌ Commentaires, réactions, social
- ❌ Plusieurs nouvelles par jour
- ❌ Mode sombre (phase 2)

---

## 2. Les règles produit

### Une nouvelle par jour, par utilisateur

Chaque thème a **sa** nouvelle du jour (`stories.publish_date`). Un utilisateur qui suit plusieurs thèmes reçoit **une** nouvelle, choisie par rotation entre ses thèmes :

```
theme_du_jour = themes_choisis_tries[ jours_depuis_inscription % nb_themes ]
```

Les nouvelles des autres thèmes de l'utilisateur ne sont pas perdues : elles apparaissent dans les Archives (« Aussi aujourd'hui dans Science »). C'est du contenu bonus, sans casser le rituel.

### Ce qui compte comme une « bonne nouvelle »

Une nouvelle est éligible si **toutes** ces conditions sont vraies :

- C'est un **fait** daté : une découverte, un résultat mesuré, une décision actée, un projet achevé. Pas une opinion, pas une promesse, pas un « pourrait »
- Elle est **positive sans contrepartie cachée** : pas de « bonne nouvelle pour X » qui est une mauvaise nouvelle pour Y
- La source est **identifiable et sérieuse** : média reconnu, institution, revue scientifique, organisme public
- Elle n'est **pas publicitaire** : pas de lancement de produit, pas de communiqué de marque
- Elle reste vraie dans la durée (voir le stock tampon, §4.7)

### Le droit d'auteur

- On ne republie **jamais** le texte d'un article. Le résumé est rédigé avec nos mots, en 2 à 3 phrases, avec un lien vers la source.
- On ne reprend **jamais** les images des médias. Chaque nouvelle a son illustration générée.

---

## 3. Sources

Table `sources`, éditable sans déploiement. Au démarrage :

| Type | Exemples | Pourquoi |
|------|----------|----------|
| Rubriques RSS de médias généralistes | rubriques Sciences, Planète, Santé de grands quotidiens FR et internationaux | Volume |
| Communiqués d'institutions | ONU, OMS, CNRS, Inserm, ESA, CNES, Muséum, ministères | Solidité maximale |
| Revues et actualité scientifique | flux d'actualité de revues et de médias scientifiques | Science, Santé |
| Médias de journalisme constructif | médias spécialisés « solutions » | Solidarité, Inventions |
| Google News RSS par requête | `https://news.google.com/rss/search?q=<requête>&hl=fr&gl=FR&ceid=FR:fr` | Rattrapage par thème |

Chaque source a un `trust_level` (1 à 3), utilisé dans le score (§4.2). Une source qui génère des rejets répétés passe en `active = false`.

---

## 4. Le cœur technique — le pipeline

Tout vit dans `supabase/functions/` (Edge Functions Deno), déclenché par `pg_cron`. Chaque étape traite **un petit lot** (5 à 10 éléments) par invocation, pour rester sous la limite de durée des Edge Functions. Chaque étape lit un statut et écrit le suivant : si une étape plante, la suivante reprend là où elle s'est arrêtée.

```
collect ──► triage ──► extract ──► draft ──► verify ──► dedup ──► illustrate ──► review ──► schedule
  (RSS)     (Haiku)   (texte)    (Sonnet)  (Sonnet)  (pgvector)   (API image)   (toi)    (règles)
```

La logique métier (scores, règles de sélection, construction des prompts, parsing des réponses) est dans `supabase/functions/_shared/pipeline/`, en **fonctions pures testées**. Les Edge Functions ne font que lire, appeler et écrire.

### 4.1 Collect — toutes les 3 h

Lire les flux actifs, insérer dans `raw_articles` avec `url` unique (`on conflict do nothing`). Ignorer les articles de plus de 7 jours.

### 4.2 Triage — Claude Haiku (`claude-haiku-5-5`)

Entrée : titre + extrait RSS + nom de la source. Sortie JSON stricte :

```json
{
  "is_good_news": true,
  "themes": ["planete"],
  "is_fact": true,
  "is_promotional": false,
  "positivity": 0.9,
  "significance": 0.8,
  "reason": "courte justification"
}
```

Score de tri :

```
score = 0,35 × positivity + 0,35 × significance + 0,30 × (trust_level / 3)
```

On garde si `is_good_news && is_fact && !is_promotional && score ≥ 0,65`. Les seuils sont dans `pipeline_config`, jamais en dur.

### 4.3 Extract — texte complet

Récupérer la page et extraire le texte principal (`@mozilla/readability` + `linkedom`). Si l'article est sous paywall ou fait moins de 800 caractères : `status = 'failed'`, raison `no_fulltext`. **On ne résume jamais à partir d'un simple extrait RSS.**

### 4.4 Draft — Claude Sonnet (`claude-sonnet-5-5`)

Le prompt impose de rédiger **uniquement** à partir du texte fourni. Sortie JSON :

```json
{
  "title_main": "La couche d'ozone",
  "title_accent": "se répare.",
  "summary": "2 à 3 phrases, 350 caractères max, en français, tutoiement",
  "why_good": "1 phrase : pourquoi c'est une bonne nouvelle",
  "claims": [
    { "claim": "l'ozone retrouvera son niveau de 1980 vers 2066 au-dessus de l'Antarctique",
      "evidence": "la phrase exacte de l'article qui le dit" }
  ],
  "scene": "description visuelle de la scène à illustrer, sans texte ni visage en gros plan"
}
```

`title_main` + `title_accent` alimentent directement le titre en deux parties du design (la partie en italique).

### 4.5 Verify — un second appel, séparé

Un **nouvel appel** Sonnet, qui ne voit pas le raisonnement du premier. Il reçoit l'article et le brouillon, et vérifie :

- chaque `claim` est bien soutenu par son `evidence`, et l'`evidence` figure réellement dans l'article (ce contrôle-là se fait **en code**, par recherche de sous-chaîne normalisée, pas par le LLM) ;
- chaque chiffre, date et nom propre du `summary` figure dans l'article ;
- le résumé n'exagère pas : « pourrait » ne devient pas « va », une étude sur la souris ne devient pas « un traitement ».

Le moindre doute fait passer la nouvelle en `status = 'rejected'`, raison `verify_failed`. Il vaut mieux perdre une bonne nouvelle que d'en publier une fausse.

### 4.6 Dedup — `pgvector`

Embedding du `title_main + summary`, comparé aux stories des 90 derniers jours du même thème. Au-delà de 0,88 de similarité cosinus, c'est le même événement : on garde celle dont la source a le meilleur `trust_level`.

### 4.7 Illustrate

Appel à une API de génération d'image avec le **prompt de style fixe** (§5) et la `scene` du brouillon, en format portrait 4:5. Le résultat est stocké dans le bucket Supabase `illustrations`. Une nouvelle sans illustration validée n'est jamais publiée.

Choix de l'API : à faire après un test de cohérence (§10, phase 0). On génère 10 scènes différentes avec le même prompt de style sur 2 ou 3 fournisseurs, et on garde celui dont les 10 images ont l'air de sortir du même livre.

### 4.8 Review — toi, au début

Back-office minimal (§7). Pendant le premier mois, **toutes** les nouvelles passent par ta validation. Ensuite, auto-validation des nouvelles avec `score ≥ 0,8` venant d'une source `trust_level = 3`, et relecture manuelle du reste.

### 4.9 Schedule — chaque jour à 4 h

Pour chaque thème actif et chaque jour des 14 prochains sans nouvelle : prendre la meilleure story `approved` non programmée et lui attribuer `publish_date`.

Règles de sélection :

- Priorité aux nouvelles **récentes** (moins de 10 jours), puis aux « intemporelles » (`evergreen = true`, marquées au triage)
- Une nouvelle non intemporelle de plus de 30 jours n'est plus programmable
- Pas deux nouvelles de la même source deux jours de suite sur un thème

**Alerte** (email via Resend) si le stock programmé d'un thème descend sous 7 jours.

---

## 5. Direction visuelle

### Tokens

| Élément | Valeur |
|---------|--------|
| Fond | Crème `#F5EFE4` + texture papier (PNG de bruit en tuile, multiply, 10 %) |
| Encre | `#1F1B16`, texte secondaire `#3A342C`, légendes `#6B6257` |
| Titres | **Fraunces** 600, interlignage serré (~1,02), accent en Fraunces *italique* 400 |
| Texte | **DM Sans** 400/600 |
| Boutons | Rayon 16 px, hauteur 52-54 px, encre pleine ou contour fin |
| Verre | `expo-blur` (intensité ~40) + bordure blanche à 50 % |
| Feuille de texte | Rayon 30 px en haut, ombre douce vers le haut, posée sur l'illustration |

### Palettes par thème

Chaque thème a 6 couleurs : haut de ciel, bas de ciel, soleil, colline claire, colline moyenne, colline foncée. La plus foncée sert de couleur d'accent (pastille, titre en italique, coches).

| Thème | Ciel haut | Ciel bas | Soleil | Colline 1 | Colline 2 | Accent |
|-------|-----------|----------|--------|-----------|-----------|--------|
| Planète | `#EFB98A` | `#F4E5CC` | `#EE8F48` | `#B9D3B5` | `#6FA48A` | `#2F6B5E` |
| Animaux | `#F2C08E` | `#F8E6CC` | `#FFF1DA` | `#E3B07A` | `#C08040` | `#7A4E14` |
| Science | `#B9B2EC` | `#ECE6F6` | `#F6B877` | `#B3ADE6` | `#7F77CF` | `#3E3880` |
| Santé | `#F1B9B0` | `#FAE6DF` | `#FFF2E4` | `#EDB0A6` | `#D27A70` | `#8E3535` |
| Solidarité | `#F3CF73` | `#FBEFCB` | `#EB8440` | `#EDCF77` | `#D2A22B` | `#6B4F00` |
| Inventions | `#A9CBE6` | `#E6F0F7` | `#F6B877` | `#B5D0E6` | `#6E9CC4` | `#24506F` |
| Culture | `#DDB8E0` | `#F5E6F3` | `#F09A4E` | `#D9B5DB` | `#AD70AF` | `#5E2D60` |

Elles vivent dans la table `themes` (colonne `palette jsonb`), pas dans le code.

### Prompt de style des illustrations (base, à affiner au test de cohérence)

```
Editorial illustration in gouache and risograph style, printed on warm off-white
paper with visible grain. Flat layered shapes with soft, slightly irregular
painted edges. Calm, optimistic early-morning light. Limited palette: {palette
in words}. Any sun or moon is a perfect circle. Wide, airy composition: keep the
top 35% of the image as open sky with no detail, for a title overlay.
No text, no letters, no logos, no close-up faces, no photorealism, no 3D render.
Scene: {scene}
```

Écran d'arrivée du jour : on réutilise l'illustration du jour, assombrie et recadrée sur le soleil. Pas de deuxième génération.

---

## 6. Modèle de données (Supabase Postgres)

```sql
create extension if not exists vector;

create table themes (
  id          text primary key,              -- 'planete', 'science'…
  label       text not null,
  position    int  not null,
  palette     jsonb not null,                -- 6 couleurs, cf. §5
  active      boolean not null default true,
  coming_soon boolean not null default false
);

create table sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  feed_url    text not null unique,
  trust_level int  not null check (trust_level between 1 and 3),
  active      boolean not null default true
);

create table raw_articles (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid references sources(id),
  url          text not null unique,
  title        text not null,
  snippet      text,
  published_at timestamptz,
  fetched_at   timestamptz not null default now(),
  status       text not null default 'new',  -- new | triaged | rejected | extracted | drafted | failed
  reject_reason text,
  triage       jsonb,
  full_text    text
);

create table stories (
  id             uuid primary key default gen_random_uuid(),
  raw_article_id uuid not null references raw_articles(id),
  theme_id       text not null references themes(id),
  title_main     text not null,
  title_accent   text,
  summary        text not null,
  why_good       text,
  claims         jsonb not null,
  scene          text,
  source_name    text not null,
  source_url     text not null,
  source_date    date,
  score          real not null,
  evergreen      boolean not null default false,
  embedding      vector(1024),
  image_path     text,                       -- bucket 'illustrations'
  status         text not null default 'drafted',
    -- drafted | verified | illustrated | approved | scheduled | rejected | retracted
  reject_reason  text,
  publish_date   date,
  created_at     timestamptz not null default now(),
  unique (theme_id, publish_date)
);

create table profiles (
  user_id      uuid primary key references auth.users(id),
  themes       text[] not null,
  notify_time  time not null default '08:00',
  timezone     text not null default 'Europe/Paris',
  created_at   timestamptz not null default now()
);

create table saved_stories (
  user_id  uuid references auth.users(id),
  story_id uuid references stories(id),
  saved_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create table error_reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id),
  story_id   uuid references stories(id),
  message    text,
  created_at timestamptz not null default now()
);

create table pipeline_config (
  key   text primary key,
  value jsonb not null
);

create table pipeline_runs (
  id        bigserial primary key,
  step      text not null,
  started_at timestamptz not null default now(),
  processed int, succeeded int, failed int,
  error     text
);
```

**RLS :**

- `themes`, et `stories` avec `status = 'scheduled' and publish_date <= current_date` : en lecture pour tout utilisateur authentifié (anonyme compris)
- `profiles` et `saved_stories` : lecture et écriture limitées à son propre `user_id`
- `error_reports` : insertion seulement
- Tout le reste : `service_role` uniquement

**`status = 'retracted'`** : si une erreur est confirmée après publication, la nouvelle disparaît de l'app. Elle est remplacée dans les archives par une ligne « Nouvelle retirée après vérification ». L'honnêteté sur ses erreurs fait partie de la promesse.

---

## 7. Back-office

Une seule page web protégée. Le plus simple : une route `/admin` dans un petit projet Next.js sur Vercel, connectée en `service_role` côté serveur, protégée par l'auth Supabase avec ton email seul autorisé.

Pour chaque story `illustrated`, en carte :

- l'illustration, le titre en deux parties, le résumé, « pourquoi c'est bien » ;
- les `claims` avec leur `evidence` ;
- le lien vers la source ;
- les actions : **Valider**, **Rejeter** (avec raison), **Régénérer l'illustration**, **Éditer le texte**.

Plus deux encarts :

- **Stock** : le nombre de jours programmés par thème, en rouge sous 7 jours ;
- **Signalements** : les `error_reports` récents, avec un bouton « Retirer la nouvelle ».

---

## 8. Écrans de l'app

| # | Écran | Contenu |
|---|-------|---------|
| 1 | **Choix des thèmes** | Illustration en haut qui prend la palette du dernier thème touché, titre « Quelles bonnes nouvelles te font du bien ? », phrase de promesse, liste numérotée des thèmes, « Près de chez moi » marqué « bientôt », bouton « Continuer · N thèmes » |
| 2 | **Heure du rendez-vous** | « À quelle heure veux-tu ta bonne nouvelle ? », sélecteur d'heure (8 h par défaut), puis demande d'autorisation des notifications **à ce moment-là, pas avant** |
| 3 | **Arrivée du jour** | Plein écran sombre, illustration du jour assombrie, « Bonjour. », carte en verre « Ta bonne nouvelle t'attend », bouton Découvrir. Affiché à la première ouverture de la journée. |
| 4 | **Nouvelle du jour** | Illustration plein cadre, pastille thème et boutons en verre, feuille crème : date, titre en deux parties, résumé avec lettrine, source en italique, boutons Partager et Lire la source. Lien discret « Signaler une erreur ». |
| 5 | **Partage** | Rendu de la carte story (390×693 logique, export ×3) avec `react-native-view-shot`, puis feuille de partage iOS |
| 6 | **Archives** | Les jours passés, sur tes thèmes. En tête : « Aussi aujourd'hui » (les nouvelles de tes autres thèmes) |
| 7 | **Gardées** | Les nouvelles enregistrées |
| 8 | **Réglages** | Thèmes, heure, « Comment on choisit les nouvelles » (transparence sur le pipeline), contact |

**La transition Arrivée → Nouvelle** est le moment signature de l'app. Le soleil monte, la carte en verre glisse vers le bas et se transforme en feuille crème, avec un haptique léger. Prévois une vraie demi-journée dessus avec Reanimated : c'est ce que les gens vont filmer.

---

## 9. Stack

| Besoin | Choix |
|--------|-------|
| App | **Expo** (SDK courant), Expo Router, TypeScript strict |
| Backend | **Supabase** : Postgres + `pgvector`, auth anonyme, Storage, Edge Functions, `pg_cron` |
| LLM | **API Claude** : Haiku pour le tri, Sonnet pour la rédaction et la vérification |
| Embeddings | API d'embeddings (à choisir) |
| Images | API de génération d'image (à choisir au test de cohérence, §4.7) |
| Extraction | `@mozilla/readability` + `linkedom` |
| Polices | `@expo-google-fonts/fraunces`, `@expo-google-fonts/dm-sans` |
| Animations | `react-native-reanimated`, `expo-haptics` |
| Verre | `expo-blur` |
| Images dans l'app | `expo-image` (cache disque) |
| Partage | `react-native-view-shot` + `expo-sharing` |
| Notifications | `expo-notifications`, **locales** (programmées sur l'appareil, pas de serveur de push en v1) |
| Back-office | Next.js sur Vercel, une page |
| Alertes | Resend |
| Tests | Vitest (logique du pipeline), Jest (app) |

**Les clés d'API** (Claude, image, embeddings) restent dans les secrets des Edge Functions, jamais dans l'app.

---

## 10. Plan de build

### Phase 0 — Le pipeline, sans app (2 semaines, puis il tourne seul)

- **J1** : projet Supabase, migrations, seed des `themes` et d'une trentaine de `sources`
- **J2** : `_shared/pipeline/` en fonctions pures avec leurs tests : calcul du score, construction et parsing des prompts, contrôle des `evidence` par sous-chaîne, règles de programmation
- **J3** : Edge Functions `collect`, `triage`, `extract`
- **J4** : `draft`, `verify`, `dedup`
- **J5** : **test de cohérence des illustrations** (10 scènes × 2 ou 3 fournisseurs), choix de l'API, puis `illustrate`
- **J6** : `schedule` et alerte de stock, branchement de `pg_cron`
- **J7** : back-office
- **Puis 2 semaines de fonctionnement**, avec 10 minutes de relecture par jour

> Jalon : le test go/no-go de §0. S'il échoue, on corrige les sources et les seuils, pas l'app.

### Phase 1 — L'app (2 semaines, en soirées compter le double)

- Navigation, polices, tokens, texture papier, composant d'illustration avec palette
- Auth anonyme, onboarding (thèmes puis heure), notifications locales
- Arrivée du jour → Nouvelle du jour, avec la transition signature
- Partage en image
- Archives, Gardées, Réglages, Signaler une erreur
- Build EAS, TestFlight, 10 testeurs pendant 2 semaines

---

## 11. Definition of Done

- [ ] Le pipeline tourne 7 jours sans intervention, et chaque thème actif a toujours au moins 7 jours de stock
- [ ] Aucune nouvelle n'est publiée sans illustration, sans source ou sans passage par `verify`
- [ ] Chaque `evidence` est retrouvée telle quelle dans le texte de l'article (contrôle en code)
- [ ] Onboarding complet en moins de 30 secondes, sans création de compte
- [ ] La notification arrive à l'heure choisie, et l'ouvrir mène à l'écran d'arrivée du jour
- [ ] La nouvelle du jour est la même toute la journée et change le lendemain
- [ ] L'image partagée est nette (×3), lisible et porte le nom de l'app
- [ ] Une nouvelle `retracted` disparaît de l'app au prochain rafraîchissement
- [ ] Aucun seuil ni aucune palette n'est écrit en dur dans le code

---

## 12. Phase 2 — dans cet ordre

1. **Widget iOS** (écran d'accueil et écran verrouillé) avec l'illustration et le titre du jour. Le meilleur levier de rétention pour ce format.
2. **Mode sombre** : les palettes du soir sont déjà là, c'est l'écran d'arrivée.
3. **Freemium** : thèmes illimités, archives complètes et widgets premium en payant ; 3 thèmes et les 7 derniers jours en gratuit.
4. **« Près de chez moi »** : sources régionales (presse locale, sites des villes) + géolocalisation au niveau du département.
5. **Android.**

---

## 13. Prompt de démarrage Claude Code

```
Je construis "Éclaircie", une app iOS (Expo) qui envoie chaque matin UNE bonne
nouvelle vérifiée et sourcée, sur des thèmes choisis par l'utilisateur. Derrière,
un pipeline Supabase collecte l'actualité (RSS), la trie avec Claude Haiku, la
résume et la vérifie avec Claude Sonnet, l'illustre, et la met en stock.

On commence par le PIPELINE UNIQUEMENT. Aucune app, aucun écran.

Stack : Supabase (Postgres + pgvector, Edge Functions Deno, pg_cron), TypeScript
strict.

Fais UNIQUEMENT ces deux choses, dans cet ordre :

1. Les migrations SQL (je colle le schéma cible ci-dessous) dans
   supabase/migrations/, avec les policies RLS décrites, et un seed des 7
   thèmes avec leurs palettes.

2. La logique métier du pipeline dans supabase/functions/_shared/pipeline/,
   en FONCTIONS PURES, sans aucun appel réseau ni accès base :
   - `triageScore(triage, trustLevel, config): number` et
     `isTriageAccepted(triage, score, config): boolean`
   - `buildDraftPrompt(article)` et `parseDraft(json)`, avec validation Zod :
     title_main, title_accent, summary (350 car. max), why_good, claims[],
     scene
   - `checkEvidence(claims, fullText): { ok, missing[] }` : chaque evidence
     doit être retrouvée dans le texte après normalisation (espaces,
     guillemets, apostrophes typographiques, casse)
   - `buildVerifyPrompt(article, draft)` et `parseVerify(json)`
   - `pickForSchedule(candidates, alreadyScheduled, day, config)` : récentes
     d'abord, puis evergreen ; jamais une non-evergreen de plus de 30 jours ;
     pas la même source deux jours de suite sur un thème
   - `themeOfTheDay(userThemes, signupDate, day)` : rotation déterministe
   Tous les seuils viennent de `config` (table pipeline_config), jamais en dur.
   Tests Vitest exhaustifs, avec des fixtures d'articles réalistes : une
   evidence absente du texte fait échouer checkEvidence ; une story de
   45 jours non evergreen n'est jamais choisie ; themeOfTheDay est stable
   pour une même date.

Règles :
- Pas de `any`. Pas de fichier de plus de 300 lignes.
- Pas de nouvelle dépendance sans me demander.
- Pas encore d'Edge Function, pas d'appel à l'API Claude ou d'image.
- Ne passe pas à la suite tant que je n'ai pas validé les migrations et la
  logique pure avec leurs tests.

[colle ici le SQL de la section 6 et les règles des sections 2 et 4]
```
