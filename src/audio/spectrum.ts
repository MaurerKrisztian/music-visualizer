import { FFT, hann } from './dsp';

export interface SpectrumOptions {
    bars: number;
    minHz: number;
    maxHz: number;
    /** Added to all bars. */
    gainDb: number;
    /** Visible dynamic range in dB. */
    rangeDb: number;
    /** dB per octave relative to 1 kHz, lifts highs so the whole spectrum moves. */
    tiltDb: number;
}

interface BarMap {
    lo: Int32Array;
    hi: Int32Array;
    center: Float32Array; // fractional bin of the bar centre
    tilt: Float32Array;
}

/**
 * Computes a log-frequency bar spectrum straight from the decoded samples at an
 * arbitrary time. Because it does not depend on a live AnalyserNode the preview
 * and the offline export produce identical frames.
 */
export class SpectrumAnalyzer {
    readonly size: number;
    private readonly fft: FFT;
    private readonly window: Float32Array;
    private readonly windowSum: number;
    private readonly re: Float64Array;
    private readonly im: Float64Array;
    private readonly mag: Float32Array;
    private map: BarMap | null = null;
    private mapKey = '';

    constructor(private readonly sampleRate: number, size = sampleRate > 60000 ? 8192 : 4096) {
        this.size = size;
        this.fft = new FFT(size);
        this.window = hann(size);
        this.windowSum = this.window.reduce((a, b) => a + b, 0);
        this.re = new Float64Array(size);
        this.im = new Float64Array(size);
        this.mag = new Float32Array(size / 2);
    }

    private ensureMap(o: SpectrumOptions): BarMap {
        const key = `${o.bars}|${o.minHz}|${o.maxHz}|${o.tiltDb}`;
        if (this.map && this.mapKey === key) return this.map;
        const n = o.bars;
        const lo = new Int32Array(n);
        const hi = new Int32Array(n);
        const center = new Float32Array(n);
        const tilt = new Float32Array(n);
        const df = this.sampleRate / this.size;
        const ratio = o.maxHz / o.minHz;
        for (let b = 0; b < n; b++) {
            const f0 = o.minHz * Math.pow(ratio, b / n);
            const f1 = o.minHz * Math.pow(ratio, (b + 1) / n);
            const fc = Math.sqrt(f0 * f1);
            lo[b] = Math.max(1, Math.floor(f0 / df));
            hi[b] = Math.min(this.size / 2 - 1, Math.ceil(f1 / df));
            center[b] = fc / df;
            tilt[b] = o.tiltDb * Math.log2(fc / 1000);
        }
        this.map = { lo, hi, center, tilt };
        this.mapKey = key;
        return this.map;
    }

    /** Writes normalised 0..1 bar levels into out (length = opts.bars). */
    compute(channels: Float32Array[], centerSample: number, opts: SpectrumOptions, out: Float32Array): void {
        const N = this.size;
        const start = Math.round(centerSample - N / 2);
        const nch = channels.length;
        const len = channels[0]?.length ?? 0;
        const re = this.re;
        const im = this.im;
        for (let i = 0; i < N; i++) {
            const idx = start + i;
            let v = 0;
            if (idx >= 0 && idx < len) {
                for (let c = 0; c < nch; c++) v += channels[c][idx];
                v /= nch;
            }
            re[i] = v * this.window[i];
            im[i] = 0;
        }
        this.fft.transform(re, im);
        const scale = 2 / this.windowSum;
        for (let k = 0; k < N / 2; k++) this.mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]) * scale;

        const map = this.ensureMap(opts);
        const floor = -opts.rangeDb;
        for (let b = 0; b < opts.bars; b++) {
            let m: number;
            if (map.hi[b] - map.lo[b] <= 1) {
                const c = map.center[b];
                const k = Math.floor(c);
                const f = c - k;
                m = this.mag[k] * (1 - f) + this.mag[Math.min(k + 1, N / 2 - 1)] * f;
            } else {
                m = 0;
                for (let k = map.lo[b]; k < map.hi[b]; k++) if (this.mag[k] > m) m = this.mag[k];
            }
            const db = 20 * Math.log10(m + 1e-9) + map.tilt[b] + opts.gainDb;
            const v = (db - floor) / opts.rangeDb;
            out[b] = v < 0 ? 0 : v > 1 ? 1 : v;
        }
    }
}

/**
 * Extracts a short, trigger-stabilised waveform window (for oscilloscopes).
 */
export function extractWave(
    channels: Float32Array[],
    centerSample: number,
    windowSamples: number,
    outL: Float32Array,
    outR: Float32Array,
): void {
    const L = channels[0];
    const R = channels[1] ?? channels[0];
    const len = L?.length ?? 0;
    const n = outL.length;
    const start0 = Math.round(centerSample - windowSamples);
    // find a rising zero crossing in a smoothed signal to keep the scope steady
    let trigger = start0;
    let prev = 0;
    let acc = 0;
    const searchEnd = start0 + windowSamples;
    for (let i = start0; i < searchEnd; i++) {
        const v = i >= 0 && i < len ? L[i] : 0;
        acc += (v - acc) * 0.08;
        if (prev < 0 && acc >= 0 && i > start0 + 8) {
            trigger = i;
            break;
        }
        prev = acc;
    }
    for (let j = 0; j < n; j++) {
        const pos = trigger + (j / (n - 1)) * windowSamples;
        const i0 = Math.floor(pos);
        const f = pos - i0;
        const a = i0 >= 0 && i0 < len ? L[i0] : 0;
        const b = i0 + 1 >= 0 && i0 + 1 < len ? L[i0 + 1] : 0;
        const c = i0 >= 0 && i0 < len ? R[i0] : 0;
        const d = i0 + 1 >= 0 && i0 + 1 < len ? R[i0 + 1] : 0;
        outL[j] = a + (b - a) * f;
        outR[j] = c + (d - c) * f;
    }
}
