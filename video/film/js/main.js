import { buildTimeline, sceneApi, env, clamp, rng, el } from './engine.js';
import opening from './scenes/opening.js';
import value from './scenes/value.js';
import ctdp from './scenes/ctdp.js';
import scale from './scenes/scale.js';
import rsip from './scenes/rsip.js';
import demo from './scenes/demo.js';
import coda from './scenes/coda.js';

const XF = 0.45; // half of a scene cross-fade

const impls = { ...opening, ...value, ...ctdp, ...scale, ...rsip, ...demo, ...coda };
const TL = buildTimeline(impls);

const scenesRoot = document.getElementById('scenes');
const live = TL.scenes.map((sc) => {
  const root = el('div', 'scene', scenesRoot);
  root.dataset.id = sc.id;
  root.style.display = 'none';
  const S = sceneApi(sc);
  const state = sc.impl.setup?.(root, S) ?? {};
  return { sc, S, root, state, shown: false };
});

// ───────────────────────── subtitles
const subs = document.getElementById('subs');
const subZh = subs.querySelector('.zh');
const subEn = subs.querySelector('.en');
const subLine = subs.querySelector('.line');
const subBand = subs.querySelector('.band');
let subCurrent = null;

function renderSubs(t) {
  const cue = TL.cues.find((c) => t >= c.start - 0.05 && t <= c.end + 0.05);
  if (cue !== subCurrent) {
    subCurrent = cue;
    subZh.textContent = cue ? cue.zh : '';
    subEn.textContent = cue ? cue.en : '';
  }
  if (!cue) {
    subLine.style.opacity = '0';
  } else {
    const o = env(t, cue.start, cue.end, 0.22, 0.26);
    const rise = (1 - clamp((t - cue.start) / 0.35)) * 7;
    subLine.style.opacity = String(o);
    subLine.style.transform = `translateY(${rise}px)`;
  }
  // the legibility band follows whether the current scene wants it
  const sc = TL.scenes.find((s) => t >= s.start && t < s.end) ?? TL.scenes.at(-1);
  const near = TL.cues.some((c) => t > c.start - 0.8 && t < c.end + 0.8);
  subBand.style.opacity = String((sc.impl.band ?? 0.85) * (near ? 1 : 0.4));
}

// ───────────────────────── film grain
const grain = document.getElementById('grain');
const gctx = grain.getContext('2d');
const tiles = [];
{
  const R = rng(7);
  for (let k = 0; k < 6; k++) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const img = x.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (R() + R() + R() - 1.5) * 120;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    tiles.push(c);
  }
}
function renderGrain(frame) {
  const R = rng(frame * 7919 + 13);
  const tile = tiles[frame % tiles.length];
  const ox = Math.floor(R() * 256);
  const oy = Math.floor(R() * 256);
  for (let y = -oy; y < 540; y += 256) for (let x = -ox; x < 960; x += 256) gctx.drawImage(tile, x, y);
}

// ───────────────────────── global fades (head and tail)
const fade = document.getElementById('fade');

async function seek(t, fps = 30) {
  const pending = [];
  for (const L of live) {
    const { sc } = L;
    const local = t - sc.start;
    const visible = t >= sc.start - XF && t < sc.end + XF;
    if (!visible) {
      if (L.shown) {
        L.root.style.display = 'none';
        L.shown = false;
      }
      continue;
    }
    const isFirst = sc === TL.scenes[0];
    const isLast = sc === TL.scenes.at(-1);
    const fin = isFirst ? 1 : clamp((local + XF) / (2 * XF));
    const fout = isLast ? 1 : clamp((sc.dur + XF - local) / (2 * XF));
    L.root.style.display = 'block';
    L.root.style.visibility = 'visible';
    L.root.style.opacity = String(Math.min(fin, fout));
    L.shown = true;
    const r = sc.impl.render(local, L.S, L.state, t);
    if (r && typeof r.then === 'function') pending.push(r);
  }
  renderSubs(t);
  renderGrain(Math.round(t * fps));
  fade.style.opacity = String(Math.max(1 - clamp(t / 1.2), clamp((t - (TL.duration - 1.6)) / 1.6)));
  if (pending.length) await Promise.all(pending);
}

const ready = (async () => {
  const faces = [
    '500 37px "PingFang SC"',
    '400 37px "PingFang SC"',
    '600 37px "PingFang SC"',
    '300 80px "Songti SC"',
    '400 80px "Songti SC"',
    '600 80px "Songti SC"',
    '400 25px "Avenir Next"',
    '500 25px "Avenir Next"',
    '600 25px "Avenir Next"',
    '400 40px "Iowan Old Style"',
    'italic 400 40px "Iowan Old Style"',
  ];
  await Promise.all(faces.map((f) => document.fonts.load(f, '自制力 Will')));
  await Promise.all(live.map((L) => L.state.ready).filter(Boolean));
  await document.fonts.ready;
  await seek(0);
})();

window.film = {
  duration: TL.duration,
  cues: TL.cues.map(({ zh, en, start, end, scene }) => ({ zh, en, start, end, scene })),
  scenes: TL.scenes.map(({ id, start, end, dur, footage, chapter }) => ({ id, start, end, dur, footage, chapter })),
  ready,
  seek,
};
