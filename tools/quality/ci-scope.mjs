import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

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

export function requiresFullCi(eventName, event, cwd = process.cwd()) {
  // Default-branch pushes and manual runs still certify the complete application.
  if (eventName !== 'pull_request') return true;
  const base = event.pull_request?.base?.sha;
  const head = event.pull_request?.head?.sha;
  if (
    ![base, head].every(
      (sha) => typeof sha === 'string' && /^[a-f0-9]{40}$/i.test(sha),
    )
  ) {
    throw new Error('CI scope requires valid pull request base and head SHAs');
  }
  // Include both sides of renames and use the merge base, like the PR diff.
  const files = execFileSync(
    'git',
    ['diff', '--name-only', '--no-renames', '-z', `${base}...${head}`],
    { cwd, encoding: 'utf8' },
  )
    .split('\0')
    .filter(Boolean);
  return (
    files.length === 0 ||
    !files.every((file) => /^(?:[^/]+|docs\/.+)\.md$/.test(file))
  );
}

export function requireCiJobs(jobs) {
  const full = jobs.changes?.outputs?.full;
  if (jobs.changes?.result !== 'success' || !['true', 'false'].includes(full)) {
    throw new Error('CI scope detection did not succeed');
  }
  const optional = new Set(full === 'true' ? ['docs'] : applicationJobs);
  for (const name of ['changes', 'docs', 'secrets', ...applicationJobs]) {
    const result = jobs[name]?.result;
    if (result !== 'success' && !(result === 'skipped' && optional.has(name))) {
      throw new Error(`Required CI job ${name}: ${result ?? 'missing'}`);
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv[2] === '--check') {
      requireCiJobs(JSON.parse(process.env.RESULTS));
      console.log('All checks required for this change succeeded');
    } else {
      const event = JSON.parse(
        fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'),
      );
      const full = requiresFullCi(process.env.GITHUB_EVENT_NAME, event);
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `full=${full}\n`);
      console.log(
        full
          ? 'Full application CI'
          : 'Documentation-only PR: docs and secret scan',
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
