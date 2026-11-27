// Dev harness: renders frames of the demo track with any preset/patch so
// headless tests can screenshot them. Open /dev/engine.html.
import { Engine } from '../src/engine/engine';
import { FeatureExtractor, DEFAULT_REACT } from '../src/audio/features';
import { computeEnvelopes, interpret, DEFAULT_SYNC } from '../src/audio/analysis';
import { decodeAudioFile, monoMix } from '../src/audio/decode';
import { createDefaultProject, deepMerge } from '../src/project/defaults';
import { applyPreset, PRESETS } from '../src/project/presets';
import { ensureFont, fontWeight, fontsVersion } from '../src/project/fonts';
import type { Project } from '../src/project/types';
import demoUrl from '../src/assets/demo.mp3';

const log = (m: string) => { (document.getElementById('log') as HTMLElement).textContent += m + '\n'; };

(async () => {
  const buf = await decodeAudioFile(await (await fetch(demoUrl)).blob());
  const env = computeEnvelopes(monoMix(buf), buf.sampleRate);
  const interp = interpret(env, DEFAULT_SYNC);
  const channels = [buf.getChannelData(0), buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0)];
  const fe = new FeatureExtractor({ channels, sampleRate: buf.sampleRate, duration: buf.duration });
  fe.setAnalysis(env, interp);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const engine = new Engine(canvas, { preserveDrawingBuffer: true, fontWeight, fontsVersion });
  engine.warmup();
  log('engine ok');

  (window as unknown as Record<string, unknown>).renderAt = async (t: number, presetId: string | null, patch: unknown, w = 960, h = 540) => {
    let p = createDefaultProject();
    p.meta = { artist: 'D-STRUCTOR', title: 'Kickstorm' };
    const preset = PRESETS.find((x) => x.id === presetId);
    if (preset) p = applyPreset(p, preset);
    p = deepMerge(p, patch) as Project;
    await ensureFont(p.text.font);
    await document.fonts.ready;
    engine.setSize(w, h);
    engine.reset();
    fe.reset();
    const fps = 60;
    let frame = 0;
    const react = { ...DEFAULT_REACT, kickDecay: p.sync.kickDecay, spectrumRelease: p.spectrum.release, spectrum: { ...DEFAULT_REACT.spectrum, bars: p.spectrum.bars, minHz: p.spectrum.minHz, maxHz: p.spectrum.maxHz, gainDb: p.spectrum.gainDb, rangeDb: p.spectrum.rangeDb, tiltDb: p.spectrum.tiltDb } };
    for (let tt = Math.max(0, t - 2); tt <= t + 1e-6; tt += 1 / fps) {
      const f = fe.compute(tt, 1 / fps, react);
      engine.render(p, f, { time: tt, dt: 1 / fps, rangeStart: 0, rangeEnd: buf.duration, frame: frame++ }, { background: null, logo: null });
    }
    return { err: engine.gl.getError(), bpm: interp.bpm, drops: Array.from(interp.drops) };
  };
  (window as unknown as Record<string, unknown>).ready = true;
})().catch((e) => log('ERROR ' + e.message));
