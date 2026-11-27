// Per-frame audio features. Everything is derived from the decoded samples and
// the offline analysis at an explicit time t, so live preview and offline
// export see exactly the same values.

import type { Envelopes, Interpretation, SectionKind } from './analysis';
import { lastIndexAtOrBefore } from './dsp';
import { extractWave, SpectrumAnalyzer, type SpectrumOptions } from './spectrum';

export interface AudioSource {
    channels: Float32Array[];
    sampleRate: number;
    duration: number;
}

export interface ReactOptions {
    spectrum: SpectrumOptions;
    /** Seconds for a bar to fall back; attack is always fast. */
    spectrumRelease: number;
    /** Seconds for the kick pulse to decay. */
    kickDecay: number;
    /** Seconds for the band envelopes to fall back. */
    bandRelease: number;
}

export const DEFAULT_REACT: ReactOptions = {
    spectrum: { bars: 96, minHz: 30, maxHz: 16000, gainDb: 0, rangeDb: 60, tiltDb: 3 },
    spectrumRelease: 0.16,
    kickDecay: 0.2,
    bandRelease: 0.15,
};

export const WAVE_POINTS = 512;
export const KICK_SLOTS = 4;

export interface Features {
    time: number;
    dt: number;
    duration: number;
    progress: number;
    spectrum: Float32Array;
    /** Falling peak-hold values per bar (for peak caps). */
    peaks: Float32Array;
    wave: Float32Array;
    waveR: Float32Array;
    sub: number;
    bass: number;
    lowMid: number;
    mid: number;
    high: number;
    energy: number;
    /** Decaying kick pulse 0..1. */
    kick: number;
    kickAge: number;
    /** Strength of kicks that happened during this frame (0 if none). */
    kickHit: number;
    /** [age, strength] x KICK_SLOTS of the most recent kicks (age 99 if none). */
    recentKicks: Float32Array;
    bpm: number;
    beatPhase: number;
    beatIndex: number;
    barPhase: number;
    barIndex: number;
    /** Pulse on every grid beat (keeps breathing in breakdowns). */
    beatPulse: number;
    intensity: number;
    drop: number;
    dropAge: number;
    dropHit: number;
    build: number;
    section: SectionKind;
    /**
     * 0..1 weight of the "drop scene": 1 inside drop/main (kick) sections with
     * a short fade at the boundaries. Deterministic in time (no state).
     */
    hot: number;
    /** Number of drops at or before t (for palette hue jumps). */
    dropCount: number;
    /** Integral of the energy envelope up to t (seconds), drives "speed up with the music". */
    travel: number;
    /** Integral of the kick pulses up to t, gives a surge on every kick. */
    kickTravel: number;
}

const TRAVEL_TAU = 0.25;

function smoothTo(prev: number, target: number, dt: number, attack: number, release: number): number {
    const tau = target > prev ? attack : release;
    const k = 1 - Math.exp(-dt / Math.max(1e-4, tau));
    return prev + (target - prev) * k;
}

function sampleArray(arr: Float32Array, rate: number, t: number): number {
    const x = t * rate;
    const i = Math.floor(x);
    if (i < 0) return arr[0] ?? 0;
    if (i >= arr.length - 1) return arr[arr.length - 1] ?? 0;
    const f = x - i;
    return arr[i] * (1 - f) + arr[i + 1] * f;
}

export class FeatureExtractor {
    private readonly analyzer: SpectrumAnalyzer;
    private rawSpectrum = new Float32Array(DEFAULT_REACT.spectrum.bars);
    private peakAge = new Float32Array(DEFAULT_REACT.spectrum.bars);
    private readonly f: Features;
    private lastT = -1;
    private env: Envelopes | null = null;
    private interp: Interpretation | null = null;

    constructor(private readonly audio: AudioSource) {
        this.analyzer = new SpectrumAnalyzer(audio.sampleRate);
        this.f = {
            time: 0,
            dt: 0,
            duration: audio.duration,
            progress: 0,
            spectrum: new Float32Array(DEFAULT_REACT.spectrum.bars),
            peaks: new Float32Array(DEFAULT_REACT.spectrum.bars),
            wave: new Float32Array(WAVE_POINTS),
            waveR: new Float32Array(WAVE_POINTS),
            sub: 0,
            bass: 0,
            lowMid: 0,
            mid: 0,
            high: 0,
            energy: 0,
            kick: 0,
            kickAge: 99,
            kickHit: 0,
            recentKicks: new Float32Array(KICK_SLOTS * 2),
            bpm: 120,
            beatPhase: 0,
            beatIndex: 0,
            barPhase: 0,
            barIndex: 0,
            beatPulse: 0,
            intensity: 0.5,
            drop: 0,
            dropAge: 99,
            dropHit: 0,
            build: 0,
            section: 'main',
            hot: 1,
            dropCount: 0,
            travel: 0,
            kickTravel: 0,
        };
    }

    private energyPrefix: Float64Array | null = null;
    private kickPrefix: Float64Array | null = null;

    setAnalysis(env: Envelopes | null, interp: Interpretation | null): void {
        this.env = env;
        this.interp = interp;
        this.energyPrefix = null;
        this.kickPrefix = null;
        if (env) {
            const pre = new Float64Array(env.frames + 1);
            for (let i = 0; i < env.frames; i++) pre[i + 1] = pre[i] + env.energy[i] / env.frameRate;
            this.energyPrefix = pre;
        }
        if (interp) {
            const pre = new Float64Array(interp.kicks.length + 1);
            for (let i = 0; i < interp.kicks.length; i++) pre[i + 1] = pre[i] + interp.kickStrength[i] * TRAVEL_TAU;
            this.kickPrefix = pre;
        }
    }

    reset(): void {
        this.lastT = -1;
    }

    compute(t: number, dt: number, o: ReactOptions = DEFAULT_REACT): Features {
        const f = this.f;
        const jumped = this.lastT < 0 || t < this.lastT - 1e-4 || t - this.lastT > 0.5;
        const sdt = jumped ? 10 : Math.max(1e-4, dt);
        f.time = t;
        f.dt = dt;
        f.duration = this.audio.duration;
        f.progress = this.audio.duration > 0 ? Math.min(1, Math.max(0, t / this.audio.duration)) : 0;

        // spectrum
        const bars = o.spectrum.bars;
        if (f.spectrum.length !== bars) {
            f.spectrum = new Float32Array(bars);
            f.peaks = new Float32Array(bars);
            this.peakAge = new Float32Array(bars);
            this.rawSpectrum = new Float32Array(bars);
        }
        const center = t * this.audio.sampleRate;
        this.analyzer.compute(this.audio.channels, center, o.spectrum, this.rawSpectrum);
        for (let i = 0; i < bars; i++) {
            const v = smoothTo(f.spectrum[i], this.rawSpectrum[i], sdt, 0.012, o.spectrumRelease);
            f.spectrum[i] = v;
            // peak caps: hold for a moment, then fall with gravity
            if (jumped || v >= f.peaks[i]) {
                f.peaks[i] = v;
                this.peakAge[i] = 0;
            } else {
                this.peakAge[i] += dt;
                if (this.peakAge[i] > 0.25) f.peaks[i] = Math.max(v, f.peaks[i] - (this.peakAge[i] - 0.25) * 2.2 * dt);
            }
        }
        extractWave(this.audio.channels, center, Math.round(this.audio.sampleRate * 0.03), f.wave, f.waveR);

        const env = this.env;
        const it = this.interp;
        if (env) {
            const r = env.frameRate;
            f.sub = smoothTo(f.sub, sampleArray(env.sub, r, t), sdt, 0.015, o.bandRelease);
            f.bass = smoothTo(f.bass, sampleArray(env.bass, r, t), sdt, 0.015, o.bandRelease);
            f.lowMid = smoothTo(f.lowMid, sampleArray(env.lowMid, r, t), sdt, 0.015, o.bandRelease);
            f.mid = smoothTo(f.mid, sampleArray(env.mid, r, t), sdt, 0.015, o.bandRelease);
            f.high = smoothTo(f.high, sampleArray(env.high, r, t), sdt, 0.01, o.bandRelease * 0.8);
            f.energy = smoothTo(f.energy, sampleArray(env.energy, r, t), sdt, 0.03, 0.3);
        }

        f.kickHit = 0;
        f.dropHit = 0;
        if (env && this.energyPrefix) {
            const x = Math.max(0, Math.min(env.frames, t * env.frameRate));
            const i = Math.floor(x);
            const a = this.energyPrefix[i];
            const b = this.energyPrefix[Math.min(env.frames, i + 1)];
            f.travel = a + (b - a) * (x - i);
        } else {
            f.travel = t * 0.5;
        }
        if (it) {
            // kicks
            const ki = lastIndexAtOrBefore(it.kicks, t);
            let kick = 0;
            for (let s = 0; s < KICK_SLOTS; s++) {
                const idx = ki - s;
                if (idx >= 0) {
                    const age = t - it.kicks[idx];
                    f.recentKicks[s * 2] = age;
                    f.recentKicks[s * 2 + 1] = it.kickStrength[idx];
                    kick = Math.max(kick, it.kickStrength[idx] * Math.exp(-age / Math.max(0.02, o.kickDecay)));
                } else {
                    f.recentKicks[s * 2] = 99;
                    f.recentKicks[s * 2 + 1] = 0;
                }
            }
            f.kick = kick;
            f.kickAge = ki >= 0 ? t - it.kicks[ki] : 99;
            if (this.kickPrefix && ki >= 0) {
                let kt = this.kickPrefix[ki + 1];
                for (let idx = ki; idx >= 0 && idx > ki - 12; idx--) {
                    kt -= it.kickStrength[idx] * TRAVEL_TAU * Math.exp(-(t - it.kicks[idx]) / TRAVEL_TAU);
                }
                f.kickTravel = kt;
            } else {
                f.kickTravel = 0;
            }
            if (!jumped) {
                for (let idx = ki; idx >= 0 && it.kicks[idx] > this.lastT; idx--) f.kickHit = Math.max(f.kickHit, it.kickStrength[idx]);
            }

            // beat grid
            f.bpm = it.bpm;
            const bi = lastIndexAtOrBefore(it.beats, t);
            if (bi >= 0) {
                const b0 = it.beats[bi];
                const b1 = bi + 1 < it.beats.length ? it.beats[bi + 1] : b0 + 60 / it.bpm;
                f.beatPhase = Math.min(0.9999, (t - b0) / Math.max(1e-3, b1 - b0));
                f.beatIndex = bi;
                const rel = bi - it.downbeat;
                const inBar = ((rel % 4) + 4) % 4;
                f.barIndex = Math.floor(rel / 4);
                f.barPhase = (inBar + f.beatPhase) / 4;
                f.beatPulse = Math.exp((-(t - b0) / Math.max(0.05, o.kickDecay)) * 1.2);
            } else {
                const p = 60 / it.bpm;
                const first = it.beats[0] ?? 0;
                const x = (t - first) / p;
                f.beatPhase = ((x % 1) + 1) % 1;
                f.beatIndex = Math.floor(x);
                f.barPhase = ((((x / 4) % 1) + 1) % 1);
                f.barIndex = Math.floor(x / 4);
                f.beatPulse = 0;
            }

            // intensity
            f.intensity = smoothTo(f.intensity, sampleArray(it.intensity, it.intensityRate, t), sdt, 0.4, 0.8);

            // drops
            const di = lastIndexAtOrBefore(it.drops, t);
            f.dropCount = di + 1;
            if (di >= 0) {
                f.dropAge = t - it.drops[di];
                f.drop = it.dropStrength[di] * Math.exp(-f.dropAge / 1.6);
                if (!jumped && it.drops[di] > this.lastT) f.dropHit = it.dropStrength[di];
            } else {
                f.dropAge = 99;
                f.drop = 0;
            }

            // build-ups
            let build = 0;
            for (let i = 0; i + 1 < it.builds.length; i += 2) {
                const a = it.builds[i];
                const b = it.builds[i + 1];
                if (t >= a && t < b) build = Math.pow((t - a) / Math.max(1e-3, b - a), 1.6);
            }
            f.build = build;

            let section: SectionKind = 'main';
            let hot = 0;
            const isHot = (k: SectionKind) => k === 'drop' || k === 'main';
            for (let i = 0; i < it.sections.length; i++) {
                const s = it.sections[i];
                if (t >= s.start && t < s.end) {
                    section = s.kind;
                    const fadeIn = 0.12;
                    const fadeOut = 0.45;
                    if (isHot(s.kind)) {
                        const prevHot = i > 0 && isHot(it.sections[i - 1].kind);
                        hot = prevHot ? 1 : Math.min(1, (t - s.start) / fadeIn);
                    } else {
                        const prevHot = i > 0 && isHot(it.sections[i - 1].kind);
                        hot = prevHot ? Math.max(0, 1 - (t - s.start) / fadeOut) : 0;
                    }
                    break;
                }
            }
            f.section = section;
            f.hot = hot;
        } else {
            f.kick = 0;
            f.kickAge = 99;
            f.recentKicks.fill(0);
            for (let s = 0; s < KICK_SLOTS; s++) f.recentKicks[s * 2] = 99;
            f.intensity = 0.6;
            f.drop = 0;
            f.build = 0;
            f.dropCount = 0;
            f.kickTravel = 0;
            f.hot = 1;
        }

        this.lastT = t;
        return f;
    }
}
