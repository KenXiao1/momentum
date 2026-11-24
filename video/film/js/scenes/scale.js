// Chapter III — scale: behaviour trees, renormalization, steady states.
import { C, W, H, el, place, makeCanvas, prog, env, ease, clamp, lerp, rgba, hash, mixHex, rng } from '../engine.js';
import { line, lineP, dot, ring, glow, text, arrow, polyP, bez, roundRect } from '../lib/draw.js';

const duo = (root, zh, en, cls = '') => el('div', `abs duo ${cls}`, root, `<span class="zh">${zh}</span><span class="en">${en}</span>`);

// ───────────────────────── limits: two great months, then the larger state turns
const limits = {
  setup(root) {
    const ctx = makeCanvas(root);
    const good = duo(root, '考试季 · 每天 8–10 小时', 'exam season · 8–10 h a day');
    const bad = duo(root, '疲惫 · 闲散 · 无目标', 'tired · idle · aimless');
    const state = duo(root, '大状态', 'the larger state');
    const big = el('div', 'abs zh-serif', root, '尺度');
    big.style.cssText += 'font-size:150px;letter-spacing:0.3em;color:#f1ece2;';
    const bigEn = el('div', 'abs caps', root, 'scale');
    bigEn.style.fontSize = '18px';
    return { ctx, good, bad, state, big, bigEn };
  },
  render(t, S, st) {
    const { ctx } = st;
    ctx.clear();
    const fadeAll = 1 - S.p(t, 2, 0, 1.0);
    const cols = 20;
    const cell = 34;
    const gap = 7;
    const x0 = W / 2 - (cols * (cell + gap)) / 2;
    const y0 = 250;
    const turn = S.p(t, 1, 0, 2.4);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < 7; r++) {
        const i = c * 7 + r;
        const born = prog(t, 0.4 + i * 0.022, 0.4);
        const inGood = c < 9;
        let v = inGood ? 0.65 + 0.35 * hash(i * 1.3) : hash(i * 7.1) < 0.18 ? 0.3 + 0.3 * hash(i) : 0.04;
        if (!inGood) v = lerp(0.55 + 0.3 * hash(i * 2.3), v, turn);
        const col = v > 0.25 ? mixHex('#3a3222', C.gold, v) : '#1a1d24';
        ctx.save();
        ctx.globalAlpha = born * fadeAll;
        ctx.fillStyle = col;
        roundRect(ctx, x0 + c * (cell + gap), y0 + r * (cell + gap), cell, cell, 6);
        ctx.fill();
        if (v > 0.8) {
          ctx.shadowColor = C.gold;
          ctx.shadowBlur = 14;
          ctx.fill();
        }
        ctx.restore();
      }
    }
    place(st.good, { x: x0 + 4.5 * (cell + gap), y: y0 - 48, o: S.p(t, 0, 0.8, 0.8) * fadeAll });
    place(st.bad, { x: x0 + 14.5 * (cell + gap), y: y0 - 48, o: S.p(t, 1, 0.8, 0.8) * fadeAll });
    st.bad.querySelector('.zh').style.color = C.cyan;
    st.good.querySelector('.zh').style.color = C.gold;
    // the larger state underneath
    const cy = 690;
    const width = cols * (cell + gap);
    const f = (u) => 0.9 * Math.exp(-(((u - 0.24) / 0.2) ** 2)) - 1.0 * Math.exp(-(((u - 0.72) / 0.22) ** 2)) * turn + 0.12 * Math.sin(u * 30) * 0.3;
    const pts = [];
    for (let i = 0; i <= 200; i++) pts.push([x0 + (i / 200) * width, cy - f(i / 200) * 80]);
    line(ctx, x0, cy, x0 + width, cy, rgba(C.ink, 0.25), 1.2, S.p(t, 0, 1.2, 1) * fadeAll);
    polyP(ctx, pts, S.p(t, 0, 1.2, 2.2), mixHex(C.gold, C.ink, 0.3), 2.4, fadeAll, 12);
    place(st.state, { x: x0 - 90, y: cy, o: S.p(t, 0, 1.6, 0.8) * fadeAll });
    // scale
    const pb = S.p(t, 2, 0.4, 1.4, ease.out);
    place(st.big, { x: W / 2 + 22, y: 440, o: pb, blur: (1 - pb) * 12 });
    place(st.bigEn, { x: W / 2 + 4, y: 560, o: S.p(t, 2, 0.9, 1) });
    // a logarithmic ruler
    const ra = S.p(t, 2, 1.0, 1.4);
    if (ra > 0) {
      const ticks = [['秒', 'sec'], ['分', 'min'], ['时', 'hour'], ['日', 'day'], ['周', 'week'], ['月', 'month'], ['年', 'year']];
      const rx0 = 560;
      const rx1 = 1360;
      line(ctx, rx0, 660, lerp(rx0, rx1, ra), 660, rgba(C.ink, 0.45), 1.2);
      ticks.forEach(([zh, en], i) => {
        const x = lerp(rx0, rx1, i / (ticks.length - 1));
        const a = prog(t, S.at(2, 1.0 + i * 0.12), 0.5);
        line(ctx, x, 652, x, 668, rgba(C.ink, 0.6), 1.2, a);
        for (let k = 1; k < 5 && i < ticks.length - 1; k++) {
          const xx = x + ((rx1 - rx0) / (ticks.length - 1)) * Math.log10(1 + k * 2.2) * 0.9;
          line(ctx, xx, 656, xx, 664, rgba(C.ink, 0.3), 1, a);
        }
        text(ctx, zh, x, 690, { font: '500 18px "PingFang SC"', color: rgba(C.ink, 0.75), alpha: a });
        text(ctx, en.toUpperCase(), x, 712, { font: '600 11px "Avenir Next"', color: rgba(C.ink, 0.45), alpha: a, spacing: 2 });
      });
    }
  },
};

// ───────────────────────── tree: choices, 99:1, and the inescapable zone
const tree = {
  setup(root) {
    const ctx = makeCanvas(root);
    const sofa = duo(root, '躺上沙发，打开短视频', 'on the sofa, video playing');
    const zone = duo(root, '不可逃逸区', 'inescapable zone');
    const will = duo(root, '有限自由意志', 'bounded free will');
    const nodes = [];
    // a binary tree; the highlighted branch follows choice 0 from depth 2 on
    const build = (d, x, y, spread, id, onPath) => {
      const n = { d, x, y, id, onPath, kids: [] };
      nodes.push(n);
      if (d < 6) {
        const p = onPath && d >= 2 ? 0.99 : 0.35 + 0.3 * hash(id * 3.7);
        n.p = p;
        n.kids.push(build(d + 1, x + 205, y - spread, spread * 0.5, id * 2 + 1, onPath || (d === 1 && id === 1)));
        n.kids.push(build(d + 1, x + 205, y + spread, spread * 0.5, id * 2 + 2, false));
      }
      return n;
    };
    const rootN = build(0, 330, 470, 210, 0, false);
    return { ctx, sofa, zone, will, nodes, rootN };
  },
  render(t, S, st) {
    const { ctx, nodes } = st;
    ctx.clear();
    const collapse = S.p(t, 3, 0.3, 1.6, ease.inOut);
    const panel = S.p(t, 2, 0, 0.8) * (1 - S.p(t, 3, 0, 0.6));
    const treeA = 1 - 0.55 * panel;
    const hi = S.p(t, 1, 0, 1.0);
    ctx.save();
    ctx.globalAlpha = treeA;
    for (const n of nodes) {
      const born = prog(t, 0.2 + n.d * 0.55, 0.7);
      if (born <= 0) continue;
      n.kids.forEach((k, i) => {
        const pk = i === 0 ? n.p : 1 - n.p;
        const onP = k.onPath && n.d >= 2;
        const kb = prog(t, 0.2 + k.d * 0.55, 0.7);
        const strong = onP ? lerp(0.5, 1, hi) : 1;
        const col = onP && hi > 0 ? mixHex(C.ink, C.cyan, hi) : C.ink;
        const w = 0.6 + pk * 3.2 * (n.d >= 2 && (n.onPath || k.onPath) ? lerp(1, 1.3, hi) : 1);
        const a = (0.18 + 0.6 * pk) * kb * (n.onPath && !k.onPath && n.d >= 2 ? lerp(1, 0.4, hi) : 1) * strong;
        const fadeZone = n.onPath && n.d >= 2 ? 1 - collapse : 1;
        polyP(ctx, bez(n.x, n.y, n.x + 100, n.y, k.x - 100, k.y, k.x, k.y, 24), kb, col, w, a * fadeZone, onP ? 10 * hi : 0);
        if (onP && hi > 0 && kb > 0.5) {
          text(ctx, i === 0 ? '99%' : '1%', (n.x + k.x) / 2, (n.y + k.y) / 2 - 14, { font: '500 15px "Avenir Next"', color: i === 0 ? C.cyan : rgba(C.ink, 0.5), alpha: hi * fadeZone });
        }
      });
      const fadeZone = n.onPath && n.d >= 3 ? 1 - collapse : 1;
      dot(ctx, n.x, n.y, n.onPath && n.d >= 2 ? 6 : 4, n.onPath && n.d >= 2 && hi > 0 ? C.cyan : C.ink, born * fadeZone, 8);
      if (n.onPath && n.d === 1 && n.kids[0]) {
        // sofa node marker
      }
    }
    // the inescapable zone: the 99:1 run coarse-grained into one capsule
    const path = nodes.filter((n) => n.onPath && n.d >= 2);
    if (collapse > 0 && path.length) {
      const xA = path[0].x - 30;
      const xB = path.at(-1).x + 40;
      const yA = Math.min(...path.map((n) => n.y)) - 30;
      const yB = Math.max(...path.map((n) => n.y)) + 30;
      const g = ctx.createLinearGradient(xA, 0, xB, 0);
      g.addColorStop(0, rgba(C.cyan, 0.25));
      g.addColorStop(1, rgba(C.cyan, 0.05));
      ctx.save();
      ctx.globalAlpha = collapse;
      ctx.fillStyle = g;
      ctx.strokeStyle = rgba(C.cyan, 0.8);
      ctx.lineWidth = 1.6;
      ctx.shadowColor = C.cyan;
      ctx.shadowBlur = 24;
      roundRect(ctx, lerp(xA + (xB - xA) * 0.3, xA, collapse), yA, lerp((xB - xA) * 0.4, xB - xA, collapse), yB - yA, (yB - yA) / 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      place(st.zone, { x: (xA + xB) / 2, y: yB + 50, o: collapse });
      st.zone.querySelector('.zh').style.color = C.cyan;
    } else place(st.zone, { o: 0 });
    ctx.restore();
    const sofaN = nodes.find((n) => n.onPath && n.d === 2);
    place(st.sofa, { x: sofaN.x, y: sofaN.y - 54, o: hi * (1 - panel) * (1 - collapse * 0.3) });
    st.sofa.querySelector('.zh').style.color = C.cyan;

    // bounded free will: two balances
    if (panel > 0) {
      const bx = 960;
      const rows = [
        { y: 400, a: 0.6, push: 0.16, label: '60 : 40' },
        { y: 600, a: 0.99, push: 0.008, label: '99 : 1' },
      ];
      ctx.save();
      ctx.globalAlpha = panel;
      ctx.fillStyle = 'rgba(10,11,15,0.75)';
      roundRect(ctx, bx - 470, 290, 940, 420, 24);
      ctx.fill();
      rows.forEach((r, i) => {
        const pushT = S.p(t, 2, 1.2 + i * 1.6, 1.0, ease.out) * (1 - S.p(t, 2, 2.4 + i * 1.6, 0.8));
        const split = r.a - r.push * pushT;
        const L = 640;
        const x0 = bx - L / 2;
        ctx.fillStyle = rgba(C.cyan, 0.75);
        roundRect(ctx, x0, r.y - 14, L * split, 28, 6);
        ctx.fill();
        ctx.fillStyle = rgba(C.gold, 0.85);
        roundRect(ctx, x0 + L * split + 3, r.y - 14, Math.max(0, L * (1 - split) - 3), 28, 6);
        ctx.fill();
        text(ctx, r.label, x0 - 30, r.y, { font: '500 30px "Iowan Old Style"', color: C.ink, align: 'right' });
        // the will: a small arrow pressing the boundary
        const hx = x0 + L * split;
        arrow(ctx, hx + 70, r.y - 44, hx + 6, r.y - 18, '#ffffff', 2, 0.9, 10);
        text(ctx, i === 0 ? '可以撬动' : '纹丝不动', x0 + L + 30, r.y - 8, { font: '500 20px "PingFang SC"', color: i === 0 ? C.gold : C.rose, align: 'left' });
        text(ctx, i === 0 ? 'the will can tip it' : 'the will cannot', x0 + L + 30, r.y + 16, { font: '500 13px "Avenir Next"', color: rgba(C.ink, 0.55), align: 'left' });
      });
      ctx.restore();
      place(st.will, { x: bx, y: 330, o: panel });
    } else place(st.will, { o: 0 });
  },
};

// ───────────────────────── rg: block-spin renormalization
const NX = 256;
const NY = 144;
function buildLattice() {
  const R = rng(42);
  // a labyrinth of domains: a few long-wavelength waves (the weak, long-range order)
  const waves = Array.from({ length: 5 }, () => {
    const a = R() * Math.PI;
    return { kx: Math.cos(a), ky: Math.sin(a), ph: R() * 6.28 };
  });
  const k = (2 * Math.PI) / 70;
  const field = new Float32Array(NX * NY);
  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      let f = 0;
      for (const w of waves) f += Math.cos(k * (w.kx * x + w.ky * y) + w.ph + 0.9 * Math.sin(0.05 * y + 0.03 * x));
      field[y * NX + x] = f;
    }
  }
  // small clusters (strong, short-range order) as smooth fine-scale noise
  const coarse = (s, seed) => {
    const Rr = rng(seed);
    const gw = Math.ceil(NX / s) + 2;
    const gh = Math.ceil(NY / s) + 2;
    const g = Array.from({ length: gw * gh }, () => Rr() * 2 - 1);
    return (x, y) => {
      const fx = x / s;
      const fy = y / s;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const u = fx - ix;
      const v = fy - iy;
      const a = g[iy * gw + ix];
      const b = g[iy * gw + ix + 1];
      const c = g[(iy + 1) * gw + ix];
      const d = g[(iy + 1) * gw + ix + 1];
      const su = u * u * (3 - 2 * u);
      const sv = v * v * (3 - 2 * v);
      return lerp(lerp(a, b, su), lerp(c, d, su), sv);
    };
  };
  const n1 = coarse(2.6, 7);
  const spins = new Int8Array(NX * NY);
  const noise = new Float32Array(NX * NY);
  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      const i = y * NX + x;
      noise[i] = n1(x, y) * 3.4 + (R() - 0.5) * 1.2;
      spins[i] = field[i] + noise[i] >= 0 ? 1 : -1;
    }
  }
  const levels = [spins];
  for (let l = 1; l <= 4; l++) {
    const b = 1 << l;
    const w = NX / b;
    const h = NY / b;
    const prev = levels[l - 1];
    const pw = NX / (b / 2);
    const out = new Int8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = prev[2 * y * pw + 2 * x] + prev[2 * y * pw + 2 * x + 1] + prev[(2 * y + 1) * pw + 2 * x] + prev[(2 * y + 1) * pw + 2 * x + 1];
        out[y * w + x] = s > 0 ? 1 : s < 0 ? -1 : field[(y * b + b / 2) * NX + x * b + b / 2] >= 0 ? 1 : -1;
      }
    }
    levels.push(out);
  }
  return { field, noise, levels };
}

function levelImage(levels, l) {
  const b = 1 << l;
  const w = NX / b;
  const h = NY / b;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  const img = x.createImageData(w, h);
  // deep, low-chroma versions of gold and cyan so the field glows rather than shouts
  const up = [168, 128, 66];
  const dn = [42, 104, 116];
  for (let i = 0; i < w * h; i++) {
    const col = levels[l][i] > 0 ? up : dn;
    img.data.set([...col, 255], i * 4);
  }
  x.putImageData(img, 0, 0);
  return c;
}

const rg = {
  setup(root) {
    const ctx = makeCanvas(root);
    const lat = buildLattice();
    const imgs = [0, 1, 2, 3, 4].map((l) => levelImage(lat.levels, l));
    const lvl = el('div', 'abs', root);
    lvl.style.cssText += 'font-family:var(--en-serif);font-size:26px;color:#e9b65c;letter-spacing:.08em';
    const exch = duo(root, '交换作用：强 · 短程', 'exchange · strong, short-range');
    const dip = duo(root, '偶极作用：弱 · 长程', 'dipolar · weak, long-range');
    const chart = duo(root, '谁说了算，取决于尺度', 'who rules depends on scale');
    return { ctx, lat, imgs, lvl, exch, dip, chart };
  },
  render(t, S, st, tAbs) {
    const { ctx, lat, imgs } = st;
    ctx.clear();
    // merge schedule: L0→L1→L2→L3 during cue 2 (and its hold)
    const m0 = S.at(2, 0.6);
    const mDur = 2.5;
    const mp = [0, 1, 2].map((k) => clamp((t - (m0 + k * mDur)) / mDur));
    const level = mp.reduce((a, b) => a + b, 0); // 0..3 continuous
    const L = Math.min(2, Math.floor(level));
    const f = level - L; // progress within current merge
    // camera: block pixels stay ~56px; then pull out to the whole lattice
    const out = S.p(t, 3, 0, 3.2, ease.inOut);
    const cellPx0 = 56;
    const cell = lerp(cellPx0 / Math.pow(2, level), 1920 / NX, out); // px per fine cell
    const cx = NX / 2;
    const cy = NY / 2;
    const X = (x) => W / 2 + (x - cx) * cell;
    const Y = (y) => H / 2 - 40 + (y - cy) * cell;
    const latA = 1 - 0.55 * S.p(t, 5, 0, 1.0);
    const drawArrows = (l, alpha, scale = 1) => {
      if (alpha <= 0) return;
      const b = 1 << l;
      const w = NX / b;
      const h = NY / b;
      const px = cell * b;
      if (px < 7) return;
      const x0 = Math.max(0, Math.floor((cx * cell - W / 2) / px));
      const x1 = Math.min(w, Math.ceil((cx * cell + W / 2) / px) + 1);
      const y0 = Math.max(0, Math.floor(((cy * cell) - H / 2) / px) - 1);
      const y1 = Math.min(h, Math.ceil((cy * cell + H / 2) / px) + 2);
      const flick = Math.floor(tAbs * 5);
      ctx.save();
      ctx.lineCap = 'round';
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          let s = lat.levels[l][y * w + x];
          if (l === 0) {
            // thermal flicker at the finest scale
            const i = y * NX + x;
            if (hash(i * 0.37 + flick * 13.1) < 0.04 * (1 - level)) s = -s;
          }
          const mx = X(x * b + b / 2);
          const my = Y(y * b + b / 2);
          const len = px * 0.32 * scale;
          ctx.strokeStyle = s > 0 ? C.gold : C.cyan;
          ctx.fillStyle = ctx.strokeStyle;
          ctx.globalAlpha = alpha * latA;
          ctx.lineWidth = Math.max(1.2, px * 0.06);
          ctx.beginPath();
          ctx.moveTo(mx, my + s * len);
          ctx.lineTo(mx, my - s * len * 0.4);
          ctx.stroke();
          const hw = Math.max(3, px * 0.14);
          ctx.beginPath();
          ctx.moveTo(mx, my - s * len);
          ctx.lineTo(mx - hw, my - s * (len - hw * 1.5));
          ctx.lineTo(mx + hw, my - s * (len - hw * 1.5));
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    };
    const outlines = (l, alpha) => {
      if (alpha <= 0) return;
      const b = 1 << (l + 1);
      const px = cell * b;
      ctx.save();
      ctx.strokeStyle = rgba(C.ink, 0.5 * alpha * latA);
      ctx.lineWidth = 1;
      for (let x = 0; x <= NX; x += b) {
        const xx = X(x);
        if (xx < -2 || xx > W + 2) continue;
        ctx.beginPath();
        ctx.moveTo(xx, 0);
        ctx.lineTo(xx, H);
        ctx.stroke();
      }
      for (let y = 0; y <= NY; y += b) {
        const yy = Y(y);
        if (yy < -2 || yy > H + 2) continue;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(W, yy);
        ctx.stroke();
      }
      ctx.restore();
      return px;
    };
    // colour field underneath, which takes over as we pull out
    const fieldA = S.p(t, 3, 0.3, 2.4) * latA;
    if (fieldA > 0) {
      const lvlImg = imgs[out > 0.6 ? 0 : Math.min(3, Math.round(level))];
      ctx.save();
      ctx.globalAlpha = fieldA * 0.78;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(lvlImg, X(0), Y(0), NX * cell, NY * cell);
      ctx.restore();
    }
    const arrowsA = (1 - S.p(t, 3, 0.2, 1.6)) * prog(t, 0, 1.2);
    if (level < 3) {
      // phase A: outlines; phase B: swap arrows
      const swap = clamp((f - 0.3) / 0.45);
      outlines(L, Math.sin(Math.PI * clamp(f / 0.9)) * (level > 0 || f > 0 ? 1 : 0));
      drawArrows(L, arrowsA * (1 - swap));
      drawArrows(L + 1, arrowsA * swap, lerp(0.6, 1, swap));
    } else drawArrows(3, arrowsA);
    st.lvl.innerHTML = `${['1 × 1', '2 × 2', '4 × 4', '8 × 8'][Math.min(3, Math.round(level))]}<span style="font-family:var(--zh-sans);font-size:17px;color:rgba(237,232,221,.6);margin-left:14px">粗粒化 · coarse-grain</span>`;
    place(st.lvl, { x: 120, y: 120, ax: 0, o: S.p(t, 2, 0.2, 0.8) * (1 - S.p(t, 3, 0, 0.8)) });

    // two forces
    const fA = S.p(t, 4, 0, 0.8) * (1 - S.p(t, 5, 0, 0.6));
    if (fA > 0) {
      ring(ctx, 520, 470, 46, '#ffffff', 2, fA);
      dot(ctx, 520, 470, 4, '#ffffff', fA);
      ring(ctx, 1180, 470, 330, '#ffffff', 1.2, fA * 0.6);
      ctx.save();
      ctx.setLineDash([4, 8]);
      ring(ctx, 1180, 470, 220, '#ffffff', 1, fA * 0.35);
      ctx.restore();
    }
    place(st.exch, { x: 520, y: 560, o: fA });
    place(st.dip, { x: 1180, y: 830, o: fA });
    // importance vs scale
    const cA = S.p(t, 5, 0.2, 0.9);
    if (cA > 0) {
      const x0 = 560;
      const x1 = 1360;
      const y0 = 700;
      const hgt = 330;
      ctx.save();
      ctx.globalAlpha = cA;
      ctx.fillStyle = 'rgba(8,9,12,0.7)';
      roundRect(ctx, x0 - 80, y0 - hgt - 60, x1 - x0 + 160, hgt + 140, 22);
      ctx.fill();
      arrow(ctx, x0, y0, x1 + 20, y0, rgba(C.ink, 0.6), 1.4, 1, 10);
      arrow(ctx, x0, y0, x0, y0 - hgt - 10, rgba(C.ink, 0.6), 1.4, 1, 10);
      text(ctx, '尺度 scale →', x1, y0 + 26, { font: '500 16px "PingFang SC", "Avenir Next"', color: rgba(C.ink, 0.6), align: 'right' });
      text(ctx, '影响力 influence', x0 + 12, y0 - hgt - 4, { font: '500 16px "PingFang SC", "Avenir Next"', color: rgba(C.ink, 0.6), align: 'left' });
      const pc = S.p(t, 5, 0.5, 1.8);
      const ex = [];
      const dp = [];
      for (let i = 0; i <= 100; i++) {
        const u = i / 100;
        ex.push([lerp(x0, x1, u), y0 - hgt * (0.9 * Math.exp(-u * 3.2) + 0.05)]);
        dp.push([lerp(x0, x1, u), y0 - hgt * (0.08 + 0.78 / (1 + Math.exp(-(u - 0.5) * 9)))]);
      }
      polyP(ctx, ex, pc, '#ffffff', 2.6, 1, 10);
      polyP(ctx, dp, pc, C.gold, 2.6, 1, 10);
      text(ctx, '交换 exchange', x0 + 40, y0 - hgt * 0.86, { font: '500 17px "PingFang SC", "Avenir Next"', color: '#ffffff', align: 'left', alpha: pc });
      text(ctx, '偶极 dipolar', x1 - 10, y0 - hgt * 0.92, { font: '500 17px "PingFang SC", "Avenir Next"', color: C.gold, align: 'right', alpha: pc });
      ctx.restore();
    }
    place(st.chart, { x: 960, y: 302, o: cA * 0 });
  },
};

// ───────────────────────── scales: powers of ten for a life
const ROWS = [
  { n: 60, colors: 14, zh: '一小时 · 60 分钟', en: 'an hour, in minutes', ways: '上千种过法', wen: 'a thousand ways', bc: '注意力', bcen: 'attention' },
  { n: 24, colors: 6, zh: '一天 · 24 小时', en: 'a day, in hours', ways: '几十种', wen: 'dozens', bc: '日程', bcen: 'schedule' },
  { n: 30, colors: 4, zh: '一个月 · 30 天', en: 'a month, in days', ways: '十几种', wen: 'a dozen', bc: '精力 · 情绪 · 作息', bcen: 'energy · mood · routine' },
  { n: 12, colors: 3, zh: '一年 · 12 个月', en: 'a year, in months', ways: '三四种剧本', wen: 'three or four scripts', bc: '环境 · 身份 · 性格', bcen: 'place · identity · character' },
];
const PALETTE = [C.gold, C.cyan, C.rose, C.sage, C.violet, '#d9cdb5', '#7aa2ff', '#f08a5d', '#c58fd8', '#6fd6b0', '#e8d36a', '#8fb3c9', '#d97a9b', '#a3c46b'];
const scales = {
  setup(root) {
    const ctx = makeCanvas(root);
    const labels = ROWS.map((r) => el('div', 'abs', root, `<span class="zh-sans" style="font-size:22px;font-weight:500">${r.zh}</span><br><span class="en-sans" style="font-size:14px;letter-spacing:.06em;color:rgba(237,232,221,.55)">${r.en}</span>`));
    const ways = ROWS.map((r) => el('div', 'abs', root, `<span class="zh-sans" style="font-size:22px;font-weight:500;color:#e9b65c">${r.ways}</span><br><span class="en-sans" style="font-size:14px;letter-spacing:.06em;color:rgba(233,182,92,.7)">${r.wen}</span>`));
    const bcs = ROWS.map((r) => el('div', 'abs', root, `<span class="zh-sans" style="font-size:20px;font-weight:500;color:#ede8dd">${r.bc}</span><br><span class="en-sans" style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:rgba(237,232,221,.5)">${r.bcen}</span>`));
    const fw = duo(root, '自由意志的影响', 'reach of free will');
    // Markov-ish colour runs per row
    const rowsCol = ROWS.map((r, ri) => {
      const R = rng(100 + ri);
      const out = [];
      let c = Math.floor(R() * r.colors);
      for (let i = 0; i < r.n; i++) {
        if (R() < [0.75, 0.45, 0.3, 0.25][ri]) c = Math.floor(R() * r.colors);
        out.push(c);
      }
      return out;
    });
    return { ctx, labels, ways, bcs, fw, rowsCol };
  },
  render(t, S, st) {
    const { ctx } = st;
    ctx.clear();
    const x0 = 520;
    const x1 = 1400;
    const ys = [250, 420, 590, 760];
    const rowA = [S.p(t, 0, 0.2, 0.8), S.p(t, 0, 1.6, 0.8), S.p(t, 0, 3.0, 0.8), S.p(t, 1, 0.1, 0.8)];
    const showBC = S.p(t, 2, 0, 0.8);
    const fwA = S.p(t, 3, 0, 0.8);
    ROWS.forEach((r, ri) => {
      const a = rowA[ri];
      if (a <= 0) return;
      const wcell = (x1 - x0) / r.n;
      for (let i = 0; i < r.n; i++) {
        const b = prog(t, (ri < 3 ? S.at(0, 0.2 + ri * 1.4) : S.at(1, 0.1)) + i * (0.6 / r.n), 0.4);
        ctx.save();
        ctx.globalAlpha = a * b * (ri === 3 ? 0.95 : 0.85);
        ctx.fillStyle = PALETTE[st.rowsCol[ri][i] % PALETTE.length];
        roundRect(ctx, x0 + i * wcell + 1, ys[ri] - 26, wcell - 2, 52, Math.min(6, wcell / 3));
        ctx.fill();
        ctx.restore();
      }
      // zoom funnel from a segment of the next row up to this row
      if (ri < 3 && rowA[ri + 1] > 0) {
        const nr = ROWS[ri + 1];
        const seg = Math.floor(nr.n * 0.42);
        const wcn = (x1 - x0) / nr.n;
        const sx0 = x0 + seg * wcn;
        const sx1 = sx0 + wcn;
        const fa = rowA[ri + 1] * 0.5;
        line(ctx, sx0, ys[ri + 1] - 28, x0, ys[ri] + 30, rgba(C.ink, 0.5), 1, fa);
        line(ctx, sx1, ys[ri + 1] - 28, x1, ys[ri] + 30, rgba(C.ink, 0.5), 1, fa);
        ctx.save();
        ctx.globalAlpha = fa;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        roundRect(ctx, sx0, ys[ri + 1] - 28, wcn, 56, 5);
        ctx.stroke();
        ctx.restore();
      }
      place(st.labels[ri], { x: x0 - 40, y: ys[ri], ax: 1, o: a });
      st.labels[ri].style.textAlign = 'right';
      place(st.ways[ri], { x: x1 + 40, y: ys[ri], ax: 0, o: a * (1 - showBC) });
      place(st.bcs[ri], { x: x1 + 40, y: ys[ri], ax: 0, o: a * showBC });
      // free will's reach shrinks with scale
      if (fwA > 0) {
        const r0 = [70, 30, 10, 3][ri];
        const cx = x0 + (x1 - x0) * 0.5;
        glow(ctx, cx, ys[ri], r0 * 2.6, '#ffffff', fwA * 0.9);
        ring(ctx, cx, ys[ri], r0, '#ffffff', 1.6, fwA);
        dot(ctx, cx, ys[ri], 3, '#ffffff', fwA);
      }
    });
    place(st.fw, { x: 960, y: 140, o: fwA });
  },
};

// ───────────────────────── bottleneck: the steady-state well
const U = (x) => 0.9 * Math.exp(-(((x - 0.3) / 0.13) ** 2)) * -1 + 0.55 * Math.exp(-(((x - 0.74) / 0.1) ** 2)) * -1 + 0.6 * Math.exp(-(((x - 0.53) / 0.08) ** 2)) + 0.25 * (x - 0.5) ** 2;
const bottleneck = {
  setup(root) {
    const ctx = makeCanvas(root);
    const items = [
      ['尺度受限', 'limited scale'],
      ['稳态回落', 'relapse'],
      ['约束耗散', 'dissipation'],
    ].map(([zh, en], i) => el('div', 'abs', root, `<span class="en-serif" style="font-size:26px;color:#e0675b;margin-right:14px">${i + 1}</span><span class="zh-serif" style="font-size:32px;letter-spacing:.12em">${zh}</span><span class="en-sans" style="font-size:14px;letter-spacing:.24em;text-transform:uppercase;color:rgba(237,232,221,.55);margin-left:14px">${en}</span>`));
    const e0 = el('div', 'abs', root, '<span class="en-serif" style="font-size:30px;font-style:italic">E</span><span class="en-serif" style="font-size:18px">0</span>');
    const e1 = el('div', 'abs', root, '<span class="en-serif" style="font-size:30px;font-style:italic">E</span><span class="en-serif" style="font-size:18px">*</span>');
    const ceil = duo(root, 'CTDP 的天花板', 'the ceiling of CTDP');
    return { ctx, items, e0, e1, ceil };
  },
  render(t, S, st) {
    const { ctx } = st;
    ctx.clear();
    const x0 = 560;
    const x1 = 1600;
    const yB = 470;
    const sc = 330;
    const X = (u) => lerp(x0, x1, u);
    const Y = (u) => yB - U(u) * sc;
    const ceilY = yB - 0.22 * sc;
    const pts = [];
    for (let i = 0; i <= 300; i++) pts.push([X(i / 300), Y(i / 300)]);
    polyP(ctx, pts, prog(t, 0.1, 1.6), C.ink, 2.4, 0.85, 8);
    // ceiling line
    const ca = S.p(t, 0, 0, 0.8);
    ctx.save();
    ctx.setLineDash([10, 10]);
    line(ctx, X(0.05), ceilY, X(0.95), ceilY, rgba(C.rose, 0.6), 1.4, ca);
    ctx.restore();
    place(st.ceil, { x: X(0.9), y: ceilY - 34, o: ca });
    st.ceil.querySelector('.zh').style.color = C.rose;
    place(st.e0, { x: X(0.3), y: Y(0.3) + 46, o: prog(t, 0.6, 1) });
    place(st.e1, { x: X(0.74), y: Y(0.74) + 46, o: prog(t, 0.6, 1) * 0.7 });
    st.items.forEach((it, i) => place(it, { x: 120, y: 330 + i * 90, ax: 0, o: S.p(t, i + 1, 0, 0.7) * lerp(0.45, 1, i === activeIdx(t, S) ? 1 : 0) }));
    // ball dynamics per phase
    let u = 0.3;
    let support = 0;
    let res = 1;
    const k = activeIdx(t, S);
    if (k === 0) {
      const lt = t - S.at(1);
      u = 0.3 + 0.03 * Math.sin(lt * 9) * Math.exp(-((lt % 1.2) * 2.5));
      // tiny pushes
      for (let j = 0; j < 3; j++) {
        const ph = (lt - j * 1.2) % 3.6;
        if (ph > 0 && ph < 0.5) arrow(ctx, X(0.3) - 80, Y(0.3) - 40, X(0.3) - 24, Y(0.3) - 20, '#ffffff', 1.6, 1 - ph * 2, 9);
      }
    } else if (k === 1) {
      const lt = t - S.at(2);
      const up = clamp(lt / 1.4);
      const back = clamp((lt - 1.8) / 1.6);
      u = 0.3 + 0.165 * ease.out(up) - 0.165 * ease.inOut(back);
      if (lt < 0.5) arrow(ctx, X(0.22), Y(0.3) - 60, X(0.29), Y(0.3) - 26, C.gold, 2.4, 1 - lt * 2, 12);
    } else if (k === 2) {
      const lt = t - S.at(3);
      const up = clamp(lt / 1.0);
      res = 1 - clamp((lt - 0.8) / 3.2);
      const fall = clamp((lt - 4.0) / 1.4);
      u = 0.3 + 0.15 * ease.out(up) * (1 - ease.inOut(fall));
      support = up * (res > 0 ? 1 : 1 - fall);
      // resource bar
      const bx = X(0.47) - 60;
      const by = Y(0.47) - 140;
      ctx.save();
      ctx.globalAlpha = Math.min(up, 1 - fall * 0.6);
      ctx.strokeStyle = rgba(C.ink, 0.6);
      roundRect(ctx, bx, by, 120, 14, 7);
      ctx.stroke();
      ctx.fillStyle = mixHex(C.rose, C.gold, res);
      roundRect(ctx, bx + 2, by + 2, Math.max(0, 116 * res), 10, 5);
      ctx.fill();
      ctx.restore();
      text(ctx, '意志力 · 资源', bx + 60, by - 20, { font: '500 16px "PingFang SC"', color: rgba(C.ink, 0.7), alpha: up });
    } else u = 0.3;
    const bx = X(u);
    const by = Y(u) - 18;
    if (support > 0) line(ctx, bx - 22, by + 12, bx - 60, by + 70, rgba(C.gold, 0.8), 3, support);
    glow(ctx, bx, by, 70, C.gold, 0.6);
    dot(ctx, bx, by, 16, C.gold, 1, 20);
  },
};
function activeIdx(t, S) {
  if (t >= S.at(3)) return 2;
  if (t >= S.at(2)) return 1;
  if (t >= S.at(1)) return 0;
  return -1;
}

export default { limits, tree, rg, scales, bottleneck };
