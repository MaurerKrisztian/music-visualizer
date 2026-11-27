// Owns the preview canvas/engine and the requestAnimationFrame loop.

import type { Features } from '../audio/features';
import { Engine, type EngineImages } from '../engine/engine';
import { assets } from '../project/assets';
import { fontsVersion, fontWeight, onFontsChanged } from '../project/fonts';
import { projectStore } from '../project/store';
import { RESOLUTIONS, type Project } from '../project/types';
import { appStore, getExtractor, player, reactOptions } from './session';

export interface LiveInfo {
    time: number;
    kick: number;
    energy: number;
    section: string;
    beatPhase: number;
    fps: number;
    scale: number;
}

export const live: LiveInfo = { time: 0, kick: 0, energy: 0, section: '', beatPhase: 0, fps: 0, scale: 1 };

export function exportAspect(p: Project): number {
    const r = RESOLUTIONS[p.export.resolution] ?? RESOLUTIONS['1080p'];
    return r.w / r.h;
}

export function engineImages(p: Project): EngineImages {
    return { background: assets.image(p.background.imageId), logo: assets.image(p.center.imageId) };
}

class PreviewController {
    private engine: Engine | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private raf = 0;
    private lastNow = 0;
    private frame = 0;
    private dirty = true;
    private scale = 1;
    private fpsAcc = 0;
    private fpsFrames = 0;
    private slowFor = 0;
    private fastFor = 0;
    private lastT = -1;
    error: string | null = null;
    paused = false;
    forcedSize: { w: number; h: number } | null = null;
    private unsubs: (() => void)[] = [];

    attach(canvas: HTMLCanvasElement): void {
        this.detach();
        this.canvas = canvas;
        try {
            this.engine = new Engine(canvas, { fontWeight, fontsVersion });
            this.error = null;
        } catch (e) {
            this.error = e instanceof Error ? e.message : String(e);
            this.engine = null;
            appStore.update((s) => void (s.message = this.error ?? ''), false);
            return;
        }
        const mark = () => (this.dirty = true);
        this.unsubs = [projectStore.subscribe(mark), assets.subscribe(mark), onFontsChanged(mark), appStore.subscribe(mark)];
        this.lastNow = performance.now();
        this.raf = requestAnimationFrame(this.loop);
    }

    detach(): void {
        cancelAnimationFrame(this.raf);
        this.unsubs.forEach((u) => u());
        this.unsubs = [];
        this.engine?.dispose();
        this.engine = null;
        this.canvas = null;
    }

    invalidate(): void {
        this.dirty = true;
    }

    getCanvas(): HTMLCanvasElement | null {
        return this.canvas;
    }

    private resize(p: Project): void {
        const c = this.canvas!;
        const res = RESOLUTIONS[p.export.resolution] ?? RESOLUTIONS['1080p'];
        let w: number;
        let h: number;
        if (this.forcedSize) {
            w = this.forcedSize.w;
            h = this.forcedSize.h;
        } else {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const cssW = Math.max(64, c.clientWidth);
            w = Math.min(res.w, cssW * dpr * this.scale);
            h = w / (res.w / res.h);
        }
        if (Math.abs(this.engine!.width - w) > 2 || Math.abs(this.engine!.height - h) > 2) {
            this.engine!.setSize(w, h);
            this.dirty = true;
        }
    }

    private loop = (now: number): void => {
        this.raf = requestAnimationFrame(this.loop);
        const engine = this.engine;
        if (!engine || !this.canvas || this.paused) return;
        if (engine.isLost) return;
        const realDt = Math.min(0.1, (now - this.lastNow) / 1000);
        this.lastNow = now;
        const p = projectStore.get();
        const ex = getExtractor();
        if (!ex) return;
        this.resize(p);
        const playing = player.playing;
        const t = playing ? Math.max(0, player.visualTime + p.sync.previewOffsetMs / 1000) : player.currentTime;
        if (!playing && !this.dirty && Math.abs(t - this.lastT) < 1e-6) return;
        this.dirty = false;
        const dt = playing ? realDt : 0;
        if (Math.abs(t - this.lastT) > 0.3 || t < this.lastT) ex.reset();
        this.lastT = t;
        const f: Features = ex.compute(t, dt, reactOptions(p));
        const duration = appStore.get().track?.duration ?? 0;
        engine.render(p, f, { time: t, dt, rangeStart: 0, rangeEnd: duration || 1, frame: this.frame++ }, engineImages(p));

        live.time = t;
        live.kick = f.kick;
        live.energy = f.energy;
        live.section = f.section;
        live.beatPhase = f.beatPhase;

        // adaptive preview resolution
        if (playing && !this.forcedSize) {
            this.fpsAcc += realDt;
            this.fpsFrames++;
            if (this.fpsAcc >= 1) {
                live.fps = this.fpsFrames / this.fpsAcc;
                if (live.fps < 42) {
                    this.slowFor++;
                    this.fastFor = 0;
                } else if (live.fps > 57) {
                    this.fastFor++;
                    this.slowFor = 0;
                } else {
                    this.slowFor = 0;
                    this.fastFor = 0;
                }
                if (this.slowFor >= 2 && this.scale > 0.4) {
                    this.scale = Math.max(0.4, this.scale * 0.8);
                    this.slowFor = 0;
                } else if (this.fastFor >= 4 && this.scale < 1) {
                    this.scale = Math.min(1, this.scale * 1.15);
                    this.fastFor = 0;
                }
                live.scale = this.scale;
                this.fpsAcc = 0;
                this.fpsFrames = 0;
            }
        }
    };
}

export const preview = new PreviewController();
