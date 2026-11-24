// Chapter IV — the Recursive Stabilization Iteration Protocol.
import { C, W, H, el, place, makeCanvas, prog, env, ease, clamp, lerp, rgba, hash, mixHex, rng } from '../engine.js';
import { line, lineP, dot, ring, glow, text, arrow, polyP, bez, roundRect } from '../lib/draw.js';
import { shards } from '../lib/motifs.js';

const duo = (root, zh, en, cls = '') => el('div', `abs duo ${cls}`, root, `<span class="zh">${zh}</span><span class="en">${en}</span>`);

function piece(ctx, x, y, ch, red, a = 1, r = 25) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = '#15171d';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = red ? C.rose : rgba(C.ink, 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r - 5, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `600 ${r * 1.05}px "Songti SC"`;
  ctx.fillStyle = red ? C.rose : C.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, x, y + 1);
  ctx.restore();
}

// ───────────────────────── chess: mate in three, then take it back
const chess = {
  setup(root) {
    const ctx = makeCanvas(root);
    const m3 = el('div', 'abs', root, '<span class="zh-serif" style="font-size:54px;letter-spacing:.2em">三步杀</span><br><span class="caps">mate in three</span>');
    m3.style.textAlign = 'center';
    const hope = duo(root, '胜机重现', 'hope returns');
    const back = duo(root, '回溯', 'backtrack');
    const nodes = [
      ['进入那种状态', 'getting into that state', 0.5],
      ['把手机带上沙发', 'bringing the phone to the sofa', 0.6],
      ['在沙发上拿着手机', 'phone in hand on the sofa', 0.8],
      ['刷一整晚', 'scrolling all night', 0.99],
    ].map(([zh, en, p]) => ({ e: duo(root, zh, en), p }));
    const macro = duo(root, '强大的宏观稳态', 'a powerful steady state');
    const micro = duo(root, '有效干预节点', 'effective intervention node');
    return { ctx, m3, hope, back, nodes, macro, micro };
  },
  render(t, S, st) {
    const { ctx } = st;
    ctx.clear();
    // A · the board
    const bA = S.p(t, 0, -0.3, 0.9) * (1 - S.p(t, 2, -0.4, 0.8));
    const shiftL = S.p(t, 1, 0, 1.2) * 0;
    if (bA > 0) {
      const cs = 52;
      const bx = 700 - 4 * cs - shiftL;
      const by = 470 - 4.5 * cs;
      ctx.save();
      ctx.globalAlpha = bA;
      ctx.strokeStyle = rgba(C.ink, 0.35);
      ctx.lineWidth = 1.2;
      for (let r = 0; r < 10; r++) {
        ctx.beginPath();
        ctx.moveTo(bx, by + r * cs);
        ctx.lineTo(bx + 8 * cs, by + r * cs);
        ctx.stroke();
      }
      for (let c = 0; c < 9; c++) {
        ctx.beginPath();
        ctx.moveTo(bx + c * cs, by);
        ctx.lineTo(bx + c * cs, by + (c === 0 || c === 8 ? 9 : 4) * cs);
        if (c !== 0 && c !== 8) {
          ctx.moveTo(bx + c * cs, by + 5 * cs);
          ctx.lineTo(bx + c * cs, by + 9 * cs);
        }
        ctx.stroke();
      }
      // palaces
      [[0, 2], [7, 9]].forEach(([r0, r1]) => {
        ctx.beginPath();
        ctx.moveTo(bx + 3 * cs, by + r0 * cs);
        ctx.lineTo(bx + 5 * cs, by + r1 * cs);
        ctx.moveTo(bx + 5 * cs, by + r0 * cs);
        ctx.lineTo(bx + 3 * cs, by + r1 * cs);
        ctx.stroke();
      });
      ctx.restore();
      const P = (c, r) => [bx + c * cs, by + r * cs];
      // pieces: black general boxed in, a red horse and chariot closing in
      const mate = S.p(t, 0, 0.6, 3.2);
      const hm = [P(2, 4), P(3, 2), P(5, 1)];
      const hi = Math.min(2, Math.floor(mate * 3));
      const hf = ease.inOut(clamp(mate * 3 - hi));
      const horse = hi >= 2 ? hm[2] : [lerp(hm[hi][0], hm[hi + 1][0], hf), lerp(hm[hi][1], hm[hi + 1][1], hf)];
      piece(ctx, ...P(4, 0), '将', false, bA);
      piece(ctx, ...P(3, 0), '士', false, bA * 0.9);
      piece(ctx, ...P(5, 0), '士', false, bA * 0.9);
      piece(ctx, ...P(2, 2), '象', false, bA * 0.8);
      piece(ctx, ...P(0, 1), '车', true, bA);
      piece(ctx, ...P(7, 6), '炮', true, bA * 0.9);
      piece(ctx, ...P(4, 9), '帅', true, bA * 0.8);
      piece(ctx, ...horse, '马', true, bA);
      for (let k = 0; k < 2; k++) {
        const a = clamp(mate * 3 - k) * bA * (1 - S.p(t, 1, 0, 0.8) * 0.6);
        if (a > 0) arrow(ctx, hm[k][0], hm[k][1], hm[k + 1][0], hm[k + 1][1], rgba(C.rose, 0.7), 1.8, a, 10);
      }
      if (mate >= 1) glow(ctx, ...P(4, 0), 120, C.rose, bA * (0.6 + 0.3 * Math.sin(t * 5)));
      place(st.m3, { x: 1260, y: 330, o: bA * S.p(t, 0, 1.0, 0.8) });
      // move history, stepping backwards
      const hA = S.p(t, 1, 0, 0.8) * bA;
      const steps = 6;
      const sx0 = 1000;
      const sx1 = 1560;
      const back = S.p(t, 1, 0.4, 3.4, ease.inOut) * (steps - 1);
      for (let i = 0; i < steps; i++) {
        const x = lerp(sx1, sx0, i / (steps - 1));
        const reached = back >= i - 0.01;
        const isHope = i === steps - 1;
        const col = !reached ? rgba(C.ink, 0.3) : isHope ? C.gold : C.rose;
        dot(ctx, x, 560, isHope && reached ? 11 : 8, col, hA, reached ? 14 : 0);
        if (i < steps - 1) line(ctx, x - 14, 560, lerp(sx1, sx0, (i + 1) / (steps - 1)) + 14, 560, rgba(C.ink, 0.3), 1.2, hA);
        text(ctx, i === 0 ? '此刻' : `−${i}`, x, 596, { font: '500 15px "Iowan Old Style", "PingFang SC"', color: rgba(C.ink, 0.6), alpha: hA });
        if (reached && !isHope) text(ctx, '必败', x, 530, { font: '500 14px "PingFang SC"', color: rgba(C.rose, 0.8), alpha: hA });
      }
      const cur = lerp(sx1, sx0, back / (steps - 1));
      ring(ctx, cur, 560, 18, '#ffffff', 1.5, hA);
      place(st.hope, { x: sx0, y: 500, o: hA * clamp((back - (steps - 1.4)) / 0.4) });
      st.hope.querySelector('.zh').style.color = C.gold;
    } else {
      place(st.m3, { o: 0 });
      place(st.hope, { o: 0 });
    }

    // B · the same move in a life
    const lA = S.p(t, 2, 0, 0.8);
    const mapP = S.p(t, 4, 0, 1.6);
    const xs = [430, 800, 1170, 1540];
    st.nodes.forEach((n, i) => {
      // appear from the right (now) to the left (earlier)
      const a = prog(t, S.at(2, 0.2 + (3 - i) * 0.9), 0.7) * lA;
      const isMicro = i === 1;
      const fade = mapP > 0 ? (i === 3 || isMicro ? 1 : 1 - mapP * 0.8) : 1;
      const y = 470;
      place(n.e, { x: xs[i], y: y - 96, o: a * fade });
      // ratio bar
      const L = 220;
      const x0 = xs[i] - L / 2;
      ctx.save();
      ctx.globalAlpha = a * fade;
      ctx.fillStyle = rgba(C.cyan, 0.8);
      roundRect(ctx, x0, y - 10, L * n.p, 20, 5);
      ctx.fill();
      ctx.fillStyle = rgba(C.gold, 0.85);
      if (n.p < 0.995) {
        roundRect(ctx, x0 + L * n.p + 2, y - 10, L * (1 - n.p) - 2, 20, 5);
        ctx.fill();
      }
      ctx.restore();
      const pct = Math.round(n.p * 100);
      text(ctx, `${pct} : ${100 - pct}`, xs[i], y + 42, { font: '500 26px "Iowan Old Style"', color: C.ink, alpha: a * fade });
      // the gap, emphasised on cue 3
      const gA = S.p(t, 3, 0, 0.8) * a * (1 - mapP);
      if (gA > 0) text(ctx, `差距 ${Math.abs(2 * pct - 100)}`, xs[i], y + 80, { font: '500 17px "PingFang SC"', color: i === 0 ? C.gold : rgba(C.ink, 0.55), alpha: gA });
      if (i < 3) arrow(ctx, xs[i + 1] - 130, y - 30, xs[i] + 130, y - 30, rgba(C.ink, 0.3), 1.2, a * fade * (1 - mapP), 8);
    });
    place(st.back, { x: 960, y: 640, o: lA * (1 - mapP) * 0.9 });
    // C · the mapping
    if (mapP > 0) {
      const bx = xs[3];
      glow(ctx, bx, 470, 330, C.cyan, mapP * 0.9);
      ring(ctx, bx, 470, 170, C.cyan, 2, mapP * 0.7);
      const mx = xs[1];
      glow(ctx, mx, 470, 110, C.gold, mapP);
      dot(ctx, mx, 470, 10, C.gold, mapP, 18);
      polyP(ctx, bez(bx - 170, 470, 1300, 620, 1000, 620, mx + 16, 478, 60), S.p(t, 4, 0.4, 1.4), '#ffffff', 1.6, mapP, 10);
      place(st.macro, { x: bx, y: 690, o: mapP });
      place(st.micro, { x: mx, y: 590, o: S.p(t, 4, 1.2, 0.8) });
      st.micro.querySelector('.zh').style.color = C.gold;
      st.macro.querySelector('.zh').style.color = C.cyan;
    } else {
      place(st.macro, { o: 0 });
      place(st.micro, { o: 0 });
    }
  },
};

// ───────────────────────── policies: joseki, interaction, metastable steps, easy wins
const JOSEKI = [[2, 2, 1], [3, 2, 0], [2, 3, 1], [3, 4, 0], [1, 5, 1], [4, 3, 0], [5, 2, 1], [5, 3, 0], [6, 3, 1]];
const policies = {
  setup(root) {
    const ctx = makeCanvas(root);
    const jz = el('div', 'abs zh-serif', root);
    jz.style.cssText += 'font-size:92px;letter-spacing:.2em;';
    const jen = el('div', 'abs caps', root);
    const center = duo(root, '不在沙发上玩手机', 'no phone on the sofa');
    const sats = [
      { zh: '洗澡拖延', en: 'putting off a shower', a: 81, b: 62, x: 520, y: 330 },
      { zh: '睡前刷手机', en: 'scrolling in bed', a: 95, b: 87, x: 1400, y: 330 },
      { zh: '第二天赖床', en: 'oversleeping', a: 67, b: 60, x: 960, y: 735, side: true },
    ].map((s) => ({ ...s, e: el('div', 'abs', root) }));
    const easy = duo(root, '胜于易胜', 'win the easy wins');
    return { ctx, jz, jen, center, sats, easy };
  },
  render(t, S, st) {
    const { ctx } = st;
    ctx.clear();
    // A · joseki on a go-board corner
    const gA = S.p(t, 0, -0.3, 0.8) * (1 - S.p(t, 1, -0.3, 0.7));
    if (gA > 0) {
      const cs = 50;
      const ox = 380;
      const oy = 200;
      ctx.save();
      ctx.globalAlpha = gA;
      ctx.strokeStyle = rgba(C.ink, 0.35);
      for (let i = 0; i < 10; i++) {
        ctx.lineWidth = i === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(ox, oy + i * cs);
        ctx.lineTo(ox + 9.4 * cs, oy + i * cs);
        ctx.moveTo(ox + i * cs, oy);
        ctx.lineTo(ox + i * cs, oy + 9.4 * cs);
        ctx.stroke();
      }
      dot(ctx, ox + 3 * cs, oy + 3 * cs, 4, rgba(C.ink, 0.6));
      JOSEKI.forEach(([c, r, black], i) => {
        const a = prog(t, S.at(0, 0.3 + i * 0.32), 0.3, ease.out);
        if (a <= 0) return;
        const x = ox + c * cs;
        const y = oy + r * cs;
        ctx.save();
        ctx.globalAlpha = gA * a;
        const g = ctx.createRadialGradient(x - 6, y - 6, 2, x, y, 22);
        if (black) {
          g.addColorStop(0, '#4a4d57');
          g.addColorStop(1, '#0d0e12');
        } else {
          g.addColorStop(0, '#ffffff');
          g.addColorStop(1, '#bdb6a8');
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 22 * lerp(1.3, 1, a), 0, Math.PI * 2);
        ctx.fill();
        if (black) {
          ctx.strokeStyle = rgba(C.ink, 0.35);
          ctx.stroke();
        }
        ctx.restore();
      });
      ctx.restore();
      const morph = S.p(t, 0, 2.8, 1.0);
      st.jz.textContent = morph < 0.5 ? '定式' : '国策';
      st.jen.textContent = morph < 0.5 ? 'joseki' : 'policy';
      const blink = Math.abs(morph - 0.5) * 2;
      place(st.jz, { x: 1300, y: 430, o: gA * S.p(t, 0, 0.6, 0.8) * blink, blur: (1 - blink) * 8 });
      place(st.jen, { x: 1292, y: 520, o: gA * S.p(t, 0, 0.8, 0.8) * blink });
      st.jz.style.color = morph < 0.5 ? '#ede8dd' : '#e9b65c';
    } else {
      place(st.jz, { o: 0 });
      place(st.jen, { o: 0 });
    }

    // B · interacting policies
    const nA = S.p(t, 1, 0, 0.8) * (1 - S.p(t, 2, -0.3, 0.7));
    if (nA > 0) {
      const cx = 960;
      const cy = 500;
      const lit = S.p(t, 1, 0.8, 0.8);
      glow(ctx, cx, cy, 260, C.gold, lit * nA * 0.8);
      ring(ctx, cx, cy, 64, C.gold, 2.4, nA);
      dot(ctx, cx, cy, 64, rgba(C.gold, 0.18), nA * lit);
      place(st.center, { x: cx, y: cy + 110, o: nA });
      st.center.querySelector('.zh').style.color = C.gold;
      st.sats.forEach((s, i) => {
        const a = nA * prog(t, S.at(1, 0.3 + i * 0.25), 0.6);
        const drop = S.p(t, 1, 1.6 + i * 0.6, 1.6, ease.inOut);
        const v = Math.round(lerp(s.a, s.b, drop));
        line(ctx, cx, cy, s.x, s.y, rgba(C.ink, 0.3), 1.2, a);
        // pulse travelling outward
        const pp = ((t - S.at(1, 1.0)) * 0.6 + i * 0.3) % 1;
        if (lit > 0.5) dot(ctx, lerp(cx, s.x, pp), lerp(cy, s.y, pp), 4, C.gold, a * (1 - pp), 10);
        ring(ctx, s.x, s.y, 54, mixHex(C.cyan, C.ink, drop * 0.5), 2, a);
        text(ctx, `${v}%`, s.x, s.y, { font: '500 34px "Iowan Old Style"', color: mixHex(C.cyan, C.gold, drop), alpha: a });
        st.sats[i].e.innerHTML = `<div class="duo"><span class="zh">${s.zh}</span><span class="en">${s.en} · ${s.a}% → ${s.b}%</span></div>`;
        place(st.sats[i].e, s.side ? { x: s.x + 80, y: s.y, ax: 0, o: a } : { x: s.x, y: s.y - 92, o: a });
      });
    } else st.sats.forEach((s) => place(s.e, { o: 0 }));
    if (nA <= 0) place(st.center, { o: 0 });

    // C · a staircase of metastable states
    const eA = S.p(t, 2, 0, 0.8) * (1 - S.p(t, 3, -0.3, 0.7));
    if (eA > 0) {
      const x0 = 300;
      const x1 = 1620;
      const wells = 4;
      const Y = (u) => {
        let y = 430 + u * 260;
        for (let k = 0; k < wells; k++) y += 120 * Math.exp(-(((u - (k + 0.5) / wells) / 0.07) ** 2));
        return y;
      };
      const pts = [];
      for (let i = 0; i <= 300; i++) pts.push([lerp(x0, x1, i / 300), Y(i / 300)]);
      polyP(ctx, pts, S.p(t, 2, 0, 1.2), C.ink, 2.4, eA * 0.85, 8);
      const hop = S.p(t, 2, 1.2, 4.0) * (wells - 1);
      const k = Math.floor(hop);
      const f = hop - k;
      const ua = (k + 0.5) / wells;
      const ub = (Math.min(wells - 1, k + 1) + 0.5) / wells;
      const hf = ease.inOut(clamp((f - 0.3) / 0.7));
      const u = lerp(ua, ub, hf);
      const by = Y(u) - 18 - Math.sin(Math.PI * hf) * 90;
      glow(ctx, lerp(x0, x1, u), by, 70, C.gold, eA * 0.7);
      dot(ctx, lerp(x0, x1, u), by, 16, C.gold, eA, 20);
      for (let w = 0; w < wells; w++) {
        const uw = (w + 0.5) / wells;
        text(ctx, `E${'₀₁₂₃'[w]}`, lerp(x0, x1, uw), Y(uw) + 40, { font: 'italic 28px "Iowan Old Style"', color: C.ink, alpha: eA * (w <= hop + 0.5 ? 1 : 0.4) });
        if (w > 0) {
          const pa = clamp((hop - (w - 1)) * 3) * eA;
          const px = lerp(x0, x1, uw - 0.5 / wells);
          ctx.save();
          ctx.globalAlpha = pa;
          ctx.fillStyle = C.gold;
          ctx.translate(px, Y(uw - 0.5 / wells) - 70);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-8, -8, 16, 16);
          ctx.restore();
          text(ctx, `+ 国策 ${w}`, px, Y(uw - 0.5 / wells) - 104, { font: '500 16px "PingFang SC"', color: C.gold, alpha: pa });
        }
      }
    }

    // D · easy wins cascade
    const dA = S.p(t, 3, 0, 0.8);
    if (dA > 0) {
      const cols = 8;
      const rows = 4;
      const cw = 120;
      const ch = 86;
      const ox = W / 2 - (cols * cw) / 2;
      const oy = 300;
      const base = (c, r) => Math.min(2, Math.floor(Math.hypot(c - 0.5, r - 3) / 2.6));
      const wave = S.p(t, 3, 0.6, 4.2) * 11;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const dist = Math.hypot(c - 0.5, r - 3);
          const solved = wave > dist * 1.25 + 0.6;
          const eased = Math.max(0, base(c, r) - Math.floor(Math.max(0, wave - dist * 1.25) / 1.4));
          const col = solved ? C.gold : [C.sage, '#d9a441', C.rose][eased];
          ctx.save();
          ctx.globalAlpha = dA * prog(t, S.at(3, (c + r) * 0.04), 0.5);
          ctx.fillStyle = rgba(col, solved ? 0.28 : 0.16);
          ctx.strokeStyle = rgba(col, 0.85);
          ctx.lineWidth = 1.6;
          roundRect(ctx, ox + c * cw + 6, oy + r * ch + 6, cw - 12, ch - 12, 12);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          text(ctx, solved ? '✓' : ['易', '中', '难'][eased], ox + c * cw + cw / 2, oy + r * ch + ch / 2, { font: '500 24px "PingFang SC"', color: col, alpha: dA });
        }
      }
      place(st.easy, { x: W / 2, y: 230, o: dA });
      st.easy.querySelector('.zh').style.cssText += 'font-family:var(--zh-serif);font-size:38px;letter-spacing:.2em';
    } else place(st.easy, { o: 0 });
  },
};

// ───────────────────────── backtrack: maze, then the policy tree
function makeMaze(cw, ch, seed) {
  const R = rng(seed);
  const walls = new Set();
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    if (x < cw - 1) walls.add(key(y * cw + x, y * cw + x + 1));
    if (y < ch - 1) walls.add(key(y * cw + x, (y + 1) * cw + x));
  }
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const c = stack.at(-1);
    const x = c % cw;
    const y = Math.floor(c / cw);
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < cw && b < ch).map(([a, b]) => b * cw + a).filter((n) => !seen.has(n));
    if (!nb.length) {
      stack.pop();
      continue;
    }
    const n = nb[Math.floor(R() * nb.length)];
    walls.delete(key(c, n));
    seen.add(n);
    stack.push(n);
  }
  // solve by DFS, recording every step including retreats
  const goal = cw * ch - 1;
  const trace = [];
  const vis = new Set();
  const dfs = (c) => {
    vis.add(c);
    trace.push({ c, back: false });
    if (c === goal) return true;
    const x = c % cw;
    const y = Math.floor(c / cw);
    const order = [[x, y + 1], [x + 1, y], [x - 1, y], [x, y - 1]];
    for (const [a, b] of order) {
      if (a < 0 || b < 0 || a >= cw || b >= ch) continue;
      const n = b * cw + a;
      if (vis.has(n) || walls.has(key(c, n))) continue;
      if (dfs(n)) return true;
      trace.push({ c, back: true });
    }
    return false;
  };
  dfs(0);
  return { walls, trace, key };
}

const NAMES = ['洗碗', '洗澡', '沙发', '先发制人', '夜幕', '站着玩', '宵禁', '书桌', '复盘', '早餐', '散步', '收纳', '拉伸', '热水', '阅读', '日记', '冥想', '早起', '午休', '备餐', '整理', '远眺', '喝水', '计划', '慢跑', '单词'];
// day-by-day script: add under parent index, or fail a node (removing its subtree)
function treeScript() {
  const ev = [];
  const add = (parent) => ev.push({ type: 'add', parent });
  add(null); add(0); add(1); add(1); add(null); add(4); add(5); add(3); // days 1–8
  ev.push({ type: 'fail', node: 3 }); // day 9: node 3 and its child 7
  add(6); add(2); add(4); add(9); add(0); add(10); add(12); add(13); add(15);
  ev.push({ type: 'fail', node: 15 }); // a fresh leaf
  add(14); add(11); add(16); add(19); add(20); add(13); add(21); add(22); add(18);
  return ev;
}
function treeAt(day) {
  const ev = treeScript();
  const nodes = [];
  let failing = null;
  const n = Math.min(ev.length, Math.floor(day));
  for (let d = 0; d < n; d++) {
    const e = ev[d];
    if (e.type === 'add') nodes.push({ id: nodes.length, parent: e.parent, born: d + 1, dead: null });
    else {
      const kill = (id) => {
        const nd = nodes[id];
        if (nd.dead === null) nd.dead = d + 1;
        nodes.filter((x) => x.parent === id).forEach((x) => kill(x.id));
      };
      kill(e.node);
    }
  }
  if (n < ev.length && ev[n].type === 'fail') failing = ev[n].node;
  return { nodes, failing, frac: day - Math.floor(day), nextAdd: n < ev.length && ev[n].type === 'add' ? ev[n] : null };
}
function layoutTree(nodes, alive, x0, dx, yMid, dy) {
  const kids = (id) => nodes.filter((n) => n.parent === id && alive(n));
  const pos = {};
  let row = 0;
  const walk = (n, depth) => {
    const ks = kids(n.id);
    if (!ks.length) {
      pos[n.id] = { x: x0 + depth * dx, y: row++ };
      return pos[n.id].y;
    }
    const ys = ks.map((k) => walk(k, depth + 1));
    pos[n.id] = { x: x0 + depth * dx, y: (ys[0] + ys.at(-1)) / 2 };
    return pos[n.id].y;
  };
  nodes.filter((n) => n.parent === null && alive(n)).forEach((r) => {
    walk(r, 0);
    row += 0.6;
  });
  const total = Math.max(1, row - 0.6);
  for (const k of Object.keys(pos)) pos[k].y = yMid + (pos[k].y - (total - 1) / 2) * dy;
  return pos;
}

const backtrack = {
  setup(root) {
    const ctx = makeCanvas(root);
    const maze = makeMaze(11, 8, 5);
    const title = duo(root, '递归回溯', 'recursive backtracking');
    const day = el('div', 'abs en-serif', root);
    day.style.cssText += 'font-size:30px;color:#ede8dd;letter-spacing:.06em';
    const rootL = duo(root, '根部：最好维持，失败代价最大', 'root: easiest to keep, costliest to lose');
    const habit = duo(root, '内化为习惯 · 维护成本趋近于零', 'habit · upkeep near zero');
    const labels = NAMES.map((n) => {
      const e = el('div', 'abs zh-sans', root, n);
      e.style.cssText += 'font-size:17px;color:rgba(237,232,221,.78)';
      return e;
    });
    return { ctx, maze, title, day, rootL, habit, labels, smooth: {} };
  },
  render(t, S, st) {
    const { ctx, maze } = st;
    ctx.clear();
    // A · a maze solved by trial and retreat
    const mA = S.p(t, 0, -0.3, 0.8) * (1 - S.p(t, 1, -0.4, 0.8));
    if (mA > 0) {
      const cw = 11;
      const chh = 8;
      const cs = 56;
      const ox = W / 2 - (cw * cs) / 2;
      const oy = 450 - (chh * cs) / 2;
      ctx.save();
      ctx.globalAlpha = mA;
      ctx.strokeStyle = rgba(C.ink, 0.55);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeRect(ox, oy, cw * cs, chh * cs);
      for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
        const c = y * cw + x;
        if (x < cw - 1 && maze.walls.has(maze.key(c, c + 1))) {
          ctx.beginPath();
          ctx.moveTo(ox + (x + 1) * cs, oy + y * cs);
          ctx.lineTo(ox + (x + 1) * cs, oy + (y + 1) * cs);
          ctx.stroke();
        }
        if (y < chh - 1 && maze.walls.has(maze.key(c, c + cw))) {
          ctx.beginPath();
          ctx.moveTo(ox + x * cs, oy + (y + 1) * cs);
          ctx.lineTo(ox + (x + 1) * cs, oy + (y + 1) * cs);
          ctx.stroke();
        }
      }
      ctx.restore();
      const steps = Math.floor(S.p(t, 0, 0.4, Math.max(2, S.at(1) - S.at(0) - 1.0), ease.linear) * maze.trace.length);
      const C2 = (c) => [ox + (c % cw) * cs + cs / 2, oy + Math.floor(c / cw) * cs + cs / 2];
      const path = [];
      const dead = [];
      for (let i = 0; i < steps; i++) {
        const s = maze.trace[i];
        if (s.back) {
          const gone = path.pop();
          if (gone !== undefined) dead.push([gone, path.at(-1)]);
        } else path.push(s.c);
      }
      dead.forEach(([a, b]) => b !== undefined && line(ctx, ...C2(a), ...C2(b), rgba(C.rose, 0.45), 3, mA));
      for (let i = 1; i < path.length; i++) line(ctx, ...C2(path[i - 1]), ...C2(path[i]), C.gold, 4, mA);
      if (path.length) dot(ctx, ...C2(path.at(-1)), 9, '#ffffff', mA, 14);
      text(ctx, '出口', ox + cw * cs + 34, oy + chh * cs - cs / 2, { font: '500 18px "PingFang SC"', color: C.gold, alpha: mA });
      place(st.title, { x: W / 2, y: oy - 50, o: mA });
    } else place(st.title, { o: 0 });

    // B · the tree, day by day
    const tA = S.p(t, 1, -0.2, 0.8);
    const keys = [
      [S.at(1), 0.2],
      [S.at(2, -0.2), 8.0],
      [S.at(2, 2.2), 9.0],
      [S.at(3), 12.5],
      [S.at(4), 21],
      [S.dur, 28.5],
    ];
    let day = 0;
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        day = lerp(keys[i - 1][1], keys[i][1], clamp((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
        break;
      }
      day = keys[i][1];
    }
    if (tA <= 0) {
      st.labels.forEach((l) => place(l, { o: 0 }));
      place(st.day, { o: 0 });
      place(st.rootL, { o: 0 });
      place(st.habit, { o: 0 });
      return;
    }
    const cur = treeAt(day);
    const alive = (n) => n.dead === null;
    const pos = layoutTree(cur.nodes, alive, 300, 270, 450, 82);
    const prev = treeAt(Math.max(0, Math.floor(day) - 0.001));
    const pPrev = layoutTree(prev.nodes, alive, 300, 270, 450, 82);
    const k = ease.inOut(clamp(cur.frac * 1.6));
    const P = (id) => {
      const a = pPrev[id] ?? pos[id];
      const b = pos[id] ?? a;
      return a && b ? [lerp(a.x, b.x, k), lerp(a.y, b.y, k)] : null;
    };
    const desc = (id) => cur.nodes.filter((n) => n.parent === id && alive(n)).reduce((s, n) => s + 1 + desc(n.id), 0);
    // failing subtree flashes, then falls
    const failSet = new Set();
    if (cur.failing !== null) {
      const mark = (id) => {
        failSet.add(id);
        cur.nodes.filter((n) => n.parent === id && alive(n)).forEach((n) => mark(n.id));
      };
      mark(cur.failing);
    }
    ctx.save();
    ctx.globalAlpha = tA;
    for (const n of cur.nodes) {
      if (!alive(n) || n.parent === null) continue;
      const a = P(n.parent);
      const b = P(n.id);
      if (!a || !b) continue;
      const born = n.born === Math.floor(day) ? clamp(cur.frac * 2) : 1;
      const f = failSet.has(n.id) ? cur.frac : 0;
      polyP(ctx, bez(a[0], a[1], a[0] + 110, a[1], b[0] - 110, b[1], b[0], b[1] + f * f * 200, 30), born, failSet.has(n.id) ? C.rose : rgba(C.ink, 0.45), 1.6, 1 - f);
    }
    st.labels.forEach((l) => place(l, { o: 0 }));
    for (const n of cur.nodes) {
      if (!alive(n)) continue;
      const p = P(n.id);
      if (!p) continue;
      const age = day - n.born;
      const born = n.born === Math.floor(day) ? ease.outBack(clamp(cur.frac * 2)) : 1;
      const f = failSet.has(n.id) ? cur.frac : 0;
      const d = desc(n.id);
      const r = (10 + 2.4 * Math.sqrt(d)) * born;
      const col = failSet.has(n.id) && f > 0.05 ? C.rose : age >= 14 ? C.sage : age >= 6 ? C.violet : C.ink;
      const y = p[1] + f * f * 200;
      const a = 1 - f;
      if (age >= 14) glow(ctx, p[0], y, r * 4, C.sage, 0.5 * a);
      dot(ctx, p[0], y, r, rgba(col, age >= 6 ? 0.35 : 0.12), a);
      ring(ctx, p[0], y, r, col, 2, a);
      if (age >= 14) dot(ctx, p[0], y, r * 0.45, C.sage, a, 10);
      if (failSet.has(n.id) && f < 0.3) ring(ctx, p[0], y, r + 10 + f * 80, C.rose, 2, (0.3 - f) * 3);
      const lab = st.labels[n.id];
      if (lab) place(lab, { x: p[0], y: y + r + 16, o: tA * a * born });
    }
    ctx.restore();
    st.day.innerHTML = `Day ${Math.max(1, Math.floor(day))}<span style="font-family:var(--zh-sans);font-size:17px;color:rgba(237,232,221,.55);margin-left:12px">每天最多一个 · at most one a day</span>`;
    place(st.day, { x: 120, y: 120, ax: 0, o: tA });
    // root annotation
    const rA = S.p(t, 3, 0, 0.8) * (1 - S.p(t, 4, 0, 0.6));
    const r0 = P(0);
    if (r0 && rA > 0) {
      ring(ctx, r0[0], r0[1], 34 + Math.sin(t * 3) * 2, C.gold, 1.8, rA);
      place(st.rootL, { x: r0[0] + 30, y: r0[1] - 70, ax: 0.2, o: rA });
      st.rootL.querySelector('.zh').style.color = C.gold;
    } else place(st.rootL, { o: 0 });
    const hA = S.p(t, 4, 0.2, 0.8);
    place(st.habit, { x: 1500, y: 160, o: hA });
    st.habit.querySelector('.zh').style.color = C.sage;
  },
};

// ───────────────────────── split: five small policies instead of one big one
const FIVE = [
  ['先发制人', 'Pre-emptive Strike', '起床后 30 分钟内不碰限制组 App', 'no restricted apps for 30 min after waking', ''],
  ['夜幕降临', 'Nightfall', '23:00 后屏幕自动变成黑白', 'screen turns greyscale at 23:00', '被动 · passive'],
  ['预备仪式', 'Wind-down Ritual', '23:00 后玩手机，只能站着', 'after 23:00, phone only while standing', ''],
  ['电子宵禁', 'Digital Curfew', '23:30 后不打开短视频', 'no short video after 23:30', ''],
  ['作息储备计划', 'Sleep Reserve', '8:30 起床，可强化升级', 'up by 8:30 — upgradable', '强化 +1'],
];
const split = {
  setup(root) {
    const ctx = makeCanvas(root);
    const big = el('div', 'abs', root, '<div style="padding:26px 40px;border-radius:20px;border:1.5px solid rgba(224,103,91,.7);background:rgba(224,103,91,.08);text-align:center"><div class="zh-serif" style="font-size:44px;letter-spacing:.12em">每天 23:30 睡觉</div><div class="en-sans" style="font-size:17px;letter-spacing:.14em;color:rgba(237,232,221,.6);margin-top:8px;text-transform:uppercase">in bed by 23:30, every day</div></div>');
    const cards = FIVE.map(([zh, en, rule, ruleEn, tag], i) => el('div', 'abs', root, `
      <div style="width:282px;height:250px;padding:22px 22px;border-radius:18px;border:1.5px solid rgba(233,182,92,.55);background:rgba(18,20,26,.92);box-shadow:0 20px 50px rgba(0,0,0,.45)">
        <div class="en-serif" style="font-size:20px;color:#e9b65c">${i + 1}</div>
        <div class="zh-serif" style="font-size:31px;letter-spacing:.06em;margin-top:6px">${zh}</div>
        <div class="en-sans" style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:rgba(237,232,221,.5);margin-top:4px">${en}</div>
        <div class="zh-sans" style="font-size:19px;line-height:1.45;margin-top:16px;white-space:normal;color:#ede8dd">${rule}</div>
        <div class="en-sans" style="font-size:14px;line-height:1.35;margin-top:6px;white-space:normal;color:rgba(237,232,221,.55)">${ruleEn}</div>
        ${tag ? `<div class="zh-sans" style="position:absolute;right:18px;top:20px;font-size:13px;padding:3px 10px;border-radius:99px;background:rgba(156,203,142,.16);color:#9ccb8e">${tag}</div>` : ''}
      </div>`));
    const steps = ['玩手机', '站着玩', '站着玩 · 黑白屏', '放下手机'].map((zh, i) => duo(root, zh, ['phone in hand', 'standing', 'standing · greyscale', 'phone down'][i]));
    const city = duo(root, '久攻不下的“城市”', 'the city that will not fall');
    const paper = duo(root, '一层窗户纸', 'now just paper');
    return { ctx, big, cards, steps, city, paper };
  },
  render(t, S, st) {
    const { ctx } = st;
    ctx.clear();
    // A · one big policy on a bull-and-bear line
    const aA = S.p(t, 0, -0.3, 0.8) * (1 - S.p(t, 1, 0.6, 0.5));
    const crack = S.p(t, 0, 1.6, 0.8);
    const splitP = S.p(t, 1, 0.4, 1.4, ease.inOut);
    if (aA > 0) {
      const pts = [];
      for (let i = 0; i <= 220; i++) {
        const u = i / 220;
        const v = 0.55 * Math.sin(u * 7.5 + 0.6) + 0.25 * Math.sin(u * 23 + 1.2) + 0.12 * Math.sin(u * 61);
        pts.push([300 + u * 1320, 690 - v * 120]);
      }
      polyP(ctx, pts, S.p(t, 0, 0, 1.6), mixHex(C.gold, C.ink, 0.4), 2.2, aA, 8);
      ctx.save();
      ctx.setLineDash([8, 8]);
      line(ctx, 300, 760, 1620, 760, rgba(C.rose, 0.5), 1.2, aA);
      ctx.restore();
      text(ctx, '最糟糕的一天 · your worst day', 1620, 790, { font: '500 15px "PingFang SC", "Avenir Next"', color: rgba(C.rose, 0.8), alpha: aA, align: 'right' });
      text(ctx, '牛市', 470, 560, { font: '500 18px "PingFang SC"', color: rgba(C.ink, 0.5), alpha: aA });
      text(ctx, '熊市', 960, 830, { font: '500 18px "PingFang SC"', color: rgba(C.ink, 0.5), alpha: aA });
    }
    place(st.big, { x: W / 2 + (crack > 0 && crack < 0.4 ? Math.sin(t * 80) * 4 : 0), y: 390, o: Math.max(aA, 1 - splitP) * (1 - splitP) });
    if (crack > 0 && splitP < 0.2) polyP(ctx, [[930, 340], [950, 380], [935, 410], [965, 450]], crack, C.rose, 2.4, 1 - splitP * 5);
    // B · five small cards
    const cA = 1 - S.p(t, 2, -0.3, 0.6);
    st.cards.forEach((c, i) => {
      const p = prog(t, S.at(1, 0.6 + i * 0.16), 1.0, ease.out);
      const x = lerp(W / 2, 170 + i * 315 + 141, p);
      place(c, { x: x - 141, y: 470 - 125, ax: 0, ay: 0, o: p * cA, dy: (1 - p) * 20, s: lerp(0.8, 1, p) });
    });
    // C · easy steps
    const sA = S.p(t, 2, 0, 0.8) * (1 - S.p(t, 3, -0.3, 0.6));
    if (sA > 0) {
      const sx = [380, 760, 1140, 1520];
      const sy = [330, 450, 570, 690];
      for (let i = 0; i < 4; i++) {
        line(ctx, sx[i] - 150, sy[i], sx[i] + 150, sy[i], rgba(C.ink, 0.55), 2, sA);
        if (i < 3) line(ctx, sx[i] + 150, sy[i], sx[i] + 150, sy[i + 1], rgba(C.ink, 0.3), 1.2, sA);
        place(st.steps[i], { x: sx[i], y: sy[i] + 52, o: sA * prog(t, S.at(2, 0.2 + i * 0.3), 0.6) });
      }
      const hop = S.p(t, 2, 1.0, 4.4, ease.linear) * 3;
      const k = Math.min(2, Math.floor(hop));
      const f = ease.inOut(clamp((hop - k) * 1.3));
      const bx = lerp(sx[k], sx[k + 1], f);
      const by = lerp(sy[k], sy[k + 1], f) - 18 - Math.sin(Math.PI * f) * 40;
      glow(ctx, bx, by, 70, C.gold, sA * 0.7);
      dot(ctx, bx, by, 15, C.gold, sA, 20);
      st.steps[3].querySelector('.zh').style.color = C.gold;
    } else st.steps.forEach((s) => place(s, { o: 0 }));
    // D · villages around a city
    const vA = S.p(t, 3, 0, 0.8);
    if (vA > 0) {
      const cx = W / 2;
      const cy = 470;
      const n = 16;
      const taken = S.p(t, 3, 0.6, 4.2, ease.linear) * n;
      const pop = clamp((taken - n) / 1 + S.p(t, 3, 5.0, 0.8));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.2;
        const rr = 300 + 60 * hash(i * 3.1);
        const x = cx + Math.cos(a) * rr * 1.35;
        const y = cy + Math.sin(a) * rr * 0.8;
        const on = taken > i;
        line(ctx, x, y, cx + Math.cos(a) * 120, cy + Math.sin(a) * 90, rgba(on ? C.gold : C.ink, on ? 0.35 : 0.12), 1, vA);
        dot(ctx, x, y, on ? 9 : 6, on ? C.gold : rgba(C.ink, 0.4), vA, on ? 12 : 0);
      }
      const wall = 1 - clamp(taken / n);
      if (pop < 1) {
        ring(ctx, cx, cy, 110, C.rose, 1 + 9 * wall, vA * (1 - pop));
        if (wall < 0.15) ring(ctx, cx, cy, 110, '#ffffff', 1, vA * (1 - pop) * 0.8);
      }
      if (pop > 0) shards(ctx, cx, cy, Math.min(0.98, pop), rgba('#ffffff', 0.9), 30, 220, 4);
      glow(ctx, cx, cy, 200, pop > 0 ? C.gold : C.rose, vA * (0.4 + 0.4 * pop));
      place(st.city, { x: cx, y: cy, o: vA * (1 - pop) });
      st.city.querySelector('.zh').style.color = C.rose;
      place(st.paper, { x: cx, y: cy, o: vA * pop });
      st.paper.querySelector('.zh').style.color = C.gold;
    } else {
      place(st.city, { o: 0 });
      place(st.paper, { o: 0 });
    }
  },
};

// ───────────────────────── rogue: collapse as a debugger; runs get deeper
const rogue = {
  setup(root) {
    const ctx = makeCanvas(root);
    const lib = duo(root, '国策库 · 内化进度保留', 'policy library · progress kept');
    const runs = [1, 2, 3].map((k) => duo(root, `第 ${k} 轮`, `run ${k}`));
    const undo = el('div', 'abs', root, '<span class="en-serif" style="font-size:140px;color:#e9b65c">↺ ∞</span>');
    const undoL = duo(root, '无限次悔棋', 'unlimited take-backs');
    return { ctx, lib, runs, undo, undoL };
  },
  render(t, S, st) {
    const { ctx } = st;
    ctx.clear();
    // A · a tree collapses into a hand of cards whose progress bars survive
    const aA = S.p(t, 0, -0.3, 0.8) * (1 - S.p(t, 1, -0.3, 0.7));
    if (aA > 0) {
      const fall = S.p(t, 0, 0.8, 1.8, ease.inOut);
      for (let i = 0; i < 9; i++) {
        const depth = i < 3 ? i : i < 6 ? i - 2 : i - 5;
        const branch = i < 3 ? 0 : i < 6 ? 1 : 2;
        const tx = 520 + depth * 150;
        const ty = 260 + branch * 110 - depth * 10;
        const cardX = 360 + i * 135;
        const cardY = 640;
        const f = ease.inOut(clamp(fall * 1.4 - i * 0.04));
        const x = lerp(tx, cardX, f);
        const y = lerp(ty, cardY, f);
        if (f < 0.5 && depth > 0) line(ctx, tx - 150, ty + 10, tx, ty, rgba(C.ink, 0.35), 1.4, aA * (1 - f * 2));
        if (f < 0.05) {
          dot(ctx, x, y, 12, rgba(C.sage, 0.2), aA);
          ring(ctx, x, y, 12, C.sage, 2, aA);
        } else {
          ctx.save();
          ctx.globalAlpha = aA * f;
          ctx.fillStyle = 'rgba(18,20,26,.95)';
          ctx.strokeStyle = rgba(C.ink, 0.3);
          roundRect(ctx, x - 55, y - 70, 110, 140, 12);
          ctx.fill();
          ctx.stroke();
          const prog0 = clamp(0.9 - i * 0.09);
          ctx.fillStyle = rgba(C.ink, 0.12);
          roundRect(ctx, x - 40, y + 40, 80, 8, 4);
          ctx.fill();
          ctx.fillStyle = C.sage;
          roundRect(ctx, x - 40, y + 40, 80 * prog0, 8, 4);
          ctx.fill();
          ctx.restore();
          text(ctx, `${Math.round(clamp(0.9 - i * 0.09) * 100)}%`, x, y + 18, { font: '500 18px "Iowan Old Style"', color: C.sage, alpha: aA * f });
          text(ctx, NAMES[i], x, y - 22, { font: '500 19px "PingFang SC"', color: C.ink, alpha: aA * f });
        }
      }
      if (fall > 0 && fall < 0.4) glow(ctx, 700, 360, 380, C.rose, (0.4 - fall) * 2 * aA);
      place(st.lib, { x: W / 2, y: 820, o: aA * S.p(t, 0, 2.2, 0.8) });
      st.lib.querySelector('.zh').style.color = C.sage;
    } else place(st.lib, { o: 0 });
    // B · runs
    const rA = S.p(t, 1, 0, 0.8) * (1 - S.p(t, 2, -0.3, 0.7));
    const depths = [9, 16, 31];
    st.runs.forEach((r, k) => {
      const x = 640 + k * 320;
      const grow = clamp((t - S.at(1, 0.3 + k * 0.9)) / 1.8);
      const h = (depths[k] / 31) * 520 * ease.out(grow);
      const base = 760;
      if (rA > 0) {
        ctx.save();
        ctx.globalAlpha = rA;
        const g = ctx.createLinearGradient(0, base, 0, base - 520);
        g.addColorStop(0, rgba(C.sage, 0.55));
        g.addColorStop(1, rgba(C.violet, 0.25));
        ctx.fillStyle = g;
        roundRect(ctx, x - 44, base - h, 88, Math.max(1, h), 10);
        ctx.fill();
        ctx.restore();
        text(ctx, `${depths[k]} 天`, x, base - h - 28, { font: '500 26px "Iowan Old Style", "PingFang SC"', color: C.ink, alpha: rA * grow });
        if (k < 2 && grow >= 1) {
          const xa = prog(t, S.at(1, 0.3 + k * 0.9 + 1.9), 0.4);
          line(ctx, x - 14, base - h - 62, x + 14, base - h - 90, C.rose, 3, rA * xa);
          line(ctx, x - 14, base - h - 90, x + 14, base - h - 62, C.rose, 3, rA * xa);
        }
        if (k === 2) glow(ctx, x, base - h, 160, C.gold, rA * grow * 0.7);
      }
      place(r, { x, y: base + 50, o: rA });
    });
    // C · unlimited take-backs
    const uA = S.p(t, 2, 0, 1.0);
    place(st.undo, { x: W / 2, y: 430, o: uA, blur: (1 - uA) * 10 });
    place(st.undoL, { x: W / 2, y: 580, o: S.p(t, 2, 0.6, 0.8) });
    if (uA > 0) glow(ctx, W / 2, 430, 380, C.gold, 0.35 * uA);
  },
};

export default { chess, policies, backtrack, split, rogue };
