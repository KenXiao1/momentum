// Chapter II — the Chained Time-Delay Protocol.
import katex from '/katex/katex.mjs';
import { C, W, H, el, place, makeCanvas, prog, env, ease, clamp, lerp, rgba, hash, mixHex } from '../engine.js';
import { line, lineP, dot, ring, glow, text, arrow, polyP, bez, roundRect } from '../lib/draw.js';
import { Plot, Vstudy, Whyper, integrate, meters } from '../lib/plot.js';
import { chair, halo, beads, chainTimes, seal, shards } from '../lib/motifs.js';

const tex = (s) => katex.renderToString(s, { throwOnError: false, output: 'html' });
const duo = (root, zh, en, cls = '') => el('div', `abs duo ${cls}`, root, `<span class="zh">${zh}</span><span class="en">${en}</span>`);
const header = (root, zh, en) => el('div', 'abs principle', root, `${zh}<small>${en}</small>`);

// ───────────────────────── seat
const seatTimes = chainTimes(12, 0, 0.62, 0.83, 0.16);
const regrowTimes = chainTimes(37, 0, 0.32, 0.9, 0.045);

function seatChain(t, S) {
  // returns {n, broken, brokenP, list-ready count}
  const t3 = S.at(3, 0.2);
  const tFail = S.at(4, 0.4);
  const t5 = S.at(5, 0.1);
  if (t < t3) return { n: 0, phase: 0 };
  if (t < tFail) return { n: seatTimes.filter((x) => x <= t - t3).length, phase: 1, t0: t3, times: seatTimes };
  if (t < tFail + 1.5) return { n: 12, phase: 2, bp: (t - tFail) / 1.5 };
  if (t < t5) return { n: 1, phase: 3, t0: tFail + 1.5, times: [0] };
  return { n: Math.max(1, regrowTimes.filter((x) => x <= t - t5).length), phase: 4, t0: t5, times: regrowTimes };
}

const seat = {
  setup(root) {
    const ctx = makeCanvas(root);
    const head = header(root, '原理一 · 神圣座位', 'Principle I · The Sacred Seat');
    const rule = el('div', 'abs', root, `
      <div style="display:grid;grid-template-columns:auto auto;column-gap:26px;row-gap:26px;align-items:baseline">
        <div class="zh-serif" style="font-size:34px;color:#e9b65c">坐上去</div>
        <div><div class="zh-sans" style="font-size:30px;font-weight:500">以最好的状态，专注满 60 分钟</div>
             <div class="en-sans" style="font-size:18px;color:rgba(237,232,221,.6);margin-top:4px">sit → focus at your best for 60 minutes</div></div>
        <div class="zh-serif" style="font-size:34px;color:rgba(237,232,221,.55)">没把握</div>
        <div><div class="zh-sans" style="font-size:30px;font-weight:500;color:rgba(237,232,221,.75)">那就别坐</div>
             <div class="en-sans" style="font-size:18px;color:rgba(237,232,221,.5);margin-top:4px">not sure → don’t sit</div></div>
      </div>`);
    const count = el('div', 'abs en-serif', root);
    count.style.cssText += 'font-size:120px;color:#e9b65c;letter-spacing:0.02em;';
    const countL = duo(root, '连续成功', 'unbroken record');
    return { ctx, head, rule, count, countL };
  },
  render(t, S, st) {
    const { ctx, head, rule, count, countL } = st;
    ctx.clear();
    place(head, { x: 120, y: 130, ax: 0, o: S.p(t, 0, 0.1, 0.9) });
    const cx = 700;
    const cy = 470;
    const ch = seatChain(t, S);
    const sacred = ch.phase === 4 ? 0.35 + 0.65 * clamp(ch.n / 37) : ch.phase === 1 ? 0.15 + 0.35 * (ch.n / 12) : ch.phase === 2 ? 0.5 * (1 - ch.bp) : ch.phase === 3 ? 0.12 : S.p(t, 0, 0.6, 1.5) * 0.12;
    halo(ctx, cx + 10, cy - 30, 200, sacred, t);
    const pc = S.p(t, 0, 0.1, 2.2);
    const failFlash = ch.phase === 2 ? Math.max(0, 1 - ch.bp * 3) : 0;
    chair(ctx, cx, cy, 1.25, pc, failFlash > 0 ? mixHex(C.gold, C.rose, failFlash) : C.gold);
    if (failFlash > 0) glow(ctx, cx, cy, 300, C.rose, failFlash);

    // rule card
    const ra = S.p(t, 1, 0.3, 1.0) * (1 - S.p(t, 3, -0.2, 0.8));
    place(rule, { x: 1080, y: 470, ax: 0, o: ra, dx: (1 - S.p(t, 1, 0.3, 1.0)) * 24 });
    // dim the "don't sit" line until its cue
    const rows = rule.firstElementChild.children;
    const dimA = S.p(t, 2, 0, 0.8);
    rows[2].style.opacity = rows[3].style.opacity = String(dimA);

    // chain
    const y = 790;
    const list = [];
    if (ch.phase === 2) {
      for (let i = 0; i < 12; i++) {
        const sp = 64;
        const x0 = 360 + i * sp;
        const fall = ease.in(clamp(ch.bp * 1.3 - hash(i) * 0.3));
        list.push({ x: x0 + (hash(i * 3) - 0.5) * 80 * fall, y: y + fall * 160, a: 1 - fall, color: mixHex(C.gold, C.rose, clamp(ch.bp * 4)), label: `#${i + 1}` });
      }
      beads(ctx, list, { link: false });
      ring(ctx, cx, cy - 30, 200 + ch.bp * 300, C.rose, 2, 1 - ch.bp);
    } else if (ch.n > 0) {
      const n = ch.n;
      const sp = Math.min(64, 1180 / Math.max(1, n - 1));
      for (let i = 0; i < n; i++) {
        const born = ch.t0 + (ch.times[i] ?? 0);
        const p = prog(t, born, 0.35, ease.outBack);
        const label = n <= 14 || i === 0 || i === n - 1 || (i + 1) % 10 === 0 ? `#${i + 1}` : '';
        list.push({ x: 360 + i * sp, y, a: clamp(p * 2), s: lerp(0.4, 1, p) * (n > 20 ? 0.72 : 1), label });
      }
      beads(ctx, list, { r: 13 });
      const last = list.at(-1);
      glow(ctx, last.x, last.y, 60, C.gold, 1 - prog(t, ch.t0 + (ch.times[n - 1] ?? 0), 0.6));
    }
    const showCount = ch.n > 0 && ch.phase !== 2;
    count.textContent = `#${ch.n}`;
    place(count, { x: 1420, y: 470, o: showCount ? S.p(t, 3, 0.7, 0.6) : 0 });
    place(countL, { x: 1420, y: 570, o: showCount ? S.p(t, 3, 0.6, 0.6) * 0.9 : 0 });
  },
};

// ───────────────────────── compress: the chain's value collapses into a spike at τ = 0
const CP = new Plot({ x0: 260, x1: 1660, y0: 450, tauMax: 6, xMin: -6, sy: 112 });
const compress = {
  setup(root) {
    const ctx = makeCanvas(root);
    const opt = duo(root, '选项：放弃专注', 'option: quit focusing');
    const past = duo(root, '过去的投入', 'past investment');
    const fut = duo(root, '未来的期望', 'future promise');
    const spike = duo(root, '整条链的价值', 'the whole chain’s value');
    const tempt = duo(root, '短期诱惑', 'temptation');
    const flow = el('div', 'abs', root, '<span class="zh-serif" style="font-size:60px;letter-spacing:.3em;color:#f1ece2">心流</span>');
    const flowEn = el('div', 'abs caps', root, 'flow');
    return { ctx, opt, past, fut, spike, tempt, flow, flowEn };
  },
  render(t, S, st) {
    const { ctx, opt, past, fut, spike, tempt, flow, flowEn } = st;
    ctx.clear();
    const calm = S.p(t, 3, 0, 1.6);
    const worldA = 1 - calm;
    ctx.save();
    ctx.globalAlpha = worldA;
    // axes with past on the left
    const ox = CP.X(0);
    arrow(ctx, CP.x0 - 20, CP.y0, CP.x1 + 50, CP.y0, rgba(C.ink, 0.5), 1.5, prog(t, 0, 1));
    line(ctx, ox, 220, ox, 830, rgba(C.ink, 0.3), 1.3, prog(t, 0, 1));
    text(ctx, '此刻 NOW', ox, 196, { font: '500 16px "PingFang SC", "Avenir Next"', color: rgba(C.ink, 0.6) });
    text(ctx, '过去 · past', CP.X(-5.4), CP.y0 + 34, { font: '500 16px "PingFang SC", "Avenir Next"', color: rgba(C.ink, 0.45) });
    text(ctx, '未来 · future', CP.X(5.4), CP.y0 + 34, { font: '500 16px "PingFang SC", "Avenir Next"', color: rgba(C.ink, 0.45) });

    // beads: 18 past (solid), 14 future (hollow) flow into the origin
    const flowP = S.p(t, 0, 2.2, 3.2, ease.inOut);
    const list = [];
    let arrived = 0;
    for (let i = 0; i < 32; i++) {
      const isPast = i < 18;
      const tau = isPast ? -5.6 + i * 0.3 : 0.5 + (i - 18) * 0.38;
      const delay = (Math.abs(tau) / 6) * 0.55;
      const p = clamp((flowP - delay) / 0.45);
      const e = ease.in(p);
      if (p >= 1) {
        arrived++;
        continue;
      }
      list.push({ x: lerp(CP.X(tau), ox, e), y: CP.y0 - 34 + e * 30, a: (isPast ? 1 : 0.6) * S.p(t, 0, 0.2, 1.0), hollow: !isPast, s: 0.7 });
    }
    beads(ctx, list, { r: 11, link: false, labels: false });
    place(past, { x: CP.X(-3), y: CP.y0 - 110, o: S.p(t, 0, 0.6, 0.8) * clamp(1 - flowP * 2) });
    place(fut, { x: CP.X(3.2), y: CP.y0 - 110, o: S.p(t, 0, 1.0, 0.8) * clamp(1 - flowP * 2) });

    // the spike: V_quit(τ) = −A · narrow gaussian
    const A = 2.7 * (arrived / 32);
    const vq = (x) => -A * Math.exp(-((x / 0.09) ** 2));
    CP.fill(ctx, vq, { color: C.rose, alpha: 0.35, from: -0.5, to: 0.5 });
    CP.curve(ctx, vq, { color: mixHex(C.rose, '#ffffff', 0.25), w: 3, from: -0.5, to: 0.5, glow: 24 });
    glow(ctx, ox, CP.Y(-A * 0.7), 160, C.rose, clamp(A / 3) * 0.9);
    place(opt, { x: 1500, y: 260, o: S.p(t, 0, 0.3, 0.8) * worldA });
    place(spike, { x: ox + 210, y: CP.Y(-A) + 10, o: S.p(t, 1, 0.2, 0.8) * worldA });
    if (S.p(t, 1, 0.2, 0.8) > 0) arrow(ctx, ox + 120, CP.Y(-A) + 10, ox + 22, CP.Y(-A) + 10, rgba(C.ink, 0.6), 1.4, S.p(t, 1, 0.2, 0.8), 9);

    // temptation: a small cyan hill dwarfed by the wall
    const tp = S.p(t, 2, 0.2, 1.0);
    const tf = (x) => 0.55 * Math.exp(-(((x - 0.45) / 0.3) ** 2)) * tp;
    CP.fill(ctx, tf, { color: C.cyan, alpha: 0.3, from: -0.2, to: 1.5 });
    CP.curve(ctx, tf, { color: C.cyan, w: 2.4, from: -0.2, to: 1.5, alpha: tp });
    place(tempt, { x: CP.X(0.9) + 60, y: CP.Y(0.55) - 46, o: tp * worldA });
    if (tp > 0) {
      const wy = CP.Y(-A);
      line(ctx, ox - 60, wy, ox + 60, wy, rgba(C.rose, 0.6), 1, tp);
      text(ctx, '屏障 · wall', ox - 80, wy, { font: '500 16px "PingFang SC", "Avenir Next"', color: rgba(C.rose, 0.9), alpha: tp, align: 'right' });
    }
    ctx.restore();

    // calm: a slow breathing light
    if (calm > 0) {
      const br = 0.5 + 0.5 * Math.sin((t - S.at(3)) * 1.3 - Math.PI / 2);
      glow(ctx, W / 2, 470, 380 + br * 80, C.gold, calm * (0.5 + 0.3 * br));
      ring(ctx, W / 2, 470, 150 + br * 22, C.gold, 1.4, calm * 0.7);
      ring(ctx, W / 2, 470, 210 + br * 30, C.gold, 1, calm * 0.3);
    }
    place(flow, { x: W / 2 + 18, y: 470, o: calm * S.p(t, 3, 0.8, 1.2) });
    place(flowEn, { x: W / 2 + 6, y: 545, o: calm * S.p(t, 3, 1.2, 1.2) });
  },
};

// ───────────────────────── precedent: 下必为例
function ruleR(theta, k) {
  const truth = 210 + 38 * Math.sin(3 * theta + 0.4) + 22 * Math.cos(5 * theta + 1.1);
  const err = 70 * Math.sin(2 * theta + 2.0) + 45 * Math.cos(4 * theta - 0.7) + 30 * Math.sin(7 * theta);
  return { truth, rule: truth + err * Math.pow(0.62, k) };
}
const precedent = {
  setup(root) {
    const ctx = makeCanvas(root);
    const head = header(root, '原理二 · 下必为例', 'Principle II · Precedent Is Binding');
    const big = el('div', 'abs zh-serif', root);
    big.style.cssText += 'font-size:150px;letter-spacing:0.16em;color:#f1ece2;';
    big.innerHTML = '下<span class="bu" style="display:inline-block;position:relative">不<span class="bi" style="position:absolute;left:0;top:0;color:#e9b65c">必</span></span>为例';
    const pin = el('div', 'abs', root, '<span class="zh-sans" style="font-size:24px;color:rgba(237,232,221,.7)">是下“必（bì）”为例，不是下“不（bù）”为例</span>');
    const qs = [
      duo(root, '去洗手间？', 'bathroom?'),
      duo(root, '回一条消息？', 'a quick reply?'),
      duo(root, '刷两分钟视频？', 'two minutes of video?'),
    ];
    const left = duo(root, '下不为例', 'just this once');
    const right = duo(root, '毫不通融', 'never');
    const node = duo(root, '疑似违规', 'questionable act');
    const up = duo(root, '判定违规 → 链条断裂', 'violation → chain breaks');
    const dn = duo(root, '判定允许 → 永久判例', 'allowed → forever');
    const pl = duo(root, '此刻的你 · 运动员', 'you now · the player');
    const rf = duo(root, '未来的你 · 裁判', 'you later · the referee');
    const nash = el('div', 'abs', root, '<span class="zh-serif" style="font-size:40px;letter-spacing:.2em">纳什均衡</span>');
    const nashEn = el('div', 'abs caps', root, 'Nash equilibrium across time');
    const bLegend = el('div', 'abs', root, `
      <div class="label-zh" style="font-size:20px"><span style="color:#e9b65c">●</span> 必要的 · necessary &nbsp;&nbsp; <span style="color:#5cc8d7">●</span> 放纵的 · indulgent</div>
      <div class="label-en" style="margin-top:10px"><span style="display:inline-block;width:26px;border-top:2px dashed rgba(237,232,221,.6);vertical-align:middle"></span>&nbsp; 理性边界 rational boundary &nbsp;&nbsp; <span style="display:inline-block;width:26px;border-top:2px solid #e9b65c;vertical-align:middle"></span>&nbsp; 规则边界 rule boundary</div>`);
    const rulings = el('div', 'abs en-serif', root);
    rulings.style.cssText += 'font-size:30px;color:#e9b65c;';
    // behaviours scattered around the true boundary
    const pts = [];
    for (let i = 0; i < 90; i++) {
      const th = hash(i * 13.1) * Math.PI * 2;
      const { truth } = ruleR(th, 99);
      const r = truth * (0.45 + hash(i * 7.7) * 1.0);
      pts.push({ th, r, inside: r < truth, order: hash(i * 3.3) });
    }
    pts.sort((a, b) => a.order - b.order);
    return { ctx, head, big, pin, qs, left, right, node, up, dn, pl, rf, nash, nashEn, bLegend, rulings, pts };
  },
  render(t, S, st) {
    const { ctx } = st;
    ctx.clear();
    // 0 · 下不为例 → 下必为例
    const bigA = S.p(t, 0, -0.4, 0.9) * (1 - S.p(t, 1, -0.4, 0.6));
    place(st.big, { x: W / 2 + 22, y: 470, o: bigA });
    const sw = S.p(t, 0, 1.0, 0.9, ease.inOut);
    const bu = st.big.querySelector('.bu');
    const bi = st.big.querySelector('.bi');
    bu.style.color = `rgba(237,232,221,${1 - sw})`;
    bu.style.transform = `translateY(${-sw * 40}px)`;
    bi.style.transform = `translateY(${(1 - sw) * 80 + sw * 40}px)`;
    bi.style.opacity = String(sw);
    if (sw > 0 && sw < 1) {
      const strike = S.p(t, 0, 0.5, 0.5);
      lineP(ctx, 790, 470, 960, 470, strike, C.rose, 3, 1 - sw);
    }
    place(st.pin, { x: W / 2, y: 610, o: S.p(t, 0, 1.6, 0.8) * bigA });
    place(st.head, { x: 120, y: 130, ax: 0, o: S.p(t, 1, -0.4, 0.8) });

    // 1 · questions around a focus session
    const qA = S.p(t, 1, 0, 0.8) * (1 - S.p(t, 2, -0.3, 0.6));
    if (qA > 0) {
      ring(ctx, W / 2, 470, 140, C.gold, 2, qA);
      glow(ctx, W / 2, 470, 260, C.gold, 0.3 * qA);
      text(ctx, '专注 60 分钟', W / 2, 460, { font: '500 26px "PingFang SC"', color: C.ink, alpha: qA });
      text(ctx, 'FOCUS · 60 MIN', W / 2, 494, { font: '600 13px "Avenir Next"', color: rgba(C.gold, 0.8), alpha: qA, spacing: 3 });
      const spots = [[560, 330], [1360, 360], [1040, 720]];
      st.qs.forEach((q, i) => {
        const a = S.p(t, 1, 0.3 + i * 0.55, 0.6) * qA;
        place(q, { x: spots[i][0], y: spots[i][1], o: a, dy: Math.sin(t * 1.4 + i) * 4 });
        q.querySelector('.zh').style.color = C.cyan;
        lineP(ctx, spots[i][0] + (W / 2 - spots[i][0]) * 0.25, spots[i][1] + (470 - spots[i][1]) * 0.25, W / 2 + (spots[i][0] - W / 2) * 0.62, 470 + (spots[i][1] - 470) * 0.62, a, rgba(C.cyan, 0.4), 1.2, 1);
      });
    } else st.qs.forEach((q) => place(q, { o: 0 }));

    // 2 · erosion vs shattering
    const eA = S.p(t, 2, 0, 0.8) * (1 - S.p(t, 3, -0.3, 0.6));
    if (eA > 0) {
      const ep = S.p(t, 2, 0.4, 4.2, ease.inOut);
      // left: a boundary nibbled away by exceptions
      const lx = 600;
      const ly = 480;
      const segs = 48;
      for (let i = 0; i < segs; i++) {
        const gone = hash(i * 5.1) < ep * 0.85;
        if (gone) continue;
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 0.7) / segs) * Math.PI * 2;
        ring(ctx, lx, ly, 150, C.gold, 2, eA, a0, a1 - a0);
      }
      for (let i = 0; i < 14; i++) {
        if (hash(i * 9.3) > ep) continue;
        const a = hash(i * 2.2) * Math.PI * 2;
        dot(ctx, lx + Math.cos(a) * (150 + 40 * hash(i)), ly + Math.sin(a) * (150 + 40 * hash(i)), 4, C.cyan, eA * 0.8, 8);
      }
      place(st.left, { x: lx, y: 700, o: eA });
      // right: a rigid ring that cracks, then shatters
      const rx = 1320;
      const crack = clamp(ep * 1.6);
      const boom = clamp((ep - 0.62) / 0.38);
      if (boom <= 0) {
        ring(ctx, rx, ly, 150, C.ink, 3.4, eA);
        polyP(ctx, [[rx + 106, ly - 106], [rx + 70, ly - 60], [rx + 92, ly - 20], [rx + 40, ly + 30]], crack, C.rose, 2, eA);
      } else shards(ctx, rx, ly, boom * 0.98, rgba(C.ink, 0.9), 40, 300, 3);
      if (boom > 0) glow(ctx, rx, ly, 280, C.rose, (1 - boom) * eA);
      place(st.right, { x: rx, y: 700, o: eA });
    } else {
      place(st.left, { o: 0 });
      place(st.right, { o: 0 });
    }

    // 3–5 · the fork
    const fA = S.p(t, 3, 0, 0.8) * (1 - S.p(t, 6, -0.3, 0.6));
    if (fA > 0) {
      const n = [600, 480];
      const u = [1250, 330];
      const d = [1250, 630];
      const pu = S.p(t, 3, 0.2, 1.0);
      const litU = S.p(t, 4, 0, 0.6);
      const litD = S.p(t, 5, 0, 0.6);
      polyP(ctx, bez(n[0] + 90, n[1], 900, n[1], 980, u[1], u[0] - 170, u[1]), pu, litU > 0 ? C.rose : rgba(C.ink, 0.5), 2 + litU, fA, 10 * litU);
      polyP(ctx, bez(n[0] + 90, n[1], 900, n[1], 980, d[1], d[0] - 170, d[1]), pu, litD > 0 ? C.gold : rgba(C.ink, 0.5), 2 + litD, fA, 10 * litD);
      dot(ctx, n[0] + 90, n[1], 6, C.ink, fA, 10);
      place(st.node, { x: n[0] - 30, y: n[1], o: fA });
      place(st.up, { x: u[0], y: u[1], o: fA * lerp(0.45, 1, litU) });
      place(st.dn, { x: d[0], y: d[1], o: fA * lerp(0.45, 1, litD) });
      st.up.querySelector('.zh').style.color = litU > 0 ? C.rose : C.ink;
      st.dn.querySelector('.zh').style.color = litD > 0 ? C.gold : C.ink;
      // mini consequences
      const mu = fA * litU;
      for (let i = 0; i < 6; i++) {
        const fall = S.p(t, 4, 0.6 + i * 0.05, 0.9, ease.in);
        dot(ctx, u[0] + 200 + i * 32, u[1] + fall * 60, 7, i === 0 ? C.gold : C.rose, mu * (i === 0 ? 1 : 1 - fall));
      }
      text(ctx, '#1', u[0] + 200, u[1] - 30, { font: '500 18px "Iowan Old Style"', color: C.gold, alpha: mu * S.p(t, 4, 1.4, 0.5) });
      text(ctx, '∞', d[0] + 230, d[1], { font: '400 64px "Iowan Old Style"', color: C.gold, alpha: fA * litD });
    } else {
      [st.node, st.up, st.dn].forEach((e) => place(e, { o: 0 }));
    }

    // 6 · player and referee
    const nA = S.p(t, 6, 0, 0.8) * (1 - S.p(t, 7, -0.3, 0.6));
    if (nA > 0) {
      const a = [700, 470];
      const b = [1220, 470];
      ring(ctx, a[0], a[1], 70, C.cyan, 2, nA);
      ring(ctx, b[0], b[1], 70, C.gold, 2, nA);
      glow(ctx, a[0], a[1], 160, C.cyan, 0.4 * nA);
      glow(ctx, b[0], b[1], 160, C.gold, 0.4 * nA);
      const bal = Math.sin((t - S.at(6)) * 1.6) * Math.exp(-(t - S.at(6)) * 0.5) * 0.08;
      const mx = W / 2;
      line(ctx, a[0] + 80, a[1] - bal * 260, b[0] - 80, b[1] + bal * 260, rgba(C.ink, 0.55), 1.6, nA);
      polyP(ctx, [[mx - 18, 520], [mx, 492], [mx + 18, 520], [mx - 18, 520]], 1, rgba(C.ink, 0.55), 1.6, nA);
      place(st.pl, { x: a[0], y: a[1] + 120, o: nA });
      place(st.rf, { x: b[0], y: b[1] + 120, o: nA });
      place(st.nash, { x: mx + 16, y: 300, o: nA * S.p(t, 6, 0.6, 0.8) });
      place(st.nashEn, { x: mx + 6, y: 355, o: nA * S.p(t, 6, 0.9, 0.8) });
      arrow(ctx, a[0], 640, b[0], 640, rgba(C.ink, 0.35), 1.2, nA, 9);
      text(ctx, 'τ', b[0] + 26, 640, { font: 'italic 24px "KaTeX_Main"', color: rgba(C.ink, 0.6), alpha: nA });
    } else [st.pl, st.rf, st.nash, st.nashEn].forEach((e) => place(e, { o: 0 }));

    // 7 · the rule boundary converges on the rational one
    const bA = S.p(t, 7, 0, 0.8);
    if (bA > 0) {
      const cx = 820;
      const cy = 470;
      const elapsed = t - S.at(7, 0.4);
      const nRulings = clamp(Math.floor(elapsed / 0.16), 0, st.pts.length);
      const k = nRulings / 9;
      const pathOf = (key) => {
        const out = [];
        for (let i = 0; i <= 180; i++) {
          const th = (i / 180) * Math.PI * 2;
          const r = ruleR(th, k)[key];
          out.push([cx + Math.cos(th) * r, cy + Math.sin(th) * r * 0.82]);
        }
        return out;
      };
      ctx.save();
      ctx.setLineDash([7, 8]);
      polyP(ctx, pathOf('truth'), 1, rgba(C.ink, 0.55), 1.6, bA);
      ctx.restore();
      polyP(ctx, pathOf('rule'), S.p(t, 7, 0, 1.4), C.gold, 2.6, bA, 14);
      st.pts.forEach((p, i) => {
        if (i >= nRulings) return;
        const x = cx + Math.cos(p.th) * p.r;
        const y = cy + Math.sin(p.th) * p.r * 0.82;
        const fresh = 1 - clamp((elapsed - i * 0.16) / 0.5);
        dot(ctx, x, y, 4 + fresh * 5, p.inside ? C.gold : C.cyan, bA * 0.9, 8 + fresh * 10);
      });
      place(st.bLegend, { x: 1270, y: 420, ax: 0, o: bA * S.p(t, 7, 0.4, 0.8) });
      st.rulings.textContent = `判例 × ${nRulings}`;
      place(st.rulings, { x: 1270, y: 560, ax: 0, o: bA * S.p(t, 7, 0.8, 0.8) });
    } else {
      place(st.bLegend, { o: 0 });
      place(st.rulings, { o: 0 });
    }
  },
};

// ───────────────────────── delay: shifting V(τ) into the flat part of W(τ)
const DP = new Plot({ x0: 300, x1: 1380, y0: 600, tauMax: 8, sy: 165 });
const SHIFT = 1.2;
const delay = {
  setup(root) {
    const ctx = makeCanvas(root);
    const head = header(root, '原理三 · 线性时延', 'Principle III · Linear Time Delay');
    const barrier = duo(root, '启动阻力', 'activation barrier');
    const q1 = el('div', 'abs', root, '<span class="zh-sans" style="font-size:44px;font-weight:500">“现在开始吗？”</span><span class="en-sans" style="font-size:22px;color:rgba(237,232,221,.6);margin-left:18px">Start now?</span>');
    const a1 = el('div', 'abs', root, '<span class="zh-sans" style="font-size:44px;font-weight:600;color:#e0675b">不。</span><span class="en-sans" style="font-size:22px;color:rgba(224,103,91,.8);margin-left:12px">No.</span>');
    const q2 = el('div', 'abs', root, '<span class="zh-sans" style="font-size:44px;font-weight:500">“十五分钟后呢？”</span><span class="en-sans" style="font-size:22px;color:rgba(237,232,221,.6);margin-left:18px">In fifteen minutes?</span>');
    const a2 = el('div', 'abs', root, '<span class="zh-sans" style="font-size:44px;font-weight:600;color:#e9b65c">好。</span><span class="en-sans" style="font-size:22px;color:rgba(233,182,92,.85);margin-left:12px">Okay.</span>');
    const dt = el('div', 'abs', root, katex.renderToString('\\Delta\\tau = 15\\,\\text{min}', { output: 'html' }));
    dt.style.cssText += 'font-size:30px;color:#ede8dd';
    const mainL = duo(root, '主链 · 神圣座位', 'main chain · the seat');
    const bookL = duo(root, '预约链 · 十五分钟内入座', 'booking chain · seat within 15 min');
    const snap = duo(root, '响指', 'snap');
    const clock = el('div', 'abs en-serif', root);
    clock.style.cssText += 'font-size:44px;color:#a99be8;font-variant-numeric:tabular-nums';
    return { ctx, head, barrier, q1, a1, q2, a2, dt, mainL, bookL, snap, clock };
  },
  render(t, S, st) {
    const { ctx } = st;
    ctx.clear();
    place(st.head, { x: 120, y: 130, ax: 0, o: S.p(t, 1, 0, 0.8) });

    // 0 · the seat is so sacred you dare not sit
    const sA = S.p(t, 0, -0.4, 0.8) * (1 - S.p(t, 1, 0.6, 0.8));
    if (sA > 0) {
      ctx.save();
      ctx.globalAlpha = sA;
      halo(ctx, 640, 440, 200, 1, t);
      chair(ctx, 630, 480, 1.2, 1);
      const bx = 1010;
      const grd = ctx.createLinearGradient(bx - 40, 0, bx + 40, 0);
      grd.addColorStop(0, rgba(C.rose, 0));
      grd.addColorStop(0.5, rgba(C.rose, 0.35));
      grd.addColorStop(1, rgba(C.rose, 0));
      ctx.fillStyle = grd;
      ctx.fillRect(bx - 40, 250, 80, 480);
      line(ctx, bx, 250, bx, 730, rgba(C.rose, 0.8), 1.5);
      // you approach and bounce back
      const ph = (t - S.at(0)) % 2.4;
      const x = 1340 - 260 * Math.sin(Math.PI * clamp(ph / 1.6)) * 0.9;
      dot(ctx, x, 560, 10, C.ink, 1, 14);
      text(ctx, '你', x, 520, { font: '500 20px "PingFang SC"', color: C.ink });
      ctx.restore();
      place(st.barrier, { x: 1010, y: 780, o: sA });
      st.barrier.querySelector('.zh').style.color = C.rose;
    } else place(st.barrier, { o: 0 });

    // 2 · the two questions
    const qa = S.p(t, 2, 0, 0.6) * (1 - S.p(t, 3, -0.3, 0.6));
    place(st.q1, { x: 520, y: 400, ax: 0, o: qa });
    place(st.a1, { x: 1240, y: 400, ax: 0, o: qa * S.p(t, 2, 0.9, 0.4) });
    place(st.q2, { x: 520, y: 560, ax: 0, o: qa * S.p(t, 2, 1.8, 0.6) });
    place(st.a2, { x: 1240, y: 560, ax: 0, o: qa * S.p(t, 2, 2.8, 0.4) });

    // 3 · the shift
    const pA = S.p(t, 3, 0, 0.8) * (1 - S.p(t, 4, -0.3, 0.7));
    if (pA > 0) {
      ctx.save();
      ctx.globalAlpha = pA;
      const sh = S.p(t, 3, 1.4, 2.2) * SHIFT;
      DP.axes(ctx, { top: 400, bottom: 820 });
      // W strip
      const wy = 300;
      const wpts = [];
      for (let i = 0; i <= 200; i++) {
        const x = (i / 200) * 8;
        wpts.push([DP.X(x), wy - Whyper(x) * 90]);
      }
      line(ctx, DP.x0 - 20, wy, DP.x1 + 40, wy, rgba(C.ink, 0.25), 1.2);
      polyP(ctx, wpts, 1, C.violet, 2.4, 1, 12);
      text(ctx, 'W(τ)', DP.x0 - 56, wy - 50, { font: 'italic 26px "KaTeX_Main"', color: C.violet, align: 'right' });
      const v = (x) => Vstudy(x - sh) * (x >= sh ? 1 : 0);
      DP.curve(ctx, v, { color: C.gold, alpha: 0.35, w: 2, dash: [5, 6], glow: 0 });
      const vw = (x) => v(x) * Whyper(x) * 3;
      DP.fill(ctx, vw, { color: C.gold, alpha: 0.3 });
      DP.curve(ctx, vw, { color: C.gold, w: 3 });
      // shaded band showing where W is steep
      ctx.fillStyle = rgba(C.violet, 0.06);
      ctx.fillRect(DP.X(0), 210, DP.X(1) - DP.X(0), 620);
      if (sh > 0.02) arrow(ctx, DP.X(0.55), 370, DP.X(0.55 + sh), 370, C.ink, 1.6, 1, 10);
      const now = integrate((x) => Vstudy(x) * Whyper(x));
      const later = integrate((x) => Vstudy(x - SHIFT) * (x >= SHIFT ? 1 : 0) * Whyper(x));
      const cur = integrate((x) => v(x) * Whyper(x));
      meters(ctx, { x: 1720, y: 560, half: 130, rows: [
        { label: '现在开始', value: now / 0.08, color: C.rose },
        { label: '15 分钟后', value: (cur / later) * (sh / SHIFT), color: C.gold },
      ] });
      ctx.restore();
      place(st.dt, { x: DP.X(0.55 + SHIFT / 2), y: 340, o: pA * S.p(t, 3, 1.6, 0.6) });
    } else place(st.dt, { o: 0 });

    // 4–5 · booking chain and the firing pin
    const cA = S.p(t, 4, 0, 0.8);
    if (cA > 0) {
      ctx.save();
      ctx.globalAlpha = cA;
      const seatX = 1540;
      const pin = S.p(t, 5, 0.6, 1.4, ease.inExpo);
      const boom = clamp((t - S.at(5, 2.0)) / 1.2);
      halo(ctx, seatX, 450, 120, 0.6 + boom * 0.8, t);
      chair(ctx, seatX, 470, 0.7, 1);
      // main chain
      const ml = [];
      for (let i = 0; i < 14; i++) ml.push({ x: 260 + i * 46, y: 360, a: 1, s: 0.6 });
      beads(ctx, ml, { r: 13, labels: false });
      text(ctx, '#37', 260 + 13 * 46 + 46, 360, { font: '500 26px "Iowan Old Style"', color: C.gold, align: 'left' });
      // booking chain (collapses into a pin)
      const bl = [];
      for (let i = 0; i < 12; i++) {
        const x0 = 260 + i * 46;
        const e = ease.inOut(clamp(S.p(t, 5, 0, 1.0) * 1.2 - i * 0.02));
        bl.push({ x: lerp(x0, 850, e), y: 620, a: 1 - e * 0.9, s: 0.6, color: C.violet });
      }
      beads(ctx, bl, { r: 13, labels: false });
      text(ctx, '#21', 260 + 11 * 46 + 46, 620, { font: '500 26px "Iowan Old Style"', color: C.violet, align: 'left', alpha: 1 - S.p(t, 5, 0, 0.6) });
      place(st.mainL, { x: 420, y: 300, o: cA * (1 - boom) });
      place(st.bookL, { x: 460, y: 690, o: cA * (1 - S.p(t, 5, 0, 0.6)) });
      st.bookL.querySelector('.zh').style.color = C.violet;
      // snap + countdown
      const snapT = S.at(4, 1.6);
      const sp = prog(t, snapT, 0.5, ease.out);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        lineP(ctx, 1000 + Math.cos(a) * 18, 620 + Math.sin(a) * 18, 1000 + Math.cos(a) * (18 + 30 * sp), 620 + Math.sin(a) * (18 + 30 * sp), 1, C.violet, 2, 1 - prog(t, snapT + 0.4, 0.6));
      }
      place(st.snap, { x: 1000, y: 700, o: cA * prog(t, snapT - 0.3, 0.5) * (1 - S.p(t, 5, 0, 0.6)) });
      const cd = clamp((t - snapT) / (S.at(5, 0.6) - snapT));
      ring(ctx, 1220, 620, 54, rgba(C.violet, 0.25), 3, prog(t, snapT, 0.5) * (1 - pin));
      ring(ctx, 1220, 620, 54, C.violet, 3, prog(t, snapT, 0.5) * (1 - pin), -Math.PI / 2, Math.PI * 2 * (1 - cd));
      const secs = Math.round((1 - cd) * 900);
      st.clock.textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
      place(st.clock, { x: 1220, y: 520, o: cA * prog(t, snapT, 0.5) * (1 - pin) });
      // the pin flies from the chain to the seat, through the barrier
      if (S.p(t, 5, 0.3, 0.4) > 0 && boom < 1) {
        const px = lerp(850, seatX - 90, pin);
        const py = lerp(620, 470, pin);
        const len = 120 + 80 * pin;
        ctx.save();
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#f7f3ff';
        const ang = Math.atan2(470 - 620, seatX - 90 - 850);
        ctx.translate(px, py);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-len, -5);
        ctx.lineTo(-len, 5);
        ctx.closePath();
        ctx.globalAlpha = S.p(t, 5, 0.3, 0.4) * (1 - boom);
        ctx.fill();
        ctx.restore();
      }
      // barrier
      const bx = 1380;
      const hit = clamp((t - S.at(5, 1.75)) / 1.0);
      if (hit <= 0) {
        line(ctx, bx, 330, bx, 640, rgba(C.rose, 0.85), 2.4, S.p(t, 4, 0.4, 0.8));
        text(ctx, '启动阻力', bx, 310, { font: '500 18px "PingFang SC"', color: C.rose, alpha: S.p(t, 4, 0.4, 0.8) });
      } else {
        shards(ctx, bx, 520, hit, C.rose, 34, 260, 9);
        glow(ctx, bx, 520, 300, '#ffffff', (1 - hit) * 0.9);
      }
      ctx.restore();
    } else [st.mainL, st.bookL, st.snap, st.clock].forEach((e) => place(e, { o: 0 }));
  },
};

// ───────────────────────── ctdp: synthesis and the 3-3 hierarchy
const UNIT = [
  ['突击', 'assault', C.gold],
  ['侦查', 'recon', C.cyan],
  ['指挥', 'command', C.violet],
  ['特勤', 'special ops', C.rose],
  ['工程', 'engineering', C.sage],
  ['炊事', 'quartermaster', '#d9cdb5'],
];
const ctdp = {
  setup(root) {
    const ctx = makeCanvas(root);
    const labels = [
      duo(root, '非线性压缩', 'nonlinear compression'),
      duo(root, '判例法约束', 'case-law constraint'),
      duo(root, '线性时间平移', 'linear time shift'),
    ];
    const name = el('div', 'abs en-serif', root, 'CTDP');
    name.style.cssText += 'font-size:92px;letter-spacing:0.16em;color:#f1ece2;';
    const full = duo(root, '链式时延协议', 'Chained Time-Delay Protocol');
    const virtues = [duo(root, '容易开始', 'easy to start'), duo(root, '容易坚持', 'easy to sustain'), duo(root, '长期不失效', 'does not wear out')];
    const levels = [
      ['#', '单元', 'unit'],
      ['##', '任务组', 'group'],
      ['###', '任务群', 'cluster'],
      ['####', '纵队', 'column'],
    ].map(([h, zh, en]) => el('div', 'abs', root, `<span class="en-serif" style="font-size:26px;color:#e9b65c;display:inline-block;width:90px">${h}</span><span class="zh-sans" style="font-size:24px;font-weight:500">${zh}</span><span class="en-sans" style="font-size:15px;letter-spacing:.2em;text-transform:uppercase;color:rgba(237,232,221,.55);margin-left:12px">${en}</span>`));
    const legend = el('div', 'abs', root, UNIT.map(([zh, en, c]) => `<span style="margin-right:26px;white-space:nowrap"><span style="color:${c}">●</span> <span class="zh-sans" style="font-size:19px">${zh}</span> <span class="en-sans" style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:rgba(237,232,221,.5)">${en}</span></span>`).join(''));
    return { ctx, labels, name, full, virtues, levels, legend };
  },
  render(t, S, st) {
    const { ctx } = st;
    ctx.clear();
    const hier = S.p(t, 3, 0, 1.0);
    const emb = 1 - hier;
    const merge = S.p(t, 1, 0, 1.6, ease.inOut);
    const centers = [[560, 520], [960, 330], [1360, 520]];
    const pos = centers.map(([x, y]) => [lerp(x, 960, merge * 0.65), lerp(y, 470, merge * 0.65)]);
    ctx.save();
    ctx.globalAlpha = emb;
    // three emblems
    const a0 = S.p(t, 0, 0, 0.8);
    const a1 = S.p(t, 0, 0.4, 0.8);
    const a2 = S.p(t, 0, 0.8, 0.8);
    const fadeE = 1 - merge;
    // compression spike
    ctx.save();
    ctx.globalAlpha *= a0 * fadeE;
    const [ex, ey] = pos[0];
    line(ctx, ex - 80, ey + 30, ex + 80, ey + 30, rgba(C.ink, 0.4), 1.2);
    polyP(ctx, [[ex - 80, ey + 30], [ex - 14, ey + 30], [ex - 4, ey - 70], [ex + 6, ey + 30], [ex + 80, ey + 30]], 1, C.gold, 2.6, 1, 14);
    ctx.restore();
    seal(ctx, pos[1][0], pos[1][1], 96, '例', C.rose, a1 * fadeE);
    ctx.save();
    ctx.globalAlpha *= a2 * fadeE;
    const [sx, sy] = pos[2];
    ring(ctx, sx - 40, sy, 40, C.violet, 2);
    arrow(ctx, sx - 40, sy, sx + 70, sy, C.violet, 2.2, 1, 12);
    ctx.restore();
    st.labels.forEach((l, i) => place(l, { x: centers[i][0], y: centers[i][1] + 110, o: [a0, a1, a2][i] * fadeE * emb }));
    // the protocol emblem: a ring of beads
    const ringA = S.p(t, 1, 0.8, 1.0);
    const R = 210;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + t * 0.06;
      const born = prog(t, S.at(1, 0.8 + i * 0.03), 0.4);
      dot(ctx, 960 + Math.cos(a) * R, 470 + Math.sin(a) * R, 5, i % 6 === 0 ? C.violet : C.gold, ringA * born, 8);
    }
    glow(ctx, 960, 470, 380, C.gold, 0.35 * ringA);
    ctx.restore();
    place(st.name, { x: 978, y: 452, o: ringA * emb });
    place(st.full, { x: 960, y: 535, o: S.p(t, 1, 1.4, 0.8) * emb });
    const vp = [[960, 160], [1360, 760], [560, 760]];
    st.virtues.forEach((v, i) => {
      place(v, { x: vp[i][0], y: vp[i][1], o: S.p(t, 2, i * 0.5, 0.7) * emb });
      v.querySelector('.zh').style.fontFamily = 'var(--zh-serif)';
      v.querySelector('.zh').style.fontSize = '32px';
    });

    // hierarchy: 54 units → 18 groups → 6 clusters → 2 columns
    if (hier > 0) {
      const x0 = 520;
      const span = 1260;
      const n = 54;
      const sp = span / (n - 1);
      const yU = 300;
      const draw = (lvl, count, y, sel) => {
        const size = n / count;
        for (let g = 0; g < count; g++) {
          const a = x0 + g * size * sp;
          const b = x0 + (g * size + size - 1) * sp;
          const p = prog(t, S.at(3, 0.4 + lvl * 0.55 + g * 0.02), 0.5);
          if (p <= 0) continue;
          ctx.save();
          ctx.globalAlpha = hier * p;
          ctx.strokeStyle = rgba(C.ink, 0.45);
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(a - 4, y - 18);
          ctx.lineTo(a - 4, y - 8);
          ctx.lineTo(b + 4, y - 8);
          ctx.lineTo(b + 4, y - 18);
          ctx.stroke();
          ctx.restore();
          dot(ctx, (a + b) / 2, y + 8, lvl === 3 ? 7 : 5, sel ? C.gold : C.ink, hier * p, 6);
        }
      };
      for (let i = 0; i < n; i++) {
        // a composite force: mostly assault and recon, some support units
        const k = Math.floor(hash(i * 1.7) * 10);
        const type = k < 5 ? 0 : k < 7 ? 1 : k < 8 ? 2 : k < 9 ? 4 : i % 2 ? 3 : 5;
        const p = prog(t, S.at(3, 0.1 + i * 0.008), 0.5);
        dot(ctx, x0 + i * sp, yU, 7, UNIT[type][2], hier * p, 8);
      }
      draw(1, 18, yU + 70, false);
      draw(2, 6, yU + 150, false);
      draw(3, 2, yU + 230, true);
      st.levels.forEach((l, i) => place(l, { x: 140, y: yU + i * 80 + (i ? 8 : 0), ax: 0, o: hier * prog(t, S.at(3, 0.2 + i * 0.55), 0.5) }));
      place(st.legend, { x: 960, y: 690, o: hier * S.p(t, 3, 1.6, 0.8) });
    } else {
      st.levels.forEach((l) => place(l, { o: 0 }));
      place(st.legend, { o: 0 });
    }
  },
};

export default { seat, compress, precedent, delay, ctdp };
