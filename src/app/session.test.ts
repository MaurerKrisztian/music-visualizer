import { describe, expect, it, vi } from 'vitest';

vi.mock('../assets/demo.mp3', () => ({ default: 'demo.mp3' }));

describe('parseTrackName', () => {
    it('splits artist and title and strips track numbers', async () => {
        const { parseTrackName } = await import('./session');
        expect(parseTrackName('Headhunterz - Dragonborn.mp3')).toEqual({ artist: 'Headhunterz', title: 'Dragonborn' });
        expect(parseTrackName('01. Artist Name - Track Title (Extended Mix).flac')).toEqual({ artist: 'Artist Name', title: 'Track Title (Extended Mix)' });
        expect(parseTrackName('my_song.wav')).toEqual({ artist: '', title: 'my song' });
    });
});
