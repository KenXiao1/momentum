import assert from 'node:assert/strict';
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
