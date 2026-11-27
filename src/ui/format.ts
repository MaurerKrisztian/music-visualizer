export function formatTime(t: number, tenths = false): string {
    if (!Number.isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const base = `${m}:${s.toString().padStart(2, '0')}`;
    return tenths ? `${base}.${Math.floor((t % 1) * 10)}` : base;
}

export function formatBytes(b: number): string {
    if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
    if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
    if (b >= 1e3) return `${(b / 1e3).toFixed(0)} KB`;
    return `${b} B`;
}

export function parseTime(s: string): number | null {
    const m = /^\s*(?:(\d+):)?(\d+(?:\.\d+)?)\s*$/.exec(s);
    if (!m) return null;
    return (m[1] ? parseInt(m[1], 10) * 60 : 0) + parseFloat(m[2]);
}
