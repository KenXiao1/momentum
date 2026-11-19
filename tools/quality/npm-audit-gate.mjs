import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Blocks high and critical advisories. With AUDIT_BASE_SHA set (pull
// requests), only advisories absent from the base commit's lockfile block, so
// an advisory published against the base branch does not turn every unrelated
// PR red. Both sides are audited in the same run against the same advisory
// data. Without a base (pushes, local runs) every blocking advisory fails.

const BLOCKING = new Set(['high', 'critical']);

export function collectBlockingAdvisories(report) {
  if (report.error) {
    throw new Error(`npm audit failed: ${JSON.stringify(report.error)}`);
  }
  if (!report.vulnerabilities) {
    throw new Error('npm audit returned no vulnerabilities section');
  }
  const advisories = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities)) {
    for (const via of vulnerability.via) {
      if (typeof via === 'object' && BLOCKING.has(via.severity)) {
        advisories.set(`${via.name} ${via.url}`, via);
      }
    }
  }
  return advisories;
}

export function findIntroducedAdvisories(head, base) {
  return [...head].filter(([key]) => !base.has(key)).map(([, via]) => via);
}

function auditLockfile(cwd) {
  try {
    return JSON.parse(
      execFileSync('npm', ['audit', '--json', '--package-lock-only'], {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  } catch (error) {
    // npm audit exits 1 when it finds anything; the JSON is still on stdout.
    if (error.stdout) return JSON.parse(error.stdout);
    throw error;
  }
}

function auditBase(baseSha) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'momentum-audit-base-'));
  try {
    for (const file of ['package.json', 'package-lock.json']) {
      const source = execFileSync('git', ['show', `${baseSha}:${file}`], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
      fs.writeFileSync(path.join(dir, file), source);
    }
    return auditLockfile(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function describe(via) {
  return `${via.severity} ${via.name}: ${via.title} (${via.url})`;
}

function main() {
  const head = collectBlockingAdvisories(auditLockfile(process.cwd()));
  const baseSha = process.env.AUDIT_BASE_SHA;

  if (!baseSha) {
    for (const via of head.values()) console.error(describe(via));
    if (head.size > 0) {
      throw new Error(`${head.size} high or critical npm advisories`);
    }
    console.log('No high or critical npm advisories');
    return;
  }

  const base = collectBlockingAdvisories(auditBase(baseSha));
  const introduced = findIntroducedAdvisories(head, base);
  for (const via of head.values()) {
    if (base.has(`${via.name} ${via.url}`)) {
      console.log(`::warning::Already on the base branch: ${describe(via)}`);
    }
  }
  for (const via of introduced) console.error(describe(via));
  if (introduced.length > 0) {
    throw new Error(
      `This change introduces ${introduced.length} high or critical npm advisories`,
    );
  }
  console.log('No high or critical npm advisories introduced by this change');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
