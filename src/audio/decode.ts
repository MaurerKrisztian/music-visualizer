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
let nextId = 1;

/** Runs the heavy envelope analysis in a Web Worker. */
export function analyzeInWorker(buffer: AudioBuffer, onProgress?: (p: number) => void): Promise<Envelopes> {
    if (!worker) worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    const w = worker;
    const id = nextId++;
    const mono = monoMix(buffer);
    return new Promise((resolve, reject) => {
        const onMessage = (e: MessageEvent) => {
            const msg = e.data;
            if (msg.id !== id) return;
            if (msg.type === 'progress') onProgress?.(msg.p);
            else if (msg.type === 'done') {
                w.removeEventListener('message', onMessage);
                resolve(msg.env as Envelopes);
            } else if (msg.type === 'error') {
                w.removeEventListener('message', onMessage);
                reject(new Error(msg.message));
            }
        };
        w.addEventListener('message', onMessage);
        w.postMessage({ id, mono, sampleRate: buffer.sampleRate }, [mono.buffer]);
    });
}
