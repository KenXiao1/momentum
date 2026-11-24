// The value-over-time plot used throughout Chapter I and II.
import { rgba, clamp, lerp, C } from '../engine.js';
import { arrow, text, line } from './draw.js';

const g = (t, m, s) => Math.exp(-(((t - m) / s) ** 2));

// Value functions from the essay, qualitatively shaped.
export const Vstudy = (t) => -1.0 * g(t, 0.55, 0.42) + 1.15 * g(t, 2.9, 1.25);
export const Vphone = (t) => 1.05 * g(t, 0.5, 0.4) - 0.85 * g(t, 2.6, 1.2);
export const Wflat = () => 1;
export const Whyper = (t) => 1 / Math.pow(1 + 2 * t, 1.4);

export function integrate(f, a = 0, b = 9, n = 900) {
  let s = 0;
  const h = (b - a) / n;
  for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * h) * h;
  return s;
}

export class Plot {
  constructor({ x0 = 330, x1 = 1450, y0 = 560, tauMax = 8, sy = 190, xMin = 0 } = {}) {
    Object.assign(this, { x0, x1, y0, tauMax, sy, xMin });
    this.sx = (x1 - x0) / (tauMax - xMin);
  }
  X(t) {
    return this.x0 + (t - this.xMin) * this.sx;
  }
  Y(v) {
    return this.y0 - v * this.sy;
  }
  axes(ctx, { alpha = 1, p = 1, top = 210, bottom = 790, labels = true, originLabel = true } = {}) {
    if (alpha <= 0) return;
    const ox = this.X(0);
    ctx.save();
    ctx.globalAlpha *= alpha;
    arrow(ctx, this.x0 - 30, this.y0, lerp(this.x0 - 30, this.x1 + 60, p), this.y0, rgba(C.ink, 0.55), 1.6, 1, 11);
    line(ctx, ox, lerp(this.y0, bottom, p), ox, lerp(this.y0, top, p), rgba(C.ink, 0.35), 1.4);
    if (labels) {
      text(ctx, 'τ', this.x1 + 78, this.y0 + 2, { font: 'italic 30px "KaTeX_Math", "Iowan Old Style"', color: C.ink, alpha: p });
      text(ctx, '未来 future →', this.x1 + 20, this.y0 + 34, { font: '500 15px "Avenir Next", "PingFang SC"', color: rgba(C.ink, 0.5), alpha: p, align: 'right' });
      if (originLabel) {
        text(ctx, '此刻', ox, this.y0 + 30, { font: '500 17px "PingFang SC"', color: rgba(C.ink, 0.62), alpha: p });
        text(ctx, 'NOW', ox, this.y0 + 52, { font: '600 11px "Avenir Next"', color: rgba(C.ink, 0.45), alpha: p, spacing: 3 });
      }
    }
    ctx.restore();
  }
  pts(f, from = 0, to = this.tauMax, n = 260) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = lerp(from, to, i / n);
      out.push([this.X(t), this.Y(f(t))]);
    }
    return out;
  }
  curve(ctx, f, { color = C.gold, w = 3, alpha = 1, p = 1, from = 0, to = this.tauMax, glow = 14, dash = null } = {}) {
    if (alpha <= 0 || p <= 0) return;
    const pts = this.pts(f, from, lerp(from, to, clamp(p)));
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    if (glow) {
      ctx.shadowColor = rgba(color, 0.8);
      ctx.shadowBlur = glow;
    }
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  }
  fill(ctx, f, { color = C.gold, alpha = 0.2, from = 0, to = this.tauMax, p = 1 } = {}) {
    if (alpha <= 0 || p <= 0) return;
    const pts = this.pts(f, from, lerp(from, to, clamp(p)));
    ctx.save();
    const grd = ctx.createLinearGradient(0, this.y0 - this.sy * 1.3, 0, this.y0 + this.sy * 1.3);
    grd.addColorStop(0, rgba(color, alpha));
    grd.addColorStop(0.5, rgba(color, alpha * 0.25));
    grd.addColorStop(1, rgba(color, alpha));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], this.y0);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(pts.at(-1)[0], this.y0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** Signed horizontal bars comparing two integrals. */
export function meters(ctx, { x, y, rows, alpha = 1, half = 150 }) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  text(ctx, '∫ V·W dτ', x, y - 46, { font: 'italic 22px "KaTeX_Main", "Iowan Old Style"', color: rgba(C.ink, 0.7) });
  line(ctx, x, y - 22, x, y + rows.length * 64 - 18, rgba(C.ink, 0.3), 1.2);
  rows.forEach((r, i) => {
    const yy = y + i * 64;
    const len = clamp(r.value, -1, 1) * half;
    ctx.save();
    ctx.fillStyle = rgba(r.color, 0.85);
    ctx.shadowColor = rgba(r.color, 0.6);
    ctx.shadowBlur = 12;
    const bx = len >= 0 ? x : x + len;
    ctx.fillRect(bx, yy - 9, Math.abs(len), 18);
    ctx.restore();
    text(ctx, r.label, x - half - 18, yy, { font: '500 19px "PingFang SC"', color: r.color, align: 'right' });
  });
  ctx.restore();
}
