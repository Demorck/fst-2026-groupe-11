---
paths:
  - 'backend/prisma/**'
  - 'backend/src/prisma/**'
---

# Prisma 7 et PostgreSQL

- **Connexion** : l'URL vient de `DATABASE_URL` via `backend/prisma.config.ts` (le bloc `datasource` de `schema.prisma` n'a pas d'`url`). À l'exécution, `PrismaService` passe par `@prisma/adapter-pg`.
- **Générateur** : `prisma-client` avec `output = "../src/generated/prisma"`, `moduleFormat = "esm"`, `importFileExtension = "js"`. Ne pas modifier ces options, le backend en dépend.
- **Changer le schéma** : éditer `schema.prisma`, puis `npm run prisma:migrate --prefix backend -- --name <nom>` (Postgres doit tourner : `npm run db:up`, port 5433). Relire le SQL généré avant de conclure. Voir le skill `/db-migration`.
- **Migrations immuables** : ne jamais éditer ni supprimer une migration existante (les permissions du projet le refusent).
- **Conventions de modèle** (voir `User`) : `id String @id @default(uuid())`, `createdAt` et `updatedAt`, enum Prisma pour les valeurs fermées, contraintes et index (`@unique`, `@@index`) déclarés dans le schéma.
- **Octets** : une colonne `Bytes` (le logo d'une organisation) se charge explicitement (`select`) et s'exclut des listes avec `omit: { logo: true }`, sinon chaque liste renvoie jusqu'à 512 Ko par ligne.
- **Historique** : les inscriptions passées alimentent la prédiction d'affluence. Ne pas supprimer physiquement billets ni inscriptions, utiliser un statut (annulé, etc.).
