// Coda — a Galton board: effort falls through pegs of circumstance; one
// person, under a small umbrella.
import { C, W, H, el, place, makeCanvas, prog, env, ease, clamp, lerp, rgba, hash } from '../engine.js';
import { dot, ring, glow, line } from '../lib/draw.js';

const ROWS = 12;
const PEG = 46;
const TOP = 140;
const CX = W / 2;
const BIN_Y = TOP + ROWS * PEG * 0.86 + 215;
const BALL = 5.2;
const ROW_T = 0.16; // seconds per peg row

const pegXY = (r, k) => [CX + (k - r / 2) * PEG, TOP + r * PEG * 0.86];

function ballPath(i) {
  // left/right decisions; the bin is the number of rights
  const dirs = [];
  let rights = 0;
  for (let r = 0; r < ROWS; r++) {
    const right = hash(i * 31.7 + r * 7.3) < 0.5;
    dirs.push(right);
    if (right) rights++;
  }
  return { dirs, bin: rights };
}

const coda = {
  band: 0.7,
  setup(root) {
    const ctx = makeCanvas(root);
    const circ = el('div', 'abs', root, '<span class="zh-sans" style="font-size:20px;color:rgba(237,232,221,.62)">健康 · 家庭 · 资源 · 性格 · 运气 · 时代</span><br><span class="en-sans" style="font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:rgba(237,232,221,.42)">health · family · means · temperament · luck · era</span>');
    circ.style.textAlign = 'center';
    // precompute releases, bins and stacking order
    const N = 300;
    const balls = [];
    const counts = new Array(ROWS + 1).fill(0);
    for (let i = 0; i < N; i++) {
      const { dirs, bin } = ballPath(i);
      const release = 0.8 + i * 0.066;
      const land = release + ROWS * ROW_T + 0.35;
      balls.push({ dirs, bin, release, land, stack: 0 });
    }
    balls.sort((a, b) => a.land - b.land);
    for (const b of balls) b.stack = counts[b.bin]++;
    return { ctx, circ, balls };
  },
  render(t, S, st) {
    const { ctx, balls } = st;
    ctx.clear();
    const boardA = prog(t, -0.2, 1.4);
    const dimOthers = S.p(t, 3, 0, 1.6);
    // pegs
    for (let r = 0; r < ROWS; r++) {
      for (let k = 0; k <= r; k++) {
        const [x, y] = pegXY(r, k);
        dot(ctx, x, y, 3.2, rgba(C.ink, 0.55), boardA * prog(t, r * 0.05, 0.6) * lerp(1, 0.5, dimOthers));
      }
    }
    // bins
    for (let b = 0; b <= ROWS + 1; b++) {
      const x = CX + (b - ROWS / 2 - 0.5) * PEG;
      line(ctx, x, BIN_Y - 210, x, BIN_Y, rgba(C.ink, 0.16), 1, boardA);
    }
    line(ctx, CX - (ROWS / 2 + 1) * PEG, BIN_Y, CX + (ROWS / 2 + 1) * PEG, BIN_Y, rgba(C.ink, 0.35), 1.2, boardA);
    place(st.circ, { x: CX, y: TOP - 70, o: S.p(t, 1, 0, 1.0) * (1 - dimOthers * 0.5) });

    // the one we shelter: the ball landing nearest the moment of the last line
    const hero = balls.reduce((best, b) => (Math.abs(b.release - S.at(3, -0.6)) < Math.abs(best.release - S.at(3, -0.6)) ? b : best), balls[0]);
    const posOf = (b) => {
      const tt = t - b.release;
      if (tt < 0) return null;
      const rowF = tt / ROW_T;
      if (rowF < ROWS) {
        const r = Math.floor(rowF);
        const f = rowF - r;
        let k = 0;
        for (let i = 0; i < r; i++) if (b.dirs[i]) k++;
        const [x0, y0] = pegXY(r, k);
        const x1 = x0 + (b.dirs[r] ? PEG / 2 : -PEG / 2);
        const y1 = y0 + PEG * 0.86;
        return [lerp(x0, x1, ease.inOut(f)), lerp(y0 - 8, y1 - 8, f) - Math.sin(Math.PI * f) * 10, false];
      }
      const x = CX + (b.bin - ROWS / 2) * PEG + ((b.stack % 4) - 1.5) * BALL * 2.05;
      const yEnd = BIN_Y - BALL - Math.floor(b.stack / 4) * BALL * 2.0;
      const [, ry] = pegXY(ROWS - 1, 0);
      const fall = clamp((tt - ROWS * ROW_T) / 0.35);
      return [x, lerp(ry + PEG * 0.86 - 8, yEnd, ease.in(fall)), fall >= 1];
    };
    for (const b of balls) {
      if (b === hero) continue;
      const p = posOf(b);
      if (!p) continue;
      dot(ctx, p[0], p[1], BALL, p[2] ? rgba(C.ink, 0.55) : rgba(C.ink, 0.85), boardA * lerp(1, 0.4, dimOthers));
    }
    const hp = posOf(hero);
    if (hp) {
      const a = S.p(t, 3, -1.2, 1.0);
      glow(ctx, hp[0], hp[1], 90, C.gold, 0.7 * a);
      dot(ctx, hp[0], hp[1], BALL + 1.5, a > 0 ? C.gold : rgba(C.ink, 0.85), 1, 14 * a);
      // a small umbrella
      if (a > 0) {
        const ux = hp[0];
        const uy = hp[1] - 34;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = C.gold;
        ctx.fillStyle = rgba(C.gold, 0.22);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ux, uy + 10, 22, Math.PI, 0);
        for (let s = 0; s < 3; s++) ctx.arc(ux + 22 - (s * 2 + 1) * 7.33, uy + 10, 7.33, 0, Math.PI, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ux, uy + 10);
        ctx.lineTo(ux, uy + 26);
        ctx.stroke();
        ctx.restore();
      }
    }
  },
};

export default { coda };
