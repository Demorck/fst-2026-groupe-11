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
        └── communication/  génération de textes et d'images (LlmProvider, mock par défaut)
```

### Fournisseurs IA

Deux fournisseurs gratuits, un par besoin, chacun avec un repli sur le mock (CI, démo sans clé) :

| Besoin | Fournisseur | Variables (`backend/.env`) |
| --- | --- | --- |
| Texte (`LlmProvider`) | **Google Gemini**, clé gratuite créée sur [aistudio.google.com](https://aistudio.google.com) | `LLM_PROVIDER=mock\|gemini`, `GEMINI_API_KEY`, `GEMINI_TEXT_MODEL` (facultatif) |
| Image (`ImageProvider`) | **Cloudflare Workers AI** (Stable Diffusion XL Lightning, gratuit dans la limite du quota quotidien) | `IMAGE_PROVIDER=mock\|cloudflare`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (permission « Workers AI » seulement) |

Les images sont des **affiches** en portrait au ratio des formats A (1:1,414), 832 × 1176 px : c'est la taille où le modèle reste net, il faudra les agrandir pour imprimer en A3 ou plus. Les mots que le modèle écrit dans l'image sont souvent déformés : mieux vaut ne pas lui demander de texte et l'ajouter par-dessus.

Pourquoi deux : Gemini refuse la génération d'image sur le gratuit (429, quota à 0, testé le 26/10/2026 sur 5 modèles), alors que le compte Google AI Pro étudiant et GitHub Copilot ne donnent pas d'accès API. Les clés ne sont jamais commitées ; les modèles changent souvent et les quotas aussi, à vérifier dans AI Studio et le dashboard Cloudflare. Les tests et la CI utilisent toujours les mocks.

## Scripts utiles

| Script | Rôle |
| --- | --- |
| `npm run db:up` / `db:down` | Démarre / arrête Postgres |
| `npm run prisma:migrate` | Crée et applique une migration |
| `npm run prisma:studio` | Explorateur de données |
| `npm test` / `npm run test:e2e` | Tests unitaires / e2e (vitest) |
| `npm run lint` | oxlint |
