import { expect, test, type Page } from '@playwright/test';

async function addPolicy(page: Page, title: string) {
  await page
    .getByPlaceholder(
      'e.g. Start showering within 15 minutes of getting home',
      { exact: true },
    )
    .fill(title);
  await page
    .getByPlaceholder(
      'e.g. Start a 15-minute timer when home; enter the bathroom before it ends',
      { exact: true },
    )
    .fill(`Follow ${title} every day.`);
  await page.getByRole('button', { name: 'Add policy', exact: true }).click();
  await expect(
    page.getByRole('button', { name: new RegExp(`${title}$`) }),
  ).toBeVisible();
}

async function reloadTree(page: Page) {
  await page.reload();
  const openTree = page.getByRole('button', { name: 'RSIP Tree', exact: true });
  await expect(openTree).toBeVisible();
  const dismissPet = page.getByRole('button', {
    name: 'Maybe Later',
    exact: true,
  });
  if (await dismissPet.isVisible()) await dismissPet.click();
  await openTree.click();
}

test('cancels a policy deletion, then removes only that policy and preserves the other across refresh', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('language', 'en'));
  await page.goto('/');
  await page.getByRole('button', { name: 'RSIP Tree', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'RSIP Policy Tree', exact: true }),
  ).toBeVisible();
  // The existing mode control currently uses Chinese text in both locales.
  await page.getByRole('button', { name: '自由', exact: true }).click();
  await addPolicy(page, 'Keep this policy');
  await addPolicy(page, 'Remove this policy');
  const survivor = page.getByRole('button', { name: /Keep this policy$/ });
  const removable = page.getByRole('button', { name: /Remove this policy$/ });

  await removable
    .getByRole('button', { name: 'Mark as failed', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(removable).toBeVisible();
  await expect(survivor).toBeVisible();
  await reloadTree(page);
  await expect(removable).toBeVisible();
  await expect(survivor).toBeVisible();

  await removable
    .getByRole('button', { name: 'Mark as failed', exact: true })
    .click();
  await page.getByRole('button', { name: 'Roll back', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm violation', exact: true })
    .click();
  await expect(removable).toHaveCount(0);
  await expect(survivor).toBeVisible();
  await reloadTree(page);
  await expect(survivor).toBeVisible();
  await expect(removable).toHaveCount(0);
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('momentum_rsip_nodes') ?? '[]'),
  );
  expect(persisted).toEqual([
    expect.objectContaining({ title: 'Keep this policy' }),
  ]);
});
