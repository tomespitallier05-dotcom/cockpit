# Cockpit

Centre de contrôle personnel : projets, appels, conseils, tâches et progression,
dans une seule app. La vision produit, le modèle de données et la roadmap sont
dans [docs/PRODUCT.md](docs/PRODUCT.md).

**Stack** : Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 ·
shadcn/ui (Radix) · Motion · Drizzle ORM · PostgreSQL · Better Auth (passkeys + 2FA).

## Lancer en local

Prérequis : Node.js 22+.

```bash
npm install
cp .env.example .env.local   # puis renseigne BETTER_AUTH_SECRET
npm run dev
```

Ouvre http://localhost:3000 : au premier lancement, l'app te demande de créer le
compte propriétaire (le seul compte possible), puis crée ton espace et tes trois
projets de départ.

Sans `DATABASE_URL`, l'app utilise **PGlite**, un Postgres embarqué stocké dans
`./.pglite` : aucune installation de base de données n'est nécessaire.
`npm run dev` applique les migrations automatiquement avant de démarrer.

Pour repartir de zéro en local : arrête le serveur, supprime le dossier `.pglite`,
relance `npm run dev`.

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | Migrations puis serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run typecheck` / `npm run lint` | Vérifications TypeScript et ESLint |
| `npm run db:generate` | Génère une migration après un changement de `src/server/db/schema` |
| `npm run db:migrate` | Applique les migrations (PGlite, ou `DIRECT_DATABASE_URL` / `DATABASE_URL`) |
| `npm run db:studio` | Explorateur de données Drizzle Studio |
| `npm run auth:schema` | Régénère les tables d'auth après un changement de plugins Better Auth |

## Déployer (Vercel + Supabase)

1. **Supabase** : crée un projet (région `eu-west-3`, Paris). Dans
   *Connect*, récupère l'URL du **transaction pooler** (port 6543) pour
   `DATABASE_URL`, et celle du **session pooler** (port 5432) pour
   `DIRECT_DATABASE_URL`.
2. **Migrations** : depuis ta machine, avec ces deux variables dans `.env.local`,
   lance `npm run db:migrate`. Retire-les ensuite si tu veux revenir à PGlite en local.
3. **Vercel** : importe le dépôt, puis définis les variables d'environnement :
   - `DATABASE_URL` : l'URL du transaction pooler ;
   - `BETTER_AUTH_SECRET` : un secret aléatoire différent de celui du local ;
   - `BETTER_AUTH_URL` : l'URL publique, par exemple `https://cockpit.vercel.app` ;
   - `OWNER_EMAIL` : ton adresse (obligatoire en production, pour que personne d'autre
     ne puisse réclamer l'espace).
4. Déploie, ouvre l'URL, crée ton compte, puis ajoute une passkey et active la
   double authentification dans **Réglages → Sécurité**.

Les passkeys sont liées au nom de domaine de `BETTER_AUTH_URL` : celles créées
en local ne fonctionnent pas en production, et inversement.

## Organisation du code

```
src/
  app/
    (app)/            pages connectées : Aujourd'hui, Inbox, Tâches, Projets…
    (auth)/           connexion et création du compte propriétaire
    api/auth/         routes Better Auth
  components/
    shell/            sidebar, navigation mobile, palette ⌘K, raccourcis
    ui/               composants shadcn/ui
  lib/                catalogue des projets, formatage, animations, client d'auth
  server/
    db/schema/        schéma Drizzle (auth.ts est généré)
    auth.ts           configuration Better Auth (propriétaire unique)
    session.ts        getCurrentUser() : point d'entrée de toute lecture de données
    queries.ts        lectures, toujours restreintes à l'espace de l'utilisateur
  proxy.ts            redirection vers /login sans cookie de session
drizzle/              migrations SQL
```

## Raccourcis

`⌘K` / `Ctrl+K` ou `/` : palette · `C` : capturer · `G` puis `A` / `I` / `T` / `O`
/ `C` / `P` / `B` / `R` : Aujourd'hui, Inbox, Tâches, Objectifs, Contacts, Projets,
Bilans, Réglages.
