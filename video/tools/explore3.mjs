import { chromium } from 'playwright';
import { makeL } from './i18n.mjs';
const out = process.argv[2];
const lang = 'zh';
const L = makeL(lang);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();
await page.addInitScript((l) => localStorage.setItem('language', l), lang);
await page.addLocatorHandler(page.getByRole('button', { name: L('Maybe Later'), exact: true }), async (b) => b.click());
let n = 0;
const shot = async (name, full = false) => page.screenshot({ path: `${out}/r${String(++n).padStart(2, '0')}-${name}.png`, fullPage: full });
await page.goto('http://127.0.0.1:5199/');
await page.waitForTimeout(1000);
await page.getByRole('button', { name: L('RSIP Tree'), exact: true }).click();
await page.waitForTimeout(800);
await shot('rsip-empty', true);
await page.getByRole('button', { name: L('Free', 'rsip.rsipModeSwitch.free'), exact: true }).click();
const titlePh = L('e.g. Start showering within 15 minutes of getting home');
const rulePh = L('e.g. Start a 15-minute timer when home; enter the bathroom before it ends');
const parentSel = page.locator('select').first();
const policies = [
  ['吃完饭立刻洗碗', '在家吃完饭后，15 分钟内洗完碗', null],
  ['回家先洗澡', '定位到家后自动开始 15 分钟倒计时，结束前进入浴室', 0],
  ['不带手机上沙发', '手机只能放在书桌充电，不得带上沙发', 1],
  ['先发制人', '起床后 30 分钟内不打开限制组 App', null],
  ['夜幕降临', '23:00 后屏幕自动切换为黑白模式', 3],
  ['预备仪式', '23:00 后可以玩手机，但只能站着玩', 4],
];
for (const [i, [title, rule, parent]] of policies.entries()) {
  if (parent !== null) {
    const opts = await parentSel.locator('option').allInnerTexts();
    const idx = opts.findIndex((o) => o.includes(policies[parent][0]));
    await parentSel.selectOption({ index: idx });
  } else {
    await parentSel.selectOption({ index: 0 });
  }
  await page.getByPlaceholder(titlePh, { exact: true }).fill(title);
  await page.getByPlaceholder(rulePh, { exact: true }).fill(rule);
  await page.getByRole('button', { name: L('Add policy'), exact: true }).click();
  await page.waitForTimeout(300);
}
await page.waitForTimeout(600);
await shot('rsip-tree', true);
console.log(JSON.stringify(await page.getByRole('button').allInnerTexts()));
console.log(await page.evaluate(() => localStorage.getItem('momentum_rsip_nodes')).then(s=>s.slice(0,600)));
await browser.close();
