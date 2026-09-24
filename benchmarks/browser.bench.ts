import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { expect, test } from '@playwright/test';
import { createUnitChain } from '../src/test/factories/chainFactory';

// Measurements are observations, not portable latency guarantees.
test('production startup and RSIP rendering with representative data', async ({
  browser,
}, testInfo) => {
  const observations: Array<{
    chains: number;
    rsipNodes: number;
    sample: number;
    startupMs: number;
    treeMs: number;
  }> = [];
  for (const count of [100, 1000]) {
    const chains = Array.from({ length: count }, (_, index) =>
      createUnitChain({
        id: `bench-${index}`,
        name: `Benchmark chain ${index}`,
      }),
    );
    const nodes = Array.from({ length: 256 }, (_, index) => ({
      id: `node-${index}`,
      title: `Benchmark policy ${index}`,
      rule: 'Synthetic benchmark rule',
      parentId: index ? `node-${Math.floor((index - 1) / 4)}` : undefined,
      sortOrder: index,
      createdAt: new Date().toISOString(),
    }));
    for (let sample = 0; sample < 5; sample += 1) {
      const context = await browser.newContext({ locale: 'en-US' });
      try {
        await context.addInitScript(
          ({ chains, nodes }) => {
            localStorage.setItem('language', 'en');
            localStorage.setItem('momentum_chains', JSON.stringify(chains));
            localStorage.setItem('momentum_rsip_nodes', JSON.stringify(nodes));
            localStorage.setItem(
              'momentum_rsip_meta',
              JSON.stringify({ allowMultiplePerDay: true }),
            );
          },
          { chains, nodes },
        );
        const page = await context.newPage();
        const start = performance.now();
        await page.goto('http://127.0.0.1:4174');
        await expect(
          page.getByText('Benchmark chain 0', { exact: true }).first(),
        ).toBeVisible();
        const startupMs = performance.now() - start;
        const treeStart = performance.now();
        await page
          .getByRole('button', { name: 'RSIP Tree', exact: true })
          .click();
        await expect(page.locator('.rsip-node')).toHaveCount(nodes.length);
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        );
        const treeMs = performance.now() - treeStart;
        observations.push({
          chains: count,
          rsipNodes: nodes.length,
          sample,
          startupMs,
          treeMs,
        });

        if (count === 100 && sample === 0) {
          await page.getByRole('button', { name: 'Back', exact: true }).click();
          await page
            .getByRole('button', { name: 'Personal Settings', exact: true })
            .click();
          const dialog = page.getByRole('dialog', {
            name: 'Personal Settings',
          });
          await expect(
            dialog.getByRole('button', { name: 'Export diagnostics' }),
          ).toBeVisible();
          await page.screenshot({
            path: testInfo.outputPath('diagnostics-settings.png'),
          });
          const download = page.waitForEvent('download');
          await dialog
            .getByRole('button', { name: 'Export diagnostics' })
            .click();
          const path = await (await download).path();
          expect(path).not.toBeNull();
          if (!path) throw new Error('Diagnostic download was not saved');
          const data = await readFile(path, 'utf8');
          expect(data).not.toContain('Benchmark chain');
          const diagnosticReport = JSON.parse(data) as {
            schemaVersion: number;
            entries: unknown[];
          };
          expect(diagnosticReport.schemaVersion).toBe(1);
          expect(diagnosticReport.entries).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                kind: 'timing',
                name: 'FCP',
                unit: 'ms',
              }),
            ]),
          );
          await writeFile(
            testInfo.outputPath('production-diagnostics.json'),
            data,
          );
          await testInfo.attach('production-diagnostics', {
            body: data,
            contentType: 'application/json',
          });
        }
      } finally {
        await context.close();
      }
    }
  }
  const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const report = {
    generatedAt: new Date().toISOString(),
    gitSha: execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim(),
    dirty:
      execFileSync('git', ['status', '--porcelain'], {
        encoding: 'utf8',
      }).trim().length > 0,
    environment: {
      os: os.platform(),
      architecture: os.arch(),
      node: process.version,
      chromium: browser.version(),
      build: 'production',
    },
    observations,
    summary: [100, 1000].map((chains) => {
      const samples = observations.filter((value) => value.chains === chains);
      return {
        chains,
        rsipNodes: 256,
        samples: samples.length,
        startupMedianMs: median(samples.map((value) => value.startupMs)),
        treeMedianMs: median(samples.map((value) => value.treeMs)),
      };
    }),
  };
  await mkdir('reports/quality', { recursive: true });
  await writeFile(
    'reports/quality/browser-benchmark.json',
    JSON.stringify(report, null, 2),
  );
  await testInfo.attach('browser-benchmark', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
});
