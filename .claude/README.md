# Configuration Claude Code

Ce dossier configure Claude Code pour G-Event. Tout ce qui est ici est commité et partagé, sauf `settings.local.json` (perso, ignoré par git).

## Contenu

| Élément | Rôle |
| --- | --- |
| `../CLAUDE.md` | Instructions chargées à chaque session (importe `PROJECT.md` et `README.md`) |
| `rules/` | Règles par zone. Celles avec `paths:` ne se chargent que sur les fichiers concernés |
| `skills/new-backend-module`, `new-frontend-feature`, `db-migration` | Skills du projet : `/new-backend-module`, `/new-frontend-feature`, `/db-migration <nom>` |
| `skills/` (autres) | Skills tiers, voir plus bas |
| `settings.json` | Plugins partagés, permissions, hooks |
| `hooks/format-on-edit.mjs` | Passe Prettier sur chaque fichier édité par Claude |
| `../.mcp.json` | Serveur MCP context7 (docs de bibliothèques à jour). Claude Code demande une approbation au premier usage |
| `../.graphifyignore` | Exclut `.claude/` du graphe de code graphify |

## Mise en place sur votre machine

À l'ouverture du dossier, Claude Code propose d'installer les plugins déclarés dans `settings.json` : **ponytail** (code minimal), **caveman** (réponses compressées) et **frontend-design**. Acceptez ou refusez.

**graphify** (graphe de code) demande un binaire local. Sans lui, les hooks sont sans effet, mais `/graphify` tenterait d'installer le paquet via pip : installez-le d'abord avec `uv`.

```bash
brew install uv                 # autres méthodes : https://docs.astral.sh/uv/
uv tool install graphifyy       # attention : deux « y »
uv tool update-shell            # seulement si `graphify` reste introuvable, puis rouvrir le terminal
graphify update .               # construit le graphe (AST seul, aucun coût API)
graphify hook install           # reconstruit le graphe à chaque commit et checkout
```

`graphify hook install` crée un `.gitattributes` inutile ici (le graphe n'est pas versionné) : ne le commitez pas. `graphify-out/` est ignoré par git car `graph.json` change à chaque commit et provoquerait des conflits.

## Désactiver un plugin partagé pour vous seul

Dans `.claude/settings.local.json` (ignoré par git) :

```json
{ "enabledPlugins": { "caveman@caveman": false } }
```

## claude-mem (optionnel, perso)

Mémoire persistante entre sessions. Non déclaré dans le dépôt : il enregistre l'activité de vos sessions dans `~/.claude-mem` et consomme du quota pour la compression.

```bash
claude plugin marketplace add thedotmack/claude-mem --scope local
claude plugin install claude-mem@thedotmack --scope local
```

Entourez de `<private>...</private>` ce qui ne doit pas être mémorisé.

## Skills tiers installés

Installés avec `npx skills add <dépôt> -s <skill> -a claude-code --copy` (versions verrouillées dans `../skills-lock.json`, mise à jour avec `npx skills update`).

| Skill | Dépôt |
| --- | --- |
| `prisma-cli`, `prisma-client-api` | `prisma/skills` |
| `nestjs-best-practices` | `Kadajett/agent-nestjs-skills` |
| `supabase-postgres-best-practices` | `supabase/agent-skills` |
| `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines` | `vercel-labs/agent-skills` |
| `vite`, `vitest` | `antfu/skills` |
| `tailwind-design-system` | `wshobson/agents` |
| `graphify` | installé par `graphify install --project` |

Deux limites à connaître :

- `nestjs-best-practices` et `vercel-react-best-practices` sont génériques (TypeORM et repository pattern d'un côté, Next.js de l'autre). En cas de conflit, les règles de `rules/` et de `CLAUDE.md` priment.
- `web-design-guidelines` télécharge ses règles depuis `raw.githubusercontent.com` (branche `main` de `vercel-labs`) à chaque utilisation, via WebFetch. Ce contenu distant n'est ni versionné ni verrouillé : supprimez le skill (`npx skills remove web-design-guidelines`) si cela vous gêne.
