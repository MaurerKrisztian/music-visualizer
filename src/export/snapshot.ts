// Renders a single full-resolution still (e.g. for a YouTube thumbnail).

import { FeatureExtractor } from '../audio/features';
import { Engine } from '../engine/engine';
import type { Project } from '../project/types';
import type { ExportDeps } from './settings';

export async function renderSnapshot(project: Project, deps: Omit<ExportDeps, 'previewCanvas'>, time: number, width: number, height: number): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const engine = new Engine(canvas, { preserveDrawingBuffer: true, loseContextOnDispose: true, fontWeight: deps.fontWeight, fontsVersion: deps.fontsVersion });
    try {
        engine.setSize(width, height);
        engine.reset(99);
        const fe = new FeatureExtractor({
            channels: Array.from({ length: deps.buffer.numberOfChannels }, (_, i) => deps.buffer.getChannelData(i)),
            sampleRate: deps.buffer.sampleRate,
            duration: deps.buffer.duration,
        });
        fe.setAnalysis(deps.env, deps.interp);
        const dt = 1 / 60;
        let frame = 0;
        for (let t = Math.max(0, time - 0.75); t <= time + 1e-6; t += dt) {
            const f = fe.compute(t, dt, deps.react);
            engine.render(project, f, { time: t, dt, rangeStart: -1e6, rangeEnd: 1e6, frame: frame++ }, deps.images);
        }
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
        if (!blob) throw new Error('Could not capture the frame.');
        return blob;
    } finally {
        engine.dispose();
    }
}
