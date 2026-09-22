import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const shaPattern = /^[0-9a-f]{40}$/i;
function requireSha(value) {
  if (typeof value !== 'string' || !shaPattern.test(value)) {
    throw new Error('Secret scan event has no valid commit SHA');
  }
  return value;
}

export function secretScanRange(eventName, event) {
  if (eventName === 'pull_request') {
    return `${requireSha(event.pull_request?.base?.sha)}..${requireSha(event.pull_request?.head?.sha)}`;
  }
  if (eventName === 'push') {
    const before = requireSha(event.before);
    const after = requireSha(event.after);
    // A newly created ref has no base; inspect its complete history.
    if (before === '0'.repeat(40)) return undefined;
    return `${before}..${after}`;
  }
  if (eventName && !['schedule', 'workflow_dispatch'].includes(eventName)) {
    throw new Error(`Unsupported secret scan event: ${eventName}`);
  }
  return undefined;
}

export function runGitleaks() {
  const reportPath = 'reports/quality/gitleaks.json';
  fs.mkdirSync('reports/quality', { recursive: true });
  fs.rmSync(reportPath, { force: true });
  const event = process.env.GITHUB_EVENT_PATH
    ? JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
    : {};
  const range = secretScanRange(process.env.GITHUB_EVENT_NAME, event);
  const args = [
    'git',
    '.',
    '--redact',
    '--no-banner',
    '--report-format',
    'json',
    '--report-path',
    reportPath,
  ];
  if (range) args.push(`--log-opts=${range}`);
  console.log(
    range
      ? `Scanning every commit in ${range}`
      : 'Scanning complete Git history',
  );
  const result = spawnSync(process.env.GITLEAKS_BIN || 'gitleaks', args, {
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Gitleaks failed: ${result.error?.message ?? `exit ${result.status}`}`,
    );
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (!Array.isArray(report) || report.length !== 0)
    throw new Error('Secret scan did not produce a clean report');
  console.log('Validated clean Gitleaks report');
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    runGitleaks();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
