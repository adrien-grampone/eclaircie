# Spec MVP #8 — App « une bonne nouvelle par jour »

> **Nom de code : Éclaircie.** Tu choisis tes thèmes (Planète, Science, Animaux…). Chaque matin, une bonne nouvelle **vraie, vérifiée et sourcée** t'attend, illustrée et résumée en une minute de lecture. Derrière, un pipeline IA collecte, trie, vérifie et résume l'actualité positive, et la met en stock. Les illustrations sont faites à la main.

Maquettes de référence : la toile « Éclaircie — maquettes » (choix des thèmes, arrivée du jour, nouvelle du jour, carte à partager).

> **Mises à jour du 3 novembre 2026 (première journée de build).**
> - Toute la chaîne LLM tourne sur Claude Haiku, pour des raisons de coût.
> - Le dédoublonnage se fait par Haiku, sans embeddings.
> - `why_good` est supprimé, et une étape `revise` a été ajoutée entre deux passes de `verify`.
> - Des règles éditoriales et de ton ont été fixées, dont l'exclusion des événements récurrents et des études nutritionnelles.
> - La file de triage est priorisée et les vieux articles expirent.
> - Le pipeline tourne sur un projet Supabase hébergé en UE, avec surveillance.
> - **Les illustrations sont faites à la main dans l'app Gemini** (abonnement existant, mode Pro, 3:4), à partir d'un prompt généré par le back-office. Pas d'API d'image, pas de facturation Google. Le style a été validé par un test de cohérence sur 5 sujets.

---

## 0. Le cadre — le risque n'est pas l'app, c'est le contenu

L'interface est simple. Ce qui peut tuer le projet, c'est le contenu :

1. **Pas assez de bonnes nouvelles solides** sur certains thèmes. Tu te retrouves à publier du remplissage.
2. **Une nouvelle fausse ou déformée** publiée sous le label « vérifié et sourcé ». La promesse produit est détruite.

D'où la règle de construction : **le pipeline d'abord, l'app ensuite.** Tu le fais tourner deux semaines avant d'écrire le moindre écran. Les illustrations ne font pas partie du test : le go/no-go porte sur le contenu.

**Test go/no-go (fin de la phase 0) :**

- Au moins **5 thèmes sur 7** produisent ≥ 1 nouvelle validée par jour en moyenne
- Moins de **30 %** des nouvelles vérifiées par l'IA sont rejetées à ta relecture manuelle
- **Zéro** erreur factuelle repérée dans les nouvelles que tu as validées

Si un thème ne tient pas le rythme, il ne sort pas au lancement. Mieux vaut 5 thèmes impeccables que 7 thèmes dont 2 tièdes. Plan de repli connu : fusionner Inventions dans Science, sortir Culture du lancement.

**Ce qui différencie l'app** (le marché « good news » existe déjà) :

- Les thèmes au choix, et **une seule** nouvelle par jour : un rituel, pas un fil à scroller
- La source affichée et vérifiée sur chaque nouvelle
- Le soin visuel : une illustration originale par nouvelle, une direction éditoriale de magazine

---

## 1. Périmètre v1

### Dans le scope

- Pipeline de collecte, tri, rédaction, vérification, révision et dédoublonnage, avec un stock tampon par thème
- Surveillance du pipeline : journal des exécutions, alertes, rapport du matin
- Back-office : relecture et validation, flux d'illustration manuelle, images de secours, stock, signalements, santé du pipeline
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
- ❌ Embeddings et recherche vectorielle (inutiles au volume actuel, voir §4.7)
- ❌ Génération d'images par API (illustrations manuelles, voir §4.8)

---

## 2. Les règles produit et éditoriales

### Une nouvelle par jour, par utilisateur

Chaque thème a **sa** nouvelle du jour (`stories.publish_date`). Un utilisateur qui suit plusieurs thèmes reçoit **une** nouvelle, choisie par rotation entre ses thèmes :

```
theme_du_jour = themes_choisis_tries[ jours_depuis_inscription % nb_themes ]
```

Les nouvelles des autres thèmes de l'utilisateur apparaissent dans les Archives (« Aussi aujourd'hui dans Science »).

### Ce qui compte comme une « bonne nouvelle »

Une nouvelle est éligible si **toutes** ces conditions sont vraies :

- C'est un **fait** daté : une découverte, un résultat mesuré, une décision actée, un projet achevé. Pas une opinion, pas une promesse, pas un « pourrait »
- C'est un **changement**, pas un événement prévu d'avance (voir les exclusions ci-dessous)
- Elle est **positive sans contrepartie cachée**
- La source est **identifiable et sérieuse**
- Elle n'est **pas publicitaire**
- Elle reste vraie dans la durée (voir le stock tampon, §4.10)

### Règles par type de nouvelle (appliquées en code après le triage)

Le triage renvoie un `kind` :

| `kind` | Exemple | Thèmes autorisés |
|--------|---------|------------------|
| `achievement` | Un objectif atteint, un projet achevé | Tous |
| `protection` | Une aire protégée, une espèce sauvée | Tous |
| `breakthrough` | Un progrès avec bénéfice concret | Tous |
| `discovery` | Un savoir nouveau, sans bénéfice concret | **Science uniquement** |
| `solidarity` | Des gens qui en aident d'autres | Tous |
| `culture_win` | Patrimoine restauré, restitution, lieu sauvé, langue qui revit | Tous |

- **Une étude sur l'animal ou in vitro n'entre jamais dans Santé.** Santé = un résultat chez l'humain : essai clinique, traitement autorisé, recul mesuré d'une maladie.
- Le **premier** thème renvoyé par le triage est le thème principal, celui qui va dans `stories.theme_id`.

### Exclusions (rejet en code, quel que soit le thème)

| Champ du triage | Rejet | Exemples |
|-----------------|-------|----------|
| `is_scheduled_event` | `scheduled_event` | Remises de prix et récompenses annuelles (Goncourt, Nobel, César…), festivals, sorties d'œuvres, classements. **Exception** : un prix qui récompense une avancée concrète (un traitement, par exemple) reste évaluable. |
| `is_food_health_claim` | `food_health_claim` | « Tel aliment / complément est bon pour tel organe » : études souvent observationnelles, régulièrement contredites |
| `is_promotional` | `promotional` | Lancements de produits, communiqués de marque |

### Règles de ton (rédaction)

- **Jamais un terme plus fort ou plus certain que la source.** Un « could » reste « pourrait », un plan n'est pas un résultat.
- **Une nuance n'est mentionnée que si elle change le sens de cette nouvelle.** Pas de contexte général négatif ajouté (« les effectifs déclinent ailleurs »).
- Une demi-phrase maximum, **jamais la dernière phrase, jamais dans le titre**. Le résumé finit sur la bonne nouvelle.
- **Si la contrepartie est si forte qu'elle devrait figurer dans le titre, ce n'est pas une bonne nouvelle** : rejet.
- Traduction fidèle autorisée, jamais un terme plus précis que la source (« beetles » ≠ « carabes »). Noms d'espèces et de lieux : nom français courant s'il existe, sinon une description (« un coléoptère rare »). Jamais de nom anglais brut.
- Le `title_accent` peut être évocateur, mais n'apporte aucun fait absent du résumé.

À la relecture manuelle, le test est simple : à 8 h du matin, est-ce qu'on referme l'app de meilleure humeur ? Les cas limites (contrepartie lourde même hors du titre) se tranchent là, pas par une règle de plus.

### Le droit d'auteur

- On ne republie **jamais** le texte d'un article. Le résumé est rédigé avec nos mots, en 2 à 3 phrases, avec un lien vers la source.
- On ne reprend **jamais** les images des médias. Chaque nouvelle a son illustration générée.
- Avant le lancement : vérifier les conditions d'utilisation de Google sur les contenus générés dans l'app Gemini, pour un usage dans une app publiée, et l'absence de logo visible sur les images téléchargées.

---

## 3. Sources

Table `sources`, éditable sans déploiement. **État au 3 novembre : 70 flux vérifiés.**

| Type | Exemples | Pourquoi |
|------|----------|----------|
| Rubriques RSS de médias généralistes | rubriques Sciences, Planète, Santé, Culture de grands médias FR et internationaux | Volume |
| Communiqués d'institutions | ONU, OMS, Inserm, ESA… | Solidité maximale |
| Actualité scientifique | flux de revues et de médias scientifiques | Science, Santé |
| Médias de journalisme constructif | médias « solutions » | Solidarité, Inventions |
| Flux dédiés Culture et Inventions | patrimoine, restitutions, musées, rubriques innovation | Les deux thèmes les plus maigres |
| Google News RSS par requête | `https://news.google.com/rss/search?q=<requête>&hl=fr&gl=FR&ceid=FR:fr` | Rattrapage par thème |

- Chaque source a un `trust_level` (1 à 3), utilisé dans le score (§4.2).
- **Fenêtre de collecte** : 7 jours, portée à **30 jours pour les sources `trust_level = 3`** (les institutions publient rarement).
- Une source qui génère des rejets répétés passe en `active = false`. Le taux d'acceptation par source sur 24 h est affiché par `morning.sql`.
- Premiers constats : les rubriques climat généralistes et l'actualité ONU climat ne donnent presque rien ; les rubriques culture des grands médias et l'actualité scientifique donnent le plus.
- À faire : retrouver les flux à jour du CNRS, de l'Institut Pasteur, du CNES et du Muséum (404 au premier seed, URL probablement changées).

---

## 4. Le cœur technique — le pipeline

Tout vit dans `supabase/functions/` (Edge Functions Deno), déclenché par `pg_cron` via `pg_net`. L'URL du projet et la clé d'autorisation des appels sont lues dans Vault. Chaque étape traite **un petit lot** (`batch_size`, 10) par invocation. Chaque étape lit un statut et écrit le suivant : si une étape plante, la suivante reprend là où elle s'est arrêtée.

```
collect ─► triage ─► extract ─► draft ─► verify ─┬─► dedup ─► schedule ─► image + validation
 (RSS)     (Haiku)   (texte)    (Haiku)  (Haiku)  │  (Haiku)   (règles)    (toi, back-office)
                                            ▲     │
                                            └─ revise (Haiku), une fois
```

La logique métier (scores, règles éditoriales, décisions de verify et de revise, règles de programmation, construction des prompts, choix des images de secours, alertes d'image) est dans `supabase/functions/_shared/pipeline/`, en **fonctions pures testées**. Les Edge Functions ne font que lire, appeler et écrire.

**Règle de déploiement** : toujours `supabase db push` **avant** `supabase functions deploy`. Une migration qui retire une clé de config avant le redéploiement des fonctions a déjà cassé triage et extract en production.

### 4.0 Modèles et budget

**Tout le texte tourne sur Claude Haiku (`claude-haiku-5-5`)**, par décision budget : Sonnet est environ vingt fois plus cher par token, et les essais n'ont pas montré de perte de qualité nette sur cette tâche.

| Étape | Raisonnement | `max_tokens` |
|-------|--------------|--------------|
| triage | désactivé (il consommait le budget de tokens et tronquait les réponses) | 1024 |
| draft, verify, revise | adaptatif, effort `low` | 4096 |
| dedup | désactivé | 1024 |

Le prompt système de triage est marqué pour le cache de prompts.

**Plafonds journaliers** dans `pipeline_config`, respectés par chaque fonction, remis à zéro à minuit UTC :

- `max_triage_per_day` : 400
- `max_draft_per_day` : 40 (partagé par draft et revise)

Un appel en erreur d'API ne compte pas dans le budget : l'article reste dans son statut et sera repris.

**Remontée en gamme ciblée** si la relecture manuelle trouve des erreurs que verify a laissé passer : passer **seulement verify** sur Sonnet, pour les seules stories qui ont passé tout le reste.

### 4.1 Collect — toutes les 3 h

Lire **toutes** les sources actives à chaque passage (aucun appel modèle, coût nul), insérer dans `raw_articles` avec `url` unique (`on conflict do nothing`). Ignorer les articles hors de la fenêtre de collecte (§3). Les erreurs de flux sont notées dans `sources.last_error`.

### 4.2 Triage — toutes les 10 min

**File** : la vue `triage_queue` sert les articles `new` dans l'ordre `published_at desc`, puis `trust_level desc`. Les plus récents passent d'abord, pour ne pas laisser vieillir les bons articles. Un article `new` sorti de sa fenêtre de collecte passe en `expired`, **sans appel modèle**.

Entrée : titre + extrait RSS + nom de la source. Sortie JSON :

```json
{
  "is_good_news": true,
  "themes": ["planete", "animaux"],
  "kind": "protection",
  "study_subject": "none",
  "is_fact": true,
  "is_promotional": false,
  "is_scheduled_event": false,
  "is_food_health_claim": false,
  "positivity": 0.9,
  "significance": 0.8,
  "reason": "courte justification"
}
```

- `study_subject` ∈ `human | animal | in_vitro | none`.
- Le schéma est strict pour une bonne nouvelle, mais tolère un `kind` vide ou `not_applicable` quand `is_good_news` est faux (sinon, erreurs de parsing en série sur les mauvaises nouvelles).
- `is_scheduled_event` et `is_food_health_claim` valent `false` par défaut si le modèle les omet.

Score de tri :

```
score = 0,35 × positivity + 0,35 × significance + 0,30 × (trust_level / 3)
```

On garde si `is_good_news && is_fact && score ≥ 0,65`, **puis** `applyEditorialRules` applique en code les exclusions et les règles par `kind` et `study_subject` de §2 (un thème interdit est retiré ; s'il n'en reste aucun, rejet). Les seuils sont dans `pipeline_config`.

Constats au 3 novembre : 13 à 18 % d'acceptation selon les sources.

### 4.3 Extract — 3 min après le triage

Récupérer la page et extraire le texte principal (`@mozilla/readability` + `linkedom`). Si l'article est sous paywall ou fait moins de 800 caractères : `status = 'failed'`, raison `no_fulltext`. **On ne résume jamais à partir d'un simple extrait RSS.**

### 4.4 Draft — toutes les 15 min

Le prompt impose de rédiger **uniquement** à partir du texte fourni, avec les règles de ton de §2. Sortie JSON :

```json
{
  "status": "ok",
  "title_main": "Éoliennes à l'arrêt la nuit,",
  "title_accent": "chauves-souris épargnées.",
  "summary": "2 à 3 phrases, 350 caractères max, en français, tutoiement",
  "claims": [
    { "claim": "l'arrêt certaines nuits divise par cinq la mortalité",
      "evidence": "la phrase exacte de l'article qui le dit" }
  ],
  "scene": "description visuelle de la scène à illustrer"
}
```

`status` peut valoir `not_good_news` si, au vu du texte complet, la contrepartie l'emporte : la story est alors rejetée.

`title_main` + `title_accent` alimentent directement le titre en deux parties du design (la partie en italique).

**Règles du champ `scene`** (il alimente le prompt d'illustration) :

- **Exactitude ou généricité, jamais l'approximation.** Soit le sujet exact de l'article, avec ses caractéristiques (« un dinosaure bipède, de type théropode »), soit on ne le montre pas. Jamais une espèce, un objet ou un lieu approximatif. Au test, un article sur un théropode a produit une silhouette de sauropode : c'est exactement ce qu'il faut éviter.
- **Peu d'éléments** : un sujet principal, un décor simple. Plus la scène est chargée, plus le modèle d'image s'éloigne du style.
- Personnages : seulement en petites silhouettes lointaines, jamais de visage.
- Aucun texte, aucun logo, aucune marque.
- Une `scene` vide est refusée au parsing.

### 4.5 Verify — 5 min après draft

Un **appel séparé**, qui ne voit pas le raisonnement du draft. Deux contrôles :

**En code, sans modèle :** chaque `evidence` doit être retrouvée dans le texte de l'article, après normalisation (espaces, guillemets et apostrophes typographiques, casse). Une evidence absente = rejet.

**Par le modèle :** chaque problème est renvoyé typé, avec le passage fautif et une correction proposée.

| Type | Exemple | Effet |
|------|---------|-------|
| `fact_error` | Un chiffre attribué à la mauvaise période, une généralisation fausse | **Rejet définitif** |
| `overstatement` | « de retour » pour une seule observation, un qualificatif ajouté sur un fait présent | Révision |
| `missing_caveat` | Une limite qui change le sens de la nouvelle est absente | Révision |
| `translation_issue` | Un terme plus précis que la source | Révision |
| `tone_negative` | Le résumé se lit comme une mauvaise nouvelle | **Rejet** |

Règles de jugement :

- Une traduction fidèle d'un mot anglais n'est **jamais** un `translation_issue` (« folly » → « insensé » est correct).
- Le titre n'est jugé que sur deux points : il n'ajoute aucun fait absent du résumé, il ne contredit pas le résumé. Le ton évocateur est voulu.
- Un qualificatif ajouté sur un fait présent dans l'article est un `overstatement`, pas un `fact_error`.

Chaque verdict est conservé dans `stories.verify_log` (jsonb, une entrée par passe).

### 4.6 Revise — 10 min après draft

Si la première passe de verify ne renvoie que des problèmes révisables, Haiku réécrit le brouillon avec les corrections, puis **une seconde passe de verify** :

- elle vérifie que chaque problème de la première passe est corrigé ;
- elle cherche **uniquement** de nouveaux `fact_error`, pas de nouveaux pinaillages.

Deuxième échec = rejet. Le nombre de passes est dans `pipeline_config` (`verify_max_passes`).

Si le résumé révisé dépasse 350 caractères, une nouvelle tentative avec la consigne explicite de raccourcir (`revise_length_retries`), avant rejet.

Résultat au 3 novembre : 14 stories validées sur 16 après révision (88 %), contre 2 sur 16 sans révision.

### 4.7 Dedup — toutes les 30 min, par Haiku

Pas d'embeddings : au volume visé (quelques dizaines de stories par jour), une comparaison par Haiku suffit et évite un fournisseur de plus.

- **Entrée** : la story à tester + titre et résumé des stories du même thème sur 30 jours (statut `verified` et au-delà).
- **Sortie JSON** : `{ "duplicate_of": <id ou null>, "reason": "..." }`.
- **Décision (pure, testée)** : la source au `trust_level` le plus élevé gagne, à égalité la plus ancienne, et une story déjà programmée n'est jamais remplacée. Le perdant passe en `rejected` avec la raison `duplicate_of`.

Le même événement couvert par plusieurs sources produit plusieurs drafts avant le dédoublonnage. C'est accepté : sur Haiku, le surcoût est négligeable. Si un jour le volume explose, on ajoutera une comparaison de titres dès le triage, puis des embeddings multilingues.

### 4.8 Illustrations — à la main, dans l'app Gemini

**Décision** : les illustrations sont générées à la main dans l'app Gemini (abonnement existant), pas par API. Coût nul, au prix d'environ une heure à une heure et demie par semaine.

**Pourquoi Gemini** : test de cohérence du 3 novembre sur 5 sujets très différents (éoliennes et chauves-souris, ferme aux oiseaux, os de dinosaure, corail sous l'eau, épicerie de village). Les 5 images semblent sortir du même livre : soleils ronds, ciel dégagé en haut, aucun texte, silhouettes sans visage.

**Réglages dans l'app** : mode **Pro**, format **3:4**, et **une nouvelle conversation par image** (dans une même conversation, le modèle s'inspire de l'image précédente).

**Flux** :

1. `schedule` programme les stories `verified` sur 14 jours.
2. Une story programmée sans `image_path` est « en attente d'image ».
3. Le back-office (§7) affiche, pour chacune, le **prompt complet prêt à copier** : prompt de style (§5) + `themes.palette_words` + `scene`.
4. Tu génères l'image dans Gemini, tu la télécharges et tu la déposes dans le back-office. Elle est recadrée en 3:4, réduite sous 1792×2400 et convertie en WebP, puis stockée dans le bucket `illustrations` ; `image_path` est rempli.
5. **Rythme** : une session par semaine suffit pour garder deux semaines d'avance (environ 50 images par semaine à 7 thèmes).

**Filet de sécurité** :

- **Images de secours** : plusieurs images génériques par thème dans `fallback/<theme_id>/` du bucket, faites une fois pour toutes. Une story publiée sans `image_path` affiche une image de secours du thème, choisie de façon déterministe par story.
- **Alerte `image_missing`** : `planImageAlerts`, appelée par `schedule`, ouvre une alerte pour toute story programmée dans les `image_alert_days` jours (2) sans image, et la résout quand l'image arrive.

**Si le volume ou le temps devient un problème** : l'option de repli testée est l'API Gemini, `gemini-nano-banana-2.1` en 2K (environ 0,05 $ par image, soit une dizaine de dollars par mois à 7 images par jour), uniquement pour les stories programmées. Elle demande d'activer la facturation sur Google AI Studio. Le script de test est prêt dans `design/illustration-test/`, non lancé.

### 4.9 Review — toi, au début

Back-office (§7). Pendant le premier mois, **toutes** les nouvelles passent par ta validation (`approved_at`). Tu vérifies aussi que l'illustration est fidèle à la nouvelle (bonne espèce, bon type de lieu). Ensuite, auto-validation des nouvelles avec `score ≥ 0,8` venant d'une source `trust_level = 3`, et relecture manuelle du reste.

### 4.10 Schedule — chaque jour à 4 h UTC

Pour chaque thème actif et chaque jour des 14 prochains sans nouvelle : prendre la meilleure story au statut d'entrée et lui attribuer `publish_date`. Puis `planImageAlerts` (§4.8) et l'alerte de stock.

**Statut d'entrée** : `schedule_input_status` dans `pipeline_config`. Il vaut `verified` : la validation (`approved_at`) et l'image arrivent **après** la programmation, dans le back-office. Rejeter une story programmée libère son jour pour le prochain passage.

Règles de sélection (dans `pickForSchedule`, testées) :

- Priorité aux nouvelles **récentes** (moins de 10 jours), puis aux « intemporelles » (`evergreen = true`)
- Une nouvelle non intemporelle de plus de 30 jours n'est plus programmable (règle stricte)
- Pas deux nouvelles de la même source deux jours de suite sur un thème (règle stricte)
- **Une source ne dépasse pas 30 % des nouvelles d'un thème sur 14 jours glissants** (seuil en config). C'est une **préférence** : si aucun candidat ne la respecte pour un jour donné, on prend le meilleur candidat restant. **Un jour vide est pire qu'une source répétée.**

**Alerte** `stock_low` dans `pipeline_alerts` si le stock programmé d'un thème descend sous 7 jours ; elle se résout seule quand le stock remonte.

### 4.11 Surveillance

Les échecs silencieux sont le risque principal d'un pipeline qui tourne seul.

- Chaque Edge Function écrit dans `pipeline_runs`, **y compris quand elle échoue**, avec le message d'erreur.
- `pipeline_health_check()`, lancée par pg_cron toutes les heures, relève : les jobs cron en échec, les réponses HTTP non 200 vues par `pg_net`, les étapes dont le dernier run est en erreur, et les étapes muettes depuis 3 h. Une alerte ouverte par empreinte, résolue automatiquement quand la cause disparaît.
- `supabase/tests/morning.sql`, à lancer chaque matin (`supabase db query --linked --file supabase/tests/morning.sql`, ou dans l'éditeur SQL du tableau de bord) : runs et erreurs des dernières 24 h, état des jobs cron, alertes ouvertes, taille de la file de triage et âge du plus vieux article en attente, taux d'acceptation par source, stories par thème, stock programmé et prochain trou, titres à paraître sur 3 jours.

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

Elles vivent dans la table `themes` (colonne `palette jsonb`), pas dans le code. Chaque thème a aussi sa **palette en mots** pour le prompt d'image (colonne `palette_words`), par exemple pour Planète : « peach sky fading to cream, a warm orange sun, rolling fields in sage green, mid green and deep forest green ».

### Prompt de style des illustrations (validé au test de cohérence)

```
Full-bleed editorial illustration, edge to edge, no border, no frame, no paper
margin. Gouache and risograph style with the texture of warm paper and visible
grain across the whole image. Flat layered shapes with soft, slightly irregular
painted edges. Calm, optimistic early-morning light. Simple composition with few
elements and large shapes, minimal small details. Limited palette: {palette in
words}. Use only the colors of the palette. Any sun or moon is a perfect circle.
Wide, airy composition: keep the top 35% of the image as open sky with no
detail, for a title overlay. No text, no letters, no logos, no close-up faces,
no photorealism, no 3D render.
Scene: {scene}
```

Ce que le test a appris :

- « printed on warm off-white paper » produisait une **marge crème autour de l'image**, comme un tableau posé sur une feuille. D'où l'ouverture « Full-bleed… no paper margin » et la texture décrite comme une matière, pas comme un support.
- Les scènes chargées (village, maisons, arbres, personnages) dérivent vers l'illustration jeunesse et sortent de la palette. D'où « Simple composition… » et « Use only the colors of the palette », plus les règles de la `scene` (§4.4).
- Pour une scène sous l'eau, remplacer « open sky » par « open water and light ».
- Pour un animal précis, nommer sa forme reconnaissable (« small bats with clearly bat-shaped wings »).

Le soleil doit être un **cercle parfait** : l'effet de bord peint s'applique aux collines et aux formes, pas aux astres.

Écran d'arrivée du jour : on réutilise l'illustration du jour, assombrie et recadrée sur le soleil. Pas de deuxième image.

---

## 6. Modèle de données (Supabase Postgres)

Schéma de référence, à jour des migrations du 3 novembre. **Les migrations du repo font foi.**

```sql
create table themes (
  id            text primary key,            -- 'planete', 'science'…
  label         text not null,
  position      int  not null,
  palette       jsonb not null,              -- 6 couleurs, cf. §5
  palette_words text not null,               -- palette en mots pour le prompt d'image
  active        boolean not null default true,
  coming_soon   boolean not null default false
);

create table sources (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  feed_url        text not null unique,
  trust_level     int  not null check (trust_level between 1 and 3),
  active          boolean not null default true,
  last_fetched_at timestamptz,
  last_error      text
);

create table raw_articles (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid references sources(id),
  url          text not null unique,
  title        text not null,
  snippet      text,
  published_at timestamptz,
  fetched_at   timestamptz not null default now(),
  triaged_at   timestamptz,
  status       text not null default 'new',
    -- new | triaged | rejected | expired | extracted | drafted | failed
  reject_reason text,
  triage       jsonb,
  full_text    text
);

-- vue triage_queue : articles 'new' par published_at desc, puis trust_level desc

create table stories (
  id             uuid primary key default gen_random_uuid(),
  raw_article_id uuid not null references raw_articles(id),
  theme_id       text not null references themes(id),
  title_main     text not null,
  title_accent   text,
  summary        text not null,
  claims         jsonb not null,
  scene          text not null,
  source_name    text not null,
  source_url     text not null,
  source_date    date,
  score          real not null,
  evergreen      boolean not null default false,
  verify_log     jsonb not null default '[]',
  image_path     text,                       -- bucket 'illustrations', null = en attente d'image
  approved_at    timestamptz,                -- validation manuelle dans le back-office
  status         text not null default 'drafted',
    -- drafted | to_revise | verified | scheduled | rejected | retracted
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
  id         bigserial primary key,
  step       text not null,
  started_at timestamptz not null default now(),
  processed  int, succeeded int, failed int,
  error      text
);

-- pipeline_alerts : une alerte ouverte par empreinte, résolue automatiquement
-- (fonctions raise_pipeline_alert / resolve_pipeline_alert)
-- types notables : function_error, cron_failure, step_silent, stock_low, image_missing
```

**Storage** : bucket `illustrations`, **public en lecture** (l'app affiche les images). **L'écriture est réservée à l'admin** : l'upload passe par le serveur du back-office avec la clé `service_role`, ou par une policy de stockage limitée à l'admin. Jamais d'écriture possible avec la clé publique de l'app. Dossiers : `<story_id>.webp` et `fallback/<theme_id>/`.

**RLS** (contrôlée par `supabase/tests/rls_check.sql`, rejouable dans une transaction annulée) :

- `themes`, et `stories` avec `status = 'scheduled' and publish_date <= current_date` : en lecture pour tout utilisateur authentifié. Les utilisateurs anonymes de Supabase ont le rôle `authenticated` ; le rôle `anon` (aucune session) ne voit rien.
- `profiles` et `saved_stories` : lecture et écriture limitées à son propre `user_id`
- `error_reports` : insertion seulement
- Tout le reste : `service_role` uniquement

**`status = 'retracted'`** : si une erreur est confirmée après publication, la nouvelle disparaît de l'app. Elle est remplacée dans les archives par une ligne « Nouvelle retirée après vérification ».

---

## 7. Back-office

Dossier `admin/` du repo : **Next.js**, déployé sur Vercel. Connexion par lien magique Supabase, emails autorisés dans `ADMIN_EMAILS`, clé `service_role` côté serveur uniquement.

| Page | Contenu |
|------|---------|
| **Images à faire** | Compteur « N images à faire, prochaine échéance : date ». Une carte par story programmée sur 14 jours sans image : titre, résumé, thème, date, **prompt complet avec bouton Copier**, zone de dépôt (recadrage 3:4, réduction, WebP). En bas : les images de secours par thème, avec ajout et suppression. |
| **À valider** | Stories vérifiées ou programmées non validées : titre, résumé, `scene`, claims et preuves, `verify_log`, lien source. Actions : **Valider** (`approved_at`), **Rejeter** avec raison (libère le jour), **Éditer le texte**, **Retirer**. |
| **Stock** | Jours programmés par thème, en rouge sous 7 jours |
| **Signalements** | `error_reports` récents, avec « Retirer la nouvelle » |
| **Santé** | Alertes ouvertes, étapes sur 24 h, articles par statut |

---

## 8. Écrans de l'app

| # | Écran | Contenu |
|---|-------|---------|
| 1 | **Choix des thèmes** | Illustration en haut qui prend la palette du dernier thème touché, titre « Quelles bonnes nouvelles te font du bien ? », phrase de promesse (« Chaque matin, tu reçois une bonne nouvelle vérifiée et sourcée sur les thèmes que tu choisis »), liste numérotée des thèmes, « Près de chez moi » marqué « bientôt », bouton « Continuer · N thèmes » |
| 2 | **Heure du rendez-vous** | « À quelle heure veux-tu ta bonne nouvelle ? », sélecteur d'heure (8 h par défaut), puis demande d'autorisation des notifications **à ce moment-là, pas avant** |
| 3 | **Arrivée du jour** | Plein écran sombre, illustration du jour assombrie, « Bonjour. », carte en verre « Ta bonne nouvelle t'attend », bouton Découvrir. Affiché à la première ouverture de la journée. |
| 4 | **Nouvelle du jour** | Illustration plein cadre (ou image de secours du thème), pastille thème et boutons en verre, feuille crème : date, titre en deux parties, résumé avec lettrine, source en italique, boutons Partager et Lire la source. Lien discret « Signaler une erreur ». |
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
| Backend | **Supabase hébergé, région UE** : Postgres, auth anonyme, Storage, Edge Functions, `pg_cron` + `pg_net`, Vault |
| Texte (LLM) | **API Claude, Haiku partout** (§4.0) via `@anthropic-ai/sdk` |
| Images | **App Gemini à la main** (mode Pro, 3:4), dépôt dans le back-office (§4.8) |
| Extraction | `@mozilla/readability` + `linkedom` |
| Back-office | **Next.js** sur Vercel, `@supabase/ssr`, lien magique |
| Polices | `@expo-google-fonts/fraunces`, `@expo-google-fonts/dm-sans` |
| Animations | `react-native-reanimated`, `expo-haptics` |
| Verre | `expo-blur` |
| Images dans l'app | `expo-image` (cache disque) |
| Partage | `react-native-view-shot` + `expo-sharing` |
| Notifications | `expo-notifications`, **locales** (programmées sur l'appareil, pas de serveur de push en v1) |
| Tests | Vitest (logique du pipeline), Jest (app) |

**Les clés d'API** restent dans les secrets des Edge Functions, jamais dans l'app ni dans un fichier versionné, et ne sont jamais collées dans une conversation. Seule la clé Anthropic est poussée en secret de production. Une limite de dépense mensuelle est fixée dans la Console Claude, en plus des plafonds du pipeline.

---

## 10. Plan de build

### Phase 0 — Le pipeline, sans app

État au 3 novembre :

- [x] Migrations, seed des thèmes et de 70 sources, RLS contrôlée
- [x] Logique pure testée (174 tests)
- [x] collect, triage, extract, draft, verify, revise, dedup
- [x] Règles éditoriales et de ton, exclusions (événements récurrents, études nutritionnelles), règles du champ `scene`
- [x] Déploiement sur Supabase hébergé, pg_cron
- [x] Surveillance : `pipeline_alerts`, health check horaire, `morning.sql`
- [x] File de triage priorisée, expiration des vieux articles
- [x] `schedule` et alertes de stock et d'image
- [x] Test de cohérence des illustrations, choix de Gemini à la main
- [x] Back-office construit en local
- [ ] Back-office en production : migration, déploiement Vercel, écriture du bucket réservée à l'admin vérifiée
- [ ] **Deux semaines de fonctionnement**, avec 10 minutes de relecture par jour, et le relevé des erreurs que verify laisse passer

> Jalon : le test go/no-go de §0. S'il échoue, on corrige les sources, les seuils et les prompts, pas l'app.

### Entre la phase 0 et la phase 1

- Vérifier les conditions d'utilisation de Google pour les images générées et l'absence de logo visible
- Générer 3 ou 4 images de secours par thème
- Première session d'images : deux semaines d'avance

### Phase 1 — L'app (2 semaines, en soirées compter le double)

- Navigation, polices, tokens, texture papier, composant d'illustration avec image de secours
- Auth anonyme, onboarding (thèmes puis heure), notifications locales
- Arrivée du jour → Nouvelle du jour, avec la transition signature
- Partage en image
- Archives, Gardées, Réglages, Signaler une erreur
- Build EAS, TestFlight, 10 testeurs pendant 2 semaines

---

## 11. Definition of Done

- [ ] Le pipeline tourne 7 jours sans intervention, et chaque thème actif a toujours au moins 7 jours de stock
- [ ] Toute panne d'une étape apparaît dans `pipeline_alerts` en moins de 2 h
- [ ] Aucune nouvelle n'est publiée sans source, sans passage par `verify` ni sans validation manuelle (pendant le premier mois)
- [ ] Aucune nouvelle n'est publiée sans illustration : à défaut, une image de secours du thème s'affiche
- [ ] Chaque `evidence` est retrouvée telle quelle dans le texte de l'article (contrôle en code)
- [ ] Aucune illustration ne contredit sa nouvelle (espèce, lieu, objet)
- [ ] Le bucket `illustrations` est impossible à modifier avec la clé publique de l'app
- [ ] Onboarding complet en moins de 30 secondes, sans création de compte
- [ ] La notification arrive à l'heure choisie, et l'ouvrir mène à l'écran d'arrivée du jour
- [ ] La nouvelle du jour est la même toute la journée et change le lendemain
- [ ] L'image partagée est nette (×3), lisible et porte le nom de l'app
- [ ] Une nouvelle `retracted` disparaît de l'app au prochain rafraîchissement
- [ ] Aucun seuil, aucun plafond ni aucune palette n'est écrit en dur dans le code

---

## 12. Phase 2 — dans cet ordre

1. **Widget iOS** (écran d'accueil et écran verrouillé) avec l'illustration et le titre du jour. Le meilleur levier de rétention pour ce format.
2. **Mode sombre** : les palettes du soir sont déjà là, c'est l'écran d'arrivée.
3. **Freemium** : thèmes illimités, archives complètes et widgets premium en payant ; 3 thèmes et les 7 derniers jours en gratuit.
4. **Génération d'images par API** si les sessions manuelles deviennent trop lourdes (§4.8).
5. **« Près de chez moi »** : sources régionales (presse locale, sites des villes) + géolocalisation au niveau du département.
6. **Android.**

---

## 13. Prompt de démarrage Claude Code (historique)

Ce prompt a lancé la phase 0 le 3 novembre. Il est gardé pour mémoire : le repo, ses migrations et ses tests sont désormais la référence.

```
Je construis "Éclaircie", une app iOS (Expo) qui envoie chaque matin UNE bonne
nouvelle vérifiée et sourcée, sur des thèmes choisis par l'utilisateur. Derrière,
un pipeline Supabase collecte l'actualité (RSS), la trie, la résume et la
vérifie avec Claude, et la met en stock.

On commence par le PIPELINE UNIQUEMENT. Aucune app, aucun écran.

Stack : Supabase (Postgres, Edge Functions Deno, pg_cron), TypeScript strict.

Fais UNIQUEMENT ces deux choses, dans cet ordre :

1. Les migrations SQL (schéma cible ci-dessous) dans supabase/migrations/,
   avec les policies RLS décrites, et un seed des 7 thèmes avec leurs
   palettes.

2. La logique métier du pipeline dans supabase/functions/_shared/pipeline/,
   en FONCTIONS PURES, sans aucun appel réseau ni accès base, avec des tests
   Vitest exhaustifs. Tous les seuils viennent de `config` (table
   pipeline_config), jamais en dur.

Règles :
- Pas de `any`. Pas de fichier de plus de 300 lignes.
- Pas de nouvelle dépendance sans me demander.
- Ne passe pas à la suite tant que je n'ai pas validé les migrations et la
  logique pure avec leurs tests.
```
