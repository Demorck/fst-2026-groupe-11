---
name: new-frontend-feature
description: Ajoute une fonctionnalité React dans frontend/src/features/<domaine> avec sa page et sa route. À utiliser pour construire l'interface d'events, tickets, volunteers, dashboard ou ai.
argument-hint: '<domaine> <fonctionnalité>'
---

# Nouvelle fonctionnalité frontend

Les pages (`EventsPage`, `CheckinPage`, `DashboardPage`, etc.) et leurs routes existent déjà comme coquilles. Le travail consiste à les remplir à partir d'un dossier `features/<domaine>/`.

## Étapes

1. Lire `frontend/src/pages/HealthPage.tsx` (modèle chargement/erreur), `frontend/src/api/client.ts` et `frontend/src/router.tsx`.
2. Créer dans `frontend/src/features/<domaine>/` (supprimer le `.gitkeep` dès que le dossier a du contenu) :
   - `types.ts` : types de réponse, écrits à la main pour refléter les DTO du backend (aucun code partagé entre les deux packages).
   - `api.ts` : fonctions qui appellent `apiFetch`.
   - `hooks/use<Quelque>.ts` : état de chargement, d'erreur et données.
   - `components/` : composants d'affichage du domaine.
3. Brancher la page dans `frontend/src/pages/` : elle compose les hooks et composants, sans logique métier.
4. Nouvelle route seulement si elle n'existe pas : l'ajouter dans `router.tsx` comme enfant de `RootLayout`. Ajouter un `NavLink` dans `layouts/RootLayout.tsx` si la page doit être accessible depuis le menu.
5. Lancer `npm run lint && npm run build` (le build vérifie les types avec `tsc -b`).
6. Contrôler dans le navigateur (`npm run dev`, http://localhost:5173) : état de chargement, erreur API, cas vide.

## Gabarits (imports avec extension, `import type` pour les types)

```ts
// features/events/api.ts
import { apiFetch } from '../../api/client.ts';
import type { EventSummary } from './types.ts';

export const listEvents = () => apiFetch<EventSummary[]>('/events');
```

```ts
// features/events/hooks/useEvents.ts
import { useEffect, useState } from 'react';
import { listEvents } from '../api.ts';
import type { EventSummary } from '../types.ts';

export function useEvents() {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEvents()
      .then(setEvents)
      .catch((err: Error) => setError(err.message));
  }, []);

  return { events, error, loading: !events && !error };
}
```

Interface en français, classes Tailwind, éléments sémantiques (`<button>`, `<label>`). Règles complètes dans `.claude/rules/frontend-react.md`.
