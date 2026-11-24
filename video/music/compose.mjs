#!/usr/bin/env node
// Renders the score to video/out/score.wav, aligned to out/timeline.json.
//   node video/render.mjs timeline && node video/music/compose.mjs
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../tools/server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.join(HERE, '..');
const OUT = path.join(VIDEO, 'out');
const SR = 48000;
const SECTION = 60;

const TL = JSON.parse(await readFile(path.join(OUT, 'timeline.json'), 'utf8'));
const total = Math.ceil((TL.duration + 1) * SR);
const L = new Float32Array(total);
const R = new Float32Array(total);

const server = await serve(VIDEO);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto(`http://127.0.0.1:${server.port}/film/index.html`);
await page.evaluate(async () => {
  window.__score = await import('/music/score.js');
});
const nEvents = await page.evaluate((tl) => {
  window.__events = window.__score.buildScore(tl);
  return window.__events.length;
}, TL);
console.log(`${nEvents} events`);

for (let s0 = 0; s0 < TL.duration; s0 += SECTION) {
  const s1 = Math.min(TL.duration, s0 + SECTION);
  const t = Date.now();
  const b64 = await page.evaluate(async ([a, b]) => {
    const { L, R } = await window.__score.renderSection(window.__events, a, b);
    const toB64 = (f) => {
      const u = new Uint8Array(f.buffer);
      let s = '';
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return btoa(s);
    };
    return [toB64(L), toB64(R)];
  }, [s0, s1]);
  const toF = (b) => {
    const buf = Buffer.from(b, 'base64');
    return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  };
  const l = toF(b64[0]);
  const r = toF(b64[1]);
  const off = Math.round(s0 * SR);
  for (let i = 0; i < l.length && off + i < total; i++) {
    L[off + i] += l[i];
    R[off + i] += r[i];
  }
  console.log(`section ${s0}–${s1}s rendered in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
await browser.close();
server.close();

// gentle fades at the very start and end
const fade = (a, n, out) => {
  for (let i = 0; i < n; i++) {
    const g = i / n;
    const k = out ? a.length - 1 - i : i;
    a[k] *= g;
  }
};
[L, R].forEach((a) => {
  fade(a, SR * 0.5, false);
  fade(a, SR * 3, true);
});

// 32-bit float WAV, then loudness-normalise with ffmpeg
const raw = path.join(OUT, 'score.raw.wav');
const data = Buffer.alloc(total * 8);
for (let i = 0; i < total; i++) {
  data.writeFloatLE(L[i], i * 8);
  data.writeFloatLE(R[i], i * 8 + 4);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0);
hdr.writeUInt32LE(36 + data.length, 4);
hdr.write('WAVE', 8);
hdr.write('fmt ', 12);
hdr.writeUInt32LE(16, 16);
hdr.writeUInt16LE(3, 20);
hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24);
hdr.writeUInt32LE(SR * 8, 28);
hdr.writeUInt16LE(8, 32);
hdr.writeUInt16LE(32, 34);
hdr.write('data', 36);
hdr.writeUInt32LE(data.length, 40);
await writeFile(raw, Buffer.concat([hdr, data]));

// raise to about −16 LUFS and catch the transients with a true-peak limiter
const final = path.join(OUT, 'score.wav');
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', 'volume=11.6dB,alimiter=limit=0.84:level=false:attack=4:release=150',
  '-ar', String(SR), '-c:a', 'pcm_s24le', final], { stdio: 'inherit' });
console.log('score →', final);
