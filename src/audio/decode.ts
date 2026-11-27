import type { Envelopes } from './analysis';

export const ANALYSIS_RATE = 48000;

/** Decodes any browser-supported audio file to a 48 kHz AudioBuffer. */
export async function decodeAudioFile(file: Blob): Promise<AudioBuffer> {
    const data = await file.arrayBuffer();
    const ctx = new OfflineAudioContext(2, 1, ANALYSIS_RATE);
    return await ctx.decodeAudioData(data);
}

export function monoMix(buffer: AudioBuffer): Float32Array {
    const n = buffer.length;
    const out = new Float32Array(n);
    const ch = buffer.numberOfChannels;
    for (let c = 0; c < ch; c++) {
        const d = buffer.getChannelData(c);
        for (let i = 0; i < n; i++) out[i] += d[i];
    }
    if (ch > 1) for (let i = 0; i < n; i++) out[i] /= ch;
    return out;
}

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;

/** Same analysis on the main thread (used when a worker cannot start). */
async function analyzeHere(buffer: AudioBuffer, onProgress?: (p: number) => void): Promise<Envelopes> {
    const { computeEnvelopes } = await import('./analysis');
    await new Promise((r) => setTimeout(r, 0));
    return computeEnvelopes(monoMix(buffer), buffer.sampleRate, onProgress);
}

/** Runs the heavy envelope analysis in a Web Worker (falls back to the main thread). */
export function analyzeInWorker(buffer: AudioBuffer, onProgress?: (p: number) => void): Promise<Envelopes> {
    if (workerBroken) return analyzeHere(buffer, onProgress);
    try {
        if (!worker) worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    } catch {
        workerBroken = true;
        return analyzeHere(buffer, onProgress);
    }
    const w = worker;
    const id = nextId++;
    const mono = monoMix(buffer);
    return new Promise((resolve, reject) => {
        let started = false;
        const cleanup = () => {
            w.removeEventListener('message', onMessage);
            w.removeEventListener('error', onError);
        };
        const onMessage = (e: MessageEvent) => {
            const msg = e.data;
            if (msg.id !== id) return;
            started = true;
            if (msg.type === 'progress') onProgress?.(msg.p);
            else if (msg.type === 'done') {
                cleanup();
                resolve(msg.env as Envelopes);
            } else if (msg.type === 'error') {
                cleanup();
                reject(new Error(msg.message));
            }
        };
        // a worker that fails to load (blocked script, old browser) errors before any message
        const onError = (e: Event) => {
            e.preventDefault?.();
            if (started) return;
            cleanup();
            workerBroken = true;
            worker?.terminate();
            worker = null;
            analyzeHere(buffer, onProgress).then(resolve, reject);
        };
        w.addEventListener('message', onMessage);
        w.addEventListener('error', onError);
        w.postMessage({ id, mono, sampleRate: buffer.sampleRate }, [mono.buffer]);
    });
}
