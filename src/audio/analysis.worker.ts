/// <reference lib="webworker" />
import { computeEnvelopes } from './analysis';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<{ id: number; mono: Float32Array; sampleRate: number }>) => {
    const { id, mono, sampleRate } = e.data;
    try {
        const env = computeEnvelopes(mono, sampleRate, (p) => self.postMessage({ id, type: 'progress', p }));
        const transfer = [
            env.kickDb,
            env.fullDb,
            env.sub,
            env.bass,
            env.lowMid,
            env.mid,
            env.high,
            env.energy,
            env.overview.amp,
            env.overview.low,
            env.overview.mid,
            env.overview.high,
        ].map((a) => a.buffer as ArrayBuffer);
        self.postMessage({ id, type: 'done', env }, transfer);
    } catch (err) {
        self.postMessage({ id, type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
};
