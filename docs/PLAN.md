# Plan and status

## Core idea

Every frame is a pure function of **(project settings, audio features at time t)**. The features come from the decoded samples plus an offline analysis of the whole track, not from a live `AnalyserNode`. As a result:

- the preview and the exported video look identical,
- export renders frame by frame (faster or slower than real time), so 60 fps never drops a frame,
- kicks are known ahead of time and land on the exact frame.

## Architecture (`src/`)

| Folder | What lives there |
| --- | --- |
| `audio/` | `analysis.ts`: band envelopes (worker), kicks, BPM, beat grid, downbeats, sections, drops, build-ups, intensity. `features.ts`: per-frame features at time t. `spectrum.ts`: FFT bars and scope. `player.ts`, `decode.ts`, `synth.ts` (test tracks). |
| `engine/` | WebGL2 pipeline: background, overlays, trails buffer (spectrum + particles), logo / text / progress bar, bloom, final pass (shake, zoom, shockwave, glitch, chromatic aberration, grade, grain). |
| `export/` | `exporter.ts`: offline render with WebCodecs + mediabunny (MP4/WebM, WASM AAC fallback, stream to disk). `realtime.ts`: MediaRecorder fallback. |
| `project/` | Project schema, defaults, presets, store (undo/redo), assets (IndexedDB), fonts, project files. |
| `app/` | Session (load, analyse, play, autosave, restore) and the preview render loop. |
| `ui/` | React components (panels, timeline, transport, export dialog). |

## Done

- [x] Full rewrite: React 18 + TypeScript + Vite, WebGL2 engine, no Canvas2D drawing loop.
- [x] Hard-dance analysis: kick onsets (about 5 ms), BPM including uptempo and terror tempos, beat grid, downbeats, drop and build-up detection. Unit tested on synthetic tracks.
- [x] 10 backgrounds, 6 spectrum styles, logo circle, 4 particle modes, lasers / fire / smoke.
- [x] Post effects with section dynamics (calm breakdowns, tension in build-ups, impact on drops).
- [x] 12 genre presets.
- [x] Frame-accurate MP4/WebM export from 720p to 4K at 30/60 fps, plus 9:16, 1:1 and 4:5, drop-clip range and stream to disk.
- [x] Autosave, session restore (last track and images), undo/redo, project files, drag and drop, keyboard shortcuts.
- [x] Original procedurally generated demo track (150 BPM, intro, breakdown, build-up, drop).
- [x] Preset gallery with stills rendered by the engine at the first drop of your track.
- [x] Intro title card, corner watermark (channel logo), separate drop palette, and full-resolution PNG snapshot for thumbnails.
- [x] Draggable export range on the timeline; exports keep full speed in background tabs (wake lock, progress in the tab title).
- [x] Lyrics and subtitles from .lrc/.srt files; beat-synced camera cuts (a new framing on every bar during drops).
- [x] Festival crowd silhouettes, a "Surprise me" randomiser and a keyboard shortcut overlay.
- [x] Manual drop editing (double-click the timeline); kick-roll build-ups no longer create false early drops.
- [x] Drop scene: a second background that cuts in on drops (Euphoric preset: nebula breakdowns, neon tunnel drops).
- [x] Falling peak caps on bar spectrums.
- [x] Festival stage background (truss, moving heads, LED wall), vinyl and square-cover centre shapes, anamorphic lens flares, fullscreen watch mode.
- [x] Animation update: kinetic typography, 3D spectrum terrain, kick echo rings, god rays, lightning, orbit and confetti particles with drop bursts, logo jelly wobble, camera drift and build-up roll, dreamy breakdown blur, kick zoom blur.
- [x] Simple looks: centre bars, LED meter, dot matrix and thin-line spectrums, a soft gradient background, and a "Simple" preset group with calm effects.
- [x] Popular styles: sci-fi HUD circle, liquid orb, 3D particle sphere, VHS tape effect, smoothed bars, and a "Popular styles" preset group (bass circle, label bars, HUD, orb, sphere, retro VHS, psychedelic feedback).
- [x] Auto-deploy to GitHub Pages on every push to `main`.
- [x] Runs as a Claude artifact (saves through the viewer's downloads capability; MP4 falls back to Opus audio when WASM is blocked).

## Next

- [ ] Multiple free text layers (e.g. label name, "OUT NOW").
- [ ] Per-section spectrum/particle styles (beyond background and colours).
- [ ] Batch export (16:9 and 9:16 in one go).
- [ ] Render the export in a worker with OffscreenCanvas so the UI stays responsive.
- [ ] More backgrounds (3D city, VHS tape).
- [ ] Tune kick/drop detection on a set of real hardstyle, rawstyle and uptempo tracks (so far tested on synthetic tracks and the demo).
