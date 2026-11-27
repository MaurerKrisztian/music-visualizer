// Small, dependency-free DSP toolkit used by the offline analyser and the
// per-frame feature extractor. Everything here is pure (no DOM), so it runs in
// workers and in unit tests.

export interface Biquad {
    b0: number;
    b1: number;
    b2: number;
    a1: number;
    a2: number;
}

// RBJ cookbook filters.
export function lowpass(fs: number, f0: number, q = Math.SQRT1_2): Biquad {
    const w0 = (2 * Math.PI * f0) / fs;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    return {
        b0: (1 - cos) / 2 / a0,
        b1: (1 - cos) / a0,
        b2: (1 - cos) / 2 / a0,
        a1: (-2 * cos) / a0,
        a2: (1 - alpha) / a0,
    };
}

export function highpass(fs: number, f0: number, q = Math.SQRT1_2): Biquad {
    const w0 = (2 * Math.PI * f0) / fs;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    return {
        b0: (1 + cos) / 2 / a0,
        b1: -(1 + cos) / a0,
        b2: (1 + cos) / 2 / a0,
        a1: (-2 * cos) / a0,
        a2: (1 - alpha) / a0,
    };
}

// Q values for a 4th order Butterworth made of two cascaded biquads.
const BW4 = [0.5411961, 1.3065630];

export function lowpass4(fs: number, f0: number): Biquad[] {
    return BW4.map((q) => lowpass(fs, f0, q));
}

export function highpass4(fs: number, f0: number): Biquad[] {
    return BW4.map((q) => highpass(fs, f0, q));
}

/** Runs a cascade of biquads (direct form II transposed). Returns a new array. */
export function filter(x: Float32Array, stages: Biquad[]): Float32Array {
    let input = x;
    const out = new Float32Array(x.length);
    for (const c of stages) {
        const { b0, b1, b2, a1, a2 } = c;
        let z1 = 0;
        let z2 = 0;
        for (let i = 0; i < input.length; i++) {
            const xi = input[i];
            const y = b0 * xi + z1;
            z1 = b1 * xi - a1 * y + z2;
            z2 = b2 * xi - a2 * y;
            out[i] = y;
        }
        input = out;
    }
    return out;
}

/** Anti-aliased decimation by an integer factor. */
export function decimate(x: Float32Array, fs: number, factor: number): Float32Array {
    const filtered = filter(x, lowpass4(fs, (fs / (2 * factor)) * 0.8));
    const out = new Float32Array(Math.floor(filtered.length / factor));
    for (let i = 0; i < out.length; i++) out[i] = filtered[i * factor];
    return out;
}

/** In-place iterative radix-2 complex FFT. */
export class FFT {
    readonly n: number;
    private readonly cos: Float64Array;
    private readonly sin: Float64Array;
    private readonly rev: Uint32Array;

    constructor(n: number) {
        if ((n & (n - 1)) !== 0) throw new Error('FFT size must be a power of two');
        this.n = n;
        this.cos = new Float64Array(n / 2);
        this.sin = new Float64Array(n / 2);
        for (let i = 0; i < n / 2; i++) {
            this.cos[i] = Math.cos((2 * Math.PI * i) / n);
            this.sin[i] = Math.sin((2 * Math.PI * i) / n);
        }
        this.rev = new Uint32Array(n);
        const bits = Math.log2(n);
        for (let i = 0; i < n; i++) {
            let r = 0;
            for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
            this.rev[i] = r;
        }
    }

    transform(re: Float64Array, im: Float64Array): void {
        const n = this.n;
        const rev = this.rev;
        for (let i = 0; i < n; i++) {
            const j = rev[i];
            if (j > i) {
                let t = re[i];
                re[i] = re[j];
                re[j] = t;
                t = im[i];
                im[i] = im[j];
                im[j] = t;
            }
        }
        for (let size = 2; size <= n; size <<= 1) {
            const half = size >> 1;
            const step = n / size;
            for (let i = 0; i < n; i += size) {
                for (let j = 0, k = 0; j < half; j++, k += step) {
                    const l = i + j + half;
                    const c = this.cos[k];
                    const s = this.sin[k];
                    const tre = re[l] * c + im[l] * s;
                    const tim = -re[l] * s + im[l] * c;
                    re[l] = re[i + j] - tre;
                    im[l] = im[i + j] - tim;
                    re[i + j] += tre;
                    im[i + j] += tim;
                }
            }
        }
    }
}

export function hann(n: number): Float32Array {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    return w;
}

/** Percentile of a numeric array (copies + sorts). p in [0,1]. */
export function percentile(values: ArrayLike<number>, p: number): number {
    if (values.length === 0) return 0;
    const sorted = Float64Array.from(values as ArrayLike<number>).sort();
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
    return sorted[idx];
}

/** Gaussian smoothing of a 1D array, sigma in samples. */
export function gaussianSmooth(x: Float32Array, sigma: number): Float32Array {
    if (sigma <= 0.01) return Float32Array.from(x);
    const radius = Math.ceil(sigma * 3);
    const kernel = new Float64Array(radius * 2 + 1);
    let sum = 0;
    for (let i = -radius; i <= radius; i++) {
        const v = Math.exp((-0.5 * i * i) / (sigma * sigma));
        kernel[i + radius] = v;
        sum += v;
    }
    for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
    const out = new Float32Array(x.length);
    const n = x.length;
    for (let i = 0; i < n; i++) {
        let acc = 0;
        let wsum = 0;
        for (let k = -radius; k <= radius; k++) {
            const j = i + k;
            if (j < 0 || j >= n) continue;
            const w = kernel[k + radius];
            acc += x[j] * w;
            wsum += w;
        }
        out[i] = acc / wsum;
    }
    return out;
}

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function clamp(x: number, lo = 0, hi = 1): number {
    return x < lo ? lo : x > hi ? hi : x;
}

/** Binary search: index of the last element <= t, or -1. */
export function lastIndexAtOrBefore(sorted: ArrayLike<number>, t: number): number {
    let lo = 0;
    let hi = sorted.length - 1;
    let ans = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid] <= t) {
            ans = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return ans;
}
