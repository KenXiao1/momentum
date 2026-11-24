// Contact sheet of a footage clip at given clip times: node tools/footsheet.mjs seat 1,5,9
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const [clip, ts] = process.argv.slice(2);
const meta = JSON.parse(await readFile(`footage/${clip}/meta.json`));
const times = ts.split(',').map(Number);
const files = times.map((t) => {
  let i = meta.frames.findIndex((f) => f > t);
  i = i < 0 ? meta.frames.length - 1 : Math.max(0, i - 1);
  return `footage/${clip}/f${String(i).padStart(5, '0')}.jpg`;
});
const cols = files.length > 4 ? 3 : 2;
const inputs = files.flatMap((f) => ['-i', f]);
const scaled = files.map((_, i) => `[${i}]scale=960:600[s${i}]`).join(';');
const layout = files.map((_, i) => `${(i % cols) * 960}_${Math.floor(i / cols) * 600}`).join('|');
const out = `out/preview/foot-${clip}.jpg`;
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${scaled};${files.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=black`, '-q:v', '3', out], { stdio: 'inherit' });
console.log(out);
