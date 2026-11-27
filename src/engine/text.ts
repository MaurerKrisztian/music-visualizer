// Renders the artist / title block with Canvas2D (letter spacing, stroke,
// baked glow) and uploads it as a premultiplied texture.

import type { GL } from './gl';
import type { Project } from '../project/types';

export interface TextBlock {
    texture: WebGLTexture;
    /** half extents in centred units (1 = shorter screen side) */
    halfW: number;
    halfH: number;
    /** centre of the block in centred units */
    cx: number;
    cy: number;
}

function hexToRgba(hex: string, a: number): string {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export class TextRenderer {
    private readonly canvas: HTMLCanvasElement | OffscreenCanvas;
    private readonly ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    private key = '';
    private block: TextBlock | null = null;
    private readonly texture: WebGLTexture;

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

    update(t: Project['text'], meta: Project['meta'], minDim: number, fontWeight: string, fontsVersion: number): TextBlock | null {
        const line1 = (t.uppercase ? meta.artist.toUpperCase() : meta.artist).trim();
        const line2 = (t.uppercase ? meta.title.toUpperCase() : meta.title).trim();
        if (!t.enabled || (!line1 && !line2)) return null;
        const key = JSON.stringify([line1, line2, t.font, t.size, t.subSize, t.spacing, t.color, t.subColor, t.stroke, t.strokeColor, t.glow, t.align, t.x, t.y, Math.round(minDim), fontWeight, fontsVersion]);
        if (key === this.key && this.block) return this.block;
        this.key = key;

        const ctx = this.ctx;
        const px1 = Math.max(4, t.size * minDim);
        const px2 = Math.max(4, px1 * t.subSize);
        const glow = t.glow * px1 * 0.5;
        const stroke = t.stroke * px1 * 0.08;
        const pad = Math.ceil(glow * 2.2 + stroke + px1 * 0.15);
        const font1 = `${fontWeight} ${px1}px "${t.font}", sans-serif`;
        const font2 = `${fontWeight} ${px2}px "${t.font}", sans-serif`;

        const measure = (text: string, font: string, px: number) => {
            ctx.font = font;
            let w = 0;
            const chars = Array.from(text);
            const widths = chars.map((c) => ctx.measureText(c).width);
            for (let i = 0; i < chars.length; i++) w += widths[i] + (i < chars.length - 1 ? t.spacing * px : 0);
            return { w, chars, widths };
        };
        const m1 = line1 ? measure(line1, font1, px1) : null;
        const m2 = line2 ? measure(line2, font2, px2) : null;
        const gapPx = px1 * 0.28;
        const h1 = m1 ? px1 * 1.1 : 0;
        const h2 = m2 ? px2 * 1.15 : 0;
        const contentW = Math.max(m1?.w ?? 0, m2?.w ?? 0);
        const contentH = h1 + h2 + (m1 && m2 ? gapPx : 0);
        const W = Math.min(8192, Math.ceil(contentW + pad * 2));
        const H = Math.min(4096, Math.ceil(contentH + pad * 2));
        this.canvas.width = W;
        this.canvas.height = H;
        ctx.clearRect(0, 0, W, H);
        ctx.textBaseline = 'middle';

        const drawLine = (m: { w: number; chars: string[]; widths: number[] }, font: string, px: number, cy: number, color: string) => {
            ctx.font = font;
            let x = t.align === 'left' ? pad : t.align === 'right' ? W - pad - m.w : (W - m.w) / 2;
            const xs: number[] = [];
            for (let i = 0; i < m.chars.length; i++) {
                xs.push(x);
                x += m.widths[i] + t.spacing * px;
            }
            const pass = (fn: (c: string, x: number) => void) => m.chars.forEach((c, i) => fn(c, xs[i]));
            if (glow > 0.5) {
                ctx.save();
                ctx.shadowColor = hexToRgba(color, 0.9);
                ctx.shadowBlur = glow;
                ctx.fillStyle = hexToRgba(color, 0.9);
                pass((c, xx) => ctx.fillText(c, xx, cy));
                ctx.restore();
            }
            if (stroke > 0.2) {
                ctx.lineJoin = 'round';
                ctx.lineWidth = stroke * 2;
                ctx.strokeStyle = t.strokeColor;
                pass((c, xx) => ctx.strokeText(c, xx, cy));
            }
            ctx.fillStyle = color;
            pass((c, xx) => ctx.fillText(c, xx, cy));
        };

        let y = pad;
        if (m1) {
            drawLine(m1, font1, px1, y + h1 / 2, t.color);
            y += h1 + (m2 ? gapPx : 0);
        }
        if (m2) drawLine(m2, font2, px2, y + h2 / 2, t.subColor);

        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas as TexImageSource);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

        const halfW = W / minDim / 2;
        const halfH = H / minDim / 2;
        const cx = t.align === 'left' ? t.x + halfW : t.align === 'right' ? t.x - halfW : t.x;
        this.block = { texture: this.texture, halfW, halfH, cx, cy: t.y };
        return this.block;
    }

    dispose(): void {
        this.gl.deleteTexture(this.texture);
    }
}
