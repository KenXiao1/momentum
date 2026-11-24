// Chapter I — the integral of choice.
import katex from '/katex/katex.mjs';
import { C, W, H, el, place, makeCanvas, prog, env, ease, clamp, lerp, rgba } from '../engine.js';
import { line, dot, glow, text, arrow, polyP } from '../lib/draw.js';
import { Plot, Vstudy, Vphone, Whyper, integrate, meters } from '../lib/plot.js';

const tex = (s) => katex.renderToString(s, { throwOnError: false, displayMode: false, output: 'html' });

function duo(root, zh, en, cls = '') {
  return el('div', `abs duo ${cls}`, root, `<span class="zh">${zh}</span><span class="en">${en}</span>`);
}

// shared geometry for the Chapter I plots
const P = new Plot({ x0: 300, x1: 1380, y0: 585, tauMax: 8, sy: 165 });
const WS = { y: 262, h: 92 }; // the W(τ) strip above the plot

function wStrip(ctx, wf, { alpha = 1, p = 1, label = 1 } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  line(ctx, P.x0 - 30, WS.y, P.x1 + 40, WS.y, rgba(C.ink, 0.28), 1.2);
  const pts = [];
  for (let i = 0; i <= 240; i++) {
    const t = (i / 240) * P.tauMax;
    pts.push([P.X(t), WS.y - wf(t) * WS.h]);
  }
  ctx.save();
  ctx.fillStyle = rgba(C.violet, 0.1);
  ctx.beginPath();
  ctx.moveTo(P.X(0), WS.y);
  pts.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(P.X(P.tauMax), WS.y);
  ctx.fill();
  ctx.restore();
  polyP(ctx, pts, p, C.violet, 2.4, 1, 12);
  text(ctx, 'W(τ)', P.x0 - 60, WS.y - WS.h * 0.55, { font: 'italic 26px "KaTeX_Main"', color: C.violet, alpha: label, align: 'right' });
  ctx.restore();
}

const Wmix = (k) => (t) => lerp(1, Whyper(t), k);
const I_FLAT = { s: integrate(Vstudy), p: integrate(Vphone) };
const I_W = { s: integrate((t) => Vstudy(t) * Whyper(t)), p: integrate((t) => Vphone(t) * Whyper(t)) };

// ───────────────────────── formula
const formula = {
  setup(root) {
    const ctx = makeCanvas(root);
    const row = el('div', 'abs mathrow', root);
    row.style.fontSize = '96px';
    const parts = ['I', '=', '\\displaystyle\\int_{0}^{\\infty}', 'V(\\tau)', '\\cdot', 'W(\\tau)', '\\,d\\tau'];
    const toks = parts.map((p) => el('span', '', row, tex(p)));
    const lv = duo(root, '未来价值', 'future value');
    const lw = duo(root, '权重贴现', 'discount weight');
    const li = duo(root, '选择倾向', 'the pull you act on');
    return { ctx, row, toks, lv, lw, li, m: null };
  },
  render(t, S, st) {
    const { ctx, row, toks, lv, lw, li } = st;
    ctx.clear();
    const up = S.p(t, 3, 0.2, 1.4) * 150;
    place(row, { x: W / 2, y: 420 - up, o: 1 });
    if (!st.m) {
      toks.forEach((k) => (k.style.transform = 'none'));
      st.m = toks.map((k) => {
        const r = k.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
      });
      st.base = 420;
    }
    const m = st.m.map((r) => ({ ...r, y: r.y - up }));
    const hiV = S.p(t, 1, 0, 0.6);
    const hiW = S.p(t, 2, 0, 0.6);
    const hiI = S.p(t, 3, 0, 0.6);
    toks.forEach((k, i) => {
      const p = prog(t, S.at(0, 0.1 + i * 0.16), 0.9, ease.out);
      let color = C.ink;
      let s = 1;
      if (i === 3) {
        color = hiV > 0 ? C.gold : C.ink;
        s = 1 + 0.06 * Math.sin(Math.PI * clamp((t - S.at(1)) / 0.8));
      }
      if (i === 5) {
        color = hiW > 0 ? C.violet : C.ink;
        s = 1 + 0.06 * Math.sin(Math.PI * clamp((t - S.at(2)) / 0.8));
      }
      if (i === 0) color = hiI > 0 ? '#ffffff' : C.ink;
      k.style.color = color;
      k.style.opacity = String(p * (i === 3 || i === 5 || i === 0 || hiI === 0 ? 1 : 1 - 0.0 * hiI));
      k.style.filter = `blur(${(1 - p) * 8}px)`;
      k.style.transform = `translateY(${(1 - p) * 20}px) scale(${s})`;
    });

    // sparklines under V and W
    const fadeLabels = 1 - S.p(t, 3, 0.2, 0.8);
    const sv = m[3];
    const sw = m[5];
    const spark = (cx, cy, f, color, a, p) => {
      const pts = [];
      for (let i = 0; i <= 120; i++) {
        const tt = (i / 120) * 7;
        pts.push([cx - 120 + (i / 120) * 240, cy - f(tt) * 42]);
      }
      line(ctx, cx - 130, cy, cx + 130, cy, rgba(C.ink, 0.25), 1, a);
      polyP(ctx, pts, p, color, 2.2, a, 10);
    };
    const av = S.p(t, 1, 0.1, 0.8) * fadeLabels;
    const aw = S.p(t, 2, 0.1, 0.8) * fadeLabels;
    spark(sv.x, sv.y + 150, Vstudy, C.gold, av, S.p(t, 1, 0.2, 1.6));
    spark(sw.x, sw.y + 150, Whyper, C.violet, aw, S.p(t, 2, 0.2, 1.6));
    line(ctx, sv.x, sv.y + 62, sv.x, sv.y + 96, rgba(C.gold, 0.6), 1.2, av);
    line(ctx, sw.x, sw.y + 62, sw.x, sw.y + 96, rgba(C.violet, 0.6), 1.2, aw);
    place(lv, { x: sv.x, y: sv.y + 232, o: av });
    place(lw, { x: sw.x, y: sw.y + 232, o: aw });
    lv.querySelector('.zh').style.color = C.gold;
    lw.querySelector('.zh').style.color = C.violet;

    // the integral as an accumulating area: V·W swept from 0 to ∞
    const a3 = S.p(t, 3, 0.6, 0.9);
    if (a3 > 0) {
      const p3 = new Plot({ x0: 560, x1: 1360, y0: 640, tauMax: 7, sy: 200 });
      const gg = (x, m, w) => Math.exp(-(((x - m) / w) ** 2));
      const f = (x) => (0.75 * gg(x, 0.9, 0.55) - 0.55 * gg(x, 2.6, 1.0) + 0.35 * gg(x, 4.6, 1.3)) * Whyper(x) * 3.2;
      const sweep = S.p(t, 3, 0.9, 2.6, ease.inOut) * 7;
      line(ctx, 530, 640, 1400, 640, rgba(C.ink, 0.35), 1.2, a3);
      p3.fill(ctx, f, { color: '#f3e3c2', alpha: 0.3 * a3, to: Math.max(0.01, sweep) });
      p3.curve(ctx, f, { color: '#f3e3c2', alpha: a3, w: 2.4 });
      line(ctx, p3.X(sweep), 520, p3.X(sweep), 760, rgba('#ffffff', 0.7), 1.2, a3 * (sweep > 0.02 && sweep < 6.98 ? 1 : 0));
      const val = integrate(f, 0, Math.max(0.001, sweep), 200);
      text(ctx, `I = ${val >= 0 ? '+' : '−'}${Math.abs(val).toFixed(3)}`, 1460, 640, { font: '30px "KaTeX_Main"', color: C.ink, alpha: a3, align: 'left' });
      place(li, { x: 1530, y: 700, o: a3 * S.p(t, 3, 1.4, 0.8) });
    } else place(li, { o: 0 });
  },
};

// ───────────────────────── curves: study vs phone, flat vs hyperbolic weight
function curvesState(t, S) {
  return {
    axes: prog(t, -0.2, 1.4),
    study: S.p(t, 0, 0.2, 2.4),
    phone: S.p(t, 1, 0.2, 2.2),
    wIn: S.p(t, 2, 0, 0.9),
    wHyp: S.p(t, 3, 0.3, 2.0),
    weigh: S.p(t, 4, 0.1, 2.4),
    meters: S.p(t, 2, 0.5, 0.9),
  };
}

function drawPlotWorld(ctx, k, { labelsS = 0, labelsP = 0, metersA = 0, flipGlow = 0, studyA = 1, phoneA = 1, extraS = null } = {}) {
  const wf = Wmix(k.wHyp);
  const vs = (x) => Vstudy(x) * lerp(1, wf(x), k.weigh) + (extraS ? extraS(x) : 0);
  const vp = (x) => Vphone(x) * lerp(1, wf(x), k.weigh);
  P.axes(ctx, { p: k.axes, top: 380, bottom: 800 });
  if (flipGlow > 0) {
    const g = ctx.createLinearGradient(P.X(0), 0, P.X(1.4), 0);
    g.addColorStop(0, rgba('#ffffff', 0.07 * flipGlow));
    g.addColorStop(1, rgba('#ffffff', 0));
    ctx.fillStyle = g;
    ctx.fillRect(P.X(0), 380, P.X(1.4) - P.X(0), 420);
  }
  P.fill(ctx, vs, { color: C.gold, alpha: 0.24 * studyA, p: k.study });
  P.curve(ctx, vs, { color: C.gold, p: k.study, alpha: studyA });
  P.fill(ctx, vp, { color: C.cyan, alpha: 0.22 * phoneA, p: k.phone });
  P.curve(ctx, vp, { color: C.cyan, p: k.phone, alpha: phoneA });
  // annotations
  const ann = (x, v, zh, en, color, a, below) => {
    if (a <= 0) return;
    const y = P.Y(v) + (below ? 34 : -30);
    text(ctx, zh, P.X(x), y, { font: '500 19px "PingFang SC"', color, alpha: a });
    text(ctx, en, P.X(x), y + (below ? 22 : -22), { font: '500 13px "Avenir Next"', color: rgba(color, 0.7), alpha: a, spacing: 1.5 });
  };
  const fadeW = 1 - k.weigh;
  ann(0.55, Vstudy(0.55), '枯燥 · 疲惫', 'EFFORT', C.gold, labelsS * studyA, true);
  ann(2.9, Vstudy(2.9) * fadeW + 0.02, '安心 · 满足', 'RELIEF', C.gold, labelsS * fadeW * studyA, false);
  ann(6.4, 0.06, '归零', 'FADES', C.gold, labelsS * fadeW * studyA * 0.8, false);
  ann(0.5, Vphone(0.5), '快乐', 'PLEASURE', C.cyan, labelsP * phoneA, false);
  ann(2.6, Vphone(2.6) * fadeW, '焦虑 · 愧疚', 'ANXIETY · GUILT', C.cyan, labelsP * fadeW * phoneA, true);
  wStrip(ctx, wf, { alpha: k.wIn, p: 1 });
  if (metersA > 0) {
    const ns = lerp(I_FLAT.s / I_FLAT.s, I_W.s / I_W.p, k.weigh);
    const np = lerp(I_FLAT.p / I_FLAT.s, I_W.p / I_W.p, k.weigh);
    meters(ctx, { x: 1720, y: 560, half: 130, alpha: metersA, rows: [
      { label: '学习', value: ns, color: C.gold },
      { label: '刷手机', value: np, color: C.cyan },
    ] });
  }
}

const curves = {
  setup(root) {
    const ctx = makeCanvas(root);
    const wl = el('div', 'abs', root);
    wl.style.cssText += 'font-size:30px;color:#a99be8';
    const hyper = el('div', 'abs', root, tex('W(\\tau)\\approx\\dfrac{1}{1+k\\tau}'));
    hyper.style.cssText += 'font-size:34px;color:#a99be8';
    const tag = el('div', 'abs tag', root);
    return { ctx, hyper, tag };
  },
  render(t, S, st) {
    const { ctx, hyper, tag } = st;
    ctx.clear();
    const k = curvesState(t, S);
    drawPlotWorld(ctx, k, {
      labelsS: S.p(t, 0, 1.6, 0.8) * (1 - S.p(t, 1, 0, 0.6) * 0.0),
      labelsP: S.p(t, 1, 1.4, 0.8),
      metersA: k.meters,
      flipGlow: S.p(t, 4, 0.6, 1) * (1 - S.p(t, 5, 0.6, 1)),
    });
    const flat = k.wIn * (1 - k.wHyp);
    text(ctx, 'W(τ) = 1', P.X(7.6), WS.y - WS.h - 18, { font: 'italic 22px "KaTeX_Main"', color: C.violet, alpha: flat, align: 'right' });
    text(ctx, '一视同仁 · every moment counts the same', P.X(4), WS.y - WS.h - 18, { font: '500 16px "PingFang SC", "Avenir Next"', color: rgba(C.ink, 0.55), alpha: flat });
    text(ctx, '短视 · short-sighted', P.X(2.2), WS.y - 44, { font: '500 16px "PingFang SC", "Avenir Next"', color: rgba(C.violet, 0.9), alpha: k.wHyp * (1 - S.p(t, 5, 0, 0.6)), align: 'left' });
    place(hyper, { x: P.X(5.8), y: WS.y - 52, o: S.p(t, 5, 0.1, 0.9) });
    tag.innerHTML = k.weigh > 0.5 ? '加权后 <span class="en">weighted by W(τ)</span>' : '价值 <span class="en">value V(τ)</span>';
    place(tag, { x: 120, y: 120, ax: 0, o: Math.min(k.axes, 1) * 0.9 });
  },
};

// ───────────────────────── impulse: the cost of switching
const impulse = {
  setup(root) {
    const ctx = makeCanvas(root);
    const tag = el('div', 'abs tag', root, '加权后 <span class="en">weighted by W(τ)</span>');
    const who = el('div', 'abs duo', root);
    return { ctx, tag, who };
  },
  render(t, S, st) {
    const { ctx, tag, who } = st;
    ctx.clear();
    const k = { axes: 1, study: 1, phone: 1, wIn: 1 - prog(t, 0, 1.2), wHyp: 1, weigh: 1 };
    const metersA = 1 - prog(t, 0, 0.8);
    const grow = S.p(t, 0, 0.6, 1.0, ease.outBack);
    const swap = S.p(t, 1, 0.3, 1.4);
    // the spike sits on study while you are scrolling, then on the phone while you study
    const spike = (x) => -2.0 * Math.exp(-((x / 0.05) ** 2)) * grow;
    drawPlotWorld(ctx, k, {
      metersA,
      studyA: lerp(1, 0.35, swap),
      phoneA: lerp(0.35, 1, swap),
      extraS: (x) => spike(x) * (1 - swap),
    });
    if (swap > 0) P.curve(ctx, (x) => spike(x) * swap, { color: C.cyan, w: 3, from: 0, to: 0.4, alpha: swap });
    const sx = P.X(0);
    glow(ctx, sx, P.Y(-1.6), 120, swap > 0.5 ? C.cyan : C.gold, grow * 0.8);
    arrow(ctx, sx + 120, P.Y(-1.9), sx + 12, P.Y(-1.92), rgba(C.ink, 0.7), 1.5, grow, 10);
    text(ctx, '切换成本', sx + 134, P.Y(-1.9) - 2, { font: '500 21px "PingFang SC"', color: C.ink, alpha: grow, align: 'left' });
    text(ctx, 'SWITCHING COST  δ(τ)', sx + 134, P.Y(-1.9) + 24, { font: '500 13px "Avenir Next"', color: rgba(C.ink, 0.6), alpha: grow, align: 'left', spacing: 2 });
    who.innerHTML = swap < 0.5
      ? '<span class="zh">正在刷手机时，学习要先付出切换成本</span><span class="en">while scrolling, studying starts with a switch</span>'
      : '<span class="zh">正在学习时，刷手机反而要付出切换成本</span><span class="en">while studying, scrolling is the one that costs</span>';
    const wa = S.p(t, 0, 0.8, 0.8) * (1 - Math.sin(Math.PI * clamp((swap - 0.3) / 0.4)) * 0.9);
    place(who, { x: 1180, y: 300, o: wa });
    place(tag, { x: 120, y: 120, ax: 0, o: 0.9 });
  },
};

// ───────────────────────── transform: V → V′, and why compression wins
const transform = {
  setup(root) {
    const ctx = makeCanvas(root);
    const f = el('div', 'abs', root, tex('V(\\tau)\\;\\longrightarrow\\;V^{\\prime}(\\tau)'));
    f.style.cssText += 'font-size:54px;color:#ede8dd;';
    const far = duo(root, '远期奖励 · 远期惩罚', 'distant reward · distant punishment');
    const comp = duo(root, '压缩到此刻', 'compressed into now');
    const wnote = el('div', 'abs', root);
    wnote.style.cssText += 'font-size:22px;color:#a99be8;';
    wnote.innerHTML = tex('W\\approx 0.03');
    const tag = el('div', 'abs tag', root, '变换 <span class="en">transformation</span>');
    return { ctx, f, far, comp, wnote, tag };
  },
  render(t, S, st) {
    const { ctx, f, far, comp, wnote, tag } = st;
    ctx.clear();
    const fadeP = 1 - prog(t, 0, 1.0);
    const k = { axes: 1, study: 1, phone: 1, wIn: prog(t, 0.2, 1.0), wHyp: 1, weigh: 1 - prog(t, 0.2, 1.4) };
    // the extra value: a distant bump that later compresses toward τ = 0
    const addA = S.p(t, 1, 0.2, 1.2);
    const c = S.p(t, 2, 0.4, 2.4, ease.inOutQuint);
    const mu = lerp(6.3, 0.14, c);
    const sig = lerp(0.65, 0.07, c);
    const amp = (0.85 * 0.65) / sig;
    const bump = (x) => amp * Math.exp(-(((x - mu) / sig) ** 2)) * addA;
    const shown = (x) => Math.min(bump(x), 2.35);
    drawPlotWorld(ctx, k, { studyA: 1, phoneA: fadeP });
    P.fill(ctx, shown, { color: '#ffffff', alpha: 0.18 });
    P.curve(ctx, shown, { color: '#f6e7c8', w: 2.4, alpha: addA, dash: c < 0.05 ? [6, 6] : null, glow: 16 + 30 * c });
    // weighted contribution of the bump: what the decision actually feels
    const weighted = (x) => bump(x) * Whyper(x);
    const wAmt = integrate(weighted, 0, 9, 600);
    const base = integrate((x) => Vstudy(x) * Whyper(x), 0, 9, 600);
    meters(ctx, { x: 1680, y: 600, alpha: S.p(t, 1, 0.6, 0.8), half: 130, rows: [{ label: '学习 I′', value: clamp((base + wAmt) / 0.55, -1, 1), color: C.gold }] });
    place(f, { x: 1680, y: 420, o: S.p(t, 0, 0.3, 1.0) });
    place(far, { x: P.X(6.3), y: P.Y(0.85) - 70, o: addA * (1 - c * 3) });
    place(wnote, { x: P.X(6.3), y: WS.y + 32, o: addA * (1 - c * 3) });
    if (addA > 0 && c < 0.3) line(ctx, P.X(6.3), WS.y + 10, P.X(6.3), P.Y(0.9) - 100, rgba(C.violet, 0.4), 1, addA * (1 - c * 3));
    place(comp, { x: P.X(0) + 190, y: P.Y(2.2) + 10, o: S.p(t, 2, 2.2, 0.8) });
    if (c > 0.9) glow(ctx, P.X(0.14), P.Y(2.0), 160, '#ffd89a', (c - 0.9) * 10 * (0.8 + 0.2 * Math.sin(t * 4)));
    place(tag, { x: 120, y: 120, ax: 0, o: 0.9 * S.p(t, 0, 0, 0.8) });
  },
};

export default { formula, curves, impulse, transform };
