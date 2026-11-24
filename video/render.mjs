#!/usr/bin/env node
// Renders the film frame by frame in headless Chromium and encodes with ffmpeg.
//
//   node video/render.mjs preview --t 3,12.5           single frames → out/preview
//   node video/render.mjs preview --scene curves --n 8  evenly spaced frames + contact sheet
//   node video/render.mjs film [--fps 60] [--workers 10] [--from 0 --to 30]
//   node video/render.mjs subs                           SRT/VTT only
//   node video/render.mjs timeline                       print scene timing as JSON

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { serve } from './tools/server.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');

const args = process.argv.slice(2);
const mode = args[0] ?? 'preview';
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};

function run(cmd, argv, { stdin } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: [stdin ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    if (stdin) stdin(p.stdin);
  });
}

async function openFilm(browser, port, scale = 1) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text());
  });
  await page.goto(`http://127.0.0.1:${port}/film/index.html`);
  await page.waitForFunction(() => window.film && window.film.ready);
  await page.evaluate(() => window.film.ready);
  const cdp = await ctx.newCDPSession(page);
  return { page, cdp };
}

async function grab(film, t, fps, format = 'jpeg') {
  await film.page.evaluate(([tt, f]) => window.film.seek(tt, f), [t, fps]);
  const { data } = await film.cdp.send('Page.captureScreenshot', {
    format,
    quality: format === 'jpeg' ? 94 : undefined,
    optimizeForSpeed: true,
  });
  return Buffer.from(data, 'base64');
}

const fmt = (t) => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':') + '.' + String(r).padStart(3, '0');
};

async function writeSubs(cues) {
  await mkdir(OUT, { recursive: true });
  const srt = (pick) =>
    cues.map((c, i) => `${i + 1}\n${fmt(c.start).replace('.', ',')} --> ${fmt(c.end).replace('.', ',')}\n${pick(c)}\n`).join('\n');
  const vtt = (pick) => 'WEBVTT\n\n' + cues.map((c) => `${fmt(c.start)} --> ${fmt(c.end)}\n${pick(c)}\n`).join('\n');
  await writeFile(path.join(OUT, 'subtitles.zh.srt'), srt((c) => c.zh));
  await writeFile(path.join(OUT, 'subtitles.en.srt'), srt((c) => c.en));
  await writeFile(path.join(OUT, 'subtitles.bilingual.srt'), srt((c) => `${c.zh}\n${c.en}`));
  await writeFile(path.join(OUT, 'subtitles.zh.vtt'), vtt((c) => c.zh));
  await writeFile(path.join(OUT, 'subtitles.en.vtt'), vtt((c) => c.en));
  console.log(`subtitles: ${cues.length} cues → ${OUT}`);
}

const server = await serve(HERE);
const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });

try {
  if (mode === 'timeline' || mode === 'subs') {
    const film = await openFilm(browser, server.port);
    const info = await film.page.evaluate(() => ({ duration: window.film.duration, scenes: window.film.scenes, cues: window.film.cues }));
    if (mode === 'subs') await writeSubs(info.cues);
    else {
      await mkdir(OUT, { recursive: true });
      await writeFile(path.join(OUT, 'timeline.json'), JSON.stringify(info, null, 2));
      for (const s of info.scenes) console.log(s.id.padEnd(16), s.start.toFixed(2).padStart(8), s.dur.toFixed(2).padStart(7));
      console.log('duration', info.duration.toFixed(2));
    }
  } else if (mode === 'preview') {
    const dir = path.join(OUT, 'preview');
    await mkdir(dir, { recursive: true });
    const film = await openFilm(browser, server.port);
    const info = await film.page.evaluate(() => ({ duration: window.film.duration, scenes: window.film.scenes }));
    let times = [];
    if (opt('t')) times = opt('t').split(',').map(Number);
    const sceneId = opt('scene');
    if (sceneId) {
      const s = info.scenes.find((x) => x.id === sceneId);
      if (!s) throw new Error(`unknown scene ${sceneId}`);
      const n = Number(opt('n', 6));
      for (let i = 0; i < n; i++) times.push(s.start + (s.dur * (i + 0.5)) / n);
    }
    const files = [];
    for (const t of times) {
      const buf = await grab(film, t, 30, 'png');
      const f = path.join(dir, `${sceneId ?? 'f'}-${t.toFixed(2)}.png`);
      await writeFile(f, buf);
      files.push(f);
    }
    console.log(files.join('\n'));
    if (files.length > 1) {
      const cols = files.length > 4 ? 3 : 2;
      const sheet = path.join(dir, `${sceneId ?? 'sheet'}-sheet.jpg`);
      const inputs = files.flatMap((f) => ['-i', f]);
      const rows = Math.ceil(files.length / cols);
      const layout = files.map((_, i) => `${(i % cols) * 960}_${Math.floor(i / cols) * 540}`).join('|');
      const scaled = files.map((_, i) => `[${i}]scale=960:540[s${i}]`).join(';');
      const stack = files.map((_, i) => `[s${i}]`).join('');
      await run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${scaled};${stack}xstack=inputs=${files.length}:layout=${layout}:fill=black`, '-q:v', '3', sheet]);
      console.log('sheet', sheet, `(${cols}x${rows})`);
    }
  } else if (mode === 'film') {
    const fps = Number(opt('fps', 30));
    const workers = Number(opt('workers', 10));
    const film0 = await openFilm(browser, server.port);
    const info = await film0.page.evaluate(() => ({ duration: window.film.duration, cues: window.film.cues }));
    await film0.page.context().close();
    const from = Number(opt('from', 0));
    const to = Math.min(Number(opt('to', info.duration)), info.duration);
    const f0 = Math.round(from * fps);
    const f1 = Math.round(to * fps);
    const total = f1 - f0;
    const segDir = path.join(OUT, 'segments');
    await rm(segDir, { recursive: true, force: true });
    await mkdir(segDir, { recursive: true });
    const per = Math.ceil(total / workers);
    let done = 0;
    const t0 = Date.now();
    const tick = setInterval(() => {
      const el = (Date.now() - t0) / 1000;
      process.stdout.write(`\rframes ${done}/${total}  ${(done / el).toFixed(1)} fps  eta ${((total - done) / Math.max(1, done / el)).toFixed(0)}s   `);
    }, 2000);
    await Promise.all(
      Array.from({ length: workers }, async (_, w) => {
        const a = f0 + w * per;
        const b = Math.min(f1, a + per);
        if (a >= b) return;
        const film = await openFilm(browser, server.port);
        const seg = path.join(segDir, `seg${String(w).padStart(3, '0')}.mp4`);
        await run(
          'ffmpeg',
          ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-tune', 'film', '-pix_fmt', 'yuv420p',
            '-x264-params', 'keyint=' + fps * 4, seg],
          {
            stdin: async (sink) => {
              for (let f = a; f < b; f++) {
                const buf = await grab(film, f / fps, fps);
                if (!sink.write(buf)) await new Promise((r) => sink.once('drain', r));
                done++;
              }
              sink.end();
            },
          },
        );
        await film.page.context().close();
      }),
    );
    clearInterval(tick);
    console.log(`\nrendered ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    const segs = (await readdir(segDir)).filter((f) => f.endsWith('.mp4')).sort();
    await writeFile(path.join(segDir, 'list.txt'), segs.map((s) => `file '${s}'`).join('\n'));
    const silent = path.join(OUT, 'film-video.mp4');
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(segDir, 'list.txt'), '-c', 'copy', silent]);
    await writeSubs(info.cues);
    const score = path.join(OUT, 'score.wav');
    const final = path.join(OUT, from === 0 && to === info.duration ? 'engineering-the-will.mp4' : 'excerpt.mp4');
    if (existsSync(score)) {
      await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-ss', String(from), '-t', String(to - from), '-i', score,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-shortest', final]);
      console.log('final', final);
    } else {
      console.log('no score.wav yet; silent video at', silent);
    }
  }
} finally {
  await browser.close();
  server.close();
}
