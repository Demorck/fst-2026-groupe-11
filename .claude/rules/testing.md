---
paths:
  - '**/*.spec.ts'
  - '**/*.e2e-spec.ts'
  - 'backend/test/**'
---

# Tests

- **Vitest avec `globals: true`** : pas d'import de `describe`, `it`, `expect`. Les tests unitaires sont des `*.spec.ts` à côté du code (`npm test`) ; les e2e sont dans `backend/test/*.e2e-spec.ts` (`npm run test:e2e --prefix backend`). Les imports relatifs finissent par `.js`.
- **Aucune dépendance externe** : pas de Postgres, de réseau ni de vrai LLM. Utiliser `Test.createTestingModule(...)` avec `overrideProvider(PrismaService).useValue({...})` (voir `app.e2e-spec.ts`).
- **Cas métier à couvrir en priorité** : pas de sur-réservation au-delà de la capacité d'un événement ; unicité des codes de billet ; un bénévole ne s'inscrit pas deux fois sur le même créneau ; check-in refusé si déjà validé ; couverture bénévoles correcte dans le dashboard.
- **Frontend** : aucun runner de test n'est installé. Ne pas en supposer un ; en ajouter un (Vitest et Testing Library dans `frontend/`) est une décision à documenter dans `frontend/README.md`.
