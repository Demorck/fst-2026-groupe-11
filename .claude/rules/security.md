# Sécurité

- **Secrets** : ne jamais lire, afficher ni commiter `backend/.env` (les permissions du projet le refusent). Nouvelle variable d'environnement : l'ajouter à `backend/.env.example` **et** à `backend/src/config/env.validation.ts`.
- **Rôles** : `ORGANIZER`, `VOLUNTEER`, `PARTICIPANT` (enum Prisma `Role`). L'autorisation se fait côté backend avec des guards dans `backend/src/common/guards/`. Ne jamais se fier à un rôle envoyé par le client ni à un simple masquage dans l'interface.
- **DTO** : le `ValidationPipe` global a `whitelist: true`, donc toute propriété sans décorateur class-validator est **supprimée silencieusement**. Décorer chaque champ d'un DTO.
- **Codes de billet** : uniques et non devinables, avec une contrainte `@unique` en base (pas seulement un contrôle dans le service).
- **Aucun secret dans le code ni dans les tests** : pas de clé API, pas de mot de passe réel. Le paiement en ligne est hors périmètre.
