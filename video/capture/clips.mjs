// Demo clip scripts. Each run() drives the real app; marks name moments the
// film edit cuts on.
const startBtn = (page) => page.getByRole('button', { name: '开始任务', exact: true }).first();

export const CLIPS = {
  seat: {
    async run(a) {
      const { page } = a;
      a.mark('home');
      await a.box('trigger', page.getByText('戴上降噪耳机').first());
      await a.box('card', page.locator('div', { has: page.getByRole('heading', { name: '论文写作' }) }).filter({ hasText: '主链记录' }).last());
      await a.box('streak', page.getByText('#36').last());
      await a.move(page.getByText('戴上降噪耳机').first(), 900);
      await a.wait(900);
      await a.click(startBtn(page), { ms: 800 });
      a.mark('start');
      await a.wait(1200);
      await a.box('timer', page.getByText(/^\d\d:\d\d$/).first());
      await a.wait(1400);
      a.mark('focus');
      await a.jump((45 * 60 - 4) * 1000);
      a.mark('jump');
      await a.wait(5200);
      a.mark('dialog');
      await a.box('dialog', page.getByRole('dialog').last());
      const input = page.getByPlaceholder(/例如/).first();
      await a.move(input, 600);
      await a.type(input, '完成第三章第二节初稿', 70);
      await a.wait(400);
      await a.click(page.getByRole('button', { name: '完成任务', exact: true }), { ms: 700 });
      a.mark('done');
      await a.wait(1200);
      await a.box('streak37', page.getByText('#37').last());
      await a.move(page.getByText('#37').last(), 900);
      a.mark('streak');
      await a.wait(2600);
    },
  },

  precedent: {
    async run(a) {
      const { page } = a;
      await a.click(startBtn(page), { ms: 800 });
      a.mark('start');
      await a.wait(2200);
      await a.click(page.getByRole('button', { name: '暂停', exact: true }), { ms: 700 });
      a.mark('dialog');
      await a.wait(600);
      await a.box('dialog', page.getByRole('dialog').last());
      await a.box('rule', page.getByText('去洗手间', { exact: true }));
      await a.box('used', page.getByText(/使用过 12 次/).first());
      await a.wait(800);
      await a.click(page.getByText('去洗手间', { exact: true }), { ms: 900 });
      a.mark('paused');
      await a.wait(2000);
      await a.click(page.getByRole('button', { name: '继续', exact: true }).or(page.getByRole('button', { name: /继续|恢复/ })).first(), { ms: 700 });
      a.mark('resumed');
      await a.wait(1400);
      a.mark('hold');
      await a.box('interrupt', page.getByRole('button', { name: '长按中断' }));
      await a.hold(page.getByRole('button', { name: '长按中断' }), 1500);
      a.mark('confirm');
      await a.wait(400);
      await a.box('confirmDlg', page.getByText('确认中断任务').locator('..').locator('..'));
      await a.wait(1200);
      await a.move(page.getByRole('button', { name: '确认中断', exact: true }), 700);
      await a.wait(1800);
    },
  },

  delay: {
    async run(a) {
      const { page } = a;
      await page.evaluate(() => window.scrollTo(0, 360));
      await a.wait(500);
      a.mark('home');
      await a.click(page.getByRole('button', { name: '预约', exact: true }).first(), { ms: 900 });
      a.mark('booked');
      await a.wait(600);
      await a.box('card', page.locator('div', { has: page.getByRole('heading', { name: '论文写作' }) }).filter({ hasText: '主链记录' }).last());
      await a.box('countdown', page.getByText(/预约信号/).first().locator('..').locator('..'));
      await a.wait(2600);
      await a.jump((14 * 60 + 44) * 1000);
      a.mark('jump');
      await a.wait(1600);
      await a.click(page.getByRole('button', { name: '完成预约', exact: true }).first(), { ms: 800 });
      a.mark('complete');
      await a.wait(900);
      await a.box('aux', page.getByText('#22').first());
      await a.wait(1700);
    },
  },

  rsip: {
    path: '?view=rsip',
    async run(a) {
      const { page } = a;
      const jumpTo = async (loc, offset = 90) => {
        const y = await loc.evaluate((e, off) => e.getBoundingClientRect().top + window.scrollY - off, offset);
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
      };
      a.mark('tree');
      await a.box('form', page.getByRole('button', { name: '新增国策', exact: true }).locator('xpath=ancestor::div[contains(@class,"bento-card")][1]'));
      await a.wait(800);
      const parent = page.locator('select').first();
      const opts = await parent.locator('option').allInnerTexts();
      await a.move(parent, 700);
      await parent.selectOption({ index: opts.findIndex((o) => o.includes('预备仪式')) });
      await a.wait(300);
      await a.type(page.getByPlaceholder(/例如：进门/).first(), '电子宵禁', 110);
      await a.type(page.getByPlaceholder(/例如：回家即启动/).first(), '23:30 后不打开短视频 App', 55);
      await a.click(page.getByRole('button', { name: '新增国策', exact: true }), { ms: 700 });
      a.mark('added');
      await a.wait(900);
      // the tree canvas, fitted to its content
      const fit = page.getByRole('button', { name: '适应内容', exact: true });
      await jumpTo(page.locator('.rsip-canvas-content').first(), 160);
      await a.wait(300);
      a.mark('canvasCut');
      await a.click(fit, { ms: 700 });
      await a.wait(700);
      a.mark('canvas');
      await a.box('canvas', page.locator('.rsip-canvas-content').first().locator('..'));
      await a.wait(2600);
      // phase cards
      await jumpTo(page.getByRole('heading', { name: '定式执行追踪' }).first(), 24);
      a.mark('cardsCut');
      await a.wait(500);
      a.mark('cards');
      await a.box('cards', page.getByRole('heading', { name: '定式执行追踪' }).locator('..'));
      await a.wait(2400);
      const card = page.locator('div.rounded-2xl', { has: page.getByRole('heading', { name: '不带手机上沙发' }) }).last();
      await a.click(card.getByRole('button', { name: '已违反' }).first(), { ms: 900 });
      a.mark('violationDialog');
      await a.wait(500);
      await a.box('vdialog', page.getByText('确认违反国策').first().locator('xpath=ancestor::div[contains(@class,"rounded")][2]'));
      await a.wait(2100);
      await a.click(page.getByRole('button', { name: '确认违反', exact: true }), { ms: 800 });
      a.mark('rolled');
      await a.wait(2200);
      await jumpTo(page.locator('.rsip-canvas-content').first(), 160);
      a.mark('canvas2Cut');
      await a.click(fit, { ms: 600 });
      await a.wait(600);
      a.mark('canvas2');
      await a.wait(2000);
      await page.evaluate(() => window.scrollTo(0, 0));
      a.mark('historyCut');
      await a.click(page.getByRole('button', { name: '轮次历史', exact: true }), { ms: 800 });
      a.mark('history');
      await a.wait(600);
      await a.box('history', page.getByText('第 2 轮').first().locator('xpath=ancestor::div[contains(@class,"rounded")][1]'));
      await a.wait(2400);
    },
  },
};
