import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function createChain(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create chain', exact: true }).click();
  await page.getByLabel('Chain name', { exact: true }).fill(name);
  await page
    .locator('#sacred-seat-trigger')
    .selectOption({ label: 'Sit at your desk' });
  await page.getByLabel('No timer', { exact: true }).check();
  await page.getByLabel('Minimum duration', { exact: true }).click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page
    .locator('#auxiliary-signal')
    .selectOption({ label: 'Snap your fingers' });
  await page.locator('#auxiliary-completion-trigger').fill('Sit at desk');
  await page
    .locator('#task-description')
    .fill('Complete one focused work session.');
  await page.getByRole('button', { name: 'Create chain', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Start', exact: true }),
  ).toBeVisible();
}

async function openCompletion(page: Page, description: string) {
  await page.getByRole('button', { name: 'Complete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Complete task' });
  await dialog.locator('input[name="description"]').fill(description);
  return dialog;
}

async function expectSingleCompletion(
  page: Page,
  name: string,
  description: string,
) {
  await expect(
    page.getByRole('button', { name: 'Start', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('1 completion', { exact: true })).toBeVisible();
  const dismissPet = page.getByRole('button', {
    name: 'Maybe Later',
    exact: true,
  });
  if (await dismissPet.isVisible()) await dismissPet.click();
  const saved = await page.evaluate(() => ({
    chains: JSON.parse(localStorage.getItem('momentum_chains') ?? '[]'),
    history: JSON.parse(
      localStorage.getItem('momentum_completion_history') ?? '[]',
    ),
    activeSession: localStorage.getItem('momentum_active_session'),
  }));
  expect(saved.chains).toEqual([
    expect.objectContaining({ name, currentStreak: 1, totalCompletions: 1 }),
  ]);
  expect(saved.history).toEqual([
    expect.objectContaining({ description, wasSuccessful: true }),
  ]);
  expect(saved.activeSession).toBeNull();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('language', 'en'));
});

test('creates, starts, pauses, resumes and completes a chain that survives refresh', async ({
  page,
}) => {
  await createChain(page, 'Daily focused work');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const ruleDialog = page.getByRole('dialog', {
    name: 'Choose exception rule',
  });
  await ruleDialog.getByLabel('Indefinite', { exact: true }).check();
  await ruleDialog.getByText('Bathroom break', { exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Resume', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  const completion = await openCompletion(page, 'Read the next chapter');
  await completion
    .getByRole('button', { name: 'Complete task', exact: true })
    .click();
  await expectSingleCompletion(
    page,
    'Daily focused work',
    'Read the next chapter',
  );
  await page.reload();
  await expectSingleCompletion(
    page,
    'Daily focused work',
    'Read the next chapter',
  );
});

test('retains the completion draft after a storage failure and retries exactly once', async ({
  page,
}) => {
  await createChain(page, 'Recoverable focus');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const completion = await openCompletion(page, 'Keep this completion draft');
  // Inject a browser persistence failure after the journal and chains are written.
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'momentum_completion_history') {
        Storage.prototype.setItem = write;
        throw new DOMException(
          'Simulated disk quota failure',
          'QuotaExceededError',
        );
      }
      write.call(this, key, value);
    };
  });
  await completion
    .getByRole('button', { name: 'Complete task', exact: true })
    .click();
  await expect(
    page.getByText(
      'Save is not confirmed. Your task is retained; retry completion.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(completion).toBeVisible();
  await expect(completion.locator('input[name="description"]')).toHaveValue(
    'Keep this completion draft',
  );
  await completion
    .getByRole('button', { name: 'Complete task', exact: true })
    .click();
  await expectSingleCompletion(
    page,
    'Recoverable focus',
    'Keep this completion draft',
  );
  await page.reload();
  await expectSingleCompletion(
    page,
    'Recoverable focus',
    'Keep this completion draft',
  );
});

test('exports and imports a completed chain into an empty browser store', async ({
  page,
}) => {
  await createChain(page, 'Portable focus');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const completion = await openCompletion(page, 'Portable history');
  await completion
    .getByRole('button', { name: 'Complete task', exact: true })
    .click();
  await expectSingleCompletion(page, 'Portable focus', 'Portable history');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export as JSON', exact: true })
    .click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const exported = await readFile(path!, 'utf8');
  expect(JSON.parse(exported)).toHaveProperty('chains');

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page
    .getByLabel('Choose a file to import', { exact: true })
    .setInputFiles({
      name: 'momentum-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(exported),
    });
  await page.getByLabel('Preserve statistics', { exact: true }).check();
  await page
    .getByLabel('Preserve original timestamps', { exact: true })
    .check();
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  await expect(
    page.getByText('Import successful! The chains have been added.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expectSingleCompletion(page, 'Portable focus', 'Portable history');
});
