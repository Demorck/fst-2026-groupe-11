#!/usr/bin/env node
// PostToolUse hook: runs the root Prettier on the file Claude just edited.
// Scope mirrors `npm run format` (backend/src, backend/test, frontend/src).
// Never blocks: any problem ends with exit 0.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const prettier = resolve(root, 'node_modules/.bin/prettier');
const inScope = /^(backend\/(src|test)|frontend\/src)\//;
const generated = /(^|\/)(generated|node_modules|dist)\//;
const extensions = new Set(['.ts', '.tsx', '.css', '.json']);

let input = '';
for await (const chunk of process.stdin) input += chunk;

try {
  const file = JSON.parse(input).tool_input?.file_path;
  if (file && existsSync(prettier)) {
    const rel = relative(root, resolve(file)).split('\\').join('/');
    if (inScope.test(rel) && !generated.test(rel) && extensions.has(extname(rel))) {
      spawnSync(prettier, ['--write', '--log-level', 'warn', rel], {
        cwd: root,
        stdio: 'ignore',
      });
    }
  }
} catch {
  // malformed hook input: ignore
}
process.exit(0);
