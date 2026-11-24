// App demos: recorded Momentum footage inside a floating window, with a
// camera, a synthetic cursor and bilingual callouts.
import { C, W, H, el, place, makeCanvas, prog, env, ease, clamp, lerp, rgba } from '../engine.js';
import { line, dot, ring, glow } from '../lib/draw.js';

const APP_W = 1440;
const APP_H = 900;
const VIEW_W = 1280;
const VIEW_H = 800;
const BAR = 38;
const WIN_X = (W - VIEW_W) / 2;
const WIN_Y = 40;
const S0 = VIEW_W / APP_W;
const XFD = 0.3;

const metaCache = {};
function loadMeta(clip) {
  metaCache[clip] ??= fetch(`/footage/${clip}/meta.json`).then((r) => r.json());
  return metaCache[clip];
}

function frameAt(meta, ct) {
  const f = meta.frames;
  let lo = 0;
  let hi = f.length - 1;
  if (ct <= f[0]) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (f[mid] <= ct) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
const frameUrl = (clip, i) => `/footage/${clip}/f${String(i).padStart(5, '0')}.jpg`;

async function show(img, url) {
  if (img.dataset.src === url) return;
  img.dataset.src = url;
  img.src = url;
  try {
    await img.decode();
  } catch {
    /* a missing frame keeps the previous picture */
  }
}

/** Lays segments end to end with short cross-fades. */
function layout(segs) {
  let t = 0;
  return segs.map((s, i) => {
    const speed = s.speed ?? 1;
    const d = (s.b - s.a) / speed;
    const start = i === 0 ? 0 : t - (s.cut ? 0 : XFD);
    t = start + d;
    return { ...s, speed, start, end: t };
  });
}

function cursorAt(meta, ct) {
  const cs = meta.cursor;
  if (!cs.length) return null;
  let i = cs.findIndex((c) => c.t > ct);
  if (i === -1) return cs.at(-1);
  if (i === 0) return cs[0];
  const a = cs[i - 1];
  const b = cs[i];
  const f = clamp((ct - a.t) / Math.max(1e-3, b.t - a.t));
  return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), down: a.down };
}

function camAt(keys, t) {
  let cur = keys[0].slice(1, 4);
  for (let i = 1; i < keys.length; i++) {
    const [ti, x, y, z, dur = 1.2] = keys[i];
    if (t < ti) break;
    const e = ease.inOut(clamp((t - ti) / Math.max(dur, 1e-3)));
    cur = [lerp(cur[0], x, e), lerp(cur[1], y, e), lerp(cur[2], z, e)];
  }
  return cur;
}

const CURSOR_SVG = `<svg width="26" height="34" viewBox="0 0 26 34"><path d="M2 2 L2 26 L8.2 20.6 L12.6 31 L17 29 L12.7 19 L21 19 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

function makeDemo(edl) {
  return {
    band: 1,
    setup(root) {
      const ctx = makeCanvas(root);
      const win = el('div', 'window', root);
      win.style.width = `${VIEW_W}px`;
      win.style.height = `${VIEW_H + BAR}px`;
      const bar = el('div', 'bar', win);
      [18, 38, 58].forEach((x) => (el('i', '', bar).style.left = `${x}px`));
      el('div', 'url', bar, edl.url ?? 'Momentum');
      const view = el('div', 'view', win);
      view.style.width = `${VIEW_W}px`;
      view.style.height = `${VIEW_H}px`;
      const imgA = el('img', '', view);
      const imgB = el('img', '', view);
      for (const im of [imgA, imgB]) {
        im.style.width = `${APP_W * 1.5}px`;
        im.style.height = `${APP_H * 1.5}px`;
      }
      const cursor = el('div', 'abs', root, CURSOR_SVG);
      cursor.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,.5))';
      cursor.style.transformOrigin = '0 0';
      const callouts = (edl.callouts ?? []).map((c) => {
        const e = el('div', 'callout', root, `${c.zh}<span class="en">${c.en}</span>`);
        e.style.opacity = '0';
        return e;
      });
      const labels = (edl.labels ?? []).map((c) => el('div', 'abs', root, `<div style="padding:10px 22px;border-radius:999px;background:rgba(10,11,15,.82);border:1px solid rgba(237,232,221,.18);font-family:var(--zh-sans);font-size:22px;font-weight:500;letter-spacing:.12em">${c.zh}<span style="font-family:var(--en-sans);font-size:14px;letter-spacing:.26em;margin-left:14px;color:rgba(237,232,221,.6);text-transform:uppercase">${c.en}</span></div>`));
      const st = { ctx, win, imgA, imgB, cursor, callouts, labels, segs: layout(edl.segs) };
      st.ready = loadMeta(edl.clip).then((m) => (st.meta = m));
      return st;
    },
    render(t, S, st) {
      const { ctx, win, imgA, imgB, cursor, segs, meta } = st;
      ctx.clear();
      if (!meta) return;
      // window entrance
      const enter = prog(t, -0.3, 1.1, ease.out);
      const lift = (1 - enter) * 30;
      win.style.transform = `translate(${WIN_X}px, ${WIN_Y + lift}px) scale(${lerp(0.97, 1, enter)})`;
      win.style.opacity = String(enter);
      glow(ctx, W / 2, WIN_Y + 420, 900, C.violet, 0.12 * enter);

      // segment(s) at this moment
      let i = segs.findIndex((s) => t < s.end);
      if (i === -1) i = segs.length - 1;
      const seg = segs[i];
      const ctA = Math.min(seg.b, seg.a + Math.max(0, t - seg.start) * seg.speed);
      const next = segs[i + 1];
      const fadeB = next && !next.cut ? clamp((t - next.start) / XFD) : 0;
      const ctB = next ? next.a + Math.max(0, t - next.start) * next.speed : 0;

      // camera
      const [cx, cy, z] = camAt(edl.cam, t);
      const s = S0 * z;
      let tx = VIEW_W / 2 - cx * s;
      let ty = VIEW_H / 2 - cy * s;
      tx = clamp(tx, VIEW_W - APP_W * s, 0);
      ty = clamp(ty, VIEW_H - APP_H * s, 0);
      const tf = `translate(${tx}px, ${ty}px) scale(${s / 1.5})`;
      imgA.style.transform = tf;
      imgB.style.transform = tf;
      imgB.style.opacity = String(fadeB);
      imgB.style.visibility = fadeB > 0 ? 'visible' : 'hidden';
      const jobs = [show(imgA, frameUrl(edl.clip, frameAt(meta, ctA)))];
      if (fadeB > 0) jobs.push(show(imgB, frameUrl(edl.clip, frameAt(meta, ctB))));

      // app → stage mapping
      const ox = WIN_X + tx;
      const oy = WIN_Y + lift + BAR + ty;
      const toStage = (x, y) => [ox + x * s, oy + y * s];

      // cursor (from whichever segment dominates)
      const useB = fadeB > 0.5;
      const cur = cursorAt(meta, useB ? ctB : ctA);
      if (cur && !edl.noCursor) {
        const [px, py] = toStage(cur.x, cur.y);
        const inside = px > WIN_X && px < WIN_X + VIEW_W && py > WIN_Y + BAR && py < WIN_Y + BAR + VIEW_H;
        const cs = 0.85 * Math.sqrt(z) * (cur.down ? 0.9 : 1);
        place(cursor, { x: px - 3, y: py - 3, ax: 0, ay: 0, s: cs, o: inside ? enter : 0 });
        // ripples for recent clicks
        const ct = useB ? ctB : ctA;
        for (const c of meta.cursor) {
          if (!c.click) continue;
          const age = ct - c.t;
          if (age < 0 || age > 0.6) continue;
          const [rx, ry] = toStage(c.x, c.y);
          ring(ctx, rx, ry, 10 + age * 70, '#ffffff', 2, (1 - age / 0.6) * 0.8);
        }
      } else place(cursor, { o: 0 });

      // callouts sit just outside the window edge, tied to the UI by a hairline
      (edl.callouts ?? []).forEach((c, k) => {
        const e = st.callouts[k];
        const a = env(t, c.t0, c.t1, 0.35, 0.35);
        if (a <= 0) {
          e.style.opacity = '0';
          return;
        }
        const box = c.at ?? meta.boxes[c.box];
        const ax = box.w !== undefined ? box.x + box.w * (c.fx ?? 0.5) : box.x;
        const ay = box.w !== undefined ? box.y + box.h * (c.fy ?? 0.5) : box.y;
        const [px, py] = toStage(ax, ay);
        const right = (c.side ?? 'right') === 'right';
        const bx = right ? WIN_X + VIEW_W - 36 : WIN_X + 36;
        const by = clamp(py + (c.dy ?? 0), WIN_Y + 90, WIN_Y + BAR + VIEW_H - 50);
        e.style.left = `${bx}px`;
        e.style.top = `${by}px`;
        e.style.transform = `translate(${right ? '0' : '-100%'}, -50%) translateX(${(1 - a) * (right ? 14 : -14)}px)`;
        e.style.opacity = String(a);
        const p = ease.out(clamp((t - c.t0) / 0.6));
        const kx = right ? Math.max(px + 40, bx - 70) : Math.min(px - 40, bx + 70);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = rgba(C.gold, 0.85);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(lerp(px, kx, p), lerp(py, by, p));
        if (p > 0.99) ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.restore();
        dot(ctx, px, py, 5, C.gold, a, 12);
        ring(ctx, px, py, 12 + Math.sin(t * 4) * 1.5, C.gold, 1.2, a * 0.6);
      });
      (edl.labels ?? []).forEach((c, k) => {
        place(st.labels[k], { x: W / 2, y: WIN_Y + BAR + 46, o: env(t, c.t0, c.t1, 0.3, 0.4) });
      });
      return Promise.all(jobs);
    },
  };
}

// ───────────────────────── edit decision lists
const seat = makeDemo({
  clip: 'seat',
  segs: [
    { a: 0.3, b: 4.75 },
    // skip the lazy-load spinner between the dashboard and focus mode
    { a: 5.25, b: 7.3, cut: true },
    { a: 7.45, b: 8.7 },
    { a: 12.6, b: 16.7 },
    { a: 17.0, b: 22.4 },
  ],
  cam: [
    [0, 720, 450, 1],
    [0.7, 300, 760, 1.85, 1.6],
    [4.45, 720, 430, 1.25, 0.01],
    [7.1, 720, 450, 1.45, 0.6],
    [11.0, 500, 640, 1.15, 0.01],
    [12.2, 260, 800, 2.1, 1.4],
  ],
  callouts: [
    { t0: 1.6, t1: 4.4, box: 'trigger', fx: 0.16, fy: 0.5, dy: -60, zh: '神圣座位<br>戴上降噪耳机', en: 'the sacred seat · a trigger' },
    { t0: 5.0, t1: 6.6, box: 'timer', fx: 0.96, fy: 0.2, dy: -40, zh: '专注 45 分钟', en: '45 minutes, at your best' },
    { t0: 13.0, t1: 16.4, box: 'streak37', fx: 0.95, fy: 0.5, dy: -90, zh: '链条 +1 → #37', en: 'the chain grows' },
  ],
  labels: [{ t0: 6.2, t1: 8.2, zh: '45 分钟后', en: '45 minutes later' }],
});

const precedent = makeDemo({
  clip: 'precedent',
  segs: [
    { a: 2.9, b: 5.9 },
    { a: 5.95, b: 10.9 },
    { a: 13.6, b: 21.7 },
  ],
  cam: [
    [0, 720, 430, 1.1],
    [2.8, 700, 480, 1.45, 1.0],
    [7.4, 900, 600, 1.15, 0.01],
    [8.6, 1180, 760, 1.7, 1.2],
    [10.7, 720, 450, 1.55, 1.0],
  ],
  callouts: [
    { t0: 3.9, t1: 7.3, box: 'used', fx: 1, fy: 0.5, dy: -40, zh: '判例<br>已援引 12 次', en: 'precedent · cited 12 times' },
    { t0: 11.6, t1: 15.2, box: 'confirmDlg', fx: 0.86, fy: 0.42, dy: -60, zh: '不援引判例<br>主链清零', en: 'no precedent → reset' },
  ],
});

const delay = makeDemo({
  clip: 'delay',
  segs: [
    { a: 0.6, b: 5.8 },
    { a: 5.85, b: 12.3 },
  ],
  cam: [
    [0, 720, 520, 1.1],
    [1.3, 300, 760, 1.75, 1.3],
    [8.4, 360, 690, 2.0, 1.0],
  ],
  callouts: [
    { t0: 2.9, t1: 5.2, box: 'countdown', fx: 0.92, fy: 0.5, dy: -40, zh: '打响指<br>15 分钟内入座', en: 'snap · seat within 15 min' },
    { t0: 9.2, t1: 14.2, box: 'aux', fx: 1, fy: 0.5, dy: -60, zh: '预约链 +1 → #22', en: 'the booking chain grows' },
  ],
  labels: [{ t0: 4.9, t1: 6.9, zh: '14 分钟后', en: '14 minutes later' }],
});

const rsip = makeDemo({
  clip: 'rsip',
  segs: [
    { a: 0.3, b: 6.0, speed: 1.5 },
    { a: 8.9, b: 11.4, cut: true },
    { a: 11.95, b: 16.0, cut: true },
    { a: 16.4, b: 19.6, cut: true },
    { a: 23.0, b: 25.8, cut: true },
    { a: 27.95, b: 29.8, cut: true },
    { a: 31.75, b: 35.1, cut: true },
  ],
  cam: [
    [0, 720, 520, 1.12],
    [3.4, 720, 290, 1.1, 0.01],
    [5.8, 720, 430, 1.02, 0.01],
    [9.4, 718, 446, 1.6, 0.01],
    [12.6, 720, 430, 1.02, 0.01],
    [15.1, 720, 290, 1.1, 0.01],
    [16.6, 720, 330, 1.12, 0.01],
  ],
  callouts: [
    { t0: 0.8, t1: 3.4, box: 'form', fx: 0.98, fy: 0.84, dy: -40, zh: '每天最多<br>新增一个国策', en: 'one new policy a day' },
    { t0: 6.2, t1: 7.9, at: { x: 445, y: 97 }, side: 'left', dy: 40, zh: 'E2 · 内化', en: 'internalised' },
    { t0: 7.4, t1: 9.6, at: { x: 1300, y: 355 }, dy: 40, zh: 'E1 · 稳定', en: 'stable' },
    { t0: 10.0, t1: 12.6, at: { x: 880, y: 300 }, dy: -40, zh: '删除该国策<br>及其所有子孙', en: 'node + all descendants' },
    { t0: 17.4, t1: 20.6, box: 'history', fx: 0.6, fy: 0.75, dy: 40, zh: '每一次崩塌<br>都留下原因', en: 'every collapse, a reason' },
  ],
});

// ───────────────────────── outro: a slow montage that resolves into the title card
const outro = {
  band: 0.7,
  setup(root) {
    const ctx = makeCanvas(root);
    const shots = [
      { clip: 'rsip', t: 9.5, x: 560, y: 430, s: 0.42, r: -4 },
      { clip: 'precedent', t: 7.6, x: 1360, y: 430, s: 0.42, r: 4 },
      { clip: 'seat', t: 1.0, x: 960, y: 470, s: 0.6, r: 0 },
    ].map((sh) => {
      const w = el('div', 'window', root);
      w.style.width = `${APP_W}px`;
      w.style.height = `${APP_H}px`;
      w.style.transformOrigin = '50% 50%';
      const img = el('img', '', w);
      img.style.cssText = `width:${APP_W}px;height:${APP_H}px;display:block`;
      return { ...sh, w, img };
    });
    const logo = el('div', 'abs en-serif', root, 'Momentum');
    logo.style.cssText += 'font-size:132px;letter-spacing:0.04em;color:#f3eee4;';
    const tag = el('div', 'abs', root, '<span class="zh-serif" style="font-size:30px;letter-spacing:.32em">把 CTDP 与 RSIP 带进你的每一天</span>');
    const repo = el('div', 'abs en-sans', root, 'github.com/KenXiao1/momentum');
    repo.style.cssText += 'font-size:19px;letter-spacing:0.18em;color:#e9b65c;';
    const credits = el('div', 'abs', root, `
      <div style="display:grid;grid-template-columns:auto auto;column-gap:28px;row-gap:12px;font-size:18px;color:rgba(237,232,221,.62)">
        <div class="caps" style="text-align:right;font-size:13px;line-height:26px">理论 · Theory</div><div><span class="zh-sans">Edmond《如何提高自制力？》 知乎 2025</span></div>
        <div class="caps" style="text-align:right;font-size:13px;line-height:26px">应用 · App</div><div class="en-sans">Momentum — open source, local-first</div>
        <div class="caps" style="text-align:right;font-size:13px;line-height:26px">制作 · Made</div><div><span class="zh-sans">画面、配乐与字幕均由代码生成</span><span class="en-sans" style="margin-left:12px;font-style:italic">visuals, score &amp; subtitles generated in code</span></div>
      </div>`);
    const st = { ctx, shots, logo, tag, repo, credits };
    st.ready = Promise.all(shots.map(async (sh) => {
      const m = await loadMeta(sh.clip);
      await show(sh.img, frameUrl(sh.clip, frameAt(m, sh.t)));
    }));
    return st;
  },
  render(t, S, st) {
    const { ctx, shots, logo, tag, repo, credits } = st;
    ctx.clear();
    const out = prog(t, 8.2, 2.2, ease.inOut);
    shots.forEach((sh, i) => {
      const a = prog(t, 0.2 + i * 0.5, 1.4) * (1 - out);
      const drift = t * (i === 2 ? 6 : i === 0 ? -9 : 9);
      const sc = sh.s * (1 + t * 0.008) * lerp(1, 0.9, out);
      sh.w.style.transform = `translate(${sh.x - APP_W / 2 + drift}px, ${sh.y - APP_H / 2 + (1 - a) * 30}px) scale(${sc}) rotate(${sh.r}deg)`;
      sh.w.style.opacity = String(a * (i === 2 ? 1 : 0.75));
      sh.w.style.filter = out > 0 ? `blur(${out * 10}px)` : '';
    });
    glow(ctx, W / 2, 450, 900, C.gold, 0.2 * prog(t, 8.8, 2));
    const la = prog(t, 9.2, 1.6, ease.out);
    place(logo, { x: W / 2, y: 380, o: la, blur: (1 - la) * 12 });
    const lw = prog(t, 10.0, 1.6);
    line(ctx, W / 2 - 260 * lw, 470, W / 2 + 260 * lw, 470, rgba(C.gold, 0.7), 1.2);
    place(tag, { x: W / 2 + 14, y: 520, o: prog(t, 10.6, 1.2) });
    place(repo, { x: W / 2 + 10, y: 580, o: prog(t, 11.4, 1.2) });
    place(credits, { x: W / 2, y: 740, o: prog(t, 12.6, 1.4) * (1 - prog(t, S.dur - 1.2, 1.2)) });
  },
};

export default {
  'demo-seat': seat,
  'demo-precedent': precedent,
  'demo-delay': delay,
  'demo-rsip': rsip,
  outro,
};
