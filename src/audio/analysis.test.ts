import { describe, expect, it } from 'vitest';
import { analyzeMono, DEFAULT_SYNC } from './analysis';
import { synthTrack, type SynthPart } from './synth';

function matchKicks(detected: Float32Array, truth: number[], tol = 0.025) {
    let hit = 0;
    let j = 0;
    const used = new Set<number>();
    for (const t of truth) {
        while (j < detected.length && detected[j] < t - tol) j++;
        for (let k = j; k < detected.length && detected[k] <= t + tol; k++) {
            if (!used.has(k)) {
                used.add(k);
                hit++;
                break;
            }
        }
    }
    return { recall: hit / truth.length, precision: detected.length ? used.size / detected.length : 0 };
}

const hardstyle: SynthPart[] = [
    { bars: 8, kicks: true, hats: true },
    { bars: 8, kicks: false, pads: true },
    { bars: 8, kicks: false, pads: true, build: true },
    { bars: 16, kicks: true, hats: true, reverseBass: true },
    { bars: 4, kicks: false, pads: true },
];

describe('analysis', () => {
    it('detects hardstyle kicks, tempo and the drop at 150 BPM', () => {
        const s = synthTrack({ bpm: 150, parts: hardstyle });
        const { interp } = analyzeMono(s.mono, s.sampleRate);
        const m = matchKicks(interp.kicks, s.kickTimes);
        expect(m.recall).toBeGreaterThan(0.95);
        expect(m.precision).toBeGreaterThan(0.95);
        expect(Math.abs(interp.bpm - 150)).toBeLessThan(0.2);
        expect(interp.drops.length).toBeGreaterThanOrEqual(1);
        const beat = 60 / 150;
        const nearest = Math.min(...Array.from(interp.drops).map((d) => Math.abs(d - s.dropTimes[0])));
        expect(nearest).toBeLessThan(beat * 1.1);
        expect(interp.builds.length).toBeGreaterThanOrEqual(2);
        // beat grid lines up with the kicks
        const offs = s.kickTimes.slice(0, 16).map((t) => Math.min(...Array.from(interp.beats).map((b) => Math.abs(b - t))));
        expect(Math.max(...offs)).toBeLessThan(0.02);
        // downbeat lands on the drop bar start
        const db = interp.beats[interp.downbeat];
        const barLen = beat * 4;
        const phaseErr = Math.abs((((s.dropTimes[0] - db) / barLen) % 1 + 1) % 1);
        expect(Math.min(phaseErr, 1 - phaseErr)).toBeLessThan(0.05);
    });

    it('handles uptempo (200 BPM) with kick rolls', () => {
        const s = synthTrack({
            bpm: 200,
            kickTail: 0.25,
            parts: [
                { bars: 8, kicks: true, roll: true },
                { bars: 8, kicks: false, pads: true },
                { bars: 16, kicks: true, reverseBass: true },
            ],
        });
        const { interp } = analyzeMono(s.mono, s.sampleRate);
        expect(Math.abs(interp.bpm - 200)).toBeLessThan(0.3);
        const m = matchKicks(interp.kicks, s.kickTimes);
        expect(m.recall).toBeGreaterThan(0.9);
        expect(interp.drops.length).toBeGreaterThanOrEqual(1);
    });

    it('handles rawstyle kicks with tails that run into the next kick', () => {
        const s = synthTrack({
            bpm: 155,
            kickTail: 0.5,
            parts: [
                { bars: 8, kicks: true, hats: true, reverseBass: true, pads: true },
                { bars: 8, kicks: false, pads: true, build: true },
                { bars: 16, kicks: true, hats: true, reverseBass: true, pads: true },
            ],
        });
        const { interp } = analyzeMono(s.mono, s.sampleRate);
        const m = matchKicks(interp.kicks, s.kickTimes);
        expect(m.recall).toBeGreaterThan(0.95);
        expect(Math.abs(interp.bpm - 155)).toBeLessThan(0.2);
        expect(interp.drops.length).toBeGreaterThanOrEqual(1);
    });

    it('handles terror tempo (250 BPM)', () => {
        const s = synthTrack({ bpm: 250, kickTail: 0.2, parts: [{ bars: 32, kicks: true, hats: true }] });
        const { interp } = analyzeMono(s.mono, s.sampleRate);
        expect(Math.abs(interp.bpm - 250)).toBeLessThan(0.5);
    });

    it('works for generic 4/4 music (128 BPM)', () => {
        const s = synthTrack({ bpm: 128, kickTail: 0.2, parts: [{ bars: 16, kicks: true, hats: true, pads: true }] });
        const { interp } = analyzeMono(s.mono, s.sampleRate);
        expect(Math.abs(interp.bpm - 128)).toBeLessThan(0.3);
    });

    it('respects a manual BPM override and offset', () => {
        const s = synthTrack({ bpm: 150, parts: [{ bars: 8, kicks: true }] });
        const { interp } = analyzeMono(s.mono, s.sampleRate, { ...DEFAULT_SYNC, bpmOverride: 75, beatOffsetMs: 10 });
        expect(interp.bpm).toBe(75);
        expect(interp.beats.length).toBeGreaterThan(8);
    });

    it('survives silence and very short input', () => {
        const { interp } = analyzeMono(new Float32Array(44100), 44100);
        expect(interp.kicks.length).toBe(0);
        expect(interp.sections.length).toBeGreaterThan(0);
        const tiny = analyzeMono(new Float32Array(10), 44100);
        expect(tiny.interp.beats.length).toBeGreaterThanOrEqual(0);
    });
});
