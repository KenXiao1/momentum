import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = process.cwd();
const reportsDir = path.join(repoRoot, 'reports', 'quality');
const reportPath = path.join(repoRoot, 'coverage', 'vitest-ci-report.json');
const outPath = path.join(reportsDir, 'test-runtime-budget.json');

const CASE_BUDGET_MS = 2500;
const FILE_BUDGET_MS = 9000;
const BUILT_IN_EXEMPT_FILES = [
  // Intentionally launches Dependency Cruiser against the complete source tree.
  'src/__tests__/repo-governance.test.ts',
];
const envExemptFiles = (process.env.TEST_RUNTIME_BUDGET_EXEMPT ?? '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
const EXEMPT_FILES = new Set([...BUILT_IN_EXEMPT_FILES, ...envExemptFiles]);

await fs.mkdir(reportsDir, { recursive: true });

function resolvePackageBin(packageName, binName) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const packageJson = require(packageJsonPath);
  const binField = packageJson.bin;
  const relativeBin =
    typeof binField === 'string' ? binField : binField?.[binName];
  if (!relativeBin) {
    throw new Error(
      `Unable to resolve bin "${binName}" from package "${packageName}"`,
    );
  }
  return path.resolve(path.dirname(packageJsonPath), relativeBin);
}

async function ensureVitestReport(refreshReport) {
  if (!refreshReport) {
    try {
      await fs.access(reportPath);
      return;
    } catch {
      // continue
    }
  }

  const coverageDir = path.join(repoRoot, 'coverage');
  await fs.mkdir(coverageDir, { recursive: true });

  const vitestBin = resolvePackageBin('vitest', 'vitest');
  const run = spawnSync(
    process.execPath,
    [
      vitestBin,
      'run',
      '--config',
      'vitest.config.ts',
      '--reporter=json',
      '--outputFile',
      'coverage/vitest-ci-report.json',
    ],
    {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  );

  if (run.error) {
    throw new Error(`Failed to generate Vitest report (${run.error.message})`);
  }

  if ((run.status ?? 1) !== 0) {
    throw new Error(
      `Failed to generate Vitest report (exit ${run.status ?? 'unknown'})`,
    );
  }
}

function normalizePath(fileName) {
  return fileName.replace(/\\/g, '/');
}

function getFileDurationMs(suite) {
  if (
    typeof suite.startTime === 'number' &&
    typeof suite.endTime === 'number'
  ) {
    return Math.max(0, suite.endTime - suite.startTime);
  }

  return (suite.assertionResults ?? []).reduce(
    (sum, testCase) => sum + (testCase.duration ?? 0),
    0,
  );
}

const shouldRefreshReport = process.argv.includes('--refresh');
await ensureVitestReport(shouldRefreshReport);
const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));

const fileViolations = [];
const caseViolations = [];
const fileDurations = [];

for (const suite of report.testResults ?? []) {
  const fileName = normalizePath(
    path.relative(repoRoot, suite.name ?? '') || suite.name || 'unknown',
  );
  const fileDurationMs = Number(getFileDurationMs(suite).toFixed(2));
  const isExempt = EXEMPT_FILES.has(fileName);

  fileDurations.push({
    file: fileName,
    durationMs: fileDurationMs,
    exempt: isExempt,
  });

  if (!isExempt && fileDurationMs > FILE_BUDGET_MS) {
    fileViolations.push({
      file: fileName,
      durationMs: fileDurationMs,
      budgetMs: FILE_BUDGET_MS,
    });
  }

  for (const assertion of suite.assertionResults ?? []) {
    const durationMs = Number((assertion.duration ?? 0).toFixed(2));
    if (!isExempt && durationMs > CASE_BUDGET_MS) {
      caseViolations.push({
        file: fileName,
        testName: assertion.fullName ?? assertion.title ?? 'unknown test',
        durationMs,
        budgetMs: CASE_BUDGET_MS,
      });
    }
  }
}

fileDurations.sort((a, b) => b.durationMs - a.durationMs);

const payload = {
  generatedAt: new Date().toISOString(),
  sourceReport: path.relative(repoRoot, reportPath).replace(/\\/g, '/'),
  budgets: {
    perTestCaseMs: CASE_BUDGET_MS,
    perFileMs: FILE_BUDGET_MS,
  },
  exemptFiles: [...EXEMPT_FILES],
  summary: {
    totalSuites: report.numTotalTestSuites ?? 0,
    totalTests: report.numTotalTests ?? 0,
    slowFiles: fileViolations.length,
    slowTestCases: caseViolations.length,
  },
  topSlowFiles: fileDurations.slice(0, 20),
  fileViolations,
  caseViolations,
};

await fs.writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

if (fileViolations.length || caseViolations.length) {
  console.error(
    `[test-runtime-budget] budget violations: files=${fileViolations.length}, test-cases=${caseViolations.length}`,
  );
  for (const violation of fileViolations.slice(0, 20)) {
    console.error(
      `- file ${violation.file}: ${violation.durationMs}ms > ${violation.budgetMs}ms`,
    );
  }
  for (const violation of caseViolations.slice(0, 20)) {
    console.error(
      `- test ${violation.file} :: ${violation.testName}: ${violation.durationMs}ms > ${violation.budgetMs}ms`,
    );
  }
  console.error(
    `[test-runtime-budget] report: ${path.relative(repoRoot, outPath).replace(/\\/g, '/')}`,
  );
  process.exit(1);
}

console.log('[test-runtime-budget] all runtime budgets satisfied.');
console.log(
  `[test-runtime-budget] report: ${path.relative(repoRoot, outPath).replace(/\\/g, '/')}`,
);
