// Renders a small still of every preset at the first drop of the loaded track
// (with the user's images and text), so the preset gallery shows real looks.

import { FeatureExtractor } from '../audio/features';
import { Engine } from '../engine/engine';
import { fontsVersion, fontWeight } from '../project/fonts';
import { applyPreset, PRESETS } from '../project/presets';
import { projectStore } from '../project/store';
import { engineImages } from './preview';
import { appStore, getChannels, reactOptions } from './session';

const cache = new Map<string, string>();
const listeners = new Set<() => void>();
let cacheKey = '';
let running = false;
let version = 0;

export function presetThumb(id: string): string | undefined {
    return cache.get(id);
}

export function thumbsVersion(): number {
    return version;
}

export function subscribeThumbs(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export async function renderThumbs(): Promise<void> {
    const st = appStore.get();
    const channels = getChannels();
    if (!st.env || !st.interp || !st.track || channels.length === 0 || running) return;
    const p0 = projectStore.get();
    const key = [st.track.name, st.track.duration, p0.meta.artist, p0.meta.title, p0.background.imageId, p0.center.imageId, p0.text.font].join('|');
    if (key === cacheKey) return;
    cacheKey = key;
    running = true;
    let engine: Engine | null = null;
    try {
        const canvas = document.createElement('canvas');
        engine = new Engine(canvas, { preserveDrawingBuffer: true, loseContextOnDispose: true, fontWeight, fontsVersion });
        engine.setSize(320, 180);
        const fe = new FeatureExtractor({ channels, sampleRate: st.env.sampleRate, duration: st.track.duration });
        fe.setAnalysis(st.env, st.interp);
        const drop = st.interp.drops.length ? st.interp.drops[0] : Math.min(st.track.duration * 0.5, 20);
        const tShow = Math.min(st.track.duration, drop + 0.42);
        const fps = 30;
        let frame = 0;
        for (const preset of PRESETS) {
            if (cacheKey !== key) break;
            const p = applyPreset(projectStore.get(), preset);
            p.fx.fadeIn = 0;
            p.fx.fadeOut = 0;
            engine.reset();
            fe.reset();
            for (let t = Math.max(0, tShow - 0.6); t <= tShow + 1e-6; t += 1 / fps) {
                const f = fe.compute(t, 1 / fps, reactOptions(p));
                engine.render(p, f, { time: t, dt: 1 / fps, rangeStart: 0, rangeEnd: st.track.duration, frame: frame++ }, engineImages(p));
            }
            const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
            if (blob) {
                const old = cache.get(preset.id);
                if (old) URL.revokeObjectURL(old);
                cache.set(preset.id, URL.createObjectURL(blob));
                version++;
                listeners.forEach((l) => l());
            }
            await new Promise((r) => setTimeout(r, 0));
        }
    } catch (e) {
        console.warn('preset thumbnails failed', e);
    } finally {
        engine?.dispose();
        running = false;
    }
}
