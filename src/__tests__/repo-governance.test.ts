import {
  mkdirSync,
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
// Exercise the real configuration without modifying or traversing application sources.
function runArchitectureFixture(files: Record<string, string>) {
  const fixtureDir = mkdtempSync(
    path.join(os.tmpdir(), 'momentum-architecture-'),
  );
  try {
    writeFileSync(
      path.join(fixtureDir, 'tsconfig.app.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
        },
        include: ['src'],
      }),
    );
    for (const [relativePath, source] of Object.entries(files)) {
      const filePath = path.join(fixtureDir, relativePath);
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, source);
    }
    return spawnSync(
      process.execPath,
      [
        path.join(
          REPO_ROOT,
          'node_modules/dependency-cruiser/bin/dependency-cruise.mjs',
        ),
        'src',
        '--config',
        path.join(REPO_ROOT, '.dependency-cruiser.cjs'),
        '--output-type',
        'err',
      ],
      { cwd: fixtureDir, encoding: 'utf8', timeout: 30_000 },
    );
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

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

    const allowed = runArchitectureFixture({
      'src/components/view.ts': "import '../storage/ports';\n",
      'src/storage/ports.ts': 'export {};\n',
    });
    expect(allowed.error).toBeUndefined();
    expect(allowed.status).toBe(0);

    const denied = runArchitectureFixture({
      'src/components/view.ts':
        "import '../infra/storage/supabase/SupabaseStorage';\n",
      'src/infra/storage/supabase/SupabaseStorage.ts': 'export {};\n',
    });
    expect(denied.error).toBeUndefined();
    expect(denied.status).toBe(1);
    expect(`${denied.stdout}${denied.stderr}`).toContain(
      'no-component-to-supabase-infra',
    );
    expect(`${denied.stdout}${denied.stderr}`).toContain(
      'src/components/view.ts',
    );
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
    const result = runArchitectureFixture({
      'src/a.ts': "import './b';\n",
      'src/b.ts': "import './a';\n",
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain('no-circular');
  }, 45_000);
});
