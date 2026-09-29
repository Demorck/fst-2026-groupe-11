# fst-2026-groupe-11

Groupe: 11:
* Membre 1 : ANTOINE Maximilien
* Membre 2 : BASUALDO Lautaro
* Membre 3 : COLLIN Alex

## G-Event

Application de gestion d'événements pour les associations étudiantes : création d'événements, réservation de billets,
créneaux bénévoles, check-in et dashboard, avec une brique IA (prédiction d'affluence, génération de communication).
Le détail fonctionnel est dans [PROJECT.md](PROJECT.md).

## Prérequis

- **Node.js** `^22.22.3`, `^24.15.0` ou `>=26` (imposé par la CLI NestJS). Vérifier avec `node -v`
- **Docker** (pour PostgreSQL)

## Démarrage rapide

```bash
npm run setup   # une seule fois : dépendances, backend/.env, Postgres, migrations
npm run dev     # Postgres + API + front dans un seul terminal (Ctrl+C arrête tout)
```

- Front : http://localhost:5173
- API : http://localhost:3000/api
- Swagger (doc de l'API) : http://localhost:3000/api/docs

## Architecture

```
┌──────────────┐   /api/*    ┌──────────────┐   Prisma    ┌──────────────┐
│   frontend   │ ──────────► │   backend    │ ──────────► │  PostgreSQL  │
│ React + Vite │ ◄────────── │    NestJS    │ ◄────────── │   (Docker)   │
│    :5173     │    JSON     │    :3000     │             │    :5433     │
└──────────────┘             └──────────────┘             └──────────────┘
```

Le front n'appelle jamais `localhost:3000` directement : il appelle `/api/...` (via `apiFetch` dans
`frontend/src/api/client.ts`) et le serveur Vite redirige ces requêtes vers le backend. En dev, pas besoin de gérer
le CORS côté navigateur.

Les deux projets sont découpés par domaine métier, avec les mêmes noms des deux côtés :

| Domaine                        | Backend (`src/modules/`) | Frontend (`src/features/`) |
|--------------------------------|--------------------------|----------------------------|
| Authentification, rôles        | `auth/`, `users/`        | page `LoginPage`           |
| Événements                     | `events/`                | `events/`                  |
| Billets et check-in            | `tickets/`               | `tickets/`                 |
| Créneaux bénévoles             | `volunteers/`            | `volunteers/`              |
| Dashboard de suivi             | `dashboard/`             | `dashboard/`               |
| IA (prédiction, communication) | `ai/`                    | `ai/`                      |

Plus de détails dans [backend/README.md](backend/README.md) et [frontend/README.md](frontend/README.md).

## Stack

| Outil           | Où      | À quoi il sert                                                 |
|-----------------|---------|----------------------------------------------------------------|
| TypeScript      | partout | Typage du front et du back                                     |
| React 19        | front   | Interface utilisateur                                          |
| Vite            | front   | Serveur de dev, build, proxy `/api`                            |
| React Router    | front   | Navigation entre les pages (`src/router.tsx`)                  |
| Tailwind CSS    | front   | Style via des classes utilitaires                              |
| NestJS          | back    | API REST organisée en modules (controllers, services)          |
| Swagger         | back    | Doc interactive de l'API générée depuis le code                |
| class-validator | back    | Validation des requêtes et des variables d'environnement       |
| Prisma          | back    | ORM : schéma (`prisma/schema.prisma`), migrations, client typé |
| PostgreSQL      | back    | Base de données, lancée via `backend/docker-compose.yml`       |
| Vitest          | back    | Tests unitaires et e2e                                         |
| oxlint          | partout | Linter                                                         |
| Prettier        | partout | Formatage (config dans `.prettierrc`)                          |
| concurrently    | racine  | Lance l'API et le front dans un seul terminal                  |

## Scripts (à la racine)

| Script                        | Rôle                                                                                                |
|-------------------------------|-----------------------------------------------------------------------------------------------------|
| `npm run setup`               | Installe tout, crée `backend/.env` depuis `.env.example`, démarre Postgres, applique les migrations |
| `npm run dev`                 | Démarre Postgres puis l'API et le front en mode watch                                               |
| `npm run dev:api` / `dev:web` | Démarre seulement l'API ou seulement le front                                                       |
| `npm run db:up` / `db:down`   | Démarre / arrête Postgres                                                                           |
| `npm run db:migrate`          | Applique les migrations existantes                                                                  |
| `npm run build`               | Build du back puis du front                                                                         |
| `npm run lint`                | oxlint sur les deux projets                                                                         |
| `npm run format`              | Prettier sur les deux projets                                                                       |
| `npm test`                    | Tests du backend                                                                                    |

Pour modifier le schéma de la base : éditer `backend/prisma/schema.prisma` puis lancer
`npm run prisma:migrate --prefix backend` (crée une nouvelle migration et régénère le client).
