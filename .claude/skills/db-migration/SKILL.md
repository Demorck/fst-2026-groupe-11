---
name: db-migration
description: Modifie le schéma Prisma et crée la migration correspondante. À lancer explicitement avec /db-migration <nom-de-la-migration>.
argument-hint: '<nom-migration>'
disable-model-invocation: true
---

# Migration de base de données (Prisma 7)

Nom de la migration demandé : `$ARGUMENTS` (en `snake_case`, par exemple `add_event_model`). S'il est vide, le demander avant de continuer.

## Étapes

1. Démarrer Postgres : `npm run db:up` (Docker, port 5433) et attendre qu'il accepte les connexions.
2. Éditer `backend/prisma/schema.prisma` en suivant `.claude/rules/backend-prisma.md` (uuid, `createdAt`/`updatedAt`, enums, contraintes).
3. Créer et appliquer la migration : `npm run prisma:migrate --prefix backend -- --name $ARGUMENTS`. Cette commande régénère aussi le client dans `backend/src/generated/`.
4. **Si Prisma propose de réinitialiser la base** (dérive ou conflit) : s'arrêter et demander à l'utilisateur, cela détruit les données locales. Ne jamais lancer `migrate reset` de sa propre initiative.
5. Relire `backend/prisma/migrations/<horodatage>_$ARGUMENTS/migration.sql` : pas de `DROP` inattendu, et toute colonne `NOT NULL` ajoutée à une table existante a une valeur par défaut.
6. Adapter le code qui utilise le modèle **et le seed** (`backend/prisma/seed.ts`, règles dans `CLAUDE.md`, section « Données de démo ») : nouveau modèle ou colonne = données de démo, cas limites compris. Lancer `npm run db:seed` deux fois.
7. Lancer `npm run lint && npm test && npm run build`.
8. Rappeler à l'utilisateur de commiter ensemble `schema.prisma` et le dossier de migration. Ne pas commiter soi-même.

Une migration déjà appliquée ne se modifie jamais : pour corriger, créer une nouvelle migration.
