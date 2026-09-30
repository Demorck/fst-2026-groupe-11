---
paths:
  - 'backend/src/**'
  - 'backend/test/**'
---

# Backend NestJS

- **Un module par domaine** dans `src/modules/<domaine>/` : `<domaine>.module.ts`, `.controller.ts`, `.service.ts`, `dto/`. Le module est enregistré dans `AppModule`. Modèle à copier : `modules/health/`.
- **ESM** : tout import relatif finit par `.js`. Le client Prisma s'importe depuis `../generated/prisma/client.js`, jamais depuis `@prisma/client`.
- **Base de données** : uniquement via `PrismaService` injecté (global grâce à `PrismaModule`). Jamais de `new PrismaClient()`.
- **Injection** : un type de classe injecté dans un constructeur s'importe comme une valeur, pas avec `import type`, sinon `emitDecoratorMetadata` perd le token et l'injection échoue. Les interfaces passent par un token (`@Inject(LLM_PROVIDER)`).
- **Controllers fins** : validation puis délégation au service, la logique métier vit dans le service.
- **API** : le préfixe `api` est déjà posé dans `main.ts`, ne pas le répéter dans `@Controller`. Chaque controller porte `@ApiTags('<domaine>')` ; chaque DTO décore ses champs avec class-validator **et** `@ApiProperty()` (Swagger sur `/api/docs`).
- **Erreurs** : exceptions Nest (`NotFoundException`, `ConflictException`, etc.) ; filtres partagés dans `src/common/filters/`.
- **Configuration** : `ConfigService.getOrThrow`, jamais `process.env` directement ; les variables sont déclarées dans `config/env.validation.ts`.
- **Skill `nestjs-best-practices`** : générique (TypeORM, repository pattern, etc.). En cas de conflit avec ces règles, ce sont elles qui priment : pas de couche repository par-dessus Prisma.
