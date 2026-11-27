export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
    let h = (hex || '#000000').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n)) return [0, 0, 0];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: RGB): string {
    const c = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
}

/** Rotates hue by `deg` degrees (keeps saturation/value). */
export function rotateHue([r, g, b]: RGB, deg: number): RGB {
    if (!deg) return [r, g, b];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const v = max;
    const d = max - min;
    const s = max === 0 ? 0 : d / max;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }
    h = (((h + deg / 360) % 1) + 1) % 1;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0:
            return [v, t, p];
        case 1:
            return [q, v, p];
        case 2:
            return [p, v, t];
        case 3:
            return [p, q, v];
        case 4:
            return [t, p, v];
        default:
            return [v, p, q];
    }
}

/** Smooth deterministic 1D noise in [-1, 1] (for camera shake). */
export function noise1(x: number, seed = 0): number {
    const i = Math.floor(x);
    const f = x - i;
    const h = (n: number) => {
        const s = Math.sin((n + seed * 101.3) * 127.1) * 43758.5453;
        return (s - Math.floor(s)) * 2 - 1;
    };
    const u = f * f * (3 - 2 * f);
    return h(i) * (1 - u) + h(i + 1) * u;
}

export function hash1(n: number): number {
    const s = Math.sin(n * 91.345 + 47.853) * 43758.5453;
    return s - Math.floor(s);
}
