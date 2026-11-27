// The render engine. One instance per canvas (the preview and the exporter
// each own one). render() is a pure function of (project, features, time) plus
// a little simulation state (particles, trails), so exports are reproducible.

import type { Features } from '../audio/features';
import { WAVE_POINTS } from '../audio/features';
import type { BackgroundMode, Project } from '../project/types';
import { hash1, hexToRgb, noise1, rotateHue, type RGB } from './color';
import { createDataTexture, createFullscreenVao, FULLSCREEN_VS, pickHdrFormat, Program, RenderTarget, type GL } from './gl';
import { MAX_PARTICLES, ParticleSystem, PARTICLE_STRIDE } from './particles';
import { CENTER_SHADER, CROWD_SHADER, IMAGE_SHADER, PARTICLE_FS, PARTICLE_VS, PROGRESS_SHADER, SPECTRUM_SHADER, TEXT_SHADER } from './shaders/layers';
import { COPY_SHADER, DOWN_SHADER, FEEDBACK_SHADER, FINAL_SHADER, UP_SHADER } from './shaders/post';
import { backgroundShader, OVERLAY_SHADER } from './shaders/scene';
import { TextRenderer } from './text';
import { activeCue } from '../project/lyrics';

export interface ImageSource {
    id: string;
    source: TexImageSource;
    width: number;
    height: number;
}

export interface FrameInfo {
    time: number;
    dt: number;
    /** Fade-in / fade-out are relative to this range (track or export range). */
    rangeStart: number;
    rangeEnd: number;
    frame: number;
}

export interface EngineImages {
    background: ImageSource | null;
    logo: ImageSource | null;
    watermark?: ImageSource | null;
}

export interface EngineOptions {
    preserveDrawingBuffer?: boolean;
    /** Release the GL context on dispose (only for throw-away canvases). */
    loseContextOnDispose?: boolean;
    fontWeight?: (family: string) => string;
    fontsVersion?: () => number;
}

const SPEC_HIST = 32;
const BLOOM_LEVELS = 6;
const STYLE_INDEX: Record<string, number> = {
    'radial-bars': 0,
    'radial-wave': 1,
    'linear-bars': 2,
    'linear-wave': 3,
    oscilloscope: 4,
    'circle-scope': 5,
};
const COLOR_INDEX: Record<string, number> = { palette: 0, reactive: 1, rainbow: 2, mono: 3 };

interface CachedImage {
    tex: WebGLTexture;
    source: TexImageSource;
    w: number;
    h: number;
}

export class Engine {
    readonly gl: GL;
    width = 0;
    height = 0;
    private readonly vao: WebGLVertexArrayObject;
    private readonly scene: RenderTarget;
    private fxA: RenderTarget;
    private fxB: RenderTarget;
    private readonly bloom: RenderTarget[] = [];
    private readonly bgPrograms = new Map<BackgroundMode, Program>();
    private readonly progs: Record<string, Program> = {};
    private specTex: WebGLTexture;
    private specBars = 0;
    private specRow = 0;
    private readonly waveTex: WebGLTexture;
    private readonly waveData = new Float32Array(WAVE_POINTS * 2);
    private readonly particles = new ParticleSystem();
    private readonly particleVao: WebGLVertexArrayObject;
    private readonly particleBuf: WebGLBuffer;
    private readonly text: TextRenderer;
    private readonly images = new Map<string, CachedImage>();
    private readonly blackTex: WebGLTexture;
    private fbValid = false;
    private lost = false;

    constructor(readonly canvas: HTMLCanvasElement | OffscreenCanvas, private readonly opts: EngineOptions = {}) {
        const gl = canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: !!opts.preserveDrawingBuffer,
            powerPreference: 'high-performance',
        }) as GL | null;
        if (!gl) throw new Error('WebGL2 is not available in this browser.');
        this.gl = gl;
        if ('addEventListener' in canvas) {
            canvas.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                this.lost = true;
            });
        }
        gl.getExtension('EXT_color_buffer_float');
        gl.getExtension('OES_texture_float_linear');
        const fmt = pickHdrFormat(gl);
        this.vao = createFullscreenVao(gl);
        this.scene = new RenderTarget(gl, fmt, 4, 4);
        this.fxA = new RenderTarget(gl, fmt, 4, 4);
        this.fxB = new RenderTarget(gl, fmt, 4, 4);
        for (let i = 0; i < BLOOM_LEVELS; i++) this.bloom.push(new RenderTarget(gl, fmt, 4, 4));

        const mk = (name: string, fs: string, vs = FULLSCREEN_VS) => (this.progs[name] = new Program(gl, vs, fs, name));
        mk('overlay', OVERLAY_SHADER);
        mk('spectrum', SPECTRUM_SHADER);
        mk('center', CENTER_SHADER);
        mk('text', TEXT_SHADER);
        mk('progress', PROGRESS_SHADER);
        mk('image', IMAGE_SHADER);
        mk('crowd', CROWD_SHADER);
        mk('copy', COPY_SHADER);
        mk('feedback', FEEDBACK_SHADER);
        mk('down', DOWN_SHADER);
        mk('up', UP_SHADER);
        mk('final', FINAL_SHADER);
        mk('particles', PARTICLE_FS, PARTICLE_VS);

        this.specTex = createDataTexture(gl, 64, SPEC_HIST, gl.NEAREST);
        this.specBars = 64;
        this.waveTex = createDataTexture(gl, WAVE_POINTS, 2, gl.LINEAR);

        this.blackTex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, this.blackTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

        // particles: quad corners + per-instance data
        this.particleVao = gl.createVertexArray()!;
        gl.bindVertexArray(this.particleVao);
        const quad = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        this.particleBuf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuf);
        gl.bufferData(gl.ARRAY_BUFFER, MAX_PARTICLES * PARTICLE_STRIDE * 4, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, PARTICLE_STRIDE * 4, 0);
        gl.vertexAttribDivisor(1, 1);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, PARTICLE_STRIDE * 4, 16);
        gl.vertexAttribDivisor(2, 1);
        gl.bindVertexArray(null);

        this.text = new TextRenderer(gl);
    }

    get isLost(): boolean {
        return this.lost || this.gl.isContextLost();
    }

    setSize(w: number, h: number): void {
        w = Math.max(16, Math.round(w));
        h = Math.max(16, Math.round(h));
        if (w === this.width && h === this.height) return;
        this.width = w;
        this.height = h;
        this.canvas.width = w;
        this.canvas.height = h;
        this.scene.resize(w, h);
        this.fxA.resize(w, h);
        this.fxB.resize(w, h);
        let bw = w;
        let bh = h;
        for (const b of this.bloom) {
            bw = Math.max(1, Math.floor(bw / 2));
            bh = Math.max(1, Math.floor(bh / 2));
            b.resize(bw, bh);
        }
        this.fbValid = false;
    }

    /** Clears simulation state (particles, trails). Call before an export. */
    reset(seed = 1): void {
        this.particles.reset(seed);
        this.fbValid = false;
    }

    private bgProgram(mode: BackgroundMode): Program {
        let p = this.bgPrograms.get(mode);
        if (!p) {
            p = new Program(this.gl, FULLSCREEN_VS, backgroundShader(mode), `bg-${mode}`);
            this.bgPrograms.set(mode, p);
        }
        return p;
    }

    /** Compiles every background variant up front (avoids hitches when switching). */
    warmup(): void {
        for (const m of ['image', 'tunnel', 'warp', 'lasers', 'hex', 'grid', 'nebula', 'plasma', 'kaleido', 'void'] as BackgroundMode[]) this.bgProgram(m);
    }

    private imageTexture(img: ImageSource | null): CachedImage | null {
        if (!img) return null;
        const gl = this.gl;
        let c = this.images.get(img.id);
        if (c && c.source === img.source) return c;
        if (!c) {
            const tex = gl.createTexture()!;
            c = { tex, source: img.source, w: img.width, h: img.height };
            this.images.set(img.id, c);
        }
        c.source = img.source;
        c.w = img.width;
        c.h = img.height;
        gl.bindTexture(gl.TEXTURE_2D, c.tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img.source);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
        return c;
    }

    private uploadSpectrum(f: Features, advance: boolean): void {
        const gl = this.gl;
        const bars = f.spectrum.length;
        if (bars !== this.specBars) {
            gl.deleteTexture(this.specTex);
            this.specTex = createDataTexture(gl, bars, SPEC_HIST, gl.NEAREST);
            this.specBars = bars;
            this.specRow = 0;
        }
        if (advance) this.specRow = (this.specRow + 1) % SPEC_HIST;
        gl.bindTexture(gl.TEXTURE_2D, this.specTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, this.specRow, bars, 1, gl.RED, gl.FLOAT, f.spectrum);
        this.waveData.set(f.wave, 0);
        this.waveData.set(f.waveR, WAVE_POINTS);
        gl.bindTexture(gl.TEXTURE_2D, this.waveTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, WAVE_POINTS, 2, gl.RED, gl.FLOAT, this.waveData);
    }

    private draw(): void {
        this.gl.bindVertexArray(this.vao);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
    }

    private common(p: Program, f: Features, palette: RGB[], move: number, spin: number, w: number, h: number): Program {
        p.v2('uRes', w, h)
            .f('uTime', f.time)
            .f('uMove', move)
            .f('uSpin', spin)
            .f('uKick', f.kick)
            .f('uBass', f.bass)
            .f('uSub', f.sub)
            .f('uLowMid', f.lowMid)
            .f('uMid', f.mid)
            .f('uHigh', f.high)
            .f('uEnergy', f.energy)
            .f('uIntensity', f.intensity)
            .f('uDrop', f.drop)
            .f('uBuild', f.build)
            .f('uBeat', f.beatPhase)
            .f('uBar', f.barPhase)
            .f('uBeatN', f.beatIndex)
            .f('uBeatPulse', f.beatPulse)
            .v3('uColA', palette[0])
            .v3('uColB', palette[1])
            .v3('uColC', palette[2]);
        const rk = f.recentKicks;
        p.v4('uKickAge', rk[0], rk[2], rk[4], rk[6]).v4('uKickStr', rk[1], rk[3], rk[5], rk[7]);
        return p;
    }

    render(project: Project, f: Features, info: FrameInfo, images: EngineImages): void {
        if (this.isLost) return;
        const gl = this.gl;
        const W = this.width;
        const H = this.height;
        const minDim = Math.min(W, H);
        const hsx = (0.5 * W) / minDim;
        const hsy = (0.5 * H) / minDim;
        const t = info.time;
        const dt = Math.max(0, Math.min(info.dt, 0.1));
        const P = project;
        const fx = P.fx;

        // ---- derived, deterministic per-frame values --------------------------------
        const hue = P.palette.hueSpeed * t + P.palette.dropHueShift * f.dropCount;
        const pl = P.palette;
        const hot = pl.dropColors ? Math.min(1, Math.max(0, (f.intensity - 0.42) / 0.33)) : 0;
        const hotS = hot * hot * (3 - 2 * hot);
        const calmCols = [pl.a, pl.b, pl.c].map(hexToRgb);
        const hotCols = pl.dropColors ? [pl.da, pl.db, pl.dc].map(hexToRgb) : calmCols;
        const palette: RGB[] = calmCols.map((c, i) =>
            rotateHue([c[0] + (hotCols[i][0] - c[0]) * hotS, c[1] + (hotCols[i][1] - c[1]) * hotS, c[2] + (hotCols[i][2] - c[2]) * hotS], hue),
        );
        const dyn = 1 - fx.dynamics + fx.dynamics * Math.min(1, Math.max(0.12, f.intensity * 1.25));
        const build = f.build * fx.buildBoost;
        const bg = P.background;
        const speedScale = 0.15 + bg.speed * 2.6;
        const move = speedScale * (0.45 * t + 0.9 * bg.react * f.travel + 1.6 * bg.react * f.kickTravel);
        const spin = (0.05 + bg.speed * 0.25) * t + bg.react * 0.35 * f.kickTravel;
        const kick = f.kick;
        const k15 = Math.pow(kick, 1.5);

        this.uploadSpectrum(f, dt > 0);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        // ---- 1. background -----------------------------------------------------------------
        this.scene.bind();
        gl.disable(gl.BLEND);
        const bgTex = this.imageTexture(images.background);
        const bp = this.bgProgram(bg.mode).use();
        this.common(bp, f, palette, move, spin, W, H)
            .f('uBgSpeed', bg.speed)
            .f('uBgScale', bg.scale)
            .f('uBgDetail', bg.detail)
            .f('uBgTwist', bg.twist)
            .f('uBgBright', bg.brightness)
            .f('uBgReact', bg.react)
            .tex('uImage', bgTex?.tex ?? this.blackTex)
            .v2('uImageSize', bgTex?.w ?? 1, bgTex?.h ?? 1)
            .f('uHasImage', bgTex ? 1 : 0)
            .f('uImgBlur', bg.imageBlur)
            .f('uImgDim', bg.imageDim)
            .f('uImgZoom', 1.03 + bg.imageDrift * 0.05 * (0.5 + 0.5 * Math.sin(t * 0.05)) + bg.imageKickZoom * (k15 * 0.06 + f.drop * 0.04) * dyn)
            .f('uImgRot', bg.imageDrift * 0.025 * Math.sin(t * 0.043))
            .f('uImgKaleido', bg.imageKaleido)
            .v2('uImgShift', bg.imageDrift * 0.03 * Math.sin(t * 0.031), bg.imageDrift * 0.02 * Math.cos(t * 0.023));
        this.draw();

        // ---- 2. overlays (additive) ------------------------------------------------------
        const ov = P.overlays;
        if (ov.fire > 0.001 || ov.lasers > 0.001 || ov.smoke > 0.001) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE);
            const op = this.progs.overlay.use();
            this.common(op, f, palette, move, spin, W, H)
                .f('uFireAmt', ov.fire)
                .f('uFireH', ov.fireHeight)
                .f('uLaserAmt', ov.lasers * (0.6 + 0.4 * dyn))
                .f('uSmokeAmt', ov.smoke);
            this.draw();
        }

        if (ov.crowd > 0.001) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            const cp = this.progs.crowd.use();
            this.common(cp, f, palette, move, spin, W, H).f('uCrowd', Math.min(1, ov.crowd)).f('uCrowdH', ov.crowdHeight);
            this.draw();
        }

        // ---- 3. fx layer with trails: spectrum + particles ----------------------------------
        this.fxB.bind();
        gl.disable(gl.BLEND);
        if (fx.trails > 0.001 && this.fbValid) {
            const decay = Math.pow(0.5 + 0.38 * fx.trails, dt * 60);
            const fp = this.progs.feedback.use();
            this.common(fp, f, palette, move, spin, W, H)
                .tex('uPrev', this.fxA.texture)
                .f('uDecay', decay)
                .f('uFbZoom', 1 + (fx.trailZoom * 0.025 * (1 + kick * 1.5)) * dt * 60)
                .f('uFbRot', fx.trailSpin * 0.02 * dt * 60);
            this.draw();
        } else {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        const sp = P.spectrum;
        const ctrX = P.center.x * hsx;
        const ctrY = P.center.y * hsy;
        const radialStyle = sp.style.startsWith('radial') || sp.style === 'circle-scope';
        if (sp.style !== 'none') {
            const kickScale = 1 + sp.kickScale * k15 * 0.12;
            const spg = this.progs.spectrum.use();
            this.common(spg, f, palette, move, spin, W, H)
                .tex('uSpec', this.specTex)
                .f('uSpecBars', this.specBars)
                .f('uSpecRow', this.specRow)
                .f('uSpecHist', SPEC_HIST)
                .tex('uWave', this.waveTex)
                .i('uStyle', STYLE_INDEX[sp.style] ?? 0)
                .v2('uSpCenter', radialStyle ? ctrX : sp.x * hsx, radialStyle ? ctrY : sp.y * hsy)
                .f('uSpRadius', sp.radius * kickScale)
                .f('uSpHeight', sp.height * (1 + sp.kickScale * kick * 0.25))
                .f('uSpWidth', sp.width)
                .f('uSpThick', sp.thickness)
                .f('uSpGap', sp.gap)
                .f('uSpLayers', sp.layers)
                .f('uSpMirror', sp.mirror ? 1 : 0)
                .f('uSpRot', (sp.rotate * Math.PI) / 180 + (radialStyle ? P.center.spin * 0.15 * t : 0))
                .f('uSpOpacity', sp.opacity)
                .i('uSpColor', COLOR_INDEX[sp.colorMode] ?? 0);
            this.draw();
        }
        const pc = P.particles;
        this.particles.update(dt, pc, f, hsx, hsy, ctrX, ctrY, (P.center.enabled ? P.center.radius : sp.radius) * (1 + P.center.kickScale * k15 * 0.12), dyn);
        if (this.particles.count > 0) {
            const pp = this.progs.particles.use();
            pp.v2('uRes', W, H)
                .v3('uColA', palette[0])
                .v3('uColB', palette[1])
                .v3('uColC', palette[2])
                .i('uPColor', pc.colorMode === 'white' ? 1 : pc.colorMode === 'fire' ? 2 : 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuf);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.particles.data, 0, this.particles.count * PARTICLE_STRIDE);
            gl.bindVertexArray(this.particleVao);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.particles.count);
        }
        this.fbValid = true;

        // composite fx layer onto the scene
        this.scene.bind();
        gl.blendFunc(gl.ONE, gl.ONE);
        this.progs.copy.use().tex('uTex', this.fxB.texture).f('uAmt', 1);
        this.draw();
        const tmp = this.fxA;
        this.fxA = this.fxB;
        this.fxB = tmp;

        // ---- 4. center logo, text, progress (premultiplied over) ---------------------------
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        const ct = P.center;
        if (ct.enabled) {
            const logo = this.imageTexture(images.logo);
            const cp = this.progs.center.use();
            this.common(cp, f, palette, move, spin, W, H)
                .tex('uLogo', logo?.tex ?? this.blackTex)
                .f('uHasLogo', logo ? 1 : 0)
                .v2('uLogoSize', logo?.w ?? 1, logo?.h ?? 1)
                .v2('uCtr', ctrX, ctrY)
                .f('uCtrR', ct.radius * (1 + ct.kickScale * k15 * 0.12 + f.drop * 0.05))
                .f('uRing', ct.ring)
                .f('uRingGlow', ct.ringGlow)
                .f('uCtrSpin', ct.spin * 0.6 * t + Math.sin(t * 2.1) * 0.03 * kick)
                .f('uShockRings', ct.shockRings * dyn);
            this.draw();
        }

        const tx = P.text;
        const weight = this.opts.fontWeight ? this.opts.fontWeight(tx.font) : '700';
        const introLen = Math.max(0, tx.intro);
        const block = this.text.update(tx, P.meta, minDim, weight, this.opts.fontsVersion ? this.opts.fontsVersion() : 0, introLen > 0 ? 2 : 1);
        if (block) {
            const lastKickIdx = f.beatIndex;
            const glitchOn = hash1(Math.floor(t * 9) + lastKickIdx * 0.37) < 0.2 + tx.glitch * 0.6;
            const dropB = f.dropAge < 50 ? f.drop * Math.exp(-f.dropAge * (1 / 0.28 - 1 / 1.6)) : 0;
            let glitchT = tx.glitch * (Math.pow(kick, 3) * 0.9 + dropB * 0.9) * (glitchOn ? 1 : 0.15) * dyn;
            let px = block.cx * hsx + block.shift;
            let py = block.cy * hsy;
            let scale = 1 + tx.pulse * k15 * 0.07;
            // intro title card: big in the centre, then glides into place
            const tl = t - info.rangeStart;
            if (introLen > 0 && tl >= 0 && tl < introLen + 0.9) {
                const x = Math.min(1, Math.max(0, (tl - introLen + 0.1) / 0.9));
                const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
                const big = Math.min(1.9, (hsx * 1.6) / Math.max(1e-3, block.halfW * 2));
                px = px * e;
                py = py * e;
                scale *= big + (1 - big) * e;
                if (tl < 0.5) glitchT = Math.max(glitchT, (0.5 - tl) * 1.2);
            }
            const tp = this.progs.text.use();
            this.common(tp, f, palette, move, spin, W, H)
                .tex('uTextTex', block.texture)
                .v2('uTextPos', px, py)
                .v2('uTextHalf', block.halfW, block.halfH)
                .f('uTextScale', scale)
                .f('uGlitchT', Math.min(1, glitchT))
                .f('uGlitchSeed', Math.floor(t * 20))
                .f('uTextAlpha', 1);
            this.draw();
        }

        // lyrics / subtitles
        const cue = P.lyrics.cues.length ? activeCue(P.lyrics.cues, t) : null;
        if (cue) {
            const lb = this.text.updateLyric(cue.text, P.lyrics, tx, minDim, weight, this.opts.fontsVersion ? this.opts.fontsVersion() : 0);
            const age = t - cue.start;
            const left = cue.end - t;
            const alpha = Math.min(1, age / 0.12, left / 0.2);
            const pop = 1 + 0.08 * Math.exp(-age / 0.08) + tx.pulse * k15 * 0.04;
            const lp = this.progs.text.use();
            this.common(lp, f, palette, move, spin, W, H)
                .tex('uTextTex', lb.texture)
                .v2('uTextPos', 0, lb.cy * hsy)
                .v2('uTextHalf', lb.halfW, lb.halfH)
                .f('uTextScale', pop)
                .f('uGlitchT', Math.max(0, 0.5 - age * 4) + tx.glitch * Math.pow(kick, 4) * 0.4 * dyn)
                .f('uGlitchSeed', Math.floor(t * 20) + 7)
                .f('uTextAlpha', Math.max(0, alpha));
            this.draw();
        }

        const wm = P.watermark;
        const wmImg = this.imageTexture(images.watermark ?? null);
        if (wmImg && wm.opacity > 0.001) {
            const halfH = (wm.size / 2) * (1 + wm.pulse * k15 * 0.08);
            const halfW = halfH * (wmImg.w / Math.max(1, wmImg.h));
            const sx = wm.corner === 'tl' || wm.corner === 'bl' ? -1 : 1;
            const sy = wm.corner === 'tl' || wm.corner === 'tr' ? 1 : -1;
            const baseH = wm.size / 2;
            const baseW = baseH * (wmImg.w / Math.max(1, wmImg.h));
            const ip = this.progs.image.use();
            ip.v2('uRes', W, H)
                .tex('uImg', wmImg.tex)
                .v2('uImgPos', sx * (hsx - wm.margin - baseW), sy * (hsy - wm.margin - baseH))
                .v2('uImgHalf', halfW, halfH)
                .f('uImgOpacity', wm.opacity);
            this.draw();
        }

        const pr = P.progress;
        if (pr.enabled) {
            const rangeLen = Math.max(1e-3, info.rangeEnd - info.rangeStart);
            const pg = this.progs.progress.use();
            this.common(pg, f, palette, move, spin, W, H)
                .f('uProgress', Math.max(0, Math.min(1, rangeLen > 1e5 ? f.progress : (t - info.rangeStart) / rangeLen)))
                .f('uPrY', pr.y * hsy)
                .f('uPrThick', pr.thickness)
                .v3('uPrColor', hexToRgb(pr.color))
                .f('uPrGlow', pr.glow);
            this.draw();
        }

        // ---- 5. bloom ----------------------------------------------------------------------
        gl.disable(gl.BLEND);
        const down = this.progs.down;
        let src = this.scene;
        for (let i = 0; i < BLOOM_LEVELS; i++) {
            const dst = this.bloom[i];
            dst.bind();
            down.use()
                .tex('uTex', src.texture)
                .v2('uTexel', 1 / src.width, 1 / src.height)
                .f('uPrefilter', i === 0 ? 1 : 0)
                .f('uThreshold', fx.bloomThreshold);
            this.draw();
            src = dst;
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        const up = this.progs.up;
        const weightUp = 0.55 + fx.bloomRadius * 0.6;
        for (let i = BLOOM_LEVELS - 1; i > 0; i--) {
            const s = this.bloom[i];
            this.bloom[i - 1].bind();
            up.use().tex('uTex', s.texture).v2('uTexel', 1 / s.width, 1 / s.height).f('uWeight', weightUp);
            this.draw();
        }
        gl.disable(gl.BLEND);

        // ---- 6. final composite --------------------------------------------------------------
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, W, H);
        const shakeAmp = fx.shake * (k15 * 0.022 + f.drop * 0.018 + build * 0.012 * (0.4 + 0.6 * f.beatPulse)) * dyn;
        const st = t * 32;
        const shakeX = shakeAmp * noise1(st, 1);
        const shakeY = shakeAmp * noise1(st, 2);
        const shakeRot = shakeAmp * 0.8 * noise1(st * 0.7, 3);
        let zoom = 1 + shakeAmp * 2.5 + fx.zoomPunch * (Math.pow(kick, 2) * 0.055 + f.drop * 0.05) * dyn + build * 0.05;
        // beat-synced camera cuts: a new framing on every bar in intense parts
        let cutRot = 0;
        let cutX = 0;
        let cutY = 0;
        const cutAmt = fx.cuts * Math.min(1, Math.max(0, (f.intensity - 0.5) / 0.25));
        if (cutAmt > 0.001) {
            const b = f.barIndex;
            cutRot = (hash1(b * 1.31 + 7) - 0.5) * 0.14 * cutAmt;
            cutX = (hash1(b * 2.07 + 3) - 0.5) * 0.06 * cutAmt;
            cutY = (hash1(b * 0.73 + 11) - 0.5) * 0.04 * cutAmt;
            zoom *= 1 + (0.03 + hash1(b * 1.97 + 5) * 0.1) * cutAmt + Math.abs(cutRot) * 1.1;
        }
        const dropBurst = f.dropAge < 50 ? f.drop * Math.exp(-f.dropAge * (1 / 0.28 - 1 / 1.6)) : 0;
        const glitchSeed = Math.floor(t * 24);
        const kickIdx = Math.round(f.time * 1000 - f.kickAge * 1000);
        const strongKick = f.recentKicks[1] > 0.6 && hash1(kickIdx * 0.013) < 0.15 + 0.85 * fx.glitch;
        const glitch = fx.glitch * ((strongKick ? Math.exp(-f.kickAge / 0.09) : 0) * 0.8 + dropBurst * 1.2 + Math.pow(build, 3) * 0.6) * dyn;
        const period = 60 / Math.max(30, f.bpm);
        const strobe = fx.strobe * Math.exp(-(f.beatPhase * period) / 0.035) * (f.section === 'drop' || f.section === 'main' ? 1 : 0.25) * dyn;
        const flash = fx.flash * (Math.pow(kick, 3) * 0.2 * dyn + dropBurst * 0.75) + strobe * 0.9;
        const fadeIn = fx.fadeIn > 0 ? Math.min(1, Math.max(0, (t - info.rangeStart) / fx.fadeIn)) : 1;
        const fadeOut = fx.fadeOut > 0 ? Math.min(1, Math.max(0, (info.rangeEnd - t) / fx.fadeOut)) : 1;
        const fl = palette[0];
        const fp = this.progs.final.use();
        this.common(fp, f, palette, move, spin, W, H)
            .tex('uScene', this.scene.texture)
            .tex('uBloom', this.bloom[0].texture)
            .f('uBloomAmt', fx.bloom * (0.85 + 0.45 * kick + 0.3 * dropBurst))
            .f('uCA', fx.chromatic * (0.15 + 0.85 * kick + 1.5 * dropBurst) * dyn)
            .f('uGlitch', Math.min(1, glitch))
            .f('uGlitchSeed', glitchSeed)
            .f('uShock', fx.shockwave * dyn)
            .v2('uShockCenter', ctrX, ctrY)
            .f('uFlash', flash)
            .v3('uFlashColor', [0.75 + 0.25 * fl[0], 0.75 + 0.25 * fl[1], 0.75 + 0.25 * fl[2]])
            .f('uVignette', fx.vignette)
            .f('uGrain', fx.grain)
            .f('uScan', fx.scanlines)
            .f('uExposure', fx.exposure)
            .f('uContrast', fx.contrast)
            .f('uSaturation', fx.saturation)
            .f('uFade', fadeIn * fadeOut)
            .f('uLetterbox', fx.letterbox)
            .v2('uShake', shakeX + cutX, shakeY + cutY)
            .f('uShakeRot', shakeRot + cutRot)
            .f('uZoom', zoom)
            .f('uFrame', info.frame);
        this.draw();
        gl.bindVertexArray(null);
    }

    dispose(): void {
        const gl = this.gl;
        for (const p of Object.values(this.progs)) p.dispose();
        for (const p of this.bgPrograms.values()) p.dispose();
        this.scene.dispose();
        this.fxA.dispose();
        this.fxB.dispose();
        for (const b of this.bloom) b.dispose();
        for (const c of this.images.values()) gl.deleteTexture(c.tex);
        gl.deleteTexture(this.specTex);
        gl.deleteTexture(this.waveTex);
        gl.deleteTexture(this.blackTex);
        this.text.dispose();
        if (this.opts.loseContextOnDispose) gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
}
