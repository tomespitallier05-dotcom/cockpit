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
- **À venir** : jobs Inngest ou Trigger.dev, Vercel AI SDK (Claude par défaut :
  modèle léger pour le tri et l'extraction, modèle fort pour l'assistant, haut de
  gamme pour les bilans longs), Deepgram ou AssemblyAI pour la transcription,
  pgvector + recherche plein texte française pour la recherche hybride, Resend pour les emails.

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
| **1. Capturer et retrouver** | Création de projets, entrées (note, appel, message, lien, fichier) avec éditeur, Inbox et tri clavier, tâches, contacts, timeline, recherche plein texte, upload, PWA (share target, capture hors ligne) | À faire |
| **2. Comprendre** | Transcription, extraction d'insights et de tâches, recherche sémantique, « Demander » avec sources, brief et debrief d'appel, import de captures d'écran, assistant | À faire |
| **3. Piloter** | Objectifs + KPI + check-in, analytics, revue hebdo guidée, bilans automatiques, brief matinal, notifications, Inventaire, pipeline de contenu | À faire |
| **4. Automatiser** | Google Calendar et Drive, bot Discord, email entrant, import WhatsApp, erreurs répétées et conseils non appliqués, bilans trimestriels et annuels, partage avec le mentor, export | À faire |

Règle : une phase ne commence pas avant que la précédente ait servi au quotidien
pendant 1 à 2 semaines.

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
