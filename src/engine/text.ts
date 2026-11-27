// Renders text blocks (title, lyrics) with Canvas2D (letter spacing, stroke,
// baked glow) and uploads them as premultiplied textures.

import type { GL } from './gl';
import type { Project } from '../project/types';

export interface TextBlock {
    texture: WebGLTexture;
    /** half extents in centred units (1 = shorter screen side) */
    halfW: number;
    halfH: number;
    /** anchor in relative position units (-1..1 of the half screen) */
    cx: number;
    cy: number;
    /** horizontal shift for left/right alignment, in centred units */
    shift: number;
    glyphs: Glyphs;
}

export const MAX_GLYPHS = 64;

/**
 * Per-letter boxes for kinetic typography. Boxes partition the texture
 * (no overlaps), in canvas uv (y down): A = (u0, u1, v0, v1),
 * B = (index in line, line index, letters in line, seed).
 */
export interface Glyphs {
    a: Float32Array;
    b: Float32Array;
    count: number;
    texW: number;
    texH: number;
    lineH: number;
}

interface Line {
    text: string;
    /** size relative to the shorter screen side */
    size: number;
    color: string;
}

interface Style {
    font: string;
    weight: string;
    spacing: number;
    glow: number;
    stroke: number;
    strokeColor: string;
    align: 'left' | 'center' | 'right';
}

function hexToRgba(hex: string, a: number): string {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

class TextTexture {
    private readonly canvas: HTMLCanvasElement | OffscreenCanvas;
    private readonly ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    readonly texture: WebGLTexture;
    private key = '';
    private size: { w: number; h: number; res: number } | null = null;
    readonly glyphs: Glyphs = { a: new Float32Array(MAX_GLYPHS * 4), b: new Float32Array(MAX_GLYPHS * 4), count: 0, texW: 1, texH: 1, lineH: 1 };

    constructor(private readonly gl: GL) {
        this.canvas = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(4, 4);
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
        this.texture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    /** Returns half extents in centred units. */
    render(lines: Line[], style: Style, minDim: number, oversample: number, extraKey: string): { halfW: number; halfH: number } {
        const res = minDim * oversample;
        const key = JSON.stringify([lines, style, Math.round(res), extraKey]);
        if (key !== this.key || !this.size) {
            this.key = key;
            this.draw(lines, style, res);
        }
        const { w, h } = this.size!;
        return { halfW: w / res / 2, halfH: h / res / 2 };
    }

    private draw(lines: Line[], st: Style, res: number): void {
        const ctx = this.ctx;
        const maxPx = Math.max(...lines.map((l) => l.size * res), 4);
        const glow = st.glow * maxPx * 0.5;
        const stroke = st.stroke * maxPx * 0.08;
        const pad = Math.ceil(glow * 2.2 + stroke + maxPx * 0.15);
        const measured = lines.map((l) => {
            const px = Math.max(4, l.size * res);
            const font = `${st.weight} ${px}px "${st.font}", sans-serif`;
            ctx.font = font;
            const chars = Array.from(l.text);
            const widths = chars.map((c) => ctx.measureText(c).width);
            let w = 0;
            for (let i = 0; i < chars.length; i++) w += widths[i] + (i < chars.length - 1 ? st.spacing * px : 0);
            return { ...l, px, font, chars, widths, w, h: px * 1.15 };
        });
        const gap = maxPx * 0.25;
        const contentW = Math.max(...measured.map((m) => m.w), 1);
        const contentH = measured.reduce((a, m) => a + m.h, 0) + gap * Math.max(0, measured.length - 1);
        const W = Math.min(8192, Math.ceil(contentW + pad * 2));
        const H = Math.min(4096, Math.ceil(contentH + pad * 2));
        this.canvas.width = W;
        this.canvas.height = H;
        ctx.clearRect(0, 0, W, H);
        ctx.textBaseline = 'middle';
        const lineTop: number[] = [];
        const lineXs: number[][] = [];
        let y = pad;
        for (const m of measured) {
            lineTop.push(y);
            ctx.font = m.font;
            let x = st.align === 'left' ? pad : st.align === 'right' ? W - pad - m.w : (W - m.w) / 2;
            const xs: number[] = [];
            for (let i = 0; i < m.chars.length; i++) {
                xs.push(x);
                x += m.widths[i] + st.spacing * m.px;
            }
            lineXs.push(xs);
            const cy = y + m.h / 2;
            const pass = (fn: (c: string, xx: number) => void) => m.chars.forEach((c, i) => fn(c, xs[i]));
            if (glow > 0.5) {
                ctx.save();
                ctx.shadowColor = hexToRgba(m.color, 0.9);
                ctx.shadowBlur = glow;
                ctx.fillStyle = hexToRgba(m.color, 0.9);
                pass((c, xx) => ctx.fillText(c, xx, cy));
                ctx.restore();
            }
            if (stroke > 0.2) {
                ctx.lineJoin = 'round';
                ctx.lineWidth = stroke * 2;
                ctx.strokeStyle = st.strokeColor;
                pass((c, xx) => ctx.strokeText(c, xx, cy));
            }
            ctx.fillStyle = m.color;
            pass((c, xx) => ctx.fillText(c, xx, cy));
            y += m.h + gap;
        }
        // glyph boxes: split the texture at the midpoints between letters and lines
        const g = this.glyphs;
        let count = 0;
        let overflow = false;
        measured.forEach((m, li) => {
            const top = li === 0 ? 0 : (lineTop[li - 1] + measured[li - 1].h + lineTop[li]) / 2;
            const bottom = li === measured.length - 1 ? H : (lineTop[li] + m.h + lineTop[li + 1]) / 2;
            const xs = lineXs[li];
            const vis: number[] = [];
            m.chars.forEach((c, i) => {
                if (c.trim()) vis.push(i);
            });
            vis.forEach((ci, k) => {
                if (count >= MAX_GLYPHS) {
                    overflow = true;
                    return;
                }
                const left = k === 0 ? 0 : (xs[vis[k - 1]] + m.widths[vis[k - 1]] + xs[ci]) / 2;
                const right = k === vis.length - 1 ? W : (xs[ci] + m.widths[ci] + xs[vis[k + 1]]) / 2;
                const o = count * 4;
                g.a[o] = left / W;
                g.a[o + 1] = right / W;
                g.a[o + 2] = top / H;
                g.a[o + 3] = bottom / H;
                g.b[o] = k;
                g.b[o + 1] = li;
                g.b[o + 2] = vis.length;
                g.b[o + 3] = ((count * 0.6180339 + li * 0.37) % 1) + 0.001;
                count++;
            });
        });
        g.count = overflow ? 0 : count;
        g.texW = W;
        g.texH = H;
        g.lineH = measured[0]?.h ?? 1;

        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas as TexImageSource);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        this.size = { w: W, h: H, res };
    }

    dispose(): void {
        this.gl.deleteTexture(this.texture);
    }
}

export class TextRenderer {
    private readonly title: TextTexture;
    private readonly lyric: TextTexture;

    constructor(gl: GL) {
        this.title = new TextTexture(gl);
        this.lyric = new TextTexture(gl);
    }

    update(t: Project['text'], meta: Project['meta'], minDim: number, fontWeight: string, fontsVersion: number, oversample = 1): TextBlock | null {
        const line1 = (t.uppercase ? meta.artist.toUpperCase() : meta.artist).trim();
        const line2 = (t.uppercase ? meta.title.toUpperCase() : meta.title).trim();
        if (!t.enabled || (!line1 && !line2)) return null;
        const lines: Line[] = [];
        if (line1) lines.push({ text: line1, size: t.size, color: t.color });
        if (line2) lines.push({ text: line2, size: t.size * t.subSize, color: t.subColor });
        const { halfW, halfH } = this.title.render(
            lines,
            { font: t.font, weight: fontWeight, spacing: t.spacing, glow: t.glow, stroke: t.stroke, strokeColor: t.strokeColor, align: t.align },
            minDim,
            oversample,
            String(fontsVersion),
        );
        const shift = t.align === 'left' ? halfW : t.align === 'right' ? -halfW : 0;
        return { texture: this.title.texture, halfW, halfH, cx: t.x, cy: t.y, shift, glyphs: this.title.glyphs };
    }

    /** Lyric / subtitle line(s) using the title font. */
    updateLyric(text: string, ly: Project['lyrics'], t: Project['text'], minDim: number, fontWeight: string, fontsVersion: number): TextBlock {
        const lines: Line[] = (ly.uppercase ? text.toUpperCase() : text).split('\n').map((l) => ({ text: l.trim(), size: ly.size, color: ly.color }));
        const { halfW, halfH } = this.lyric.render(
            lines,
            { font: t.font, weight: fontWeight, spacing: Math.min(t.spacing, 0.12), glow: ly.glow, stroke: 0.25, strokeColor: '#000000', align: 'center' },
            minDim,
            1,
            String(fontsVersion),
        );
        return { texture: this.lyric.texture, halfW, halfH, cx: 0, cy: ly.y, shift: 0, glyphs: this.lyric.glyphs };
    }

    dispose(): void {
        this.title.dispose();
        this.lyric.dispose();
    }
}
