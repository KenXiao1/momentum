// Deterministic timeline engine. Every visual is a pure function of time, so
// any frame can be rendered independently (and in parallel) by the renderer.

import { SCENES, cueDuration, CUE_GAP } from './script.js';

export const W = 1920;
export const H = 1080;

// ───────────────────────── math helpers
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => {
    const c1 = 1.4;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
};

/** 0→1 progress of `t` across [start, start+dur], eased. */
export function prog(t, start, dur = 1, fn = ease.inOut) {
  if (dur <= 0) return t >= start ? 1 : 0;
  return fn(clamp((t - start) / dur));
}

/** Opacity envelope: fades in at `a`, out at `b`. */
export function env(t, a, b, fin = 0.5, fout = 0.5) {
  return Math.min(prog(t, a, fin, ease.inOutSine), 1 - prog(t, b - fout, fout, ease.inOutSine));
}

// Seeded PRNG (mulberry32) so every frame is reproducible.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ───────────────────────── palette (mirrors css/film.css)
export const C = {
  bg: '#0a0b0f',
  ink: '#ede8dd',
  gold: '#e9b65c',
  cyan: '#5cc8d7',
  rose: '#e0675b',
  sage: '#9ccb8e',
  violet: '#a99be8',
};
export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function mixHex(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16);
  const b = parseInt(h2.slice(1), 16);
  const ch = (s) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

// ───────────────────────── DOM helpers
export function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

/** Positions an absolutely-placed element; values are in stage pixels. */
export function place(e, { x, y, o, s = 1, r = 0, blur = 0, ax = 0.5, ay = 0.5, dx = 0, dy = 0 }) {
  if (x !== undefined) e.style.left = `${x}px`;
  if (y !== undefined) e.style.top = `${y}px`;
  e.style.transform = `translate(${-ax * 100}%, ${-ay * 100}%) translate(${dx}px, ${dy}px) rotate(${r}deg) scale(${s})`;
  if (o !== undefined) {
    e.style.opacity = String(o);
    e.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
  }
  e.style.filter = blur > 0.05 ? `blur(${blur}px)` : '';
}

export function makeCanvas(root, cls = 'layer') {
  const cv = el('canvas', cls, root);
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clear = () => ctx.clearRect(0, 0, W, H);
  return ctx;
}

// ───────────────────────── timeline
export function buildTimeline(impls) {
  let t = 0;
  const scenes = [];
  const cues = [];
  for (const def of SCENES) {
    const impl = impls[def.id];
    if (!impl) throw new Error(`No implementation for scene ${def.id}`);
    const sc = { ...def, impl, start: t, cueTimes: [] };
    let local = def.pre;
    for (const [zh, en, opt = {}] of def.cues) {
      const dur = opt.dur ?? cueDuration(zh, en);
      const cue = { zh, en, start: local, end: local + dur, scene: def.id };
      sc.cueTimes.push(cue);
      cues.push({ ...cue, start: t + local, end: t + local + dur });
      local += dur + (opt.hold ?? 0) + CUE_GAP;
    }
    local += def.post;
    sc.dur = Math.max(local, def.minDur ?? 0, impl.minDur ?? 0);
    sc.end = t + sc.dur;
    scenes.push(sc);
    t += sc.dur;
  }
  return { scenes, cues, duration: t };
}

/** Scene-time accessor handed to every scene implementation. */
export function sceneApi(sc) {
  const S = {
    id: sc.id,
    dur: sc.dur,
    cues: sc.cueTimes,
    /** start time of cue i (negative i counts from the end) */
    at(i, off = 0) {
      const c = sc.cueTimes.at(i);
      return (c ? c.start : 0) + off;
    },
    endOf(i, off = 0) {
      const c = sc.cueTimes.at(i);
      return (c ? c.end : 0) + off;
    },
    /** eased progress beginning `off` seconds after cue i starts */
    p(t, i, off = 0, dur = 1, fn = ease.inOut) {
      return prog(t, S.at(i, off), dur, fn);
    },
  };
  return S;
}
