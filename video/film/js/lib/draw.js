// Canvas drawing helpers shared by all scenes.
import { rgba, clamp, lerp } from '../engine.js';

export function line(ctx, x1, y1, x2, y2, color, w = 1.5, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** Line drawn from its start up to fraction p. */
export function lineP(ctx, x1, y1, x2, y2, p, color, w = 1.5, alpha = 1) {
  if (p <= 0) return;
  line(ctx, x1, y1, lerp(x1, x2, p), lerp(y1, y2, p), color, w, alpha);
}

export function dot(ctx, x, y, r, color, alpha = 1, glow = 0) {
  if (alpha <= 0 || r <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function ring(ctx, x, y, r, color, w = 1.5, alpha = 1, a0 = -Math.PI / 2, sweep = Math.PI * 2) {
  if (alpha <= 0 || r <= 0 || sweep <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a0 + sweep);
  ctx.stroke();
  ctx.restore();
}

/** Soft radial light. */
export function glow(ctx, x, y, r, color, alpha = 1) {
  if (alpha <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, 0.55 * alpha));
  g.addColorStop(0.35, rgba(color, 0.18 * alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function arrow(ctx, x1, y1, x2, y2, color, w = 2, alpha = 1, head = 12) {
  if (alpha <= 0) return;
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(a) * head * 0.6, y2 - Math.sin(a) * head * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(a - 0.42) * head, y2 - Math.sin(a - 0.42) * head);
  ctx.lineTo(x2 - Math.cos(a + 0.42) * head, y2 - Math.sin(a + 0.42) * head);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Polyline through points, drawn up to fraction p of its length. */
export function polyP(ctx, pts, p, color, w = 2, alpha = 1, glowPx = 0) {
  if (p <= 0 || alpha <= 0 || pts.length < 2) return;
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const target = lens.at(-1) * clamp(p);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (glowPx) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glowPx;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    if (lens[i] <= target) ctx.lineTo(pts[i][0], pts[i][1]);
    else {
      const f = (target - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
      ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f));
      break;
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Cubic bezier sampled into points. */
export function bez(x0, y0, x1, y1, x2, y2, x3, y3, n = 48) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push([
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    ]);
  }
  return pts;
}

export function text(ctx, str, x, y, { font = '500 24px "PingFang SC"', color = '#ede8dd', alpha = 1, align = 'center', base = 'middle', spacing = 0 } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  if (spacing) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  ctx.restore();
}
