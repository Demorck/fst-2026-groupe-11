---
paths:
  - 'frontend/src/**'
---

# Frontend React

- **Structure** : `pages/` (une par route, fine), `features/<domaine>/` (composants, hooks et types du domaine, mêmes noms de domaines que le backend), `components/` (UI partagée), `layouts/`, `api/client.ts`.
- **Imports** : avec l'extension réelle (`'../api/client.ts'`). Les types s'importent avec `import type` (`verbatimModuleSyntax`).
- **Syntaxe effaçable** (`erasableSyntaxOnly`) : pas d'`enum`, de `namespace` ni de parameter properties. Utiliser des unions (`'A' | 'B'`) ou `as const`.
- **Pages** : `export default function XxxPage()`. Les routes se déclarent dans `router.tsx` (`createBrowserRouter`), comme enfants de `RootLayout`.
- **Données** : `apiFetch<T>('/chemin')` uniquement, avec un état de chargement et un état d'erreur (modèle : `HealthPage`). Pas de bibliothèque de fetch ou de state ajoutée sans en justifier le besoin.
- **Style** : classes utilitaires Tailwind 4. Pas de `tailwind.config.js` : la configuration se fait en CSS (`@theme` dans `index.css`) si nécessaire.
- **Interface** : textes en français, accessible (labels de formulaire, vrais `<button>`, focus visible). Le check-in (recherche puis validation manuelle) doit être utilisable au clavier.
- **Lint** : un fichier de composant n'exporte que des composants (`react/only-export-components`).
- **Skill `vercel-react-best-practices`** : orienté Next.js. Ignorer ce qui concerne les Server Components, les server actions et `next/*` : ce projet est une SPA Vite.
