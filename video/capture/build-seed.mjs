// Builds capture/seed.json: a realistic local Momentum state created through
// the real UI, then aged (streaks, usage counts, dates) by patching the JSON.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { APP_URL, L, initScript } from './common.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();
await page.addInitScript(initScript(null));
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(APP_URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(1200);

// adopt the pet so its prompt never interrupts a recording
const petInput = page.getByPlaceholder('宠物名称...');
if (await petInput.isVisible().catch(() => false)) {
  await petInput.fill('小满');
  await page.getByRole('button', { name: /领养/ }).last().click();
  await page.waitForTimeout(600);
}

async function createChain({ name, type, trigger, desc }) {
  const btn = page.getByRole('button', { name: L('Create chain', 'dashboard.dashboardEmptyState.createChain'), exact: true });
  if (await btn.isVisible().catch(() => false)) await btn.click();
  else await page.getByRole('button', { name: '新建链', exact: true }).click();
  await page.getByLabel(L('Chain name'), { exact: true }).fill(name);
  await page.locator('#chain-type').selectOption(type);
  await page.locator('#sacred-seat-trigger').selectOption({ label: trigger });
  await page.locator('#auxiliary-signal').selectOption({ label: '打响指' });
  await page.locator('#task-description').fill(desc);
  await page.getByRole('button', { name: L('Create chain'), exact: true }).last().click();
  await page.waitForTimeout(700);
}

await createChain({ name: '论文写作', type: 'assault', trigger: '戴上降噪耳机', desc: '以最好的状态推进论文第三章' });
await createChain({ name: '阅读文献', type: 'recon', trigger: '准备一杯咖啡', desc: '精读一篇论文，写下三条笔记' });
await createChain({ name: '晨跑', type: 'engineering', trigger: '换上运动服', desc: '沿河慢跑 5 公里' });

// exception rules: the casebook
await page.getByRole('button', { name: L('Exception Rules', 'ruleManager.ruleManagerViewView.exceptionRules') }).first().click().catch(async () => {
  await page.getByRole('button', { name: '例外规则管理' }).click();
});
await page.waitForTimeout(500);
const manager = page.getByRole('dialog').first();
for (const name of ['去洗手间', '接家人电话', '取快递']) {
  await manager.getByRole('button', { name: L('Create rule', 'ruleManager.ruleManagerViewView.createRule') }).first().click();
  const form = page.getByRole('dialog', { name: L('Create rule', 'ruleManager.ruleManagerFormModal.createRule') });
  await form.getByLabel(L('Rule name *', 'ruleManager.ruleManagerFormModal.ruleName')).fill(name);
  await form.getByRole('button', { name: L('Create', 'ruleManager.ruleManagerFormModal.create'), exact: true }).click();
  await page.waitForTimeout(400);
}
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.goto(APP_URL);
await page.waitForTimeout(800);

// RSIP tree (added in free mode, then aged into strict mode)
await page.getByRole('button', { name: L('RSIP Tree'), exact: true }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: L('Free', 'rsip.rsipModeSwitch.free'), exact: true }).click();
const titlePh = L('e.g. Start showering within 15 minutes of getting home');
const rulePh = L('e.g. Start a 15-minute timer when home; enter the bathroom before it ends');
const parentSel = page.locator('select').first();
const policies = [
  ['吃完饭立刻洗碗', '在家吃完饭后，15 分钟内洗完碗', null],
  ['回家先洗澡', '到家后 15 分钟内进入浴室', 0],
  ['不带手机上沙发', '手机只在书桌充电，不带上沙发', 1],
  ['先发制人', '起床后 30 分钟内不打开限制组 App', null],
  ['夜幕降临', '23:00 后屏幕自动切换为黑白模式', 3],
  ['预备仪式', '23:00 后可以玩手机，但只能站着玩', 4],
  ['晨间书桌', '起床后先在书桌前坐五分钟', 3],
  ['周日复盘', '周日晚上花十分钟回顾国策树', 2],
];
for (const [title, rule, parent] of policies) {
  if (parent === null) await parentSel.selectOption({ index: 0 });
  else {
    const opts = await parentSel.locator('option').allInnerTexts();
    await parentSel.selectOption({ index: opts.findIndex((o) => o.includes(policies[parent][0])) });
  }
  await page.getByPlaceholder(titlePh, { exact: true }).fill(title);
  await page.getByPlaceholder(rulePh, { exact: true }).fill(rule);
  await page.getByRole('button', { name: L('Add policy'), exact: true }).click();
  await page.waitForTimeout(350);
}

const dump = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
await writeFile(new URL('./seed.raw.json', import.meta.url), JSON.stringify(dump, null, 2));
console.log(Object.keys(dump));
await browser.close();
