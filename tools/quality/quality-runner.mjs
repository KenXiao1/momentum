import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  QUALITY_LANES,
  getLaneChecks,
  getLaneConfig,
} from './lanes.config.mjs';

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function toRelativePath(repoRoot, filePath) {
  return normalizePath(path.relative(repoRoot, filePath));
}

function formatDuration(durationMs) {
  return `${durationMs.toFixed(0)}ms`;
}

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function removeOutput(filePath) {
  await fs.rm(filePath, { force: true, recursive: true });
}

async function writeTextFile(filePath, contents) {
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, contents, 'utf8');
}

function getGitSha(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if ((result.status ?? 1) !== 0) {
    return 'unknown';
  }

  return (result.stdout ?? '').trim() || 'unknown';
}

/**
 * @typedef {{ exitCode: number | null, stdout: string, stderr: string, error?: Error }} CheckExecution
 * @returns {CheckExecution | Promise<CheckExecution>}
 */
function defaultExecuteCheck(check, { repoRoot }) {
  const command =
    process.platform === 'win32'
      ? {
          executable: 'cmd.exe',
          args: ['/d', '/s', '/c', `npm run ${check.script}`],
        }
      : {
          executable: 'npm',
          args: ['run', check.script],
        };
  const result = spawnSync(command.executable, command.args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  return {
    exitCode: result.status ?? (result.error ? null : 1),
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

async function readFreshness(reportPath, startedAtMs) {
  try {
    const stats = await fs.stat(reportPath);
    return {
      path: reportPath,
      exists: true,
      isFresh: stats.mtimeMs >= startedAtMs,
      modifiedAt: new Date(stats.mtimeMs).toISOString(),
    };
  } catch {
    return {
      path: reportPath,
      exists: false,
      isFresh: false,
      modifiedAt: null,
    };
  }
}

function getResultStatus(execution, freshnessEntries) {
  if (execution.exitCode == null || execution.error) {
    return 'blocked';
  }

  if (execution.exitCode !== 0) {
    return 'fail';
  }

  if (freshnessEntries.some((entry) => !entry.exists || !entry.isFresh)) {
    return 'stale';
  }

  return 'pass';
}

function resolveLaneExitCode(results, exitPolicy) {
  if (exitPolicy === 'info') {
    return 0;
  }

  return results.some((result) => result.status !== 'pass') ? 1 : 0;
}

function renderSummaryMarkdown(summary) {
  const lines = [
    `# ${summary.laneLabel}`,
    '',
    `- Generated at: ${summary.generatedAt}`,
    `- Git SHA: ${summary.gitSha}`,
    `- Exit code: ${summary.exitCode}`,
    '',
    '| Check | Status | Exit | Duration | Script | Reports |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const result of summary.results) {
    const reportLabels = result.reportFreshness.length
      ? result.reportFreshness
          .map((entry) => {
            const suffix =
              entry.exists && entry.isFresh
                ? 'fresh'
                : entry.exists
                  ? 'stale'
                  : 'missing';
            return `${entry.path} (${suffix})`;
          })
          .join('<br>')
      : '-';

    lines.push(
      `| ${result.label} | ${result.status} | ${result.exitCode ?? 'blocked'} | ${formatDuration(result.durationMs)} | ${result.script} | ${reportLabels} |`,
    );
  }

  return `${lines.join('\n')}\n`;
}

/**
 * @typedef {{ id: string, label: string, script: string, reports?: string[], textReportPath?: string }} QualityCheck
 * @typedef {Object} LaneOptions
 * @property {string} [laneId]
 * @property {string} [repoRoot]
 * @property {QualityCheck[]} [checks]
 * @property {(check: QualityCheck, context: { repoRoot: string }) => CheckExecution | Promise<CheckExecution>} [executeCheck]
 * @property {string} [exitPolicy]
 * @property {string} [summaryJsonPath]
 * @property {string} [summaryMarkdownPath]
 * @property {string} [logsDir]
 * @property {boolean} [captureTextReports]
 * @property {string} [laneLabel]
 * @param {LaneOptions} options
 */
export async function runLane({
  laneId,
  repoRoot = process.cwd(),
  checks,
  executeCheck = defaultExecuteCheck,
  exitPolicy,
  summaryJsonPath,
  summaryMarkdownPath,
  logsDir,
  captureTextReports = false,
  laneLabel,
}) {
  const laneConfig =
    laneId && !checks
      ? getLaneConfig(laneId)
      : laneId && laneId in QUALITY_LANES
        ? getLaneConfig(laneId)
        : null;
  const selectedChecks = checks ?? getLaneChecks(laneId);
  const resolvedExitPolicy = exitPolicy ?? laneConfig?.exitPolicy ?? 'required';
  const resolvedRepoRoot = path.resolve(repoRoot);
  const resolvedSummaryJsonPath = path.resolve(
    resolvedRepoRoot,
    summaryJsonPath ??
      laneConfig?.summaryJsonPath ??
      'reports/quality/summary.json',
  );
  const resolvedSummaryMarkdownPath = path.resolve(
    resolvedRepoRoot,
    summaryMarkdownPath ??
      laneConfig?.summaryMarkdownPath ??
      'reports/quality/summary.md',
  );
  const resolvedLogsDir = path.resolve(
    resolvedRepoRoot,
    logsDir ?? laneConfig?.logsDir ?? 'reports/quality/logs',
  );

  await fs.mkdir(resolvedLogsDir, { recursive: true });

  const results = [];

  for (const check of selectedChecks) {
    const checkStartMs = Date.now();
    const resolvedReports = (check.reports ?? []).map((reportPath) =>
      path.resolve(resolvedRepoRoot, reportPath),
    );

    await Promise.all(
      resolvedReports.map((reportPath) => removeOutput(reportPath)),
    );

    const execution = await executeCheck(check, {
      repoRoot: resolvedRepoRoot,
      startedAtMs: checkStartMs,
    });
    const durationMs = Date.now() - checkStartMs;

    const stdoutPath = path.join(resolvedLogsDir, `${check.id}.stdout.log`);
    const stderrPath = path.join(resolvedLogsDir, `${check.id}.stderr.log`);

    await Promise.all([
      writeTextFile(stdoutPath, execution.stdout ?? ''),
      writeTextFile(stderrPath, execution.stderr ?? ''),
    ]);

    if (captureTextReports && check.textReportPath) {
      const mergedOutput = [execution.stdout, execution.stderr]
        .filter(Boolean)
        .join('\n')
        .trimEnd();
      await writeTextFile(
        path.resolve(resolvedRepoRoot, check.textReportPath),
        `${mergedOutput}\n`,
      );
    }

    if (execution.stdout) process.stdout.write(execution.stdout);
    if (execution.stderr) process.stderr.write(execution.stderr);

    const reportFreshness = await Promise.all(
      resolvedReports.map((reportPath) =>
        readFreshness(reportPath, checkStartMs),
      ),
    );
    const status = getResultStatus(execution, reportFreshness);

    results.push({
      id: check.id,
      label: check.label,
      script: check.script,
      commandId: check.script,
      status,
      exitCode: execution.exitCode,
      durationMs,
      stdoutPath: toRelativePath(resolvedRepoRoot, stdoutPath),
      stderrPath: toRelativePath(resolvedRepoRoot, stderrPath),
      reportFreshness: reportFreshness.map((entry) => ({
        ...entry,
        path: toRelativePath(resolvedRepoRoot, entry.path),
      })),
      errorMessage: execution.error?.message ?? null,
    });
  }

  const exitCode = resolveLaneExitCode(results, resolvedExitPolicy);
  const summary = {
    laneId: laneId ?? 'ad-hoc',
    laneLabel: laneLabel ?? laneConfig?.label ?? 'Quality lane',
    exitPolicy: resolvedExitPolicy,
    generatedAt: new Date().toISOString(),
    gitSha: getGitSha(resolvedRepoRoot),
    exitCode,
    results,
  };

  await Promise.all([
    writeTextFile(
      resolvedSummaryJsonPath,
      `${JSON.stringify(summary, null, 2)}\n`,
    ),
    writeTextFile(resolvedSummaryMarkdownPath, renderSummaryMarkdown(summary)),
  ]);

  return summary;
}

export async function runConfiguredLane(laneId, options = {}) {
  return runLane({
    laneId,
    ...options,
  });
}
