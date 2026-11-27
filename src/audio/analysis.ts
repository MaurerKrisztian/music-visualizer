// Offline music analysis tuned for hard dance (hardstyle, rawstyle, hardcore,
// uptempo, frenchcore) but generic enough for any four-on-the-floor music.
//
// Two stages:
//  1. computeEnvelopes()  heavy, runs once per track in a worker: band energy
//     envelopes at ~200 fps, loudness normalisation, a colour overview for the
//     timeline.
//  2. interpret()         light (milliseconds), re-run whenever the sync
//     settings change: kick detection, BPM + beat grid, downbeats, sections,
//     drops, build-ups and an "intensity" curve.

import {
    clamp,
    gaussianSmooth,
    highpass4,
    lowpass4,
    percentile,
    type Biquad,
} from './dsp';

export const ENV_RATE = 200;

export interface Overview {
    buckets: number;
    amp: Float32Array; // peak |x| per bucket, 0..1
    low: Float32Array; // normalised band level per bucket
    mid: Float32Array;
    high: Float32Array;
}

export interface Envelopes {
    sampleRate: number;
    duration: number;
    frameRate: number;
    frames: number;
    kickDb: Float32Array;
    fullDb: Float32Array;
    sub: Float32Array;
    bass: Float32Array;
    lowMid: Float32Array;
    mid: Float32Array;
    high: Float32Array;
    energy: Float32Array;
    refDb: number;
    overview: Overview;
}

export interface SyncOptions {
    /** 0..1, higher finds more (softer) kicks. */
    sensitivity: number;
    /** Manual BPM, or null for auto detection. */
    bpmOverride: number | null;
    /** Shifts the whole beat grid. */
    beatOffsetMs: number;
    minBpm: number;
    maxBpm: number;
}

export const DEFAULT_SYNC: SyncOptions = {
    sensitivity: 0.5,
    bpmOverride: null,
    beatOffsetMs: 0,
    minBpm: 60,
    maxBpm: 320,
};

export type SectionKind = 'intro' | 'breakdown' | 'build' | 'drop' | 'main' | 'outro';

export interface Section {
    start: number;
    end: number;
    kind: SectionKind;
}

export interface Interpretation {
    kicks: Float32Array;
    kickStrength: Float32Array;
    bpm: number;
    detectedBpm: number;
    bpmConfidence: number;
    beats: Float32Array;
    /** Index into beats of the first bar start. */
    downbeat: number;
    drops: Float32Array;
    dropStrength: Float32Array;
    /** Flat [start0, end0, start1, end1, ...] */
    builds: Float32Array;
    sections: Section[];
    intensity: Float32Array;
    intensityRate: number;
}

// ---------------------------------------------------------------------------
// Stage 1: envelopes
// ---------------------------------------------------------------------------

class Cascade {
    private readonly stages: Biquad[];
    private readonly z1: Float64Array;
    private readonly z2: Float64Array;

    constructor(stages: Biquad[]) {
        this.stages = stages;
        this.z1 = new Float64Array(stages.length);
        this.z2 = new Float64Array(stages.length);
    }

    process(input: Float32Array, out: Float32Array): void {
        let src = input;
        for (let s = 0; s < this.stages.length; s++) {
            const { b0, b1, b2, a1, a2 } = this.stages[s];
            let z1 = this.z1[s];
            let z2 = this.z2[s];
            for (let i = 0; i < src.length; i++) {
                const xi = src[i];
                const y = b0 * xi + z1;
                z1 = b1 * xi - a1 * y + z2;
                z2 = b2 * xi - a2 * y;
                out[i] = y;
            }
            this.z1[s] = z1;
            this.z2[s] = z2;
            src = out;
        }
    }
}

/** Accumulates squared samples into analysis frames. */
class EnergyAccumulator {
    readonly sums: Float64Array;
    readonly counts: Float64Array;
    constructor(frames: number, private readonly samplesPerFrame: number) {
        this.sums = new Float64Array(frames);
        this.counts = new Float64Array(frames);
    }
    add(chunk: Float32Array, startIndex: number): void {
        const spf = this.samplesPerFrame;
        const n = this.sums.length;
        for (let i = 0; i < chunk.length; i++) {
            const f = Math.floor((startIndex + i) / spf);
            if (f >= n) break;
            const v = chunk[i];
            this.sums[f] += v * v;
            this.counts[f] += 1;
        }
    }
    /** dB of the mean square over a 3-frame window. */
    toDb(): Float32Array {
        const n = this.sums.length;
        const out = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            let s = this.sums[i];
            let c = this.counts[i];
            if (i > 0) {
                s += this.sums[i - 1];
                c += this.counts[i - 1];
            }
            if (i < n - 1) {
                s += this.sums[i + 1];
                c += this.counts[i + 1];
            }
            out[i] = 10 * Math.log10(c > 0 ? s / c + 1e-12 : 1e-12);
        }
        return out;
    }
}

function normalise(db: Float32Array, active: Uint8Array, range = 36): Float32Array {
    const vals: number[] = [];
    for (let i = 0; i < db.length; i++) if (active[i]) vals.push(db[i]);
    const hi = percentile(vals, 0.99);
    const lo = Math.max(percentile(vals, 0.05), hi - range);
    const span = Math.max(1e-3, hi - lo);
    const out = new Float32Array(db.length);
    for (let i = 0; i < db.length; i++) out[i] = clamp((db[i] - lo) / span);
    return out;
}

export function computeEnvelopes(
    mono: Float32Array,
    sampleRate: number,
    onProgress?: (p: number) => void,
): Envelopes {
    const sr = sampleRate;
    const hop = Math.max(1, Math.round(sr / ENV_RATE));
    const frameRate = sr / hop;
    const frames = Math.max(1, Math.ceil(mono.length / hop));
    const D = sr >= 32000 ? 8 : 4;
    const fsl = sr / D;

    const decim = new Cascade(lowpass4(sr, (sr / (2 * D)) * 0.8));
    const midF = new Cascade([...highpass4(sr, 1000), ...lowpass4(sr, 4000)]);
    const highF = new Cascade(highpass4(sr, 4000));
    const kickF = new Cascade([...highpass4(fsl, 30), ...lowpass4(fsl, 150)]);
    const subF = new Cascade(lowpass4(fsl, 60));
    const bassF = new Cascade([...highpass4(fsl, 60), ...lowpass4(fsl, 250)]);
    const lowMidF = new Cascade([...highpass4(fsl, 250), ...lowpass4(fsl, Math.min(1000, fsl * 0.45))]);

    const full = new EnergyAccumulator(frames, hop);
    const mid = new EnergyAccumulator(frames, hop);
    const high = new EnergyAccumulator(frames, hop);
    const hopL = hop / D;
    const kick = new EnergyAccumulator(frames, hopL);
    const sub = new EnergyAccumulator(frames, hopL);
    const bass = new EnergyAccumulator(frames, hopL);
    const lowMid = new EnergyAccumulator(frames, hopL);

    const duration = mono.length / sr;
    const buckets = Math.round(Math.min(8000, Math.max(1200, duration * 12)));
    const amp = new Float32Array(buckets);

    const CHUNK = 1 << 16; // multiple of D
    const tmp = new Float32Array(CHUNK);
    const lowChunk = new Float32Array(CHUNK / D);
    const lowTmp = new Float32Array(CHUNK / D);
    let lowIndex = 0;

    for (let start = 0; start < mono.length; start += CHUNK) {
        const len = Math.min(CHUNK, mono.length - start);
        const x = mono.subarray(start, start + len);

        full.add(x, start);
        for (let i = 0; i < len; i++) {
            const b = Math.min(buckets - 1, Math.floor(((start + i) / mono.length) * buckets));
            const a = Math.abs(x[i]);
            if (a > amp[b]) amp[b] = a;
        }

        const t1 = tmp.subarray(0, len);
        midF.process(x, t1);
        mid.add(t1, start);
        highF.process(x, t1);
        high.add(t1, start);

        decim.process(x, t1);
        // keep samples at absolute indices that are multiples of D
        let ln = 0;
        for (let i = 0; i < len; i++) {
            if ((start + i) % D === 0) lowChunk[ln++] = t1[i];
        }
        const lc = lowChunk.subarray(0, ln);
        const lt = lowTmp.subarray(0, ln);
        kickF.process(lc, lt);
        kick.add(lt, lowIndex);
        subF.process(lc, lt);
        sub.add(lt, lowIndex);
        bassF.process(lc, lt);
        bass.add(lt, lowIndex);
        lowMidF.process(lc, lt);
        lowMid.add(lt, lowIndex);
        lowIndex += ln;

        if (onProgress && (start / CHUNK) % 16 === 0) onProgress(start / mono.length);
    }

    const fullDb = full.toDb();
    const kickDb = kick.toDb();
    const active = new Uint8Array(frames);
    const peakDb = percentile(fullDb, 0.99);
    let activeCount = 0;
    for (let i = 0; i < frames; i++) {
        active[i] = fullDb[i] > Math.max(-70, peakDb - 50) ? 1 : 0;
        activeCount += active[i];
    }
    if (activeCount === 0) active.fill(1);

    const activeFull: number[] = [];
    for (let i = 0; i < frames; i++) if (active[i]) activeFull.push(fullDb[i]);
    const refDb = percentile(activeFull, 0.95);

    const env: Envelopes = {
        sampleRate: sr,
        duration,
        frameRate,
        frames,
        kickDb,
        fullDb,
        sub: normalise(sub.toDb(), active),
        bass: normalise(bass.toDb(), active),
        lowMid: normalise(lowMid.toDb(), active),
        mid: normalise(mid.toDb(), active),
        high: normalise(high.toDb(), active),
        energy: normalise(fullDb, active, 30),
        refDb,
        overview: { buckets, amp, low: new Float32Array(buckets), mid: new Float32Array(buckets), high: new Float32Array(buckets) },
    };

    // colour overview (max per bucket)
    const ov = env.overview;
    let maxAmp = 1e-6;
    for (let i = 0; i < buckets; i++) maxAmp = Math.max(maxAmp, amp[i]);
    for (let i = 0; i < buckets; i++) amp[i] = amp[i] / maxAmp;
    for (let f = 0; f < frames; f++) {
        const b = Math.min(buckets - 1, Math.floor((f / frames) * buckets));
        ov.low[b] = Math.max(ov.low[b], env.bass[f]);
        ov.mid[b] = Math.max(ov.mid[b], env.lowMid[f] * 0.5 + env.mid[f] * 0.5);
        ov.high[b] = Math.max(ov.high[b], env.high[f]);
    }
    onProgress?.(1);
    return env;
}

// ---------------------------------------------------------------------------
// Stage 2: interpretation
// ---------------------------------------------------------------------------

interface KickResult {
    times: Float32Array;
    strength: Float32Array;
}

export function detectKicks(env: Envelopes, sensitivity: number): KickResult {
    const fr = env.frameRate;
    const n = env.frames;
    const db = env.kickDb;
    const sens = clamp(sensitivity);

    const raw = new Float32Array(n);
    for (let i = 2; i < n; i++) raw[i] = Math.max(0, db[i] - db[i - 2]);
    const odf = new Float32Array(n);
    for (let i = 1; i < n - 1; i++) odf[i] = 0.25 * raw[i - 1] + 0.5 * raw[i] + 0.25 * raw[i + 1];

    // Local statistics over +-1 s (prefix sums).
    const L = Math.max(1, Math.round(fr));
    const ps = new Float64Array(n + 1);
    const ps2 = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
        ps[i + 1] = ps[i] + odf[i];
        ps2[i + 1] = ps2[i] + odf[i] * odf[i];
    }

    const activeKick: number[] = [];
    for (let i = 0; i < n; i++) if (env.fullDb[i] > env.refDb - 40) activeKick.push(db[i]);
    const kickRef = percentile(activeKick, 0.95);

    const k = 2.2 - 1.6 * sens;
    const levelRange = 10 + 20 * sens;
    const absMin = 4.0 - 2.5 * sens;
    const W = Math.max(1, Math.round(0.03 * fr));
    const after = Math.max(1, Math.round(0.03 * fr));
    const minGap = 0.07 * fr;

    type Cand = { i: number; v: number; lvl: number };
    const cands: Cand[] = [];
    for (let i = 2; i < n; i++) {
        const v = odf[i];
        if (v < absMin) continue;
        const a = Math.max(0, i - L);
        const b = Math.min(n, i + L + 1);
        const cnt = b - a;
        const mean = (ps[b] - ps[a]) / cnt;
        const varr = Math.max(0, (ps2[b] - ps2[a]) / cnt - mean * mean);
        if (v < mean + k * Math.sqrt(varr)) continue;
        let isMax = true;
        for (let j = Math.max(0, i - W); j <= Math.min(n - 1, i + W); j++) {
            if (j < i ? odf[j] >= v : odf[j] > v) {
                isMax = false;
                break;
            }
        }
        if (!isMax) continue;
        let lvl = -200;
        for (let j = i; j <= Math.min(n - 1, i + after); j++) lvl = Math.max(lvl, db[j]);
        if (lvl < kickRef - levelRange) continue;
        cands.push({ i, v, lvl });
    }

    // Enforce a minimum gap, keeping the stronger candidate.
    const kept: Cand[] = [];
    for (const c of cands) {
        const last = kept[kept.length - 1];
        if (last && c.i - last.i < minGap) {
            if (c.v * (c.lvl - kickRef + 60) > last.v * (last.lvl - kickRef + 60)) kept[kept.length - 1] = c;
        } else {
            kept.push(c);
        }
    }

    const vRef = Math.max(1e-3, percentile(kept.map((c) => c.v), 0.9));
    const times = new Float32Array(kept.length);
    const strength = new Float32Array(kept.length);
    kept.forEach((c, idx) => {
        times[idx] = Math.max(0, (c.i - 3) / fr);
        const lv = clamp((c.lvl - (kickRef - levelRange)) / levelRange);
        strength[idx] = clamp(0.55 * lv + 0.45 * clamp(c.v / vRef), 0.1, 1);
    });
    return { times, strength };
}

export interface TempoEstimate {
    bpm: number;
    phase: number; // time of a beat, in [0, period)
    confidence: number;
}

function resultant(times: Float32Array, weights: Float32Array, period: number): { r: number; phase: number } {
    let c = 0;
    let s = 0;
    let wsum = 0;
    const w2 = (2 * Math.PI) / period;
    for (let i = 0; i < times.length; i++) {
        const a = times[i] * w2;
        c += weights[i] * Math.cos(a);
        s += weights[i] * Math.sin(a);
        wsum += weights[i];
    }
    const r = wsum > 0 ? Math.sqrt(c * c + s * s) / wsum : 0;
    let ang = Math.atan2(s, c);
    if (ang < 0) ang += 2 * Math.PI;
    return { r, phase: (ang / (2 * Math.PI)) * period };
}

export function estimateTempo(
    times: Float32Array,
    strength: Float32Array,
    minBpm: number,
    maxBpm: number,
    bpmOverride: number | null,
): TempoEstimate | null {
    if (bpmOverride && bpmOverride > 0) {
        const period = 60 / bpmOverride;
        if (times.length === 0) return { bpm: bpmOverride, phase: 0, confidence: 0 };
        const { r, phase } = resultant(times, strength, period);
        return { bpm: bpmOverride, phase, confidence: r };
    }
    if (times.length < 8) return null;

    // Inter-onset interval histogram in BPM space (0.25 BPM bins).
    const binW = 0.25;
    const nb = Math.ceil((maxBpm - minBpm) / binW) + 1;
    const hist = new Float32Array(nb);
    for (let i = 0; i + 1 < times.length; i++) {
        const ioi = times[i + 1] - times[i];
        if (ioi <= 0) continue;
        const bpm = 60 / ioi;
        if (bpm < minBpm || bpm > maxBpm) continue;
        const w = Math.sqrt(strength[i] * strength[i + 1]);
        hist[Math.round((bpm - minBpm) / binW)] += w;
    }
    const sm = gaussianSmooth(hist, 1 / binW);
    let best = 0;
    for (let i = 1; i < nb; i++) if (sm[i] > sm[best]) best = i;
    if (sm[best] <= 0) return null;
    const bpm0 = minBpm + best * binW;

    // Refine with circular statistics of kick phases.
    let bestBpm = bpm0;
    let bestR = -1;
    let bestPhase = 0;
    const search = (lo: number, hi: number, step: number) => {
        for (let b = lo; b <= hi; b += step) {
            const { r, phase } = resultant(times, strength, 60 / b);
            if (r > bestR) {
                bestR = r;
                bestBpm = b;
                bestPhase = phase;
            }
        }
    };
    search(bpm0 * 0.985, bpm0 * 1.015, 0.01);
    const coarse = bestBpm;
    search(coarse - 0.012, coarse + 0.012, 0.001);

    // Octave check: fast candidates whose kicks are strongly accented on every
    // other beat are really half tempo (e.g. 8th-note bass patterns). Genuine
    // uptempo / terror kicks are evenly weighted and keep the fast tempo.
    if (bestBpm > 165 && bestBpm / 2 >= minBpm) {
        const P = 60 / bestBpm;
        let even = 0;
        let odd = 0;
        for (let i = 0; i < times.length; i++) {
            const k = Math.round((times[i] - bestPhase) / P);
            if (Math.abs(times[i] - bestPhase - k * P) > 0.2 * P) continue;
            if ((k & 1) === 0) even += strength[i];
            else odd += strength[i];
        }
        const total = even + odd;
        const accented = total > 0 && Math.max(even, odd) / total > 0.62;
        const implausible = bestBpm > 230 && bestR < 0.6;
        if (accented || implausible) {
            const half = bestBpm / 2;
            const { r, phase } = resultant(times, strength, 60 / half);
            bestBpm = half;
            bestR = r;
            bestPhase = phase;
        }
    }
    // Snap to a "round" tempo if it is essentially as good (DAW exports are usually integer BPM).
    const rounded = Math.round(bestBpm * 2) / 2;
    if (Math.abs(rounded - bestBpm) < 0.06) {
        const { r, phase } = resultant(times, strength, 60 / rounded);
        if (r > bestR * 0.985) {
            bestBpm = rounded;
            bestR = r;
            bestPhase = phase;
        }
    }
    return { bpm: bestBpm, phase: bestPhase, confidence: Math.max(0, bestR) };
}

/** Dynamic-programming beat tracker (Ellis 2007) for tracks without a steady grid. */
function trackBeatsDP(env: Envelopes, period: number): number[] {
    const fr = env.frameRate;
    const n = env.frames;
    const db = env.kickDb;
    const odf = new Float32Array(n);
    let mean = 0;
    for (let i = 2; i < n; i++) {
        odf[i] = Math.max(0, db[i] - db[i - 2]);
        mean += odf[i];
    }
    mean /= Math.max(1, n);
    let sd = 0;
    for (let i = 0; i < n; i++) sd += (odf[i] - mean) ** 2;
    sd = Math.sqrt(sd / Math.max(1, n)) || 1;
    for (let i = 0; i < n; i++) odf[i] /= sd;

    const p = period * fr;
    const alpha = 80;
    const score = new Float64Array(n);
    const back = new Int32Array(n).fill(-1);
    const lo = Math.round(p / 2);
    const hi = Math.round(p * 2);
    for (let i = 0; i < n; i++) {
        let bestV = -Infinity;
        let bestJ = -1;
        for (let j = i - hi; j <= i - lo; j++) {
            if (j < 0) continue;
            const d = Math.log((i - j) / p);
            const v = score[j] - alpha * d * d;
            if (v > bestV) {
                bestV = v;
                bestJ = j;
            }
        }
        score[i] = odf[i] + (bestJ >= 0 ? bestV : 0);
        back[i] = bestJ;
    }
    let end = Math.max(0, n - Math.round(p));
    for (let i = end; i < n; i++) if (score[i] > score[end]) end = i;
    const beats: number[] = [];
    for (let i = end; i >= 0; i = back[i]) {
        beats.push(i / fr);
        if (back[i] < 0) break;
    }
    beats.reverse();
    return beats;
}

function meanRange(arr: Float32Array | number[], a: number, b: number): number {
    const lo = Math.max(0, a);
    const hi = Math.min(arr.length, b);
    if (hi <= lo) return 0;
    let s = 0;
    for (let i = lo; i < hi; i++) s += arr[i];
    return s / (hi - lo);
}

export function interpret(env: Envelopes, opts: SyncOptions = DEFAULT_SYNC): Interpretation {
    const duration = env.duration;
    const { times: kicks, strength: kickStrength } = detectKicks(env, opts.sensitivity);

    const tempo = estimateTempo(kicks, kickStrength, opts.minBpm, opts.maxBpm, opts.bpmOverride);
    const bpm = tempo?.bpm ?? 120;
    const period = 60 / bpm;
    const offset = opts.beatOffsetMs / 1000;

    let beatList: number[];
    if (tempo && (tempo.confidence >= 0.3 || opts.bpmOverride)) {
        beatList = [];
        let first = tempo.phase + offset;
        while (first - period >= -0.08 * period) first -= period;
        while (first < -0.08 * period) first += period;
        for (let t = first; t < duration; t += period) beatList.push(t);
    } else if (tempo) {
        beatList = trackBeatsDP(env, period).map((t) => t + offset).filter((t) => t >= 0 && t < duration);
    } else {
        beatList = [];
        for (let t = offset >= 0 ? offset : offset + period; t < duration; t += period) beatList.push(t);
    }
    const beats = Float32Array.from(beatList);
    const B = beats.length;

    // Per-beat features.
    const fr = env.frameRate;
    const kickAt = new Float32Array(B);
    const loud = new Float32Array(B);
    let ki = 0;
    for (let b = 0; b < B; b++) {
        const t = beats[b];
        const tol = period * 0.18;
        while (ki < kicks.length && kicks[ki] < t - tol) ki++;
        let s = 0;
        for (let j = ki; j < kicks.length && kicks[j] <= t + tol; j++) s = Math.max(s, kickStrength[j]);
        kickAt[b] = s;
        const fa = Math.floor(t * fr);
        const fb = Math.floor((b + 1 < B ? beats[b + 1] : t + period) * fr);
        loud[b] = meanRange(env.energy, fa, fb);
    }

    // Downbeat: section changes happen on bar starts.
    let downbeat = 0;
    if (B >= 16) {
        const scores = [0, 0, 0, 0];
        for (let b = 4; b < B - 4; b++) {
            const nl = Math.max(0, meanRange(loud, b, b + 4) - meanRange(loud, b - 4, b));
            const nk = Math.max(0, meanRange(kickAt, b, b + 4) - meanRange(kickAt, b - 4, b));
            scores[b % 4] += nl + 0.6 * nk;
        }
        downbeat = scores.indexOf(Math.max(...scores));
    }

    // Bars and sections.
    const barStarts: number[] = [];
    const barKick: boolean[] = [];
    const barLoud: number[] = [];
    for (let b = downbeat; b + 4 <= B; b += 4) {
        barStarts.push(beats[b]);
        let cnt = 0;
        for (let j = 0; j < 4; j++) if (kickAt[b + j] > 0.22) cnt++;
        barKick.push(cnt >= 2);
        barLoud.push(meanRange(loud, b, b + 4));
    }
    const nBars = barStarts.length;
    // Remove single-bar blips (fills / stray hits).
    for (let k = 1; k < nBars - 1; k++) {
        if (barKick[k] !== barKick[k - 1] && barKick[k] !== barKick[k + 1]) barKick[k] = barKick[k - 1];
    }

    const sections: Section[] = [];
    const drops: number[] = [];
    const dropStrength: number[] = [];
    const builds: number[] = [];
    if (nBars < 4) {
        sections.push({ start: 0, end: duration, kind: kicks.length > 4 ? 'main' : 'intro' });
    } else {
        type Run = { a: number; b: number; kick: boolean };
        const runs: Run[] = [];
        for (let k = 0; k < nBars; k++) {
            const last = runs[runs.length - 1];
            if (last && last.kick === barKick[k]) last.b = k + 1;
            else runs.push({ a: k, b: k + 1, kick: barKick[k] });
        }
        const barTime = (k: number) => (k >= nBars ? duration : barStarts[k]);
        runs.forEach((run, ri) => {
            const start = ri === 0 ? 0 : barTime(run.a);
            const end = ri === runs.length - 1 ? duration : barTime(run.b);
            if (run.kick) {
                const prev = runs[ri - 1];
                const isDrop = !!prev && !prev.kick && prev.b - prev.a >= 4;
                if (isDrop) {
                    const after = meanRange(barLoud, run.a, run.a + 8);
                    const before = meanRange(barLoud, Math.max(prev.a, run.a - 8), run.a);
                    const lengthFactor = clamp((run.b - run.a) / 8, 0.4, 1);
                    drops.push(barTime(run.a));
                    dropStrength.push(clamp((0.55 + (after - before) * 1.6) * lengthFactor, 0.3, 1));
                }
                sections.push({ start, end, kind: isDrop ? 'drop' : 'main' });
            } else {
                const kind: SectionKind = ri === 0 ? 'intro' : ri === runs.length - 1 ? 'outro' : 'breakdown';
                const next = runs[ri + 1];
                const leadsToDrop = !!next && next.kick && run.b - run.a >= 4;
                if (leadsToDrop) {
                    const buildBars = Math.min(8, run.b - run.a);
                    const bStart = barTime(run.b - buildBars);
                    if (bStart > start + 0.01) sections.push({ start, end: bStart, kind });
                    sections.push({ start: Math.max(start, bStart), end, kind: 'build' });
                    builds.push(Math.max(start, bStart), end);
                } else {
                    sections.push({ start, end, kind });
                }
            }
        });
    }

    // Intensity curve (20 fps): kick density + loudness.
    const iRate = 20;
    const iN = Math.max(1, Math.ceil(duration * iRate));
    const dens = new Float32Array(iN);
    for (let i = 0; i < kicks.length; i++) {
        const idx = Math.min(iN - 1, Math.floor(kicks[i] * iRate));
        dens[idx] += kickStrength[i];
    }
    const densS = gaussianSmooth(dens, 1.2 * iRate);
    const energyDs = new Float32Array(iN);
    for (let i = 0; i < iN; i++) energyDs[i] = meanRange(env.energy, Math.floor((i / iRate) * fr), Math.floor(((i + 1) / iRate) * fr));
    const energyS = gaussianSmooth(energyDs, 1.0 * iRate);
    const expected = (bpm / 60) / iRate; // kicks per intensity frame at one kick per beat
    const intensity = new Float32Array(iN);
    for (let i = 0; i < iN; i++) {
        const kd = clamp(densS[i] / (expected * 0.85));
        intensity[i] = clamp(0.08 + 0.6 * kd + 0.32 * energyS[i] * energyS[i]);
    }

    return {
        kicks,
        kickStrength,
        bpm,
        detectedBpm: tempo && !opts.bpmOverride ? tempo.bpm : estimateTempo(kicks, kickStrength, opts.minBpm, opts.maxBpm, null)?.bpm ?? bpm,
        bpmConfidence: tempo?.confidence ?? 0,
        beats,
        downbeat,
        drops: Float32Array.from(drops),
        dropStrength: Float32Array.from(dropStrength),
        builds: Float32Array.from(builds),
        sections,
        intensity,
        intensityRate: iRate,
    };
}

/** Convenience for tests / one-shot use. */
export function analyzeMono(mono: Float32Array, sampleRate: number, opts: SyncOptions = DEFAULT_SYNC) {
    const env = computeEnvelopes(mono, sampleRate);
    return { env, interp: interpret(env, opts) };
}

