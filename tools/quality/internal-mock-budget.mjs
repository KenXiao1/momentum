import fs from 'node:fs/promises';
import path from 'node:path';
import { compareToBaseline, findInternalMocks } from './internal-mocks.mjs';

const repoRoot = process.cwd();
const baselinePath = path.join(
  repoRoot,
  'tools',
  'quality',
  'internal-mock-baseline.json',
);
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const update = process.argv.includes('--update');

async function listTestFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listTestFiles(absolute)));
    else if (TEST_FILE.test(entry.name) || absolute.includes('__tests__'))
      files.push(absolute);
  }
  return files;
}

const counts = {};
for (const file of await listTestFiles(path.join(repoRoot, 'src'))) {
  const mocks = findInternalMocks(await fs.readFile(file, 'utf8'));
  if (mocks.length > 0) {
    counts[path.relative(repoRoot, file).replace(/\\/g, '/')] = mocks.length;
  }
}
const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

if (update) {
  const sorted = Object.fromEntries(Object.entries(counts).sort());
  await fs.writeFile(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`[internal-mocks] baseline written: ${total} internal mocks.`);
  process.exit(0);
}

const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
const { increases, decreases } = compareToBaseline(counts, baseline);

if (increases.length > 0) {
  console.error(
    '[internal-mocks] These test files mock more project modules than allowed.\n' +
      'Use createTestStorage() or the real module and assert on its results;\n' +
      'mock only packages and native/cloud boundaries.',
  );
  for (const { file, now, allowed } of increases)
    console.error(`  ${file}: ${now} (allowed ${allowed})`);
  process.exit(1);
}

const hint =
  decreases.length > 0
    ? ` ${decreases.length} file(s) dropped below the baseline; run "npm run quality:test:internal-mocks -- --update" to lock that in.`
    : '';
console.log(`[internal-mocks] PASSED: ${total} internal mocks.${hint}`);
