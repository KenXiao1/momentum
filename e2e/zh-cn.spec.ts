import { expect, test } from '@playwright/test';

// The other journeys run in English. This one checks that a Chinese browser
// gets the Chinese interface and can complete the first-run flow in it.
test.use({ locale: 'zh-CN' });

test.beforeEach(async ({ page }) => {
  await page.addLocatorHandler(
    page.getByRole('button', { name: '稍后再说', exact: true }),
    async (dismiss) => {
      await dismiss.click();
    },
  );
});

test('a Chinese browser gets the Chinese interface and can create a chain', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '创建第一条链', exact: true }).click();
  await page.getByLabel('链名称', { exact: true }).fill('写论文');
  await page
    .locator('#sacred-seat-trigger')
    .selectOption({ label: '坐到书房书桌前' });
  await page.getByLabel('无时长任务', { exact: true }).check();
  await page.getByLabel('最小时长', { exact: true }).click();
  await page.getByRole('button', { name: '不设置', exact: true }).click();
  await page.locator('#auxiliary-signal').selectOption({ label: '打响指' });
  await page.locator('#auxiliary-completion-trigger').fill('坐到桌前');
  await page.locator('#task-description').fill('完成一次专注。');
  await page.getByRole('button', { name: '创建链条', exact: true }).click();

  await expect(
    page.getByRole('button', { name: '开始任务', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('写论文', { exact: true })).toBeVisible();
});
