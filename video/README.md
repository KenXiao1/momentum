# Engineering the Will · 意志的工程学

An 11-minute bilingual (中文 / English) explainer film about CTDP and RSIP,
adapted from Edmond's essay 《如何提高自制力？》 (Zhihu, 2025, MIT-style licence
with attribution). It is also a demo of Momentum: the app segments are real
recordings of the local-mode app. There is no voice-over — the subtitles are the
narration — and every picture, subtitle and note of music is generated in code.

## Outputs (`video/out/`, git-ignored)

| File | What |
| --- | --- |
| `engineering-the-will.mp4` | 1920×1080, 60 fps, H.264 + AAC 320k, burned-in bilingual subtitles |
| `subtitles.{zh,en,bilingual}.srt`, `subtitles.{zh,en}.vtt` | soft subtitles for platforms that want them |
| `score.wav` | the score alone, 48 kHz / 24-bit, about −16 LUFS |

## Rebuild

```bash
# 1. a local-mode build of the app to record (from the repo root)
VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite build --outDir /tmp/momentum-dist
npx vite preview --outDir /tmp/momentum-dist --host 127.0.0.1 --port 5199 --strictPort

# 2. seed a lived-in state through the real UI, then age it
node video/capture/build-seed.mjs && node video/capture/age-seed.mjs

# 3. record the demo clips (CDP screencast + cursor log + element boxes)
node video/capture/record.mjs

# 4. timeline → score → film
node video/render.mjs timeline
node video/music/compose.mjs
node video/render.mjs film --fps 60 --workers 12
```

Iterate on a scene with `node video/render.mjs preview --scene <id> --n 9`,
which writes a contact sheet to `out/preview/`.

## How it is built

- `film/js/script.js` — the bilingual script. Cue lengths come from a reading-time
  model, so the script drives all picture and music timing.
- `film/js/engine.js` — deterministic timeline: every frame is a pure function of
  time, so frames render independently and in parallel.
- `film/js/scenes/` — one module per chapter (`opening`, `value`, `ctdp`, `scale`,
  `rsip`, `coda`) plus `demo.js`, which plays recorded footage in a window with a
  camera, synthetic cursor and callouts.
- `render.mjs` — headless Chromium frames → JPEG → x264 segments → concat → mux.
- `music/score.js` — the score as code: felt-piano, pad, bell, pluck and percussion
  voices synthesised with Web Audio in an `OfflineAudioContext`, events derived
  from the same timeline (chain beads ring, the firing pin lands on the beat, the
  renormalization scene thins random notes into a single chord).
- `capture/` — Playwright scripts that seed, drive and record the real app.
