// Records Momentum demo clips as screencast frames plus a cursor log.
//   node video/capture/record.mjs [clip ...]
// Output: video/footage/<clip>/f00000.jpg … and meta.json
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_URL, initScript } from './common.mjs';
import { CLIPS } from './clips.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FOOT = path.join(HERE, '..', 'footage');
const seed = JSON.parse(await readFile(path.join(HERE, 'seed.json'), 'utf8'));
const VW = 1440;
const VH = 900;
const DPR = 1.5;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

async function record(name, script) {
  const dir = path.join(FOOT, name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.clock.install();
  await page.addInitScript(initScript(seed));
  page.on('pageerror', (e) => console.error(`[${name}] pageerror`, e.message));
  await page.goto(APP_URL + (script.path ?? ''));
  await page.waitForTimeout(1800);

  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  const writes = [];
  let t0 = null;
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const ts = metadata.timestamp;
    if (t0 === null) t0 = ts;
    const idx = frames.length;
    frames.push(+(ts - t0).toFixed(4));
    writes.push(writeFile(path.join(dir, `f${String(idx).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64')));
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  const wall0 = Date.now() / 1000;
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: VW * DPR, maxHeight: VH * DPR, everyNthFrame: 1 });

  const cursor = [];
  const marks = {};
  const boxes = {};
  let cx = script.cursorStart?.[0] ?? VW * 0.62;
  let cy = script.cursorStart?.[1] ?? VH * 0.75;
  const now = () => Date.now() / 1000 - wall0;
  const log = (down = false, click = false) => cursor.push({ t: +now().toFixed(3), x: Math.round(cx), y: Math.round(cy), down, click });
  log();

  const center = async (target) => {
    if (Array.isArray(target)) return target;
    const loc = typeof target === 'string' ? page.locator(target).first() : target;
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const b = await loc.boundingBox();
    if (!b) throw new Error(`no box for ${target}`);
    return [b.x + b.width / 2, b.y + b.height / 2];
  };
  const api = {
    page,
    wait: (ms) => page.waitForTimeout(ms),
    mark: (k) => (marks[k] = +now().toFixed(3)),
    async box(k, loc) {
      const b = await loc.boundingBox({ timeout: 3000 }).catch(() => null);
      if (b) boxes[k] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      else console.warn(`[${name}] no box for ${k}`);
    },
    async move(target, ms = 650) {
      const [tx, ty] = await center(target);
      const sx = cx;
      const sy = cy;
      const steps = Math.max(8, Math.round(ms / 16));
      for (let i = 1; i <= steps; i++) {
        const e = easeInOut(i / steps);
        cx = sx + (tx - sx) * e;
        cy = sy + (ty - sy) * e + Math.sin(Math.PI * e) * -18;
        await page.mouse.move(cx, cy);
        log();
        await page.waitForTimeout(ms / steps);
      }
    },
    async click(target, { ms = 650, pause = 140 } = {}) {
      if (target) await api.move(target, ms);
      await page.waitForTimeout(pause);
      await page.mouse.down();
      log(true, true);
      await page.waitForTimeout(90);
      await page.mouse.up();
      log(false);
    },
    async hold(target, ms) {
      if (target) await api.move(target);
      await page.mouse.down();
      log(true);
      const end = Date.now() + ms;
      while (Date.now() < end) {
        await page.waitForTimeout(100);
        log(true);
      }
      await page.mouse.up();
      log(false);
    },
    async type(locator, text, delay = 85) {
      await locator.click();
      for (const ch of text) {
        await page.keyboard.insertText(ch);
        await page.waitForTimeout(delay);
      }
    },
    jump: (ms) => page.clock.fastForward(ms),
    async scroll(dy, ms = 900) {
      const steps = Math.round(ms / 16);
      for (let i = 0; i < steps; i++) {
        const e0 = easeInOut(i / steps);
        const e1 = easeInOut((i + 1) / steps);
        await page.mouse.wheel(0, dy * (e1 - e0));
        await page.waitForTimeout(16);
      }
    },
  };

  await script.run(api);
  await page.waitForTimeout(400);
  await cdp.send('Page.stopScreencast');
  await Promise.all(writes);
  // align wall-clock logs with screencast timestamps
  const offset = t0 - wall0;
  const shift = (t) => +(t - offset).toFixed(3);
  const meta = {
    name,
    viewport: { width: VW, height: VH, dpr: DPR },
    frames,
    duration: frames.at(-1),
    cursor: cursor.map((c) => ({ ...c, t: shift(c.t) })),
    marks: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, shift(v)])),
    boxes,
  };
  await writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta));
  const fps = frames.length / meta.duration;
  console.log(`${name}: ${frames.length} frames over ${meta.duration.toFixed(1)}s (${fps.toFixed(1)} fps) marks=${JSON.stringify(meta.marks)}`);
  await browser.close();
}

const wanted = process.argv.slice(2);
for (const [name, script] of Object.entries(CLIPS)) {
  if (wanted.length && !wanted.includes(name)) continue;
  await record(name, script);
}
