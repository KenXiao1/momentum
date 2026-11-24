// The score, composed in code. buildScore(TL) turns the film timeline into a
// list of musical events; renderSection() synthesises a window of them with
// Web Audio in an OfflineAudioContext. Key of D; felt piano, warm pads,
// glass bells, and a few physical gestures timed to on-screen events.

export const SR = 48000;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function invert(f, y) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (f(m) < y) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
function chainTimes(n, start, first, decay, min) {
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

// ───────────────────────── harmony
const CH = {
  Dmaj9: [38, 50, 57, 64, 66, 69],
  Dadd9: [38, 50, 57, 62, 64, 66],
  Bm9: [35, 47, 54, 61, 62, 66],
  Gmaj7s11: [31, 43, 50, 57, 59, 61, 66],
  A6sus: [33, 45, 52, 57, 59, 62, 66],
  Em9: [28, 40, 47, 54, 55, 59, 62],
  Asus: [33, 45, 52, 57, 62, 64],
  Dm9: [26, 38, 45, 52, 53, 57, 60],
  Bbmaj7: [34, 46, 53, 57, 58, 62],
  Gm9: [31, 43, 50, 57, 58, 62, 65],
  Fmaj9: [29, 41, 48, 55, 57, 60, 64],
  Cadd9: [36, 48, 55, 62, 64, 67],
  Am7: [33, 45, 52, 55, 60, 64],
};
const PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86, 88, 90, 93];
const DMIN = [62, 64, 65, 67, 69, 70, 72, 74, 76, 77, 79, 81];
const THEME = [[66, 1], [69, 1], [64, 1], [62, 1.6], [66, 1], [69, 1], [71, 1], [69, 1.6], [67, 1], [66, 1], [64, 1], [62, 3]];

export function buildScore(TL) {
  const ev = [];
  const S = Object.fromEntries(TL.scenes.map((s) => [s.id, s]));
  const cues = {};
  for (const c of TL.cues) (cues[c.scene] ??= []).push(c);
  const at = (id, i = null, off = 0) => (i === null ? S[id].start : cues[id][i].start) + off;
  const end = (id) => S[id].end;

  const piano = (t, m, v = 0.4, d = 2.5, pan = 0) => ev.push({ k: 'piano', t, m, v, d, pan });
  const bell = (t, m, v = 0.4, pan = 0) => ev.push({ k: 'bell', t, m, v, pan });
  const pluck = (t, m, v = 0.3, pan = 0) => ev.push({ k: 'pluck', t, m, v, pan });
  const pad = (t, d, ch, g = 1, o = {}) => ev.push({ k: 'pad', t, d, notes: CH[ch] ?? ch, g, ...o });
  const boom = (t, g = 1) => ev.push({ k: 'boom', t, g });
  const riser = (t, d, g = 1) => ev.push({ k: 'riser', t, d, g });
  const tick = (t, g = 1) => ev.push({ k: 'tick', t, g });
  const wood = (t, g = 1) => ev.push({ k: 'wood', t, g });
  const snap = (t) => ev.push({ k: 'snap', t });
  const thud = (t, g = 1) => ev.push({ k: 'thud', t, g });
  const crash = (t, g = 1) => ev.push({ k: 'crash', t, g });
  const drone = (t, d, root, g = 1) => ev.push({ k: 'drone', t, d, root, g });
  const theme = (t, beat = 0.9, v = 0.42, oct = 0) => {
    let tt = t;
    for (const [m, len] of THEME) {
      piano(tt, m + oct, v * (0.85 + 0.15 * hash(tt)), len * beat * 1.6, 0.1);
      tt += len * beat;
    }
    return tt;
  };
  // gentle arpeggio pulse over a chord list, one chord per `bars` bars
  const arp = (t0, t1, chords, { bpm = 92, bars = 2, v = 0.24, bass = true, pattern = [0, 2, 1, 3, 2, 4, 3, 2], fade = 4 } = {}) => {
    const e8 = 30 / bpm;
    const bar = e8 * 8;
    let i = 0;
    for (let t = t0; t < t1 - 0.05; t += e8, i++) {
      const b = Math.floor(i / 8);
      const ch = CH[chords[Math.floor(b / bars) % chords.length]];
      const upper = ch.slice(2);
      const idx = pattern[i % 8] % upper.length;
      const env = Math.min(clamp((t - t0) / (fade * bar) + 0.15), clamp((t1 - t) / (bar * 1.5)));
      const acc = i % 8 === 0 ? 1.15 : i % 2 === 0 ? 1 : 0.82;
      piano(t, upper[idx] + 12 * (i % 16 >= 8 && idx < 2 ? 1 : 0), v * acc * env, e8 * 3, (idx - 2) * 0.18);
      if (bass && i % (8 * bars) === 0) {
        piano(t, ch[0] + 12, v * 1.3 * env, bar * bars, -0.1);
        piano(t, ch[1], v * 0.9 * env, bar * bars, 0);
      }
    }
  };
  const padSeq = (t0, t1, chords, g = 1, att = 2.4) => {
    const n = chords.length;
    const d = (t1 - t0) / n;
    chords.forEach((c, i) => pad(t0 + i * d, d + 2.2, c, g, { att }));
  };

  // ── cold open
  drone(0.5, end('cold') - 0.5, 38, 0.8);
  pad(1.0, end('cold') - 3, 'Dm9', 0.45, { att: 6, cutoff: 600 });
  [[2.4, 69], [3.6, 65], [4.6, 64], [6.2, 62], [8.8, 57]].forEach(([t, m]) => piano(t, m, 0.32, 4));
  bell(at('cold', 1, 0.55), 88, 0.32, 0.4);
  bell(at('cold', 1, 0.75), 93, 0.18, 0.5);
  piano(at('cold', 2), 66, 0.3, 4);
  piano(at('cold', 2, 0.8), 69, 0.26, 4);
  {
    const a = at('cold', 3, 1.6);
    let t = a;
    let d = 0.5;
    while (t < a + 4.2) {
      tick(t, 0.7);
      t += d;
      d = Math.max(0.09, d * 0.9);
    }
  }
  pad(at('cold', 4, -0.6), 5, 'Asus', 0.6, { att: 1.5 });
  piano(at('cold', 4, 0.1), 64, 0.36, 5);

  // ── title
  const tt = at('title');
  boom(tt + 1.0, 0.9);
  pad(tt + 0.6, S.title.dur + 2, 'Dmaj9', 1, { att: 3.5 });
  bell(tt + 1.2, 81, 0.25);
  bell(tt + 1.5, 86, 0.18, 0.3);
  theme(tt + 3.0, 0.95, 0.4);

  // ── Chapter I
  boom(at('ch1', null, 0.3), 0.5);
  piano(at('ch1', null, 0.35), 38, 0.5, 6);
  piano(at('ch1', null, 0.35), 50, 0.4, 6);
  bell(at('ch1', null, 0.9), 78, 0.2);
  const c1a = at('formula');
  const flip = at('curves', 4);
  arp(c1a + 0.5, flip, ['Dmaj9', 'Bm9', 'Gmaj7s11', 'A6sus'], { v: 0.2 });
  padSeq(c1a, flip, ['Dmaj9', 'Bm9', 'Gmaj7s11', 'A6sus', 'Dmaj9', 'Bm9', 'Gmaj7s11', 'A6sus'], 0.5);
  arp(flip, at('transform', 2, 0.4), ['Bm9', 'Gmaj7s11', 'Em9', 'A6sus'], { v: 0.21, fade: 0.5 });
  padSeq(flip, at('transform', 2, 0.4), ['Bm9', 'Gmaj7s11', 'Em9', 'A6sus', 'Bm9', 'Gmaj7s11'], 0.5);
  bell(at('formula', 0, 0.2), 81, 0.2);
  bell(at('curves', 3, 0.3), 74, 0.22);
  thud(at('impulse', 0, 0.6), 0.5);
  riser(at('transform', 2, 0.4), 2.4, 0.8);
  boom(at('transform', 2, 2.8), 1);
  pad(at('transform', 2, 2.8), end('transform') - at('transform', 2, 2.8) + 2, 'Dmaj9', 0.9, { att: 0.3 });
  bell(at('transform', 2, 2.8), 86, 0.35);

  // ── Chapter II
  const c2 = at('ch2');
  boom(c2 + 0.3, 0.6);
  pad(c2, S.ch2.dur + 1, 'Gmaj7s11', 0.7, { att: 1.5 });
  bell(c2 + 0.9, 79, 0.22);
  // seat: one bell per bead, a break, then the long chain
  pad(at('seat'), at('seat', 4, 0.4) - at('seat'), 'Gmaj7s11', 0.35, { att: 3 });
  const t3 = at('seat', 3, 0.2);
  chainTimes(12, 0, 0.62, 0.83, 0.16).forEach((x, i) => bell(t3 + x + 0.08, PENTA[i % PENTA.length], 0.3 - i * 0.008, (i / 12 - 0.5) * 0.8));
  const tFail = at('seat', 4, 0.4);
  thud(tFail, 1);
  piano(tFail, 39, 0.5, 2);
  piano(tFail, 38, 0.5, 2);
  bell(tFail + 1.6, PENTA[0], 0.3);
  const t5 = at('seat', 5, 0.1);
  chainTimes(37, 0, 0.32, 0.9, 0.045).forEach((x, i) => bell(t5 + x + 0.08, PENTA[i % 10] + (i >= 30 ? 12 : 0), 0.22, Math.sin(i) * 0.5));
  pad(t5, end('seat') - t5 + 2, 'Dmaj9', 0.8, { att: 2.5 });
  // compress
  drone(at('compress'), S.compress.dur, 38, 0.7);
  riser(at('compress', 0, 2.2), 3.2, 0.9);
  boom(at('compress', 0, 5.4), 1.1);
  piano(at('compress', 0, 5.4), 26, 0.6, 4);
  piano(at('compress', 0, 5.4), 38, 0.5, 4);
  bell(at('compress', 2, 0.4), 90, 0.18, 0.4);
  pad(at('compress', 0, 5.6), at('compress', 3) - at('compress', 0, 5.6) + 1, 'Bm9', 0.45, { att: 2.5, cutoff: 800 });
  for (let t = at('compress', 1, 0.6); t < at('compress', 3) - 0.4; t += 1.6) piano(t, 38, 0.22, 1.2);
  pad(at('compress', 3), end('compress') - at('compress', 3) + 3, 'Dmaj9', 0.9, { att: 3, cutoff: 900 });
  [[0.8, 78], [2.4, 74], [3.6, 81], [5.0, 76]].forEach(([o, m]) => piano(at('compress', 3, o), m, 0.22, 4));
  // demo-seat
  arp(at('demo-seat'), end('demo-seat'), ['Dmaj9', 'A6sus', 'Bm9', 'Gmaj7s11'], { v: 0.19, bpm: 96 });
  padSeq(at('demo-seat'), end('demo-seat'), ['Dmaj9', 'A6sus', 'Bm9', 'Gmaj7s11'], 0.4);
  bell(at('demo-seat', 1, 4.6), 86, 0.25);
  // precedent
  const pr = at('precedent');
  padSeq(pr, at('precedent', 6), ['Bm9', 'Gmaj7s11', 'Em9', 'Bm9', 'A6sus'], 0.5);
  piano(at('precedent', 0, 0.5), 50, 0.35, 2);
  bell(at('precedent', 0, 1.45), 83, 0.3);
  [0, 1, 2].forEach((i) => bell(at('precedent', 1, 0.3 + i * 0.55), [76, 78, 81][i], 0.16, (i - 1) * 0.5));
  arp(at('precedent', 2), at('precedent', 6), ['Bm9', 'Em9', 'Gmaj7s11', 'A6sus'], { v: 0.17, bpm: 92 });
  crash(at('precedent', 2, 2.67), 0.5);
  piano(at('precedent', 4), 40, 0.4, 3);
  piano(at('precedent', 4), 41, 0.3, 3);
  bell(at('precedent', 5), 86, 0.3);
  // Nash: a two-voice canon
  {
    const a = at('precedent', 6);
    const motif = [66, 69, 71, 69, 66, 64];
    motif.forEach((m, i) => {
      piano(a + i * 0.55, m, 0.3, 1.5, -0.6);
      piano(a + 1.1 + i * 0.55, m - 5, 0.27, 1.5, 0.6);
    });
    pad(a, at('precedent', 7) - a + 1, 'Dadd9', 0.6);
  }
  {
    const a = at('precedent', 7, 0.4);
    for (let i = 0; i < 40; i++) pluck(a + i * 0.16, PENTA[(i * 3) % 9] + 12, 0.22 * (1 - i / 44), Math.sin(i * 1.7) * 0.7);
    pad(at('precedent', 7), end('precedent') - at('precedent', 7) + 2, 'Dmaj9', 0.6);
  }
  arp(at('demo-precedent'), end('demo-precedent'), ['Bm9', 'Gmaj7s11', 'Dmaj9', 'A6sus'], { v: 0.18, bpm: 96 });
  padSeq(at('demo-precedent'), end('demo-precedent'), ['Bm9', 'Gmaj7s11', 'Dmaj9', 'A6sus'], 0.4);
  thud(at('demo-precedent', 1, 1.0), 0.5);
  // delay
  pad(at('delay'), at('delay', 2) - at('delay') + 1, 'Asus', 0.6, { att: 2 });
  piano(at('delay', 1), 62, 0.35, 3);
  piano(at('delay', 2, 0.9), 57, 0.3, 1.5);
  piano(at('delay', 2, 2.8), 66, 0.35, 2.5);
  pad(at('delay', 3), at('delay', 4) - at('delay', 3) + 1, 'Bm9', 0.5);
  pad(at('delay', 3, 1.4), 3, 'Dmaj9', 0.5);
  {
    const snapT = at('delay', 4, 1.6);
    snap(snapT);
    const hit = at('delay', 5, 1.75);
    for (let t = snapT + 0.5; t < at('delay', 5, 0.6); t += 0.5) tick(t, 0.6);
    pad(at('delay', 4), hit - at('delay', 4), 'Gmaj7s11', 0.45);
    riser(at('delay', 5, 0.3), hit - at('delay', 5, 0.3), 1);
    boom(hit, 1.2);
    crash(hit, 0.9);
    pad(hit, end('delay') - hit + 3, 'Dmaj9', 1, { att: 0.2 });
    bell(hit + 0.05, 86, 0.35);
    bell(hit + 0.3, 90, 0.25, 0.4);
  }
  arp(at('demo-delay'), end('demo-delay'), ['Dmaj9', 'Gmaj7s11', 'Bm9', 'A6sus'], { v: 0.19, bpm: 96 });
  padSeq(at('demo-delay'), end('demo-delay'), ['Dmaj9', 'Gmaj7s11', 'Bm9', 'A6sus'], 0.4);
  bell(at('demo-delay', 1, 3.3), 81, 0.22);
  // ctdp — the first summit
  [0, 0.4, 0.8].forEach((o, i) => bell(at('ctdp', 0, o), [74, 78, 81][i], 0.28, (i - 1) * 0.5));
  pad(at('ctdp'), at('ctdp', 1) - at('ctdp') + 1, 'Gmaj7s11', 0.6);
  riser(at('ctdp', 1, -1.2), 1.4, 0.6);
  boom(at('ctdp', 1, 0.2), 0.9);
  for (let i = 0; i < 36; i++) bell(at('ctdp', 1, 0.8 + i * 0.03), PENTA[i % 12], 0.1, Math.cos(i) * 0.7);
  pad(at('ctdp', 1), end('ctdp') - at('ctdp', 1) + 2, 'Dmaj9', 1, { att: 1 });
  theme(at('ctdp', 1, 0.6), 0.62, 0.42);
  arp(at('ctdp', 1, 0.6), end('ctdp'), ['Dmaj9', 'Bm9', 'Gmaj7s11', 'A6sus'], { v: 0.17, bpm: 96, fade: 1 });
  for (let t = at('ctdp', 3); t < end('ctdp') - 0.5; t += 0.625) piano(t, 38, 0.3, 0.6);

  // ── Chapter III
  boom(at('ch3', null, 0.3), 0.8);
  pad(at('ch3'), S.ch3.dur + 2, 'Dm9', 0.8, { att: 1.2, cutoff: 700 });
  piano(at('ch3', null, 0.4), 26, 0.5, 6);
  // limits
  arp(at('limits'), at('limits', 1), ['Dmaj9', 'Gmaj7s11'], { v: 0.16, bpm: 104 });
  pad(at('limits'), at('limits', 1) - at('limits') + 2, 'Dmaj9', 0.5);
  padSeq(at('limits', 1), at('limits', 2), ['Bbmaj7', 'Gm9'], 0.6);
  [70, 69, 67, 65].forEach((m, i) => piano(at('limits', 1, 0.4 + i * 1.1), m, 0.3, 3));
  boom(at('limits', 2, 0.4), 0.9);
  pad(at('limits', 2), end('limits') - at('limits', 2) + 2, 'Dm9', 0.7);
  // tree
  drone(at('tree'), S.tree.dur, 38, 0.6);
  for (let d = 0; d < 7; d++) piano(at('tree', null, 0.2 + d * 0.55), DMIN[d], 0.26, 2.5, (d - 3) * 0.15);
  pad(at('tree'), at('tree', 1) - at('tree') + 2, 'Dm9', 0.5);
  bell(at('tree', 1, 0.1), 89, 0.25, 0.3);
  pad(at('tree', 1), at('tree', 2) - at('tree', 1) + 1, 'Bbmaj7', 0.5);
  piano(at('tree', 2, 1.2), 69, 0.32, 2);
  piano(at('tree', 2, 1.2), 74, 0.25, 2);
  piano(at('tree', 2, 2.8), 38, 0.4, 2);
  piano(at('tree', 2, 2.8), 39, 0.35, 2);
  pad(at('tree', 3), end('tree') - at('tree', 3) + 2, 'Gm9', 0.6, { cutoff: 700 });
  riser(at('tree', 3, 0.0), 1.6, 0.5);
  // rg — musical coarse-graining: dense random notes that thin into one chord
  {
    const a = at('rg');
    const m0 = at('rg', 2, 0.6);
    const pools = [
      [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 83, 84],
      DMIN,
      [62, 65, 69, 72, 74, 77, 81],
      [62, 69, 74, 77, 81],
    ];
    let k = 0;
    for (let t = a + 0.4; t < at('rg', 3, 2.0); k++) {
      const lvl = t < m0 ? 0 : t < m0 + 2.5 ? 1 : t < m0 + 5 ? 2 : 3;
      const pool = pools[lvl];
      const fadeIn = clamp((t - a) / 2);
      pluck(t, pool[Math.floor(hash(k * 7.7) * pool.length)], (0.12 + 0.05 * lvl) * fadeIn, (hash(k * 3.3) - 0.5) * 1.6);
      t += [0.07, 0.14, 0.28, 0.56][lvl] * (0.6 + 0.8 * hash(k * 1.3));
    }
    drone(a, S.rg.dur, 38, 0.5);
    [0, 1, 2].forEach((i) => {
      piano(m0 + i * 2.5 + 0.9, [50, 45, 38][i], 0.35, 4);
      bell(m0 + i * 2.5 + 0.9, [81, 77, 74][i], 0.16);
    });
    pad(at('rg', 3), at('rg', 5) - at('rg', 3) + 2, 'Dm9', 0.9, { att: 3 });
    bell(at('rg', 4, 0.2), 93, 0.18, -0.5);
    piano(at('rg', 4, 0.2), 26, 0.45, 6);
    pad(at('rg', 5), end('rg') - at('rg', 5) + 3, 'Fmaj9', 0.8, { att: 2.5 });
    piano(at('rg', 5, 0.6), 72, 0.3, 4);
    piano(at('rg', 5, 1.4), 76, 0.28, 4);
  }
  // scales
  pad(at('scales'), S.scales.dur + 2, 'Dm9', 0.6, { att: 2 });
  [[0, 0.2, 81], [0, 1.6, 76], [0, 3.0, 69], [1, 0.1, 62]].forEach(([c, o, m]) => bell(at('scales', c, o), m, 0.26));
  padSeq(at('scales', 2), end('scales'), ['Bbmaj7', 'Gm9'], 0.5);
  bell(at('scales', 3, 0.2), 93, 0.12, 0.3);
  piano(at('scales', 3, 1.0), 74, 0.2, 4);
  // bottleneck
  drone(at('bottleneck'), S.bottleneck.dur, 38, 0.8);
  for (let t = at('bottleneck'); t < end('bottleneck') - 0.4; t += 1.25) {
    piano(t, 26, 0.32, 1.2);
    piano(t + 0.625, 33, 0.24, 1.2);
  }
  pad(at('bottleneck'), S.bottleneck.dur + 2, 'Dm9', 0.5, { cutoff: 600 });
  [0, 1.2, 2.4].forEach((o) => wood(at('bottleneck', 1, o), 0.5));
  [62, 65, 69, 72].forEach((m, i) => piano(at('bottleneck', 2, i * 0.32), m, 0.24, 1.2));
  [72, 69, 65, 62].forEach((m, i) => piano(at('bottleneck', 2, 1.8 + i * 0.4), m, 0.24, 1.6));
  pad(at('bottleneck', 3), 4.5, 'Gm9', 0.5);
  thud(at('bottleneck', 3, 4.0), 0.9);

  // ── Chapter IV
  boom(at('ch4', null, 0.3), 0.6);
  pad(at('ch4'), S.ch4.dur + 1, 'Bbmaj7', 0.7, { att: 1.5 });
  bell(at('ch4', null, 0.9), 77, 0.24);
  // chess
  pad(at('chess'), at('chess', 2) - at('chess') + 1, 'Gm9', 0.45);
  [0, 1.07, 2.13].forEach((o) => wood(at('chess', 0, 0.6 + o), 0.8));
  piano(at('chess', 0, 3.8), 38, 0.45, 3);
  piano(at('chess', 0, 3.8), 44, 0.35, 3);
  {
    const a = at('chess', 1, 0.4);
    for (let k = 1; k <= 5; k++) {
      const x = invert(inOut, k / 5);
      const t = a + x * 3.4;
      if (k < 5) piano(t, [69, 67, 65, 64][k - 1], 0.28, 1.5);
      else {
        bell(t, 81, 0.32);
        pad(t, 4, 'Fmaj9', 0.6, { att: 0.6 });
      }
    }
  }
  pad(at('chess', 2), at('chess', 4) - at('chess', 2) + 1, 'Bbmaj7', 0.5);
  [0, 1, 2, 3].forEach((i) => piano(at('chess', 2, 0.2 + i * 0.9), [74, 72, 69, 65][i], 0.26, 2.5));
  riser(at('chess', 4, -1), 1.2, 0.4);
  pad(at('chess', 4), end('chess') - at('chess', 4) + 2, 'Fmaj9', 0.7);
  bell(at('chess', 4, 1.2), 84, 0.28);
  // policies
  pad(at('policies'), at('policies', 1) - at('policies') + 1, 'Fmaj9', 0.45);
  for (let i = 0; i < 9; i++) wood(at('policies', 0, 0.3 + i * 0.32), 0.7);
  bell(at('policies', 0, 3.3), 81, 0.3);
  pad(at('policies', 1), at('policies', 2) - at('policies', 1) + 1, 'Dmaj9', 0.6);
  piano(at('policies', 1, 0.8), 50, 0.35, 4);
  [0, 1, 2].forEach((i) => {
    piano(at('policies', 1, 1.6 + i * 0.6), [78, 76, 74][i], 0.26, 2);
    piano(at('policies', 1, 2.8 + i * 0.6), [74, 71, 69][i], 0.22, 2);
  });
  arp(at('policies', 2), end('policies'), ['Dmaj9', 'Gmaj7s11', 'Bm9', 'A6sus'], { v: 0.17, bpm: 96 });
  padSeq(at('policies', 2), end('policies'), ['Dmaj9', 'Gmaj7s11', 'Bm9', 'A6sus'], 0.4);
  [0, 1, 2].forEach((k) => bell(at('policies', 2, 1.2 + ((k + 0.65) / 3) * 4.0), [74, 78, 81][k], 0.3));
  {
    const a = at('policies', 3, 0.6);
    const times = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
      const dist = Math.hypot(c - 0.5, r - 3);
      const y = (dist * 1.25 + 0.6) / 11;
      if (y < 1) times.push([a + invert(inOut, y) * 4.2, dist]);
    }
    times.sort((x, y) => x[0] - y[0]).forEach(([t, d], i) => pluck(t, PENTA[Math.min(PENTA.length - 1, Math.floor(d * 1.4))], 0.2, Math.sin(i) * 0.6));
  }
  // backtrack
  {
    const a = at('backtrack');
    pad(a, at('backtrack', 1) - a + 1, 'Bm9', 0.5);
    for (let i = 0; i < 44; i += 2) tick(a + 0.6 + i * 0.12, 0.25);
    const keys = [[at('backtrack', 1), 0.2], [at('backtrack', 2, -0.2), 8.0], [at('backtrack', 2, 2.2), 9.0], [at('backtrack', 3), 12.5], [at('backtrack', 4), 21], [end('backtrack'), 28.5]];
    const timeOfDay = (d) => {
      for (let i = 1; i < keys.length; i++) {
        if (d <= keys[i][1]) return keys[i - 1][0] + ((d - keys[i - 1][1]) / (keys[i][1] - keys[i - 1][1])) * (keys[i][0] - keys[i - 1][0]);
      }
      return keys.at(-1)[0];
    };
    const fails = new Set([9, 19]);
    for (let d = 1; d <= 28; d++) {
      const t = timeOfDay(d);
      if (fails.has(d)) {
        thud(t, 0.6);
        piano(t, 64, 0.25, 1.5);
        piano(t + 0.3, 62, 0.22, 1.5);
      } else bell(t + 0.02, PENTA[(d * 2) % 11], 0.15, Math.sin(d) * 0.6);
    }
    arp(at('backtrack', 1), end('backtrack'), ['Gmaj7s11', 'Dmaj9', 'Em9', 'A6sus'], { v: 0.15, bpm: 92 });
    padSeq(at('backtrack', 1), end('backtrack'), ['Gmaj7s11', 'Dmaj9', 'Em9', 'A6sus', 'Gmaj7s11', 'Dmaj9'], 0.45);
    theme(at('backtrack', 4, 0.2), 0.55, 0.3, 12);
  }
  arp(at('demo-rsip'), end('demo-rsip'), ['Dmaj9', 'Bm9', 'Gmaj7s11', 'A6sus'], { v: 0.18, bpm: 96 });
  padSeq(at('demo-rsip'), end('demo-rsip'), ['Dmaj9', 'Bm9', 'Gmaj7s11', 'A6sus'], 0.4);
  thud(at('demo-rsip', 2, 0.6), 0.4);
  // split
  pad(at('split'), at('split', 1) - at('split') + 1, 'Em9', 0.5);
  thud(at('split', 0, 1.6), 0.6);
  [62, 66, 69, 73, 74].forEach((m, i) => bell(at('split', 1, 0.6 + i * 0.16), m + 12, 0.24, (i - 2) * 0.3));
  pad(at('split', 1), at('split', 2) - at('split', 1) + 1, 'Gmaj7s11', 0.6);
  [69, 66, 64, 62].forEach((m, i) => piano(at('split', 2, 1.0 + (i * 4.4) / 3), m, 0.32, 2.5));
  pad(at('split', 2), at('split', 3) - at('split', 2) + 1, 'Dadd9', 0.5);
  for (let i = 0; i < 16; i++) pluck(at('split', 3, 0.6 + (i * 4.2) / 16), PENTA[i % 12], 0.2, Math.cos(i * 0.4) * 0.7);
  pad(at('split', 3), 5.2, 'Bm9', 0.5);
  boom(at('split', 3, 5.0), 0.7);
  crash(at('split', 3, 5.0), 0.5);
  pad(at('split', 3, 5.0), end('split') - at('split', 3, 5.0) + 2, 'Dmaj9', 0.8, { att: 0.3 });
  // rogue
  pad(at('rogue'), at('rogue', 1) - at('rogue') + 1, 'Bm9', 0.5);
  [74, 71, 69, 66, 62].forEach((m, i) => piano(at('rogue', 0, 0.8 + i * 0.18), m, 0.22, 1.5));
  pad(at('rogue', 1), at('rogue', 2) - at('rogue', 1) + 1, 'Gmaj7s11', 0.6);
  [0, 1, 2].forEach((k) => {
    riser(at('rogue', 1, 0.3 + k * 0.9), 1.6, 0.25 + k * 0.1);
    if (k < 2) thud(at('rogue', 1, 0.3 + k * 0.9 + 1.9), 0.35);
  });
  bell(at('rogue', 1, 2.4), 86, 0.28);
  boom(at('rogue', 2), 0.9);
  pad(at('rogue', 2), end('rogue') - at('rogue', 2) + 3, 'Dmaj9', 1.1, { att: 0.6 });
  theme(at('rogue', 2, 0.4), 0.6, 0.38);
  arp(at('rogue', 2), end('rogue'), ['Dmaj9', 'Bm9', 'Gmaj7s11', 'A6sus'], { v: 0.15, bpm: 96, fade: 1 });

  // ── coda
  {
    const a = at('coda');
    pad(a, S.coda.dur + 2, 'Dadd9', 0.55, { att: 4, cutoff: 800 });
    theme(a + 1.0, 1.25, 0.3);
    // a few of the falling balls ring softly, like rain
    for (let i = 0; i < 300; i += 5) {
      const land = a + 0.8 + i * 0.066 + 12 * 0.16 + 0.35;
      if (land < end('coda') - 1) pluck(land, PENTA[6 + Math.floor(hash(i * 2.3) * 7)], 0.07, (hash(i) - 0.5) * 1.4);
    }
    piano(at('coda', 3, 0.2), 50, 0.35, 6);
    piano(at('coda', 3, 0.2), 57, 0.3, 6);
    bell(at('coda', 3, 0.3), 86, 0.26);
  }
  // ── outro
  {
    const a = at('outro');
    arp(a, a + 9.2, ['Dmaj9', 'Gmaj7s11'], { v: 0.15, bpm: 96, fade: 0.5 });
    pad(a, 9.4, 'Gmaj7s11', 0.5);
    boom(a + 9.2, 0.8);
    pad(a + 9.0, end('outro') - a - 9.0 + 1, 'Dmaj9', 1, { att: 1.5 });
    bell(a + 9.4, 81, 0.3);
    bell(a + 9.6, 86, 0.22, 0.4);
    theme(a + 10.2, 0.75, 0.34);
    piano(end('outro') - 4.5, 38, 0.4, 5);
    piano(end('outro') - 4.5, 50, 0.32, 5);
    piano(end('outro') - 4.5, 57, 0.28, 5);
  }
  return ev.sort((a, b) => a.t - b.t);
}

// ───────────────────────── synthesis
function noiseBuffer(ctx, seconds) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < d.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    d[i] = s / 2147483648 - 1;
  }
  return b;
}

function impulse(ctx, seconds = 5.2, rt60 = 4.4) {
  const n = Math.ceil(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let s = 777 + c * 31;
    let lp = 0;
    for (let i = 0; i < n; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const w = s / 2147483648 - 1;
      const t = i / ctx.sampleRate;
      const k = 0.55 - 0.42 * Math.min(1, t / seconds); // darker tail
      lp += k * (w - lp);
      const pre = t < 0.022 ? 0 : 1;
      d[i] = lp * Math.exp((-6.9 * t) / rt60) * pre * (t < 0.08 ? 0.6 + 5 * t : 1);
    }
  }
  return b;
}

export async function renderSection(events, t0, t1) {
  const evs = events.filter((e) => e.t >= t0 && e.t < t1);
  let tail = 0;
  for (const e of evs) tail = Math.max(tail, e.t + (e.d ?? 3) + 6 - t1);
  const len = Math.max(1, t1 - t0 + Math.max(6, tail));
  const ctx = new OfflineAudioContext(2, Math.ceil(len * SR), SR);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 2.5;
  comp.attack.value = 0.02;
  comp.release.value = 0.3;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  comp.connect(master).connect(ctx.destination);
  // tame the low end before the bus compressor
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 32;
  hp.Q.value = 0.7;
  const shelf = ctx.createBiquadFilter();
  shelf.type = 'lowshelf';
  shelf.frequency.value = 160;
  shelf.gain.value = -4;
  hp.connect(shelf).connect(comp);
  const dry = ctx.createGain();
  dry.connect(hp);
  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.62;
  verb.connect(wet).connect(hp);
  const send = ctx.createGain();
  send.connect(verb);
  const noise = noiseBuffer(ctx, 3);

  const out = (node, rev = 0.35, pan = 0) => {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p);
    p.connect(dry);
    const s = ctx.createGain();
    s.gain.value = rev;
    p.connect(s).connect(send);
  };
  const env = (g, t, peak, att, tau, stop) => {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + att);
    g.gain.setTargetAtTime(0, t + att, tau);
    if (stop) g.gain.setTargetAtTime(0, stop, 0.2);
  };

  for (const e of evs) {
    const t = Math.max(0, e.t - t0);
    switch (e.k) {
      case 'piano': {
        const f0 = mtof(e.m);
        const v = Math.pow(e.v, 1.35);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = Math.min(12000, 700 + 3600 * e.v + f0 * 1.6);
        lp.Q.value = 0.4;
        out(lp, 0.42, e.pan);
        const decay = Math.min(7, Math.max(0.7, 3.4 * Math.pow(220 / f0, 0.5)));
        const stop = t + e.d;
        for (let n = 1; n <= 7; n++) {
          const f = n * f0 * Math.sqrt(1 + 0.00035 * n * n);
          if (f > 10000) break;
          for (const det of n <= 2 ? [-0.9, 0.9] : [0]) {
            const o = ctx.createOscillator();
            o.frequency.value = f + det * (n === 1 ? 0.6 : 1);
            const g = ctx.createGain();
            const amp = (v * 0.22) / Math.pow(n, 1.25) / (n <= 2 ? 2 : 1);
            env(g, t, amp, 0.005, decay / Math.pow(n, 0.55), stop);
            o.connect(g).connect(lp);
            o.start(t);
            o.stop(stop + 1.2);
          }
        }
        const nb = ctx.createBufferSource();
        nb.buffer = noise;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = Math.min(4000, f0 * 3);
        bp.Q.value = 1.2;
        const ng = ctx.createGain();
        env(ng, t, v * 0.05, 0.002, 0.012);
        nb.connect(bp).connect(ng).connect(lp);
        nb.start(t, hash(e.t) * 2, 0.08);
        break;
      }
      case 'bell': {
        const f0 = mtof(e.m);
        const g0 = ctx.createGain();
        g0.gain.value = 1;
        out(g0, 0.6, e.pan);
        const parts = [[1, 1, 3.2], [2.0, 0.28, 1.8], [2.76, 0.42, 1.4], [5.4, 0.2, 0.7], [8.93, 0.09, 0.35]];
        for (const [r, a, d] of parts) {
          const f = f0 * r;
          if (f > 14000) continue;
          const o = ctx.createOscillator();
          o.frequency.value = f;
          const g = ctx.createGain();
          env(g, t, e.v * 0.09 * a, 0.003, d);
          o.connect(g).connect(g0);
          o.start(t);
          o.stop(t + d * 6);
        }
        break;
      }
      case 'pluck': {
        const f0 = mtof(e.m);
        const g0 = ctx.createGain();
        out(g0, 0.5, e.pan);
        for (const [r, a, d] of [[1, 1, 0.7], [3.93, 0.35, 0.12], [9.2, 0.12, 0.04]]) {
          const o = ctx.createOscillator();
          o.frequency.value = f0 * r;
          const g = ctx.createGain();
          env(g, t, e.v * 0.12 * a, 0.002, d);
          o.connect(g).connect(g0);
          o.start(t);
          o.stop(t + d * 7);
        }
        break;
      }
      case 'pad': {
        const att = e.att ?? 2.4;
        const end = t + e.d;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = e.cutoff ?? 1100;
        lp.Q.value = 0.6;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07 + 0.05 * hash(e.t);
        const lfoG = ctx.createGain();
        lfoG.gain.value = (e.cutoff ?? 1100) * 0.35;
        lfo.connect(lfoG).connect(lp.frequency);
        lfo.start(t);
        lfo.stop(end + 4);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.022 * e.g, t + att);
        g.gain.setValueAtTime(0.022 * e.g, Math.max(t + att, end - 0.01));
        g.gain.setTargetAtTime(0, Math.max(t + att, end), 1.4);
        lp.connect(g);
        out(g, 0.55, 0);
        e.notes.forEach((m, i) => {
          const voices = i === 0 ? [[0, 'triangle']] : [[-7, 'sawtooth'], [6, 'sawtooth'], [0, 'triangle']];
          for (const [det, type] of voices) {
            const o = ctx.createOscillator();
            o.type = type;
            o.frequency.value = mtof(m);
            o.detune.value = det + (hash(i * 9 + e.t) - 0.5) * 4;
            const og = ctx.createGain();
            og.gain.value = i === 0 ? 0.55 : 0.55 * (type === 'triangle' ? 1.2 : 1);
            const p = ctx.createStereoPanner();
            p.pan.value = ((i / Math.max(1, e.notes.length - 1)) - 0.5) * 0.9 * (det < 0 ? -1 : 1);
            o.connect(og).connect(p).connect(lp);
            o.start(t);
            o.stop(end + 8);
          }
        });
        break;
      }
      case 'drone': {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05 * e.g, t + 3);
        g.gain.setValueAtTime(0.05 * e.g, Math.max(t + 3, t + e.d - 3));
        g.gain.linearRampToValueAtTime(0, t + e.d);
        out(g, 0.3, 0);
        for (const [m, a, det] of [[e.root, 1, 0], [e.root + 7, 0.55, 0.3], [e.root + 12, 0.25, -0.2]]) {
          const o = ctx.createOscillator();
          o.frequency.value = mtof(m) + det;
          const og = ctx.createGain();
          og.gain.value = a;
          o.connect(og).connect(g);
          o.start(t);
          o.stop(t + e.d + 0.1);
        }
        break;
      }
      case 'boom': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(72, t);
        o.frequency.exponentialRampToValueAtTime(34, t + 1.2);
        const g = ctx.createGain();
        env(g, t, 0.55 * e.g, 0.01, 0.9);
        o.connect(g);
        out(g, 0.25, 0);
        o.start(t);
        o.stop(t + 6);
        const nb = ctx.createBufferSource();
        nb.buffer = noise;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 260;
        const ng = ctx.createGain();
        env(ng, t, 0.3 * e.g, 0.005, 0.35);
        nb.connect(lp).connect(ng);
        out(ng, 0.4, 0);
        nb.start(t, 0.3, 2.5);
        break;
      }
      case 'crash': {
        const nb = ctx.createBufferSource();
        nb.buffer = noise;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1800;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(9000, t);
        lp.frequency.exponentialRampToValueAtTime(2500, t + 2.5);
        const g = ctx.createGain();
        env(g, t, 0.09 * e.g, 0.004, 0.9);
        nb.connect(hp).connect(lp).connect(g);
        out(g, 0.8, 0);
        nb.start(t, 1.1, 2.9);
        break;
      }
      case 'riser': {
        const nb = ctx.createBufferSource();
        nb.buffer = noise;
        nb.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 2.2;
        bp.frequency.setValueAtTime(300, t);
        bp.frequency.exponentialRampToValueAtTime(5200, t + e.d);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09 * e.g, t + e.d);
        g.gain.linearRampToValueAtTime(0, t + e.d + 0.05);
        nb.connect(bp).connect(g);
        out(g, 0.6, 0);
        nb.start(t);
        nb.stop(t + e.d + 0.1);
        break;
      }
      case 'tick':
      case 'snap':
      case 'wood': {
        const nb = ctx.createBufferSource();
        nb.buffer = noise;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = e.k === 'tick' ? 5200 : e.k === 'snap' ? 2300 : 1500;
        bp.Q.value = e.k === 'wood' ? 6 : 3;
        const g = ctx.createGain();
        const amp = (e.k === 'snap' ? 0.5 : e.k === 'wood' ? 0.35 : 0.1) * (e.g ?? 1);
        env(g, t, amp, 0.001, e.k === 'snap' ? 0.03 : 0.012);
        nb.connect(bp).connect(g);
        out(g, e.k === 'snap' ? 0.7 : 0.35, e.k === 'tick' ? 0.2 : 0);
        nb.start(t, hash(e.t * 3) * 2, 0.2);
        if (e.k === 'wood') {
          const o = ctx.createOscillator();
          o.frequency.value = 820;
          const og = ctx.createGain();
          env(og, t, 0.12 * (e.g ?? 1), 0.001, 0.025);
          o.connect(og);
          out(og, 0.4, 0);
          o.start(t);
          o.stop(t + 0.3);
        }
        break;
      }
      case 'thud': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(90, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.4);
        const g = ctx.createGain();
        env(g, t, 0.4 * e.g, 0.004, 0.32);
        o.connect(g);
        out(g, 0.3, 0);
        o.start(t);
        o.stop(t + 3);
        break;
      }
      default:
        break;
    }
  }
  const buf = await ctx.startRendering();
  return { len: buf.length, L: buf.getChannelData(0), R: buf.getChannelData(1) };
}
