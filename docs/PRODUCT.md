# Cockpit — référence produit

Document de référence pour toutes les phases. Il fixe la vision, les principes,
le modèle de données et la roadmap. À mettre à jour à chaque décision structurante
(section « Journal des décisions »).

## Vision

Un système d'exploitation personnel d'entrepreneur : documenter, organiser, suivre
et analyser sa progression dans plusieurs projets (achat-revente, création de
contenu Instagram, business, accompagnements, développement personnel, projets
futurs), à partir d'informations aujourd'hui dispersées entre appels Google Meet,
Discord, Instagram, WhatsApp, emails, conseils et feedbacks.

Ce n'est pas un « second cerveau » mais une **boucle de progression** :

```
CAPTURER  →  COMPRENDRE  →   AGIR    →  MESURER  →  APPRENDRE
 (< 5 s)     (insights IA)   (tâches)     (KPI)      (bilans, patterns)
    ↑______________________________________________________|
```

Chaque fonctionnalité sert une étape de cette boucle ; sinon elle est coupée.

**North Star** : le pourcentage de conseils du mentor effectivement appliqués.

## Principes

1. **Un objet universel.** Notes, appels, messages, fichiers, liens, journal,
   expériences, décisions et bilans sont des *Entrées* typées sur une même timeline.
   Recherche, IA, timeline et analytics en découlent.
2. **Capturer d'abord, classer ensuite.** Tout arrive dans l'Inbox ; l'IA propose
   projet, type, contact et tags ; l'utilisateur valide en un geste.
3. **Insights atomiques.** L'IA extrait de chaque entrée des unités (conseil,
   décision, action, erreur, leçon, idée, chiffre clé), toujours reliées à leur
   source avec citation.
4. **L'IA propose, l'utilisateur dispose.** Aucune tâche, aucun tag, aucune
   modification n'est appliqué sans validation. Toute réponse cite ses sources.
5. **La progression se mesure, elle ne se déclare pas.** Objectifs reliés à des KPI.
6. **Pas de métriques de vanité.** Le nombre de notes n'est jamais un indicateur.
7. **Le premium, c'est la vitesse.** Interactions sous 100 ms, mouvement discret qui
   répond à une action, un seul élément ambiant par écran, `prefers-reduced-motion`
   respecté.
8. **Organisé dans 5 ans.** Rangement automatique (projet × type × date × contact)
   plutôt que des dossiers, vocabulaire de tags contrôlé, archivage, export complet.

## Ce que l'IA doit pouvoir répondre, et les données nécessaires

| Question | Données nécessaires |
|---|---|
| « Que m'a conseillé mon mentor ces 30 derniers jours ? » | Insights `advice` + contact `mentor` + dates |
| « Quels produits semblent les plus prometteurs ? » | `inventory_item` : achat, vente, frais, délai, plateforme |
| « Quelles erreurs reviennent souvent ? » | Insights `mistake` + regroupement sémantique |
| « Analyse mon évolution ce mois-ci » | `metric_value` + `goal` + tâches terminées |
| « Quels sont mes blocages principaux ? » | Journal, tâches souvent en retard, objectifs stagnants |
| « Montre mes meilleurs résultats » | Résultats chiffrés et datés |

Les modules Insights, KPI et Inventaire sont donc des prérequis de l'IA, pas des bonus.

## Réalité des intégrations

| Source | Possible | Stratégie |
|---|---|---|
| Instagram DM | API Meta pour comptes pro/créateur seulement, après validation | Partage + capture d'écran lue par l'IA |
| WhatsApp | Aucune API pour comptes perso | Import de « Exporter la discussion », partage, captures |
| Discord | Bot sur les serveurs où il est invité, pas les DM | Bot + commande `/save`, partage |
| Google Meet | Transcription native selon forfait Workspace | Upload audio/vidéo → transcription FR avec diarisation |
| Email | Oui | Adresse de réception dédiée |
| Google Calendar | Oui (OAuth) | Appels à venir → fiche appel + brief |

Sur iPhone, Safari ne gère pas le Web Share Target : la capture passe par un
Raccourci iOS. Enregistrer un appel suppose le consentement de l'interlocuteur
(art. 226-1 du Code pénal) : la pièce jointe porte un champ `recording_consent`.

## Modèle de données

Tables métier (`src/server/db/schema/app.ts`), toutes portant `workspace_id` :

- `workspace` — un par propriétaire, fuseau horaire.
- `project` — nom, slug, icône, couleur, template (`resale` | `content` |
  `business` | `blank`), statut (`active` | `paused` | `done` | `archived`).
- `entry` — l'objet universel : type, contenu (JSON de l'éditeur), `plain_text`,
  **`occurred_at` distinct de `created_at`**, source, `meta`, statut Inbox, épinglé,
  privé (exclu de l'IA). Liens : `entry_contact`, `entry_link`, `entry_tag`, `attachment`.
- `insight` — type, contenu, citation, position dans l'enregistrement, contact
  auteur, statut `proposed` → `accepted` → `applied` | `dismissed`.
- `task` — statut, priorité, échéance, temps estimé/réel, récurrence, source
  (entrée, insight), contact à qui elle a été promise.
- `contact` + `project_contact` — rôle, relation, handles, dernière et prochaine interaction.
- `metric` + `metric_value` — KPI par projet et leurs valeurs datées.
- `goal` — période, type (`metric` | `milestone`), valeurs de départ et cible.
- `inventory_item` — économie par article (montants en centimes).
- `review` — bilans du jour à l'année, avec photo des KPI au moment du bilan.
- `tag`, `reminder`, `ai_thread`, `ai_message`, `ai_usage` (coût de chaque appel IA).

Tables d'auth générées par Better Auth (`auth.ts`) : `user`, `session`, `account`,
`verification`, `passkey`, `two_factor`.

Conventions : suppression réversible via `deleted_at`, énumérations en colonnes
texte typées (pas de migration de type pour ajouter une valeur), argent en centimes.
Les embeddings arriveront en phase 2 dans une table dédiée, indépendante du modèle.

## Architecture

```
CAPTURE              TRAITEMENT (tâches de fond)                    RESTITUTION
Web / ⌘K       ┐     1. Extraction : PDF→texte, image→OCR,           Aujourd'hui
PWA / partage  │        audio/vidéo→transcription                   Recherche
Note vocale    ├→ Entry → 2. IA : type, projet, contact, tags,   →   Assistant
Email entrant  │  (Inbox)   insights, tâches proposées              Bilans
Upload         │     3. Indexation : plein texte FR + vecteurs       Notifications
Bot Discord    ┘     4. Validation dans l'Inbox                     Analytics
```

- **Rendu** : Cache Components. Le shell (sidebar, en-têtes) est prérendu ; tout
  ce qui lit la session est derrière un `<Suspense>`. `getCurrentUser()`
  (`use cache: private`) est le seul point d'entrée vers les données de l'utilisateur ;
  chaque requête de `queries.ts` le résout elle-même.
- **Accès** : `proxy.ts` redirige sans cookie ; la session est vérifiée au plus
  près des données. Compte propriétaire unique, verrouillé par `OWNER_EMAIL` en production.
- **Base** : Postgres (Supabase en production, PGlite en local).
- **IA** (`src/server/ai/`) : Claude via le SDK Anthropic (`claude-opus-5-5` par défaut,
  effort réglé par usage : bas pour l'extraction, moyen pour l'assistant, haut pour
  les bilans longs ; repli serveur en cas de refus ; registre des coûts et plafond
  mensuel). Embeddings (voyage-4-lite, 1024 dimensions, pgvector) et transcription
  (ElevenLabs Scribe) via Vercel AI Gateway, authentifié par OIDC. `AI_MOCK=1` pour
  tester sans fournisseur.
- **Traitements** : `after()` après chaque capture, et une tâche quotidienne
  (`/api/cron/daily`) pour le brief, les rappels, les bilans de début de période et
  l'analyse progressive des entrées modifiées.

## Design system

Fond `#0a0a0b`, surfaces `#111113` / `#18181b`, texte `#ededea` / `#9a9aa3` /
`#6b6b74`, accent unique `#5b8cff`, bordures en blanc à 7 %, liseré supérieur
« verre ». Geist et Geist Mono, base 13–14 px, chiffres tabulaires. Rayons 12 px
(cartes) et 8 px (champs). Mouvement de 150 à 400 ms sur la courbe
`cubic-bezier(0.22, 1, 0.36, 1)`. Tokens dans `src/app/globals.css`, palette de
projets et templates dans `src/lib/project-catalog.ts`.

## Roadmap

| Phase | Contenu | Statut |
|---|---|---|
| **0. Fondations** | Repo, auth (passkeys, 2FA, propriétaire unique), schéma complet, design system, sidebar + nav mobile + ⌘K + raccourcis, page Aujourd'hui, pages modules, manifeste PWA | ✅ Fait |
| **1. Capturer et retrouver** | Création de projets, entrées (note, appel, message, lien, fichier) avec éditeur, Inbox et tri clavier, tâches, contacts, timeline, recherche plein texte, upload, PWA (share target ; capture hors ligne à venir) | ✅ Fait |
| **2. Comprendre** | Transcription, extraction d'insights et de tâches, recherche sémantique, « Demander » avec sources, brief et debrief d'appel, import de captures d'écran, assistant | 🟡 Livré, à éprouver |
| **3. Piloter** | Objectifs + KPI + check-in, analytics, revue hebdo guidée, bilans automatiques, brief matinal, notifications, Inventaire, pipeline de contenu | 🟡 Livré, à éprouver |
| **4. Automatiser** | Google Calendar et Drive, bot Discord, email entrant, import WhatsApp, erreurs répétées et conseils non appliqués, bilans trimestriels et annuels, partage avec le mentor, export | 🟡 Livré, à éprouver |

Légende : ✅ fait et utilisé au quotidien · 🟡 le code existe, mais il n'a pas encore
servi en conditions réelles.

Règle d'origine : une phase ne commence pas avant que la précédente ait servi au
quotidien pendant 1 à 2 semaines. Le 2026-10-28, à ta demande, les phases 2 à 4 ont
été livrées d'un bloc : elles n'ont donc jamais passé cette épreuve, d'où le statut 🟡.
Un « Fait » sans usage réel cachait des défauts (voir ci-dessous).

**Ce que l'on sait de l'état réel des phases 2 à 4 (2026-10-29)**

- **Brief matinal (phase 3)** : il plantait en production, car trois requêtes de
  `brief.ts` passaient une date brute à postgres.js. Corrigé, et couvert par un test
  d'intégration sur un vrai Postgres. C'est la seule partie des phases 2 à 4 avec un test
  automatique dédié ; les parcours de base (connexion, capture, tri, tâche, accueil) sont
  couverts par Playwright.
- **Transcription et recherche sémantique (phase 2)** : elles passent par le Vercel AI
  Gateway et n'ont pas pu être essayées sans ses identifiants. Voir le tableau des variables.
- **Assistant (phase 2)** : les questions suggérées sont codées en dur et parlent de
  « mon mentor » (prévu à l'étape 4 du plan).
- **Email entrant (phase 4)** : le secret peut encore passer dans l'URL (`?token=`) ;
  prévu à l'étape 2 du plan.
- **Connecteur MCP (hors phases)** : la découverte OAuth et les outils existent, mais la
  route `/api/mcp` n'existe pas encore. À terminer ou retirer (étape 6 du plan).
- **Capture hors ligne (phase 1)** : toujours à venir.

## Variables d'environnement : ce qui dépend de quoi

Sans une variable, la fonction concernée est désactivée, sauf mention « obligatoire ».
`.env.example` donne le détail de chaque valeur. Sur Vercel, les variables se règlent
dans Project → Settings → Environment Variables.

| Variable | Obligatoire ? | Ce qui en dépend |
|---|---|---|
| `DATABASE_URL` | **Oui en production** (sans elle, toute requête échoue) | Toute l'app. Supabase : URL du transaction pooler (port 6543). En local, vide = base embarquée PGlite. |
| `DIRECT_DATABASE_URL` | Non | `npm run db:migrate` uniquement (Supabase : session pooler, port 5432). Repli sur `DATABASE_URL`. |
| `BETTER_AUTH_SECRET` | **Oui** | Connexion, sessions, chiffrement des jetons Google. Au moins 32 caractères. |
| `BETTER_AUTH_URL` | **Oui en production** | URL publique : retours de connexion, passkeys (le nom de domaine en est la référence), liens du bot Discord et du connecteur. |
| `OWNER_EMAIL` | **Oui en production** | Seule adresse autorisée à créer le compte propriétaire. Sans elle, la création est refusée en production. |
| `CRON_SECRET` | **Oui** | `/api/cron/daily` (brief, rappels, bilans automatiques, analyse des entrées modifiées). Vercel l'envoie en `Authorization: Bearer`. Absent : le point d'accès répond 500 et ne fait rien. Faux ou absent côté appelant : 401. |
| `NEXT_PUBLIC_SENTRY_DSN` | Non (recommandé) | Remontée des erreurs et alerte si la tâche quotidienne échoue ou ne s'exécute pas. Vide = Sentry désactivé. |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Non | Envoi des *source maps* à Sentry au déploiement (lisibilité des erreurs). Les trois ensemble, sinon ignorées. |
| `ANTHROPIC_API_KEY` | Non | Tout ce que Claude fait : analyse des entrées, insights et tâches proposées, assistant, bilans rédigés, brief réécrit, lecture des captures d'écran. Sans elle : brief et bilans par règles, pas d'assistant ni d'analyse. |
| `AI_MODEL`, `AI_MONTHLY_BUDGET_USD`, `AI_TRANSCRIPTION_MODEL` | Non | Modèle (défaut `claude-opus-5-5`), plafond mensuel en dollars (défaut 25), modèle de transcription. |
| `AI_GATEWAY_API_KEY` | Non (automatique sur Vercel) | Recherche sémantique (embeddings) et transcription audio/vidéo. Sur Vercel, l'identité du déploiement suffit ; ailleurs, la clé est nécessaire. |
| `AI_MOCK` | Non (**jamais en production**) | Remplace toute l'IA par des réponses factices, pour développer et tester sans coût. |
| `BLOB_STORE_ID` ou `BLOB_READ_WRITE_TOKEN` | Non (nécessaire en production pour les fichiers) | Stockage des pièces jointes. Sans l'un des deux, les fichiers vont dans `./.uploads`, qui ne survit pas sur Vercel. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Non | Notifications push. Les notifications dans l'app marchent sans. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Non | Google Agenda et Drive (lecture seule), liés depuis Réglages. Jamais utilisés pour se connecter. |
| `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_OWNER_ID` | Non | Bot Discord. La clé publique vérifie la signature de chaque requête ; seul `DISCORD_OWNER_ID` peut l'utiliser. |
| `INBOUND_EMAIL_SECRET` | Non | Email entrant (webhook Postmark). Sans lui, l'adresse refuse tout. Le secret ne passe **que** en authentification Basic : `https://inbound:SECRET@domaine/api/inbound/email` (un `?token=` est refusé). |
| `TRUSTED_ORIGINS` | Non | Origines supplémentaires autorisées à appeler l'authentification (liste séparée par des virgules, `https://…`). Les previews Vercel sont ajoutées toutes seules. |
| `CSP_REPORT_ONLY` | Non | `1` : la CSP est seulement signalée dans la console du navigateur, sans rien bloquer (pour un premier déploiement prudent). |
| `PGLITE_DIR` | Non | Dossier de la base embarquée en local (défaut `.pglite`). |
| `TEST_DATABASE_URL` | Tests seulement | Base de test, forcément locale (voir « Tests »). |

## Sécurité

- **En-têtes** (`next.config.ts`) sur toutes les pages : CSP, `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS en production.
- **CSP sans nonce**, volontairement : un nonce oblige chaque page à être rendue à la
  demande, ce qui est incompatible avec `cacheComponents` et le préchargement partiel.
  La politique garde donc `'unsafe-inline'` pour scripts et styles, et limite le reste :
  aucun script étranger, aucun cadre, aucun `<object>`, appels réseau seulement vers
  Cockpit, Vercel Blob (envois directs) et Sentry. Si un nouveau service externe est
  ajouté (images, API appelée depuis le navigateur), il faut l'ajouter à la CSP.
  Pas de `form-action` : il bloquerait la redirection d'un formulaire vers un autre
  domaine (consentement du connecteur Claude).
- **Limitation de débit** (Better Auth, stockée dans la table `rate_limit`) : par IP et
  par route. Connexion 10 essais / 15 min, création de compte 5 / h, codes 2FA et codes de
  secours 8 / 15 min, enregistrement du connecteur 20 / h. Une fenêtre repart du dernier
  essai : insister garde la porte fermée.
- **Origines de confiance** : l'URL de `BETTER_AUTH_URL`, les URLs de preview que Vercel
  injecte (`VERCEL_URL`, `VERCEL_BRANCH_URL`, seulement sur un build de preview) et
  `TRUSTED_ORIGINS`. Jamais de joker. Les passkeys ne marchent pas sur une preview (elles
  sont liées au domaine de production).
- **Rendu du texte de l'IA** (`markdown.tsx`) : audité, il ne produit que des éléments
  React, jamais de HTML brut ; les seuls liens sont les citations vers `/entrees/<id>`.
  Un test (`tests/unit/security.test.ts`) le vérifie avec des entrées piégées.
- **Fichiers privés** (`/api/fichiers/[id]`) : le type MIME vient de celui qui envoie le
  fichier (ou de l'expéditeur d'un email). Seuls les formats qui ne s'exécutent pas
  (PNG, JPEG, GIF, WebP, AVIF, PDF, audio et vidéo courants) s'ouvrent dans le navigateur ;
  tout le reste (SVG, HTML…) est téléchargé comme octets opaques, et une CSP `sandbox`
  accompagne chaque fichier affiché.
- **Codes de secours 2FA** : affichés avec « Copier » et « Télécharger » à l'activation,
  et régénérables depuis Réglages > Sécurité (mot de passe demandé, les anciens codes
  cessent de marcher).

## Fiabilité et tests

- **Tâche quotidienne** (`/api/cron/daily`) : chaque étape (brief, rappels, bilans,
  analyse) tourne dans son propre `try/catch`, pour chaque espace. Une étape qui échoue
  n'empêche ni les autres ni les autres espaces ; l'erreur part dans Sentry et la
  réponse est un 500, que Vercel affiche comme un échec. Le passage entier est aussi un
  *cron monitor* Sentry : une exécution en erreur, ou qui n'arrive jamais, déclenche
  l'alerte (à activer dans Sentry, voir plus bas).
- **Pages d'erreur** : `error.tsx` (dans l'app, la barre latérale reste utilisable et la
  page propose de réessayer), `global-error.tsx` (si le gabarit racine casse) et
  `not-found.tsx`, tous en français. Le détail technique ne s'affiche jamais : il part
  dans Sentry avec une référence (`digest`).
- **Brief sur l'accueil** : s'il échoue, une phrase le dit et le reste de la page se
  charge.
- **Tests d'intégration** (`tests/integration/`) : tournent sur un vrai Postgres via
  postgres.js, comme en production. PGlite ne convient pas ici : il accepte une date brute
  dans une requête SQL, postgres.js non. `npm run test:db:up` démarre un Postgres avec
  pgvector (Docker, `docker-compose.test.yml`), `npm run test:db:reset` y applique toutes
  les migrations, `npm run test:integration` lance les tests. Garde-fou : ils refusent de
  tourner si `TEST_DATABASE_URL` ne pointe pas vers la machine locale.
- **Tests de bout en bout** (`tests/e2e/`, Playwright) : 5 parcours : connexion, capture,
  tri de l'Inbox, tâche, accueil, plus la page 404 et l'accès au cron. Ils démarrent
  l'app sur le port 3100 contre la base de test, avec `AI_MOCK=1`. Première fois :
  `npx playwright install chromium`, puis `npm run test:e2e`. `npm test` enchaîne tout.
  `tests/e2e/securite.spec.ts` couvre les en-têtes, l'absence de violation de CSP sur les
  pages principales, la limitation de débit, l'email entrant et les codes de secours.
  `npm run test:unit` (sans base) vérifie le rendu markdown et le service des fichiers.
- **Activer l'alerte Sentry** : créer un projet Next.js, copier son DSN dans
  `NEXT_PUBLIC_SENTRY_DSN` sur Vercel, redéployer. Le *cron monitor* « cron-daily »
  apparaît dans la section Crons de Sentry après le premier passage de la tâche ;
  vérifier là que les notifications (email) sont actives pour un échec et pour une
  exécution manquée. Cette partie n'a pas pu être essayée sans compte Sentry.

## Journal des décisions

- **2026-10-27** — Drizzle plutôt que Prisma (pgvector et SQL avancé natifs).
- **2026-10-27** — Better Auth avec passkeys + TOTP ; un seul compte propriétaire.
- **2026-10-27** — PGlite en développement local pour zéro installation ; Postgres
  (Supabase, transaction pooler) en production.
- **2026-10-27** — Cache Components activé : shell statique, données en streaming.
  Les lectures de base passent par `connection()` tant qu'elles ne sont pas mises en
  cache (`use cache` + tags prévus en phase 1).
- **2026-10-27** — Interface en français, thème sombre uniquement pour l'instant
  (tokens prêts pour un thème clair).
- **2026-10-28** — Claude via le SDK Anthropic ; embeddings et transcription via AI
  Gateway (aucune clé à gérer sur Vercel). Opus 5.5 partout, l'effort fait le reste.
- **2026-10-28** — Recherche hybride : plein texte français + pgvector, fusion par rang
  réciproque. PGlite charge pgvector en local (`@electric-sql/pglite-pgvector`).
- **2026-10-28** — Traitements de fond avec `after()` et un cron Vercel quotidien,
  sans service de jobs externe ; chaque étape est idempotente.
- **2026-10-28** — Google lié au compte (Agenda et Drive en lecture), jamais utilisé
  pour se connecter ; jetons OAuth chiffrés en base.
- **2026-10-28** — Bot Discord en interactions HTTP (pas de processus à héberger),
  email entrant au format Postmark, partage avec le mentor par lien haché et révocable.
- **2026-10-29** — Phases 2 à 4 repassées de « Fait » à « Livré, à éprouver » : elles
  n'ont jamais servi, et le brief plantait avec postgres.js (dates brutes dans `sql`).
  Règle : les dates se comparent avec `gte`/`lte`/`lt` de Drizzle, jamais dans un gabarit `sql`.
- **2026-10-29** — `CRON_SECRET` obligatoire pour la tâche quotidienne ; le contournement
  par user-agent `vercel-cron` est supprimé (n'importe qui pouvait le falsifier).
- **2026-10-29** — Sentry (facultatif, piloté par `NEXT_PUBLIC_SENTRY_DSN`) pour les
  erreurs et l'alerte de la tâche quotidienne. Tests : Postgres réel pour les requêtes,
  Playwright pour les parcours ; pas de PGlite dans les tests.
- **2026-10-30** — Rate limiting Better Auth stocké en base (table `rate_limit`, migration
  0006) : en mémoire il ne limite rien sur Vercel. CSP sans nonce (voir « Sécurité »).
  Email entrant : secret en Basic uniquement. Les fichiers non sûrs (SVG, HTML) ne
  s'affichent plus jamais en ligne.
