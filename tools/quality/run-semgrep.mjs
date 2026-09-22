import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { validateSemgrepReport } from './semgrep-report.mjs';

const reportPath = 'reports/quality/semgrep.json';
fs.mkdirSync('reports/quality', { recursive: true });
// Never accept an earlier scan when this invocation crashes or writes no report.
fs.rmSync(reportPath, { force: true });
const result = spawnSync(
  process.env.SEMGREP_BIN || 'semgrep',
  [
    'scan',
    '--strict',
    '--error',
    '--config',
    'p/ci',
    '--metrics',
    'off',
    '--json',
    '--output',
    reportPath,
    'src',
  ],
  { stdio: 'inherit' },
);
if (result.error || result.status !== 0) {
  console.error(
    'Semgrep failed:',
    result.error?.message ?? `exit ${result.status}`,
  );
  process.exit(1);
}
try {
  const count = validateSemgrepReport(
    JSON.parse(fs.readFileSync(reportPath, 'utf8')),
  );
  console.log(`Validated Semgrep report: ${count} source files scanned`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
