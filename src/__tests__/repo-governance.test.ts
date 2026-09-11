import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { extractWorkflowRunBlocks } from '../test/utils/workflowRunBlocks';

const REPO_ROOT = process.cwd();
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const WORKFLOWS_DIR = path.join(REPO_ROOT, '.github', 'workflows');
const CI_WORKFLOW_PATH = path.join(REPO_ROOT, '.github', 'workflows', 'ci.yml');
const CODEQL_WORKFLOW_PATH = path.join(
  REPO_ROOT,
  '.github',
  'workflows',
  'codeql.yml',
);
const SEMGREP_WORKFLOW_PATH = path.join(
  REPO_ROOT,
  '.github',
  'workflows',
  'semgrep.yml',
);
const ARCHITECTURE_VIOLATION_FIXTURE_PATH = path.join(
  REPO_ROOT,
  'src',
  'components',
  '__architecture_violation_fixture__.ts',
);

function readFile(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

function extractNpmRunCommands(workflow: string): string[] {
  return [...workflow.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)].map(
    (match) => match[1],
  );
}

function readWorkflowSources(): Array<{ file: string; source: string }> {
  return readdirSync(WORKFLOWS_DIR)
    .filter((file) => /\.ya?ml$/.test(file))
    .map((file) => ({
      file,
      source: readFile(path.join(WORKFLOWS_DIR, file)),
    }));
}

describe('repo governance', () => {
  it('ci workflow only invokes the aggregated quality lanes', () => {
    const workflow = readFile(CI_WORKFLOW_PATH);
    const commands = [...new Set(extractNpmRunCommands(workflow))].sort();

    expect(commands).toEqual(['quality:ci:info', 'quality:ci:required']);

    const packageJson = JSON.parse(readFile(PACKAGE_JSON_PATH)) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['quality:ci:required']).toEqual(
      expect.any(String),
    );
    expect(packageJson.scripts['quality:ci:info']).toEqual(expect.any(String));
    expect(packageJson.scripts['quality:ci:nightly']).toEqual(
      expect.any(String),
    );
  });

  it('fails the architecture gate when UI imports Supabase infrastructure', () => {
    const packageJson = JSON.parse(readFile(PACKAGE_JSON_PATH)) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['quality:arch-gate']).toMatch(
      /--output-type\s+err(?:\s|$)/,
    );

    writeFileSync(
      ARCHITECTURE_VIOLATION_FIXTURE_PATH,
      "import '../infra/storage/supabase/SupabaseStorage';\n",
      'utf8',
    );

    try {
      const npmCliPath = process.env.npm_execpath;
      if (!npmCliPath) {
        throw new Error('npm_execpath is required for the governance test');
      }
      const result = spawnSync(
        process.execPath,
        [npmCliPath, 'run', 'quality:arch-gate'],
        {
          cwd: REPO_ROOT,
          encoding: 'utf8',
        },
      );
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).not.toBe(0);
      expect(output).toContain('no-component-to-supabase-infra');
      expect(output).toContain('__architecture_violation_fixture__.ts');
    } finally {
      rmSync(ARCHITECTURE_VIOLATION_FIXTURE_PATH, { force: true });
    }
  }, 45_000);

  it('codeql workflow uses the security-extended query suite', () => {
    const workflow = readFile(CODEQL_WORKFLOW_PATH);

    expect(workflow).toMatch(/queries:\s*security-extended/);
  });

  it('semgrep workflow includes scheduled scans and default-branch gating', () => {
    const workflow = readFile(SEMGREP_WORKFLOW_PATH);

    expect(workflow).toMatch(/schedule:/);
    expect(workflow).toContain('default_branch');
  });

  it('pins every third-party action to a full commit SHA', () => {
    const mutableActionReferences = readWorkflowSources().flatMap(
      ({ file, source }) =>
        [...source.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)]
          .map((match) => match[1] ?? '')
          .filter((reference) => !reference.startsWith('./'))
          .filter((reference) => !/@[0-9a-f]{40}$/i.test(reference))
          .map((reference) => `${file}: ${reference}`),
    );

    expect(mutableActionReferences).toEqual([]);
  });

  it('keeps GitHub context expressions out of shell command bodies', () => {
    const unsafeRunBlocks = readWorkflowSources().flatMap(({ file, source }) =>
      extractWorkflowRunBlocks(source)
        .filter((runBlock) => /\$\{\{\s*github\./.test(runBlock))
        .map((runBlock) => `${file}: ${runBlock.trim()}`),
    );

    expect(unsafeRunBlocks).toEqual([]);
  });

  it.each(['|', '|-', '|+', '>', '>-', '>+'])(
    'extracts YAML run blocks using the %s scalar marker',
    (marker) => {
      const workflow = [
        'steps:',
        `  - run: ${marker}`,
        '      echo "${{ github.ref_name }}"',
      ].join('\n');

      expect(extractWorkflowRunBlocks(workflow)).toEqual([
        '      echo "${{ github.ref_name }}"',
      ]);
    },
  );

  it('fails the architecture gate for circular imports', () => {
    const fixtureDir = mkdtempSync(path.join(os.tmpdir(), 'momentum-cycle-'));
    writeFileSync(path.join(fixtureDir, 'a.ts'), "import './b';\n");
    writeFileSync(path.join(fixtureDir, 'b.ts'), "import './a';\n");

    try {
      const npmCliPath = process.env.npm_execpath;
      if (!npmCliPath) throw new Error('npm_execpath is required');
      const result = spawnSync(
        process.execPath,
        [npmCliPath, 'run', 'quality:arch-gate', '--', fixtureDir],
        { cwd: REPO_ROOT, encoding: 'utf8' },
      );
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain('no-circular');
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  }, 45_000);
});
