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

## Next

- [ ] Timeline: add or remove drop markers by hand.
- [ ] Multiple free text layers (e.g. label name, "OUT NOW").
- [ ] Per-section looks beyond colours (switch background or spectrum style on each drop).
- [ ] Batch export (16:9 and 9:16 in one go).
- [ ] Render the export in a worker with OffscreenCanvas so the UI stays responsive.
- [ ] Beat-synced camera cuts and more backgrounds (3D city, crowd silhouettes, VHS).
