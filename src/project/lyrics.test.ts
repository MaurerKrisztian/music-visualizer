import { describe, expect, it } from 'vitest';
import { activeCue, parseLrc, parseLyrics, parseSrt } from './lyrics';

describe('lyrics', () => {
    it('parses SRT', () => {
        const cues = parseSrt(`1\n00:00:01,000 --> 00:00:03,500\nHello <i>world</i>\n\n2\n00:00:04,000 --> 00:00:06,000\nLine A\nLine B\n`);
        expect(cues).toEqual([
            { start: 1, end: 3.5, text: 'Hello world' },
            { start: 4, end: 6, text: 'Line A\nLine B' },
        ]);
    });

    it('parses LRC with multiple stamps and offset', () => {
        const cues = parseLrc(`[ar:Test]\n[offset:+500]\n[00:01.00][00:10.00]Chorus\n[00:05.50]Verse\n`);
        expect(cues.map((c) => c.text)).toEqual(['Chorus', 'Verse', 'Chorus']);
        expect(cues[0].start).toBeCloseTo(0.5);
        expect(cues[0].end).toBeCloseTo(5);
    });

    it('detects the format and finds the active cue', () => {
        const cues = parseLyrics('song.lrc', '[00:02.00]One\n[00:04.00]Two');
        expect(activeCue(cues, 3)?.text).toBe('One');
        expect(activeCue(cues, 1)).toBeNull();
    });
});
