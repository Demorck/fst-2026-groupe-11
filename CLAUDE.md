# G-Event

@PROJECT.md
@README.md

## Langue

- Réponds en français. Code, identifiants, commentaires et messages de commit en anglais ; textes de l'interface et documentation en français.

## Pièges du dépôt (non évidents à la lecture du code)

- **Backend en ESM strict** : tout import relatif finit par `.js` (`'./app.module.js'`), même depuis un `.ts`. Ne pas utiliser `nest g resource` / `nest g module` tels quels : ils génèrent des imports sans extension.
- **Frontend** : imports relatifs avec l'extension réelle (`.ts`, `.tsx`). `erasableSyntaxOnly` interdit `enum`, `namespace` et les parameter properties ; `verbatimModuleSyntax` impose `import type` pour les types.
- **Client Prisma généré** : `backend/src/generated/` est gitignoré et ne se modifie jamais à la main. Il est régénéré par `npm run prisma:generate --prefix backend` (aussi au `postinstall`).
- **Migrations immuables** : une migration appliquée ne s'édite jamais, on en crée une nouvelle (skill `/db-migration`).
- **Appels API du front** : uniquement via `apiFetch` (chemins relatifs à `/api`), jamais `localhost:3000` en dur.
- **IA** : seul `LLM_PROVIDER=mock` existe. Aucun appel à un vrai LLM, aucune clé API dans le dépôt.
- **Hors périmètre** (PROJECT.md) : paiement réel, scan QR caméra, app mobile, emails/push réels, multi-organisation. Ne pas les implémenter, mocker si besoin.

## Avant de conclure une tâche

`npm run lint && npm test && npm run build` à la racine. Pour toucher à la base : `npm run db:up` d'abord.

## Outils

- Recherche dans le code : `graphify query` d'abord (section graphify ci-dessous), puis Grep/Read.
- Docs de bibliothèques (NestJS 12, Prisma 7, React Router 8, Vite 8, Tailwind 4, TypeScript 6) : plus récentes que la mémoire du modèle, interroger context7 plutôt que deviner.
- Skills du projet : `/new-backend-module`, `/new-frontend-feature`, `/db-migration`. Les règles détaillées par zone sont dans `.claude/rules/`.
- Plugins partagés : ponytail (code minimal) et caveman (réponses compressées). `/ponytail off` et `/caveman off` les désactivent pour la session.
- Ne jamais commit ni push sans demande explicite (`.claude/rules/git-workflow.md`).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
