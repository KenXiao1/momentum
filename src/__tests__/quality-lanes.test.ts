import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const REPO_ROOT = process.cwd();
const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'momentum-quality-'));
  tempDirs.push(dir);
  return dir;
}

describe('quality lane tooling', () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
    vi.restoreAllMocks();
  });

  it('binds coverage reports to the current commit and coverage configuration', async () => {
    const {
      createCoverageMetadata,
      assertFreshCoverageMetadata,
      isCoverageWorkspaceFile,
    } = await import('../../tools/quality/coverage-metadata.mjs');

    expect(
      isCoverageWorkspaceFile(
        'src/components/__architecture_violation_fixture__.ts',
      ),
    ).toBe(false);
    expect(isCoverageWorkspaceFile('src/components/NewFeature.tsx')).toBe(true);

    const metadata = await createCoverageMetadata(REPO_ROOT);

    await expect(
      assertFreshCoverageMetadata(REPO_ROOT, metadata),
    ).resolves.toBeUndefined();
    await expect(
      assertFreshCoverageMetadata(REPO_ROOT, {
        ...metadata,
        headSha: 'stale-head',
      }),
    ).rejects.toThrow(/Coverage report is stale/);
    await expect(
      assertFreshCoverageMetadata(REPO_ROOT, {
        ...metadata,
        workspaceHash: 'stale-worktree',
      }),
    ).rejects.toThrow(/source or test files changed/);
  });

  it('runs every check and distinguishes pass, fail, stale, and blocked', async () => {
    const tempDir = await makeTempDir();
    const freshReportPath = path.join(tempDir, 'fresh.json');
    const staleReportPath = path.join(tempDir, 'stale.json');

    await fs.writeFile(staleReportPath, JSON.stringify({ ok: true }), 'utf8');

    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { runLane } = await import('../../tools/quality/quality-runner.mjs');

    const seen: string[] = [];
    const result = await runLane({
      laneId: 'test',
      repoRoot: tempDir,
      checks: [
        {
          id: 'pass-check',
          label: 'Pass check',
          script: 'quality:pass',
          reports: [freshReportPath],
        },
        {
          id: 'fail-check',
          label: 'Fail check',
          script: 'quality:fail',
          reports: [],
        },
        {
          id: 'stale-check',
          label: 'Stale check',
          script: 'quality:stale',
          reports: [staleReportPath],
        },
        {
          id: 'blocked-check',
          label: 'Blocked check',
          script: 'quality:blocked',
          reports: [path.join(tempDir, 'missing.json')],
        },
      ],
      executeCheck: async (check: { id: string }) => {
        seen.push(check.id);

        if (check.id === 'pass-check') {
          await fs.writeFile(
            freshReportPath,
            JSON.stringify({ ok: true }),
            'utf8',
          );
          return { exitCode: 0, stdout: 'ok', stderr: '' };
        }

        if (check.id === 'fail-check') {
          return { exitCode: 1, stdout: '', stderr: 'failed' };
        }

        if (check.id === 'stale-check') {
          return { exitCode: 0, stdout: 'stale', stderr: '' };
        }

        return {
          exitCode: null,
          stdout: '',
          stderr: 'spawn error',
          error: new Error('spawn error'),
        };
      },
    });

    expect(seen).toEqual([
      'pass-check',
      'fail-check',
      'stale-check',
      'blocked-check',
    ]);
    expect(result.exitCode).toBe(1);
    expect(
      result.results.map((entry: { id: string; status: string }) => ({
        id: entry.id,
        status: entry.status,
      })),
    ).toEqual([
      { id: 'pass-check', status: 'pass' },
      { id: 'fail-check', status: 'fail' },
      { id: 'stale-check', status: 'stale' },
      { id: 'blocked-check', status: 'blocked' },
    ]);
  });

  it('allows informational lanes to exit zero even when checks fail', async () => {
    const tempDir = await makeTempDir();

    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { runLane } = await import('../../tools/quality/quality-runner.mjs');

    const result = await runLane({
      laneId: 'ad-hoc-info',
      repoRoot: tempDir,
      exitPolicy: 'info',
      checks: [
        {
          id: 'fail-check',
          label: 'Fail check',
          script: 'quality:fail',
          reports: [],
        },
      ],
      executeCheck: async () => ({ exitCode: 1, stdout: '', stderr: 'failed' }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.status).toBe('fail');
  });
});
