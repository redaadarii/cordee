# Cordée

Gestion de projet agile pour les équipes produit : tableau kanban, backlog, sprints, liste, calendrier, rapports, commentaires avec mentions, pièces jointes et notifications, le tout synchronisé en temps réel.

Une cordée, ce sont des grimpeurs reliés par la même corde, qui avancent au rythme du groupe. C'est l'idée du produit : chacun voit où en sont les autres.

## Stack

| Partie | Technologies |
| --- | --- |
| API (`apps/api`) | Node.js 22, NestJS 12 (ESM), Drizzle ORM, PostgreSQL, Socket.IO, Zod |
| Front (`apps/web`) | React 19, Vite 8, TypeScript, Tailwind CSS 4, TanStack Query, Zustand, dnd-kit |
| Partagé (`packages/shared`) | Schémas Zod et types des échanges API, utilisés des deux côtés |
| Outillage | pnpm workspaces, Turborepo, Vitest, Testing Library, oxlint, Docker, GitHub Actions |

## Démarrer

Prérequis : Node.js 22.12 ou plus, pnpm 10, Docker (pour PostgreSQL).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # puis changer JWT_ACCESS_SECRET
pnpm db:up          # PostgreSQL (et Redis, réservé à la suite) dans Docker
pnpm db:migrate     # crée les tables
pnpm db:seed        # facultatif : données de démonstration
pnpm dev            # API sur :3000, front sur :5173
```

Ouvrir http://localhost:5173. Avec les données de démonstration : `demo@cordee.dev` / `cordee-demo-2026`.

Sans `SMTP_URL`, les e-mails (invitations, mot de passe oublié) s'affichent dans le terminal de l'API : copiez le lien depuis là.

## Déployer

```bash
cp .env.prod.example .env.prod      # puis remplir
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Détails dans [l'architecture](docs/03-architecture.md#mise-en-production).

## Commandes

| Commande | Rôle |
| --- | --- |
| `pnpm dev` | Lance l'API et le front en rechargement à chaud |
| `pnpm build` | Compile les trois paquets |
| `pnpm typecheck` | Vérifie les types |
| `pnpm test` | Tests unitaires de l'API et tests du front (Vitest) |
| `pnpm --filter @cordee/api run test:e2e` | Parcours de bout en bout, contre une API démarrée avec `NODE_ENV=test MAIL_OUTBOX_FILE=/tmp/cordee-outbox.jsonl` |
| `pnpm --filter @cordee/api run db:generate` | Génère une migration SQL après une modification de `schema.ts` |

## Organisation du dépôt

```
apps/
  api/                 API NestJS
    drizzle/           migrations SQL versionnées
    src/
      access/          contrôle d'accès (rôles par espace de travail)
      auth/            inscription, connexion, mots de passe, rotation des jetons
      workspaces/      espaces, membres, invitations, recherche
      projects/        projets, colonnes, étiquettes, rapports
      issues/          tickets, déplacement, historique
      attachments/     pièces jointes et stockage
      mail/            envoi des e-mails (SMTP ou console)
      sprints/  comments/  notifications/
      realtime/        passerelle Socket.IO et bus d'événements
      database/        schéma Drizzle, migrations, jeu de démonstration
    test/              parcours de bout en bout
  web/                 application React
    src/
      app/             routeur et coquille (menu, barre du haut)
      features/        un dossier par écran ou domaine : board, backlog, list, calendar,
                       reports, settings, issues, members, account…
      lib/             client HTTP, temps réel, formatage
      stores/          session et espace courant (Zustand)
      ui/              composants de base
packages/
  shared/              contrat d'API : schémas Zod, DTO, rôles
docs/                  analyse, périmètre, architecture, design, feuille de route
docker/                images de l'API et du front, configuration nginx
```

## Documentation

1. [Analyse des outils existants](docs/01-analyse-concurrentielle.md)
2. [Périmètre fonctionnel](docs/02-perimetre-fonctionnel.md)
3. [Architecture](docs/03-architecture.md)
4. [Design system et UX](docs/04-design-system.md)
5. [Feuille de route](docs/05-roadmap.md)
