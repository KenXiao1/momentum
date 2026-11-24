// Cold open, title, chapter cards.
import { C, W, H, el, place, makeCanvas, prog, env, ease, clamp, lerp, rgba, mixHex } from '../engine.js';
import { line, lineP, dot, glow, roundRect, polyP, bez, text } from '../lib/draw.js';
import { TITLE } from '../script.js';

// ───────────────────────── cold open: 7 p.m., a desk, a phone
const cold = {
  band: 0.6,
  setup(root) {
    const ctx = makeCanvas(root);
    const clock = el('div', 'abs en-serif', root);
    clock.style.cssText += 'font-size:96px;letter-spacing:0.08em;color:#ede8dd;font-variant-numeric:lining-nums tabular-nums;';
    const date = el('div', 'abs caps', root, 'Tuesday · 晚上');
    return { ctx, clock, date };
  },
  render(t, S, st) {
    const { ctx, clock, date } = st;
    ctx.clear();
    const deskY = 700;
    const dim = 1 - 0.7 * S.p(t, 4, 0.6, 2.4);

    // clock: 19:00 rolls to 02:00 while the evening disappears
    const roll = S.p(t, 3, 1.6, 4.2, ease.inOut);
    const minutes = 19 * 60 + Math.round(roll * 7 * 60);
    const hh = Math.floor(minutes / 60) % 24;
    const mm = minutes % 60;
    clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    clock.style.color = mixHex(C.ink, C.rose, roll * 0.85);
    place(clock, { x: W / 2, y: 300, o: env(t, 0.6, 999, 1.4) * dim });
    date.textContent = roll > 0.5 ? '凌晨 · AFTER MIDNIGHT' : '晚上 · EVENING';
    place(date, { x: W / 2, y: 380, o: env(t, 1.2, 999, 1.2) * 0.8 * dim });

    // desk
    const pd = prog(t, 0.4, 2.2, ease.inOut);
    line(ctx, W / 2 - 560 * pd, deskY, W / 2 + 560 * pd, deskY, rgba(C.ink, 0.42), 1.4, dim);

    // the open book, drawn on
    const pb = S.p(t, 0, 0.2, 1.8);
    const bookA = (1 - 0.65 * S.p(t, 3, 0.3, 1.2)) * dim;
    const L = [[585, 694], [700, 686], [700, 612], [592, 621], [585, 694]];
    const R = [[700, 686], [815, 694], [808, 621], [700, 612]];
    polyP(ctx, L, pb, C.gold, 1.6, bookA, 6);
    polyP(ctx, R, pb, C.gold, 1.6, bookA, 6);
    for (let i = 0; i < 4; i++) {
      const pl = prog(t, S.at(0, 0.9 + i * 0.12), 0.6);
      lineP(ctx, 606, 638 + i * 12, 688, 633 + i * 12, pl, rgba(C.gold, 0.5), 1.1, bookA);
      lineP(ctx, 712, 633 + i * 12, 796, 638 + i * 12, pl, rgba(C.gold, 0.5), 1.1, bookA);
    }

    // the phone: outline, then it lights up
    const px = 1220;
    const pw = 124;
    const ph = 236;
    const top = deskY - ph - 2;
    const lit = S.p(t, 1, 0.5, 0.35, ease.out);
    const scroll = S.p(t, 3, 0.4, 0.8);
    const pulse = 0.85 + 0.15 * Math.sin(t * 3.1);
    const phoneA = env(t, S.at(0, 0.3), 999, 1.2);
    glow(ctx, px, top + ph * 0.45, 420 + 140 * scroll, C.cyan, lit * (0.55 + 0.35 * scroll) * pulse * lerp(1, 0.55, 1 - dim));
    ctx.save();
    ctx.globalAlpha *= phoneA;
    roundRect(ctx, px - pw / 2, top, pw, ph, 20);
    const sg = ctx.createLinearGradient(0, top, 0, top + ph);
    sg.addColorStop(0, rgba('#9fe6ef', 0.9 * lit));
    sg.addColorStop(1, rgba('#1d5560', 0.85 * lit));
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.strokeStyle = rgba(C.ink, 0.55 + 0.3 * lit);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // notification + feed
    ctx.save();
    roundRect(ctx, px - pw / 2 + 4, top + 4, pw - 8, ph - 8, 17);
    ctx.clip();
    const pop = S.p(t, 1, 0.6, 0.5, ease.outBack);
    ctx.globalAlpha *= lit;
    for (let k = 0; k < 9; k++) {
      const yy = top + 34 + k * 46 - (scroll * 900 + (scroll > 0 ? t * 40 : 0)) % 46 - scroll * 0;
      const isNote = k === 0 && scroll < 0.02;
      if (isNote) {
        ctx.fillStyle = rgba('#ffffff', 0.92);
        roundRect(ctx, px - 50, top + 24 - (1 - pop) * 30, 100, 34, 9);
        ctx.fill();
        ctx.fillStyle = rgba('#1d5560', 0.7);
        ctx.fillRect(px - 38, top + 34 - (1 - pop) * 30, 56, 4);
        ctx.fillRect(px - 38, top + 44 - (1 - pop) * 30, 36, 4);
      } else if (scroll > 0) {
        ctx.fillStyle = rgba('#ffffff', 0.32);
        roundRect(ctx, px - 48, yy, 96, 36, 6);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.restore();
    // reflection on the desk
    line(ctx, px - 150, deskY, px + 150, deskY, rgba(C.cyan, 0.5), 2, lit * 0.8 * dim);

    // the decision: two paths from "you"
    const you = [960, 812];
    const pa = S.p(t, 2, 0.1, 1.4);
    const choose = S.p(t, 3, 0.2, 1.1);
    const toBook = bez(you[0], you[1], 900, 760, 760, 760, 700, 712);
    const toPhone = bez(you[0], you[1], 1020, 760, 1160, 760, 1220, 712);
    polyP(ctx, toBook, pa, C.gold, 2, (1 - 0.75 * choose) * dim, 8);
    polyP(ctx, toPhone, pa, C.cyan, 2 + 1.5 * choose, dim, 8 + 10 * choose);
    dot(ctx, you[0], you[1], 6, C.ink, prog(t, S.at(2), 0.6) * dim, 10);
    text(ctx, '明天轻松', 760, 790, { font: '500 20px "PingFang SC"', color: C.gold, alpha: S.p(t, 2, 0.8, 0.8) * (1 - 0.7 * choose) * dim });
    text(ctx, 'LATER', 760, 815, { font: '600 11px "Avenir Next"', color: rgba(C.gold, 0.7), alpha: S.p(t, 2, 0.8, 0.8) * (1 - 0.7 * choose) * dim, spacing: 3 });
    text(ctx, '此刻快乐', 1160, 790, { font: '500 20px "PingFang SC"', color: C.cyan, alpha: S.p(t, 2, 1.0, 0.8) * dim });
    text(ctx, 'NOW', 1160, 815, { font: '600 11px "Avenir Next"', color: rgba(C.cyan, 0.7), alpha: S.p(t, 2, 1.0, 0.8) * dim, spacing: 3 });
    if (choose > 0 && choose < 1) {
      const idx = Math.floor(choose * (toPhone.length - 1));
      dot(ctx, toPhone[idx][0], toPhone[idx][1], 5, '#ffffff', 1, 16);
    }
  },
};

// ───────────────────────── title: order out of noise
const title = {
  band: 0.5,
  setup(root) {
    const ctx = makeCanvas(root);
    const wrap = el('div', 'abs zh-serif', root);
    wrap.style.cssText += 'font-size:124px;font-weight:400;letter-spacing:0.22em;color:#f1ece2;';
    const chars = [...TITLE.zh].map((ch) => el('span', '', wrap, ch));
    chars.forEach((c) => (c.style.cssText = 'display:inline-block;will-change:transform,opacity,filter;'));
    const en = el('div', 'abs en-sans', root, TITLE.en.toUpperCase());
    en.style.cssText += 'font-size:21px;font-weight:500;letter-spacing:0.62em;color:rgba(237,232,221,0.72);';
    const credit = el('div', 'abs', root, '<span class="zh-sans">改编自 Edmond《如何提高自制力？》</span><span class="en-sans" style="margin-left:18px;letter-spacing:.06em;font-style:italic">after Edmond’s essay “How to Improve Self-Control”</span>');
    credit.style.cssText += 'font-size:18px;color:rgba(237,232,221,0.5);';
    const proto = el('div', 'abs en-sans', root, 'CTDP &nbsp;·&nbsp; RSIP');
    proto.style.cssText += 'font-size:15px;font-weight:600;letter-spacing:0.5em;color:#e9b65c;';
    return { ctx, wrap, chars, en, credit, proto };
  },
  render(t, S, st) {
    const { ctx, wrap, chars, en, credit, proto } = st;
    ctx.clear();
    // field of spins that align as the title resolves
    const order = prog(t, 0.6, 4.2, ease.inOut);
    const sp = 48;
    for (let gy = 0; gy <= H / sp; gy++) {
      for (let gx = 0; gx <= W / sp; gx++) {
        const x = gx * sp + (gy % 2) * 0;
        const y = gy * sp;
        const n = Math.sin(gx * 0.31 + t * 0.35) + Math.cos(gy * 0.37 - t * 0.27) + Math.sin((gx + gy) * 0.17 + t * 0.2);
        const chaos = n * 1.9 + Math.sin(gx * 12.9898 + gy * 78.233) * 2.2;
        const ang = lerp(chaos, -Math.PI / 2, order * 0.92);
        const d = Math.hypot(x - W / 2, y - H / 2 + 40);
        const a = 0.13 * clamp(d / 520) * env(t, 0, 999, 1.5) * (1 - 0.5 * S.p(t, 0, 0, 3));
        const L = 10;
        line(ctx, x - Math.cos(ang) * L, y - Math.sin(ang) * L, x + Math.cos(ang) * L, y + Math.sin(ang) * L, d < 700 && order > 0.5 ? C.gold : C.ink, 1.2, a);
      }
    }
    glow(ctx, W / 2, 470, 700, C.gold, 0.22 * order);

    const lift = S.p(t, 0, -0.2, 1.6) * 40;
    place(wrap, { x: W / 2 + 14, y: 470 - lift, o: 1 });
    chars.forEach((c, i) => {
      const p = prog(t, 1.1 + i * 0.16, 1.4, ease.out);
      c.style.opacity = String(p);
      c.style.filter = `blur(${(1 - p) * 14}px)`;
      c.style.transform = `translateY(${(1 - p) * 22}px)`;
    });
    place(en, { x: W / 2 + 6, y: 584 - lift, o: prog(t, 2.3, 1.4), dy: (1 - prog(t, 2.3, 1.4)) * 10 });
    const lw = prog(t, 2.6, 1.6, ease.inOut);
    line(ctx, W / 2 - 220 * lw, 640 - lift, W / 2 + 220 * lw, 640 - lift, rgba(C.gold, 0.7), 1.2);
    place(proto, { x: W / 2 + 8, y: 680 - lift, o: prog(t, 3.0, 1.2) });
    place(credit, { x: W / 2, y: 735 - lift, o: prog(t, 3.4, 1.4) * 0.95 });
  },
};

// ───────────────────────── chapter cards
function chapterCard(num, zh, en) {
  return {
    band: 0,
    setup(root) {
      const ctx = makeCanvas(root);
      const big = el('div', 'abs en-serif', root, num);
      big.style.cssText += 'font-size:620px;color:rgba(237,232,221,0.035);line-height:1;';
      const n = el('div', 'abs en-serif', root, `Chapter&nbsp;&nbsp;${num}`);
      n.style.cssText += 'font-size:26px;font-style:italic;letter-spacing:0.08em;color:#e9b65c;';
      const z = el('div', 'abs zh-serif', root, zh);
      z.style.cssText += 'font-size:84px;letter-spacing:0.18em;color:#f1ece2;';
      const e = el('div', 'abs en-sans', root, en.toUpperCase());
      e.style.cssText += 'font-size:18px;font-weight:500;letter-spacing:0.46em;color:rgba(237,232,221,0.66);';
      return { ctx, big, n, z, e };
    },
    render(t, S, st) {
      const { ctx, big, n, z, e } = st;
      ctx.clear();
      const out = 1 - prog(t, S.dur - 0.7, 0.7);
      place(big, { x: W / 2 + 40 + t * 8, y: H / 2 + 10, o: prog(t, 0, 1.6) * out });
      place(n, { x: W / 2, y: 392, o: prog(t, 0.25, 0.9) * out, dy: (1 - prog(t, 0.25, 0.9)) * 8 });
      const pz = prog(t, 0.45, 1.3, ease.out);
      place(z, { x: W / 2 + 12, y: 508, o: pz * out, blur: (1 - pz) * 10 });
      place(e, { x: W / 2 + 8, y: 614, o: prog(t, 0.9, 1.1) * out });
      const lw = prog(t, 0.7, 1.4);
      line(ctx, W / 2 - 160 * lw, 572, W / 2 + 160 * lw, 572, rgba(C.gold, 0.6), 1.1, out);
    },
  };
}

export default {
  cold,
  title,
  ch1: chapterCard('I', '选择的积分', 'The Integral of Choice'),
  ch2: chapterCard('II', '链式时延协议', 'Chained Time-Delay Protocol'),
  ch3: chapterCard('III', '尺度', 'Scale'),
  ch4: chapterCard('IV', '递归稳态迭代协议', 'Recursive Stabilization Iteration Protocol'),
};
