import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateSemgrepReport } from '../semgrep-report.mjs';
import {
  requireSuccessfulRun,
  requireSuccessfulJobs,
} from '../release-gate.mjs';

const report = {
  version: '1.177.0',
  errors: [],
  results: [],
  paths: { scanned: ['src/main.tsx'] },
};
for (const [name, value] of [
  ['missing report', null],
  ['crashed scanner', { ...report, errors: [{ message: 'invalid severity' }] }],
  ['missing result array', { ...report, results: undefined }],
  ['empty scan', { ...report, paths: { scanned: [] } }],
  ['findings', { ...report, results: [{ check_id: 'security-rule' }] }],
]) {
  test(`rejects Semgrep ${name}`, () =>
    assert.throws(() => validateSemgrepReport(value)));
}
test('accepts a completed clean source scan', () =>
  assert.equal(validateSemgrepReport(report), 1));

const run = {
  id: 1,
  run_number: 3,
  run_attempt: 1,
  head_sha: 'abc',
  head_branch: 'main',
  event: 'push',
  status: 'completed',
  conclusion: 'success',
};
const target = { sha: 'abc', branch: 'main' };
for (const patch of [
  { head_sha: 'other' },
  { head_branch: 'feature' },
  { event: 'pull_request' },
  { status: 'in_progress' },
  { conclusion: 'failure' },
]) {
  test(`release rejects ${JSON.stringify(patch)}`, () =>
    assert.throws(() => requireSuccessfulRun([{ ...run, ...patch }], target)));
}
test('a newer failure cannot borrow an older green run', () => {
  assert.throws(() =>
    requireSuccessfulRun(
      [run, { ...run, run_number: 4, conclusion: 'failure' }],
      target,
    ),
  );
});
test('a passing run still requires the exact required job and SHA', () => {
  assert.equal(requireSuccessfulRun([run], target).id, 1);
  assert.throws(() => requireSuccessfulJobs([], 'abc'));
  assert.throws(() =>
    requireSuccessfulJobs(
      [{ name: 'required', ...run, head_sha: 'other' }],
      'abc',
    ),
  );
  assert.doesNotThrow(() =>
    requireSuccessfulJobs([{ name: 'required', ...run }], 'abc'),
  );
});

const { secretScanRange } = await import('../run-gitleaks.mjs');
test('secret scan uses complete event SHAs without a paginated commit list', () => {
  const base = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  assert.equal(
    secretScanRange('pull_request', {
      pull_request: { base: { sha: base }, head: { sha: head } },
    }),
    `${base}..${head}`,
  );
  assert.equal(
    secretScanRange('push', { before: base, after: head }),
    `${base}..${head}`,
  );
  assert.equal(
    secretScanRange('push', { before: '0'.repeat(40), after: head }),
    undefined,
  );
  assert.equal(secretScanRange('schedule', {}), undefined);
  assert.throws(() => secretScanRange('pull_request', {}));
  assert.throws(() =>
    secretScanRange('push', { before: '--all', after: head }),
  );
  assert.throws(() => secretScanRange('unexpected', {}));
});

test('native releases collect only desktop packages and updater metadata', () => {
  const workflow = readFileSync(
    new URL('../../../.github/workflows/tauri-build.yml', import.meta.url),
    'utf8',
  );
  const publication = workflow.split('\n  create-release:\n')[1];
  assert.ok(publication, 'release job must exist');
  assert.match(
    publication,
    /^    if: github\.event_name == 'push' && startsWith\(github\.ref, 'refs\/tags\/v'\)$/m,
    'manual dispatch must not publish a release, including a dispatch at a tag',
  );
  const downloads = publication
    .split(/\n      - /)
    .filter((step) => step.includes('uses: actions/download-artifact@'));
  assert.equal(downloads.length, 3);
  assert.deepEqual(
    downloads.map((step) => step.match(/^          name: (.+)$/m)?.[1]).sort(),
    ['linux-artifacts', 'macos-artifacts', 'windows-artifacts'],
  );
  const files = publication.match(
    /^          files: \|\n((?:            .+\n)+)/m,
  )?.[1];
  assert.ok(files, 'release assets must use an explicit allowlist');
  const patterns = files
    .trim()
    .split('\n')
    .map((line) => line.trim());
  assert.ok(patterns.includes('artifacts/latest.json'));
  // upload-artifact preserves bundle subdirectories across its multiple paths.
  for (const extension of [
    'exe',
    'msi',
    'dmg',
    'app.tar.gz',
    'deb',
    'AppImage',
  ]) {
    assert.ok(patterns.includes(`artifacts/**/*.${extension}`));
  }
  for (const pattern of patterns) {
    assert.match(
      pattern,
      /^artifacts\/(?:\*\*\/\*\.(?:exe|msi|dmg|app\.tar\.gz|deb|AppImage)(?:\.sig)?|latest\.json)$/,
      `unexpected public release asset pattern: ${pattern}`,
    );
  }
  assert.doesNotMatch(publication, /Sideload install|\*\*Android\*\*/);
  assert.match(workflow, /name: android-development-artifacts/);
  assert.match(workflow, /app-universal-release-unsigned\.apk/);
  assert.doesNotMatch(workflow, /TARGET_APK=/);
});
