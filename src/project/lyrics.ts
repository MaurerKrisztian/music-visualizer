// SRT and LRC lyric/subtitle parsing.

export interface LyricCue {
    start: number;
    end: number;
    text: string;
}

function srtTime(s: string): number {
    const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(s);
    if (!m) return NaN;
    return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, '0').slice(0, 3) / 1000;
}

export function parseSrt(text: string): LyricCue[] {
    const cues: LyricCue[] = [];
    for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
        const lines = block.split('\n').filter((l) => l.trim() !== '');
        const ti = lines.findIndex((l) => l.includes('-->'));
        if (ti < 0) continue;
        const [a, b] = lines[ti].split('-->');
        const start = srtTime(a);
        const end = srtTime(b);
        const body = lines
            .slice(ti + 1)
            .join('\n')
            .replace(/<[^>]+>/g, '')
            .trim();
        if (Number.isFinite(start) && Number.isFinite(end) && body) cues.push({ start, end, text: body });
    }
    return cues.sort((x, y) => x.start - y.start);
}

export function parseLrc(text: string): LyricCue[] {
    const stamps: { t: number; text: string }[] = [];
    let offset = 0;
    for (const raw of text.replace(/\r/g, '').split('\n')) {
        const off = /^\[offset:\s*([+-]?\d+)\]/i.exec(raw);
        if (off) offset = +off[1] / 1000;
        const times = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
        if (!times.length) continue;
        const body = raw.replace(/\[[^\]]*\]/g, '').replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim();
        for (const m of times) stamps.push({ t: +m[1] * 60 + +m[2], text: body });
    }
    stamps.sort((a, b) => a.t - b.t);
    const cues: LyricCue[] = [];
    for (let i = 0; i < stamps.length; i++) {
        if (!stamps[i].text) continue;
        const next = stamps[i + 1]?.t ?? stamps[i].t + 4;
        const start = Math.max(0, stamps[i].t - offset);
        cues.push({ start, end: Math.min(next - offset, start + 8), text: stamps[i].text });
    }
    return cues;
}

export function parseLyrics(name: string, text: string): LyricCue[] {
    if (/\.lrc$/i.test(name) || (/^\s*\[\d+:\d+/m.test(text) && !text.includes('-->'))) return parseLrc(text);
    return parseSrt(text);
}

export function activeCue(cues: LyricCue[], t: number): LyricCue | null {
    for (const c of cues) {
        if (t >= c.start && t < c.end) return c;
        if (c.start > t) break;
    }
    return null;
}
