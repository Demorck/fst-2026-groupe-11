# Sécurité

- **Secrets** : ne jamais lire, afficher ni commiter `backend/.env` (les permissions du projet le refusent). Nouvelle variable d'environnement : l'ajouter à `backend/.env.example` **et** à `backend/src/config/env.validation.ts`.
- **Rôles** : `ORGANIZER`, `VOLUNTEER`, `PARTICIPANT` (enum Prisma `Role`). L'autorisation se fait côté backend avec des guards dans `backend/src/common/guards/`. Ne jamais se fier à un rôle envoyé par le client ni à un simple masquage dans l'interface.
- **Droits sur un événement** : ils passent par l'appartenance à une organisation qui le gère (`OrganizationsService.canManageEvent` pour gérer, `isVolunteerOfEvent` pour s'inscrire comme bénévole), jamais par `Event.organizerId` seul (qui n'est que l'auteur). Un événement a toujours au moins une organisation.
- **Logo** : seuls PNG, JPEG et WebP sont acceptés, reconnus par leur signature et non par le `Content-Type` du client (pas de SVG, servi depuis notre origine il pourrait exécuter un script). Servi avec `nosniff`, 512 Ko maximum.
- **DTO** : le `ValidationPipe` global a `whitelist: true`, donc toute propriété sans décorateur class-validator est **supprimée silencieusement**. Décorer chaque champ d'un DTO.
- **Codes de billet** : uniques et non devinables, avec une contrainte `@unique` en base (pas seulement un contrôle dans le service).
- **Aucun secret dans le code ni dans les tests** : pas de clé API, pas de mot de passe réel. Le paiement en ligne est hors périmètre.
