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
| `benevole1` à `benevole4`                | Bénévole    | Créneaux couverts, partiellement couverts ou vides ; `benevole4` a quitté le BDE et a une invitation expirée |
| `participant1` à `participant5`          | Participant | Billets réservés, annulés, validés (check-in) ou non          |
| `participant6`                           | Participant | Aucun billet : pour essayer la réservation                    |

| Organisation                | Membres et particularités                                                                                   |
|-----------------------------|-------------------------------------------------------------------------------------------------------------|
| BDE Nancy (logo vert)       | `orga` gestionnaire ; `benevole1` et `benevole2` bénévoles ; **invitations en attente** : `benevole3` (bénévole) et `orga2` (co-gestionnaire) ; `benevole4` **a quitté** (ses heures restent) |
| Club Sport Université (logo orange) | `orga` gestionnaire ; `benevole2` et `benevole3` bénévoles ; `benevole1` **retiré** ; invitation de `benevole4` **annulée** |
| Association Numérique (sans logo, initiales) | `orga2` gestionnaire ; `benevole3` a **refusé** une invitation ; celle de `benevole4` a **expiré** (plus de 7 jours) : on peut les réinviter |

Chaque événement est rattaché à au moins une organisation. Le tournoi de futsal en a deux (BDE et Club Sport), les autres une seule : de quoi voir les bulles d'organisations et les badges bénévoles (vert : déjà inscrit sur un créneau, gris : peut bénévoler).

Badges sur la liste des événements, selon le bénévole connecté : vert quand il est déjà inscrit sur un créneau, gris quand il peut s'inscrire, **seulement s'il reste un créneau à venir avec de la place** (sans créneau, ou créneaux complets ou passés : pas de bulle). `benevole1` est vert sur la soirée de rentrée, le tournoi de futsal et la soirée jeux, sans bulle sur la conférence IA ni le gala (aucun créneau) ; `benevole2` est gris sur la soirée jeux (créneau « Rangement » encore vide) ; `benevole3` est vert sur le futsal et n'a aucune bulle sur les événements du BDE tant qu'il n'a pas accepté son invitation. `orga` (gestionnaire) a les mêmes badges : vert sur la soirée de rentrée (créneau « Buvette »). Les participants et les visiteurs n'ont pas de badge.

Sur une carte d'événement, la couleur de la catégorie est toujours conservée. Un participant qui a un billet voit « Vous avez un billet » (vert) ; sans billet, sur un événement **complet** (la conférence IA), la bulle rouge « Aucun billet n'est disponible » s'affiche (tout visiteur ou compte connecté sans billet). « Mes billets » existe pour tous les comptes connectés ; seuls les gestionnaires d'une organisation de l'événement modifient ses créneaux et voient le check-in.

Hiérarchie des rôles (arbre de droits) : **organisateur ⊃ bénévole ⊃ participant**. Chaque rôle a ses droits plus ceux du rôle en dessous : un bénévole réserve et annule des billets comme un participant (même sur un événement de son organisation), un organisateur a en plus les droits d'un bénévole. Le bénévolat reste limité aux événements d'une organisation dont on est membre (bénévole ou gestionnaire), alors que la billetterie ne dépend d'aucune organisation. Côté code : `hasRole` (`backend/src/common/roles.ts`, `frontend/src/features/auth/types.ts`) et `RolesGuard`, où `@Roles(X)` signifie « X ou plus ».

Hiérarchie des gestionnaires : le **gestionnaire principal** est celui qui a créé l'organisation (`orga` au BDE et au Club Sport, `orga2` à l'Association Numérique) ; les autres membres ont été invités par lui. Un gestionnaire peut retirer un bénévole ; un co-gestionnaire (`orga2` après avoir accepté l'invitation du BDE) ne peut retirer ni le principal ni un autre gestionnaire ; seul le principal retire un co-gestionnaire. Le principal ne peut pas quitter tant qu'il reste un co-gestionnaire ; un bénévole quitte quand il veut (« Quitter », sur la liste ou sur la page de l'organisation).

À essayer avec ces données :
- **Réserver et annuler un billet** : `participant6` (aucun billet) réserve une place, voit son code et son QR code, puis annule (bouton « Annuler ma réservation », sur l'événement ou dans « Mes billets ») ; la place est libérée partout. `participant1` peut annuler un billet à venir ; l'annulation est refusée pour un événement déjà commencé (gala, tournoi de l'an dernier, conférence cybersécurité) et pour une présence déjà validée. La réservation d'un événement déjà commencé est refusée aussi (« L'événement a déjà commencé »). Sur la page de l'événement, le bouton « Réserver » est alors remplacé par « Les réservations sont fermées », et « Annuler » disparaît dès le début, même page ouverte. S'inscrire sur un créneau bénévole déjà terminé est refusé (« Terminé ») ; se désinscrire est refusé dès le début du créneau (« En cours »), comme le retrait par un gestionnaire.
- **Heures et attestation** : connecté en `orga`, « Mes organisations » puis BDE Nancy : `benevole1` a 4 h, `benevole4` (partie) 4 h, avec une attestation imprimable chacun ; `orga` lui-même y figure à 2 h (créneau « Logistique » du gala) : un gestionnaire n'apparaît dans ce tableau que s'il a bénévolé. Chez Club Sport, `benevole1` (retiré) garde ses 2 h.
- **Journal** : trois entrées chez Club Sport et BDE (retrait, départ, invitation annulée).
- **Dashboard** (`orga` puis `orga2`) : la soirée jeux (dans 2 heures) cumule « Peu rempli » et « Créneaux incomplets », la conférence IA (complète) n'a rien à signaler ; `orga2` ne voit que ses événements. Le sélecteur d'organisation restreint le tableau.
- **Manque de bénévoles** : connecté en bénévole ou organisateur, « Il manque N bénévole(s) » apparaît sur la carte du tournoi de futsal et de la soirée jeux.
- **Droits hérités** : `benevole1` réserve une place (et voit « Mes billets ») sur un événement de son BDE, `benevole3` sur la soirée jeux (organisation non rejointe) ; `orga` a un billet pour le tournoi de futsal et s'inscrit lui-même au créneau « Buvette » de la soirée de rentrée (se désinscrire, puis se réinscrire). Seul le gestionnaire principal retire un co-gestionnaire d'un événement (comme pour l'organisation). `participant1` reste refusé sur les créneaux bénévoles, avec « réservée au rôle Bénévole ou Organisateur ». Les créneaux d'un événement ne s'ouvrent qu'aux membres de ses organisations : `benevole3` n'a pas le lien « Créneaux bénévoles » sur la soirée jeux, et l'adresse `/events/<id>/shifts` saisie à la main est refusée.
- **Couverture des créneaux** : connecté en `orga`, « Créneaux bénévoles » du tournoi de futsal : noms des inscrits sous chaque créneau, « Manque 1 » sur l'accueil et « Manque 2 » sur le rangement, puis « Bénévoles inscrits » avec l'organisation de chacun (`benevole2` est au BDE et au Club Sport) et « Retirer de l'événement ». Sur la soirée de rentrée, `orga` se voit lui-même sans bouton. Une fois l'invitation du BDE acceptée, `orga2` voit le tournoi de futsal sans pouvoir retirer `benevole3` (Club Sport seulement).
- **Pastille** : `benevole3` et `orga2` voient « Mes organisations » avec un compteur tant que leur invitation du BDE n'est pas traitée.

| Événement                          | Particularité                                                                 |
|------------------------------------|-------------------------------------------------------------------------------|
| Soirée de rentrée (dans 7 jours)   | Capacité 100, créneaux couverts : accueil (bénévoles) et buvette (`orga`)                                    |
| Tournoi de futsal (dans 14 jours)  | Trois créneaux : partiellement couvert, couvert, vide                         |
| Conférence IA (dans 21 jours)      | **Complète** (capacité 2) : pas de bouton « Réserver », l'API refuse aussi    |
| Atelier code créatif (dans 30 j.)  | Aucun billet, autre organisateur                                              |
| Soirée jeux (dans 2 heures)        | Personne n'est encore validé : pour essayer le check-in, un billet annulé     |
| Gala, tournoi de l'an dernier, conférence cybersécurité | Passés, billets validés ou non : historique pour la prédiction d'affluence |

Pour repartir d'une base vierge : `cd backend && npx prisma migrate reset` (détruit les données locales), puis `npm run db:seed`.

# Maquette
https://claude.ai/artifact/HZNcp6ANdFbVzhMhKKMDzR#page-dcb81aee8d83
