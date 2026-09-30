# Style de code

- **Prettier** : `singleQuote` et `trailingComma: all` (config racine et backend identiques). Le hook `.claude/hooks/format-on-edit.mjs` formate à chaque édition ; à défaut, `npm run format`.
- **oxlint** (`npm run lint`) : corriger les avertissements plutôt que les désactiver, en particulier `no-floating-promises` (backend) et `react/rules-of-hooks` (frontend, niveau error).
- **Langue** : identifiants et commentaires en anglais, textes d'interface et documentation en français.
- **Commentaires** : courts, pour expliquer le _pourquoi_ seulement (voir `health.controller.ts`), jamais pour paraphraser le code.
- **Dépendances** : vérifier d'abord que Node, Nest, React ou Tailwind ne couvrent pas déjà le besoin. Installer dans le bon package (`npm install <pkg> --prefix backend` ou `--prefix frontend`) ; la racine ne contient que l'outillage de dev commun (`concurrently`, `prettier`).
- **Lockfiles** : jamais édités à la main, et les changements sans rapport avec la tâche ne sont pas inclus.
