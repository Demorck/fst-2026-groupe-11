# Workflow Git

- **Branches** : travail sur `major/<sujet>` (convention de l'historique), intégré dans `main` par Pull Request. Pas de push direct sur `main`.
- **Commits** : en anglais, courts et descriptifs, dans le style de l'historique (« Adding health controller and module »).
- **Jamais sans demande explicite** : `git commit`, `git push`, `git rebase`, `git reset --hard`, force-push. Claude prépare les changements, l'utilisateur décide de les commiter.
- **Ne jamais commiter** : `backend/.env`, `backend/src/generated/`, `dist/`, `graphify-out/`, `.claude/settings.local.json`, `CLAUDE.local.md`, `.claude-mem/`.
- **Un commit = un sujet** : ne pas mélanger config Claude, refactor et fonctionnalité.
