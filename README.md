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
npm run setup   # une seule fois : dépendances, backend/.env, Postgres, migrations, données de démo
npm run env     # La première fois ou si .env.example a été modifié
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
| Organisations, invitations     | `organizations/`         | `organizations/`           |
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
| `npm run setup`               | Installe tout, crée `backend/.env` depuis `.env.example`, démarre Postgres, applique les migrations, peuple la base |
| `npm run dev`                 | Démarre Postgres puis l'API et le front en mode watch                                               |
| `npm run dev:api` / `dev:web` | Démarre seulement l'API ou seulement le front                                                       |
| `npm run db:up` / `db:down`   | Démarre / arrête Postgres                                                                           |
| `npm run db:migrate`          | Applique les migrations existantes                                                                  |
| `npm run db:seed`             | Peuple la base avec les données de démo (idempotent, peut être relancé à tout moment)               |
| `npm run build`               | Build du back puis du front                                                                         |
| `npm run lint`                | oxlint sur les deux projets                                                                         |
| `npm run format`              | Prettier sur les deux projets                                                                       |
| `npm test`                    | Tests du backend                                                                                    |

Pour modifier le schéma de la base : éditer `backend/prisma/schema.prisma` puis lancer
`npm run prisma:migrate --prefix backend` (crée une nouvelle migration et régénère le client).

## Données de démo

`npm run db:seed` (lancé par `npm run setup`) crée des comptes et des données pour tester sans rien saisir. Mot de passe de tous les comptes : `password123` (démo locale uniquement). Le seed est idempotent et refuse de tourner avec `NODE_ENV=production`.

| Compte (`@gevent.test`)                  | Rôle        | Pour tester                                                   |
|------------------------------------------|-------------|---------------------------------------------------------------|
| `orga`                                   | Organisateur | Propriétaire de presque tous les événements                    |
| `orga2`                                  | Organisateur | Atelier code créatif et conférence cybersécurité (propriété)  |
| `benevole1`, `benevole2`, `benevole3`    | Bénévole    | Créneaux couverts, partiellement couverts ou vides            |
| `participant1` à `participant5`          | Participant | Billets réservés, annulés, validés (check-in) ou non          |
| `participant6`                           | Participant | Aucun billet : pour essayer la réservation                    |

| Organisation                | Membres et particularités                                                                                   |
|-----------------------------|-------------------------------------------------------------------------------------------------------------|
| BDE Nancy (logo vert)       | `orga` gestionnaire ; `benevole1` et `benevole2` bénévoles ; **invitations en attente** : `benevole3` (bénévole) et `orga2` (co-gestionnaire) |
| Club Sport Université (logo orange) | `orga` gestionnaire ; `benevole2` et `benevole3` bénévoles                                         |
| Association Numérique (sans logo, initiales) | `orga2` gestionnaire ; `benevole3` a **refusé** une invitation (on peut le réinviter)      |

Chaque événement est rattaché à au moins une organisation. Le tournoi de futsal en a deux (BDE et Club Sport), les autres une seule : de quoi voir les bulles d'organisations et les badges bénévoles (vert : déjà inscrit sur un créneau, gris : peut bénévoler).

Badges sur la liste des événements, selon le bénévole connecté : `benevole1` est vert sur la soirée de rentrée, le tournoi de futsal et la soirée jeux, gris sur le gala et la conférence IA ; `benevole3` est vert sur le futsal, gris sur le tournoi de l'an dernier et n'a aucun badge sur les événements du BDE tant qu'il n'a pas accepté son invitation. Les autres rôles et les visiteurs n'ont pas de badge.

| Événement                          | Particularité                                                                 |
|------------------------------------|-------------------------------------------------------------------------------|
| Soirée de rentrée (dans 7 jours)   | Capacité 100, un créneau d'accueil couvert                                    |
| Tournoi de futsal (dans 14 jours)  | Trois créneaux : partiellement couvert, couvert, vide                         |
| Conférence IA (dans 21 jours)      | **Complète** (capacité 2) : la réservation doit être refusée                  |
| Atelier code créatif (dans 30 j.)  | Aucun billet, autre organisateur                                              |
| Soirée jeux (dans 2 heures)        | Personne n'est encore validé : pour essayer le check-in, un billet annulé     |
| Gala, tournoi de l'an dernier, conférence cybersécurité | Passés, billets validés ou non : historique pour la prédiction d'affluence |

Pour repartir d'une base vierge : `cd backend && npx prisma migrate reset` (détruit les données locales), puis `npm run db:seed`.

# Maquette
https://claude.ai/artifact/HZNcp6ANdFbVzhMhKKMDzR#page-dcb81aee8d83
