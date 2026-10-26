# G-Event — Backend

API REST NestJS + PostgreSQL (Prisma 7).

## Démarrage

```bash
npm install            # lance aussi `prisma generate`
cp .env.example .env
npm run db:up          # Postgres via docker compose
npm run prisma:migrate # applique les migrations
npm run start:dev
```

- API : http://localhost:3000/api
- Swagger : http://localhost:3000/api/docs

## Structure

```
src/
├── config/        validation des variables d'environnement
├── prisma/        PrismaService global (client généré dans src/generated/, non versionné)
├── common/        décorateurs, guards, filtres partagés
└── modules/
    ├── auth/        authentification et rôles
    ├── users/       comptes (organisateur, bénévole, participant)
    ├── events/      création et consultation des événements
    ├── tickets/     réservations et check-in
    ├── volunteers/  créneaux bénévoles et affectations
    ├── dashboard/   suivi (inscriptions, remplissage, couverture)
    └── ai/
        ├── prediction/     prédiction d'affluence (`POST /api/ai/attendance-prediction`, organisateurs) : moyenne des taux de remplissage des événements passés, pondérée par catégorie, saison et capacité
        └── communication/  génération de textes (LlmProvider, mock par défaut)
```

## Scripts utiles

| Script | Rôle |
| --- | --- |
| `npm run db:up` / `db:down` | Démarre / arrête Postgres |
| `npm run prisma:migrate` | Crée et applique une migration |
| `npm run prisma:studio` | Explorateur de données |
| `npm test` / `npm run test:e2e` | Tests unitaires / e2e (vitest) |
| `npm run lint` | oxlint |
