# Canvasbeats: music visualizer for hard dance

Demo: https://canvasbeats.com

A browser music visualizer built for **hardstyle, rawstyle, hardcore, uptempo and frenchcore**. It also works for any other genre. Drop in a track, pick a look, and export a YouTube-ready video. Everything runs locally in the browser.

## Features

- **Track analysis** (Web Worker): kick detection, BPM and beat grid, downbeats, build-ups and drops, plus an intensity curve. Double-click the timeline to add or remove a drop by hand.
- **WebGL2 engine** with:
  - 10 backgrounds (cover art, neon tunnel, hyperspace, lasers, hex shockwave, retro grid, nebula, plasma, kaleidoscope, void)
  - 6 spectrum styles
  - logo / cover circle with shock rings
  - particles
  - lasers, fire with pyro jets, smoke, and festival crowd silhouettes that jump on the kicks
  - post effects: bloom, shake, zoom punch, beat-synced camera cuts, shockwave ripple, glitch, chromatic aberration, strobe, trails and film grain
- **Section-aware dynamics**: calm breakdowns, tension that builds into the drop, and maximum impact on the drop. An optional **drop scene** switches the background (and palette) the moment the kicks come back.
- **12 genre presets** (Euphoric, Rawstyle, Uptempo Terror, Frenchcore, Gabber, Mainstage Pyro and more). The gallery thumbnails are rendered from your own track.
- **Branding**: intro title card, artist/title text with 20+ fonts (or upload your own), lyrics/subtitles from .lrc/.srt files, a corner watermark logo, and a separate drop palette.
- **Frame-accurate export**:
  - formats: MP4 (H.264 + AAC) or WebM (VP9 + Opus)
  - sizes: 720p to 4K, 30 or 60 fps, plus 9:16 Shorts/TikTok, square and 4:5
  - one-click drop clip, or drag the range on the timeline
  - optional streaming straight to disk
  - full-resolution PNG snapshot for thumbnails
  - falls back to real-time recording when WebCodecs is missing
- Autosave, undo/redo, and `.canvasbeats` project files with embedded images and fonts. Drag and drop for audio, images, fonts and projects.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # analysis unit tests (synthetic hardstyle / uptempo / terror tracks)
npm run build
```

`/dev/engine.html` renders frames of the demo track for screenshot checks.
`scripts/make-demo.py` regenerates the bundled demo track.

See [docs/PLAN.md](docs/PLAN.md) for the architecture, current status and roadmap.
