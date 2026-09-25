import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requiresFullCi, requireCiJobs } from '../ci-scope.mjs';

const applicationJobs = [
  'static',
  'tests',
  'rust',
  'build',
  'dependencies',
  'e2e',
  'database',
  'semgrep',
];

test('classifies complete PR diffs with real Git, including renames and an advancing base', async (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'momentum-ci-scope-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), text);
  };
  const commit = () => {
    git('add', '.');
    git('commit', '-qm', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  const event = (base, head) => ({
    pull_request: { base: { sha: base }, head: { sha: head } },
  });
  git('init', '-q', '-b', 'base');
  git('config', 'user.name', 'CI Test');
  git('config', 'user.email', 'ci@example.invalid');
  write('README.md', '# Example\n');
  write('src/code.js', 'export const value = 1;\n');
  const base = commit();

  await t.test(
    'README-only PR is docs-only even after code changes on its base',
    () => {
      git('switch', '-qc', 'docs-change', base);
      write('README.md', '# Updated example\n');
      const head = commit();
      assert.equal(
        requiresFullCi('pull_request', event(base, head), cwd),
        false,
      );
      git('switch', '-q', 'base');
      write('src/code.js', 'export const value = 2;\n');
      const advancedBase = commit();
      assert.equal(
        requiresFullCi('pull_request', event(advancedBase, head), cwd),
        false,
      );
      assert.equal(requiresFullCi('push', event(base, head), cwd), true);
      assert.equal(
        requiresFullCi('workflow_dispatch', event(base, head), cwd),
        true,
      );
    },
  );

  await t.test(
    'renaming source to Markdown cannot bypass application checks',
    () => {
      git('switch', '-qc', 'rename-source', base);
      fs.mkdirSync(path.join(cwd, 'docs'));
      git('mv', 'src/code.js', 'docs/code.md');
      assert.equal(
        requiresFullCi('pull_request', event(base, commit()), cwd),
        true,
      );
    },
  );

  await t.test(
    'a code change beyond 300 documentation files still runs full CI',
    () => {
      git('switch', '-qc', 'large-diff', base);
      for (let i = 0; i < 305; i++) write(`docs/page-${i}.md`, '# Example\n');
      write('src/code.js', 'export const value = 3;\n');
      assert.equal(
        requiresFullCi('pull_request', event(base, commit()), cwd),
        true,
      );
    },
  );

  await t.test('unknown or executable files are not documentation', () => {
    git('switch', '-qc', 'workflow-change', base);
    write('.github/workflows/ci.yml', 'name: changed\n');
    assert.equal(
      requiresFullCi('pull_request', event(base, commit()), cwd),
      true,
    );
  });

  await t.test(
    'an empty diff or invalid event cannot select the lightweight lane',
    () => {
      assert.equal(
        requiresFullCi('pull_request', event(base, base), cwd),
        true,
      );
      assert.throws(
        () => requiresFullCi('pull_request', {}, cwd),
        /valid.*SHAs/,
      );
      assert.throws(
        () => requiresFullCi('pull_request', event('--all', base), cwd),
        /valid.*SHAs/,
      );
    },
  );
});

function completedJobs(full) {
  return {
    changes: { result: 'success', outputs: { full: String(full) } },
    docs: { result: full ? 'skipped' : 'success' },
    secrets: { result: 'success' },
    ...Object.fromEntries(
      applicationJobs.map((name) => [
        name,
        { result: full ? 'success' : 'skipped' },
      ]),
    ),
  };
}

for (const full of [true, false]) {
  test(`required accepts successful applicable jobs for full=${full}`, () => {
    assert.doesNotThrow(() => requireCiJobs(completedJobs(full)));
  });
  test(`required rejects failed, cancelled or missing jobs for full=${full}`, () => {
    for (const name of ['changes', 'docs', 'secrets', ...applicationJobs]) {
      for (const result of ['failure', 'cancelled', undefined]) {
        const jobs = completedJobs(full);
        jobs[name].result = result;
        assert.throws(() => requireCiJobs(jobs), /CI (scope|job)/);
      }
    }
  });
}

test('required only accepts skips explicitly authorized by a successful scope decision', () => {
  for (const name of ['secrets', ...applicationJobs]) {
    const jobs = completedJobs(true);
    jobs[name].result = 'skipped';
    assert.throws(() => requireCiJobs(jobs), /Required CI job/);
  }
  for (const name of ['docs', 'secrets']) {
    const jobs = completedJobs(false);
    jobs[name].result = 'skipped';
    assert.throws(() => requireCiJobs(jobs), /Required CI job/);
  }
  for (const value of [undefined, '', 'unknown']) {
    const jobs = completedJobs(false);
    jobs.changes.outputs.full = value;
    assert.throws(() => requireCiJobs(jobs), /scope detection/);
  }
});

test('CI wires scope and the aggregate without duplicate feature-branch push runs', () => {
  const workflow = fs.readFileSync(
    new URL('../../../.github/workflows/ci.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /push:\s+branches: \[new-feature-branch\]/);
  assert.match(workflow, /^  pull_request:/m);
  assert.doesNotMatch(workflow, /paths-ignore:|paths:/);
  for (const name of [...applicationJobs, 'info']) {
    assert.match(
      workflow,
      new RegExp(
        `  ${name}:\n    needs: changes\n    if: needs.changes.outputs.full == 'true'`,
      ),
    );
  }
  assert.match(workflow, /  secrets:\n    uses: .*gitleaks.yml/);
  const required = workflow.split('\n  required:\n')[1].split('\n  info:\n')[0];
  assert.match(required, /if: always\(\)/);
  const needs = required
    .match(/needs:\s*\[([\s\S]*?)\]/)[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  assert.deepEqual(
    needs.sort(),
    ['changes', 'docs', 'secrets', ...applicationJobs].sort(),
  );
  assert.match(required, /node tools\/quality\/ci-scope.mjs --check/);
});
