import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function requireSuccessfulRun(runs, { sha, branch }) {
  const matching = runs
    .filter(
      (run) =>
        run.head_sha === sha &&
        run.head_branch === branch &&
        run.event === 'push',
    )
    .sort(
      (a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt,
    );
  const run = matching[0];
  if (!run || run.status !== 'completed' || run.conclusion !== 'success') {
    throw new Error(
      `The latest default-branch CI run for ${sha} must succeed before release`,
    );
  }
  return run;
}

export function requireSuccessfulJobs(jobs, sha) {
  const required = jobs.filter((job) => job.name === 'required');
  if (
    required.length !== 1 ||
    required[0].head_sha !== sha ||
    required[0].status !== 'completed' ||
    required[0].conclusion !== 'success'
  ) {
    throw new Error(`CI required job has not succeeded for ${sha}`);
  }
}

export function verifyRelease() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error('GITHUB_REPOSITORY is required');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const api = (endpoint) =>
    JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8' }));
  const repo = api(`repos/${repository}`);
  const branch = repo.default_branch;
  execFileSync('git', ['fetch', 'origin', branch], { stdio: 'inherit' });
  execFileSync('git', ['merge-base', '--is-ancestor', sha, 'FETCH_HEAD']);
  const query = new URLSearchParams({
    head_sha: sha,
    event: 'push',
    per_page: '100',
  });
  const runs = api(
    `repos/${repository}/actions/workflows/ci.yml/runs?${query}`,
  ).workflow_runs;
  const run = requireSuccessfulRun(runs, { sha, branch });
  const jobs = [];
  for (let page = 1; ; page += 1) {
    const batch = api(
      `repos/${repository}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100&page=${page}`,
    ).jobs;
    jobs.push(...batch);
    if (batch.length < 100) break;
  }
  requireSuccessfulJobs(jobs, sha);
  console.log(
    `Release authorized by CI run ${run.id}, attempt ${run.run_attempt}, SHA ${sha}`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    verifyRelease();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
