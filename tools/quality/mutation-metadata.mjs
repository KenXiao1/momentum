import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CRITICAL_MUTATION_TARGETS,
  CRITICAL_MUTATION_TEST_FILES,
  CRITICAL_MUTATION_THRESHOLDS,
  FULL_MUTATION_SCOPE,
} from './mutation-scope.mjs';

export const MUTATION_MODES = Object.freeze({
  nightly: Object.freeze({
    mode: 'nightly',
    configFile: 'stryker.config.mjs',
    configDependencies: ['stryker.config.mjs', 'vitest.config.ts'],
    reportFile: 'reports/mutation/mutation.json',
    metadataFile: 'reports/mutation/mutation-metadata.json',
    qualityReportFile: 'reports/quality/test-mutation-hotspots.json',
    mutate: FULL_MUTATION_SCOPE,
    testFiles: [],
    perFileThresholds: null,
  }),
  critical: Object.freeze({
    mode: 'critical',
    configFile: 'stryker.critical.config.mjs',
    configDependencies: [
      'stryker.critical.config.mjs',
      'stryker.config.mjs',
      'vitest.config.ts',
    ],
    reportFile: 'reports/mutation/critical.json',
    metadataFile: 'reports/mutation/critical-metadata.json',
    qualityReportFile: 'reports/quality/test-mutation-critical.json',
    mutate: CRITICAL_MUTATION_TARGETS,
    testFiles: CRITICAL_MUTATION_TEST_FILES,
    perFileThresholds: CRITICAL_MUTATION_THRESHOLDS,
  }),
});

export function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function resolveMutationMode(mode) {
  const descriptor = MUTATION_MODES[mode];
  if (!descriptor) {
    throw new Error(
      `Unknown mutation mode "${mode}". Expected one of: ${Object.keys(MUTATION_MODES).join(', ')}.`,
    );
  }
  return descriptor;
}

export function getGitHead(repoRoot) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

export async function computeWorkspaceHash(repoRoot) {
  const hash = crypto.createHash('sha256');
  const trackedDiff = execFileSync(
    'git',
    ['diff', '--binary', '--no-ext-diff', 'HEAD', '--', '.'],
    { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const untrackedOutput = execFileSync(
    'git',
    ['ls-files', '--others', '--exclude-standard', '-z'],
    { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] },
  ).toString('utf8');
  const untrackedFiles = untrackedOutput
    .split('\0')
    .filter(Boolean)
    .map(normalizePath)
    .sort();

  hash.update(trackedDiff);
  for (const file of untrackedFiles) {
    hash.update(`\0${file}\0`);
    hash.update(await fs.readFile(path.join(repoRoot, file)));
  }

  return hash.digest('hex');
}

export async function computeConfigHash(repoRoot, descriptor) {
  const hash = crypto.createHash('sha256');
  for (const file of descriptor.configDependencies) {
    hash.update(`\0${file}\0`);
    hash.update(await fs.readFile(path.join(repoRoot, file)));
  }
  return hash.digest('hex');
}

export function computeScopeHash(descriptor) {
  return sha256(
    JSON.stringify({
      mutate: descriptor.mutate,
      testFiles: descriptor.testFiles,
      perFileThresholds: descriptor.perFileThresholds,
    }),
  );
}

export async function getStrykerVersion(repoRoot) {
  const packageJson = JSON.parse(
    await fs.readFile(
      path.join(
        repoRoot,
        'node_modules',
        '@stryker-mutator',
        'core',
        'package.json',
      ),
      'utf8',
    ),
  );
  return packageJson.version;
}
