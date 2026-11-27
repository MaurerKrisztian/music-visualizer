// Procedural hard-dance track synthesiser. Used by the unit tests to validate
// kick / BPM / drop detection against known ground truth, and handy for
// generating test material. Pure TS, no DOM.

import { mulberry32 } from './dsp';

export interface SynthPart {
    bars: number;
    kicks: boolean;
    pads?: boolean;
    build?: boolean;
    hats?: boolean;
    reverseBass?: boolean;
    /** Kick rolls (16ths) in the last bar of the part. */
    roll?: boolean;
}

export interface SynthOptions {
    bpm: number;
    sampleRate?: number;
    parts: SynthPart[];
    seed?: number;
    kickTail?: number;
}

export interface SynthResult {
    mono: Float32Array;
    sampleRate: number;
    kickTimes: number[];
    dropTimes: number[];
    duration: number;
}

export function synthTrack(opts: SynthOptions): SynthResult {
    const sr = opts.sampleRate ?? 44100;
    const beat = 60 / opts.bpm;
    const totalBars = opts.parts.reduce((a, p) => a + p.bars, 0);
    const duration = totalBars * 4 * beat + 1;
    const out = new Float32Array(Math.ceil(duration * sr));
    const rnd = mulberry32(opts.seed ?? 7);
    const kickTimes: number[] = [];
    const dropTimes: number[] = [];
    const tail = Math.min(opts.kickTail ?? 0.3, beat * 0.92);

    const addKick = (t0: number, amp: number) => {
        const start = Math.round(t0 * sr);
        const len = Math.round(tail * sr);
        let phase = 0;
        for (let i = 0; i < len && start + i < out.length; i++) {
            const t = i / sr;
            const f = 52 + 190 * Math.exp(-t / 0.02);
            phase += (2 * Math.PI * f) / sr;
            const envA = t < 0.002 ? t / 0.002 : Math.exp(-t / (tail * 0.9));
            const fade = i > len - sr * 0.01 ? (len - i) / (sr * 0.01) : 1;
            let s = Math.sin(phase) * envA;
            s = Math.tanh(5 * s) * 0.75 * fade;
            const click = t < 0.004 ? (rnd() * 2 - 1) * (1 - t / 0.004) * 0.4 : 0;
            out[start + i] += amp * (s + click);
        }
        kickTimes.push(t0);
    };

    const addNoise = (t0: number, dur: number, amp: number, hp: boolean) => {
        const start = Math.round(t0 * sr);
        const len = Math.round(dur * sr);
        let prev = 0;
        for (let i = 0; i < len && start + i < out.length; i++) {
            const t = i / sr;
            const n = rnd() * 2 - 1;
            const v = hp ? n - prev : n;
            prev = n;
            out[start + i] += v * amp * Math.exp(-t / (dur * 0.35));
        }
    };

    const addTone = (t0: number, dur: number, freq: number, amp: number, rise = false) => {
        const start = Math.round(t0 * sr);
        const len = Math.round(dur * sr);
        for (let i = 0; i < len && start + i < out.length; i++) {
            const t = i / sr;
            const e = rise ? Math.pow(t / dur, 2) : Math.min(1, t / 0.05) * Math.min(1, (dur - t) / 0.05);
            out[start + i] += Math.sin(2 * Math.PI * freq * t) * amp * e;
        }
    };

    let bar = 0;
    let prevKicks = true;
    let prevLen = 0;
    for (const part of opts.parts) {
        const t0 = bar * 4 * beat;
        if (part.kicks && !prevKicks && prevLen >= 4) dropTimes.push(t0);
        for (let b = 0; b < part.bars; b++) {
            for (let q = 0; q < 4; q++) {
                const t = t0 + (b * 4 + q) * beat;
                const lastBar = b === part.bars - 1;
                if (part.kicks) {
                    if (part.roll && lastBar && q >= 2) {
                        for (let s = 0; s < 4; s++) addKick(t + (s * beat) / 4, 0.8);
                    } else {
                        addKick(t, 0.9);
                    }
                }
                if (part.hats) addNoise(t + beat / 2, 0.05, 0.12, true);
                if (part.reverseBass) addTone(t + beat * 0.3, beat * 0.45, 55, 0.25, true);
                if (part.build) {
                    const prog = (b * 4 + q) / (part.bars * 4);
                    const div = prog < 0.5 ? 2 : prog < 0.75 ? 4 : 8;
                    for (let s = 0; s < div; s++) addNoise(t + (s * beat) / div, 0.06, 0.15 + 0.25 * prog, true);
                }
            }
            if (part.pads) {
                const tb = t0 + b * 4 * beat;
                const chord = [220, 277.18, 329.63, 110];
                for (const f of chord) addTone(tb, 4 * beat, f, 0.05);
                addTone(tb, 4 * beat, 55, 0.04);
            }
        }
        bar += part.bars;
        prevKicks = part.kicks;
        prevLen = part.bars;
    }

    // normalise to -1 dBFS
    let peak = 1e-9;
    for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
    const g = 0.89 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= g;

    return { mono: out, sampleRate: sr, kickTimes, dropTimes, duration: out.length / sr };
}
