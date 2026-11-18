import fs from 'node:fs/promises';
import path from 'node:path';
import { findErrorHandlingViolations } from './error-handling.mjs';

const repoRoot = process.cwd();
const SOURCE = /\.(ts|tsx)$/;
const TEST = /\.(test|spec)\.[cm]?[jt]sx?$/;

async function listSources(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === '__tests__' ||
        absolute.endsWith(path.join('src', 'test'))
      )
        continue;
      files.push(...(await listSources(absolute)));
    } else if (SOURCE.test(entry.name) && !TEST.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files;
}

const violations = [];
for (const file of await listSources(path.join(repoRoot, 'src'))) {
  const relative = path.relative(repoRoot, file).replace(/\\/g, '/');
  for (const violation of findErrorHandlingViolations(
    await fs.readFile(file, 'utf8'),
  )) {
    violations.push({ file: relative, ...violation });
  }
}

if (violations.length > 0) {
  console.error(
    '[error-handling] See tools/quality/error-handling.mjs for the rules.',
  );
  for (const { file, line, rule, name } of violations)
    console.error(`  ${file}:${line} ${rule}${name ? ` in ${name}` : ''}`);
  process.exit(1);
}
console.log('[error-handling] PASSED: no log-and-rethrow or swallowed writes.');
