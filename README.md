# Canvasbeats: music visualizer for hard dance

Demo: https://maurerkrisztian.github.io/music-visualizer/

A browser music visualizer built for **hardstyle, rawstyle, hardcore, uptempo and frenchcore**. It also works for any other genre. Drop in a track, pick a look, and export a YouTube-ready video. Everything runs locally in the browser.

## Features

- **Track analysis** (Web Worker): kick detection, BPM and beat grid, downbeats, build-ups and drops, plus an intensity curve. Double-click the timeline to add or remove a drop by hand.
- **WebGL2 engine** with:
  - 12 backgrounds (cover art, festival stage, neon tunnel, hyperspace, lasers, hex shockwave, retro grid, nebula, plasma, kaleidoscope, soft gradient, void)
  - 13 spectrum styles: radial bars and waves, a sci-fi HUD circle, a liquid orb, bars (optionally smoothed into soft hills), centre bars (audiogram), LED meter, dot matrix, thin line, mountain wave, a 3D terrain that scrolls away from the viewer, and two oscilloscopes; radial styles can send echo rings out on kicks
  - centre logo as a circle, a square cover or a spinning vinyl record (it back-spins on drops), with shock rings
  - particles: warp, embers, dust, sparks, orbit, confetti cannons and a 3D point sphere that bulges with the spectrum, with a burst on every drop
  - lasers, god rays, lightning on drops, fire with pyro jets, smoke, and festival crowd silhouettes that jump on the kicks
  - camera and post effects: bloom, anamorphic lens flares, shake, zoom punch, kick zoom blur, beat-synced camera cuts, living camera drift, a camera roll into each drop, dreamy breakdown blur, shockwave ripple, glitch, chromatic aberration, strobe, trails, VHS tape and film grain
- **Section-aware dynamics**: calm breakdowns, tension that builds into the drop, and maximum impact on the drop. An optional **drop scene** switches the background (and palette) the moment the kicks come back.
- **25 presets** in three groups: full-effect genre looks (Euphoric, Rawstyle, Uptempo Terror, Frenchcore, Gabber, Mainstage Pyro, Vinyl Spin and more), popular styles from music channels and visualizer apps (Bass Circle, Label Bars, Sci-Fi HUD, Liquid Orb, Particle Sphere, Retro VHS, Feedback Trip), and simple, calm looks for any genre (Clean Bars, Audiogram, Hi-Fi LED, Dot Matrix, Thin Line, Minimal Mono). The gallery thumbnails are rendered from your own track.
- **Branding**: kinetic typography (letters bounce on kicks, wave, jitter, flicker like neon or explode on drops), an intro title card that types itself in, artist/title text with 20+ fonts (or upload your own), lyrics/subtitles from .lrc/.srt files, a corner watermark logo, and a separate drop palette.
- **Frame-accurate export**:
  - formats: MP4 (H.264 + AAC) or WebM (VP9 + Opus)
  - sizes: 720p to 4K, 30 or 60 fps, plus 9:16 Shorts/TikTok, square and 4:5
  - one-click drop clip, or drag the range on the timeline
  - optional streaming straight to disk
  - full-resolution PNG snapshot for thumbnails
  - falls back to real-time recording when WebCodecs is missing
- Fullscreen watch mode (F), autosave, undo/redo, and `.canvasbeats` project files with embedded images and fonts. Drag and drop for audio, images, fonts and projects.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # analysis unit tests (synthetic hardstyle / uptempo / terror tracks)
npm run build
```

`/dev/engine.html` renders frames of the demo track for screenshot checks.
`scripts/make-demo.py` regenerates the bundled demo track.

Every push to `main` is linted, tested, built and deployed to GitHub Pages by `.github/workflows/deploy.yml`.

See [docs/PLAN.md](docs/PLAN.md) for the architecture, current status and roadmap.
