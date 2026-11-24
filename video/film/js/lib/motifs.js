// Recurring visual motifs: the sacred seat, chain beads, seals.
import { C, rgba, clamp, lerp, ease, hash } from '../engine.js';
import { polyP, ring, glow, dot, text, line, roundRect } from './draw.js';

/** A minimal chair in profile, drawn on with progress p. */
export function chair(ctx, cx, cy, s, p, color = C.gold, alpha = 1, w = 2.6) {
  const P = (pts) => pts.map(([x, y]) => [cx + x * s, cy + y * s]);
  const parts = [
    [[-62, -175], [-58, -90], [-54, 0]],
    [[-66, 0], [86, 0]],
    [[-60, 12], [84, 12]],
    [[-54, 12], [-64, 136]],
    [[74, 12], [84, 136]],
    [[-60, 78], [80, 78]],
  ];
  parts.forEach((pts, i) => {
    const pp = clamp(p * parts.length - i * 0.8);
    polyP(ctx, P(pts), pp, color, i === 5 ? w * 0.5 : w, alpha * (i === 5 ? 0.5 : 1), 10);
  });
}

/** Halo whose richness grows with the chain length. */
export function halo(ctx, cx, cy, r, strength, t, color = C.gold) {
  if (strength <= 0) return;
  glow(ctx, cx, cy, r * 1.8, color, 0.35 * strength);
  const n = 1 + Math.floor(strength * 4);
  for (let i = 0; i < n; i++) {
    const rr = r * (1 + i * 0.16) + Math.sin(t * 0.8 + i) * 3;
    ring(ctx, cx, cy, rr, color, i === 0 ? 1.6 : 1, (0.7 - i * 0.14) * clamp(strength * 1.4 - i * 0.2));
  }
}

/**
 * A chain of beads along a line. `beads` is a list of {x, y, a, color, label}.
 */
export function beads(ctx, list, { r = 13, link = true, labels = true, font = '500 15px "Iowan Old Style"' } = {}) {
  if (link) {
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1];
      const b = list[i];
      line(ctx, a.x + r, a.y, b.x - r, b.y, rgba(a.color ?? C.gold, 0.45), 1.4, Math.min(a.a, b.a));
    }
  }
  for (const b of list) {
    if (b.a <= 0) continue;
    const color = b.color ?? C.gold;
    if (b.hollow) ring(ctx, b.x, b.y, r * (b.s ?? 1), color, 1.4, b.a);
    else {
      dot(ctx, b.x, b.y, r * (b.s ?? 1), rgba(color, 0.22), b.a);
      ring(ctx, b.x, b.y, r * (b.s ?? 1), color, 1.8, b.a);
      dot(ctx, b.x, b.y, r * 0.38 * (b.s ?? 1), color, b.a, 10);
    }
    if (labels && b.label) text(ctx, b.label, b.x, b.y - r - 16, { font, color: rgba(color, 0.85), alpha: b.a });
  }
}

/** Times at which successive nodes join a chain: quick, then quicker. */
export function chainTimes(n, start, first = 0.6, decay = 0.84, min = 0.09) {
  const out = [];
  let t = start;
  let d = first;
  for (let i = 0; i < n; i++) {
    out.push(t);
    t += d;
    d = Math.max(min, d * decay);
  }
  return out;
}

/** A square seal stamp with one character. */
export function seal(ctx, cx, cy, size, ch, color = C.rose, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  roundRect(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.12);
  ctx.fillStyle = rgba(color, 0.18);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.font = `600 ${size * 0.62}px "Songti SC"`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, cx, cy + size * 0.04);
  ctx.restore();
}

/** Deterministic shards for breaking things. */
export function shards(ctx, cx, cy, p, color, n = 26, spread = 260, seed = 1) {
  if (p <= 0 || p >= 1) return;
  for (let i = 0; i < n; i++) {
    const a = hash(seed * 31 + i) * Math.PI * 2;
    const v = 0.4 + hash(seed * 17 + i * 3) * 0.6;
    const d = ease.out(p) * spread * v;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d + p * p * 120;
    const len = 6 + hash(i * 7 + seed) * 14;
    const rot = a + p * 6 * (hash(i) - 0.5);
    line(ctx, x - Math.cos(rot) * len, y - Math.sin(rot) * len, x + Math.cos(rot) * len, y + Math.sin(rot) * len, color, 2, 1 - p);
  }
}
