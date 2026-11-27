import { useEffect, useRef, useState } from 'react';
import type { SectionKind } from '../audio/analysis';
import { live } from '../app/preview';
import { appStore, player, seek, toggleDropAt } from '../app/session';
import { projectStore, useProject, useStore } from '../project/store';
import { formatTime } from './format';

const SECTION_COLORS: Record<SectionKind, string> = {
    intro: '#3a3f55',
    breakdown: '#2f6fd6',
    build: '#ff9f1c',
    drop: '#ff2d6f',
    main: '#8a4dff',
    outro: '#3a3f55',
};

export function Timeline() {
    const canvas = useRef<HTMLCanvasElement>(null);
    const head = useRef<HTMLDivElement>(null);
    const wrap = useRef<HTMLDivElement>(null);
    const env = useStore(appStore, (s) => s.env);
    const interp = useStore(appStore, (s) => s.interp);
    const duration = useStore(appStore, (s) => s.track?.duration ?? 0);
    const rangeStart = useProject((p) => p.export.rangeStart);
    const rangeEnd = useProject((p) => p.export.rangeEnd);
    const [width, setWidth] = useState(800);
    const [hover, setHover] = useState<number | null>(null);
    const drag = useRef<'start' | 'end' | null>(null);
    const hasRange = rangeStart !== null || rangeEnd !== null;

    useEffect(() => {
        const el = wrap.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setWidth(el.clientWidth));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // static layer
    useEffect(() => {
        const c = canvas.current;
        if (!c) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const W = Math.max(100, width);
        const H = 76;
        c.width = W * dpr;
        c.height = H * dpr;
        c.style.width = `${W}px`;
        c.style.height = `${H}px`;
        const g = c.getContext('2d')!;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        if (!env || !duration) return;
        const x = (t: number) => (t / duration) * W;

        // sections strip
        if (interp) {
            for (const s of interp.sections) {
                g.fillStyle = SECTION_COLORS[s.kind];
                g.globalAlpha = 0.9;
                g.fillRect(x(s.start), 0, Math.max(1, x(s.end) - x(s.start)), 5);
                g.globalAlpha = s.kind === 'drop' ? 0.1 : s.kind === 'build' ? 0.08 : 0.0;
                g.fillRect(x(s.start), 5, Math.max(1, x(s.end) - x(s.start)), H - 5);
            }
            g.globalAlpha = 1;
        }

        // colour waveform (rekordbox-like: low = magenta, mid = amber, high = cyan)
        const ov = env.overview;
        const mid = 8 + (H - 8) / 2;
        const amp = (H - 14) / 2;
        for (let px = 0; px < W; px++) {
            const b0 = Math.floor((px / W) * ov.buckets);
            const b1 = Math.max(b0 + 1, Math.floor(((px + 1) / W) * ov.buckets));
            let a = 0;
            let lo = 0;
            let mi = 0;
            let hi = 0;
            for (let b = b0; b < b1 && b < ov.buckets; b++) {
                a = Math.max(a, ov.amp[b]);
                lo = Math.max(lo, ov.low[b]);
                mi = Math.max(mi, ov.mid[b]);
                hi = Math.max(hi, ov.high[b]);
            }
            const sum = lo + mi + hi + 1e-6;
            const r = Math.round(255 * Math.min(1, (lo * 1.0 + mi * 1.0 + hi * 0.1) / sum + 0.1));
            const gg = Math.round(255 * Math.min(1, (lo * 0.15 + mi * 0.75 + hi * 0.85) / sum + 0.1));
            const bb = Math.round(255 * Math.min(1, (lo * 0.6 + mi * 0.1 + hi * 1.0) / sum + 0.15));
            const h = Math.max(1, a * amp);
            g.fillStyle = `rgb(${r},${gg},${bb})`;
            g.fillRect(px, mid - h, 1, h * 2);
        }

        if (interp) {
            // kicks
            if (interp.kicks.length < W * 1.5) {
                g.fillStyle = 'rgba(255,255,255,0.35)';
                for (let i = 0; i < interp.kicks.length; i++) g.fillRect(Math.round(x(interp.kicks[i])), H - 4, 1, 4 * interp.kickStrength[i]);
            }
            // drops
            g.font = '600 9px system-ui, sans-serif';
            for (let i = 0; i < interp.drops.length; i++) {
                const dx = Math.round(x(interp.drops[i])) + 0.5;
                g.strokeStyle = '#ff2d6f';
                g.lineWidth = 1;
                g.beginPath();
                g.moveTo(dx, 6);
                g.lineTo(dx, H);
                g.stroke();
                g.fillStyle = '#ff2d6f';
                g.beginPath();
                g.moveTo(dx - 4, 6);
                g.lineTo(dx + 4, 6);
                g.lineTo(dx, 11);
                g.fill();
                g.fillText('DROP', dx + 4, 16);
            }
        }

        // export range
        if (rangeStart !== null || rangeEnd !== null) {
            const a = x(rangeStart ?? 0);
            const b = x(rangeEnd ?? duration);
            g.fillStyle = 'rgba(5,6,12,0.62)';
            g.fillRect(0, 5, a, H);
            g.fillRect(b, 5, W - b, H);
            g.fillStyle = '#ffd60a';
            g.fillRect(a, 5, 2, H);
            g.fillRect(b - 2, 5, 2, H);
        }
    }, [env, interp, duration, width, rangeStart, rangeEnd]);

    // playhead
    useEffect(() => {
        let raf = 0;
        const tick = () => {
            raf = requestAnimationFrame(tick);
            const d = appStore.get().track?.duration ?? 0;
            if (!d || !head.current) return;
            const t = player.playing ? live.time : player.currentTime;
            head.current.style.transform = `translateX(${((t / d) * width).toFixed(1)}px)`;
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [width]);

    const timeAt = (clientX: number) => {
        const r = wrap.current!.getBoundingClientRect();
        return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration));
    };

    const handleAt = (clientX: number): 'start' | 'end' | null => {
        if (!hasRange || !wrap.current || !duration) return null;
        const r = wrap.current.getBoundingClientRect();
        const xa = r.left + ((rangeStart ?? 0) / duration) * r.width;
        const xb = r.left + ((rangeEnd ?? duration) / duration) * r.width;
        if (Math.abs(clientX - xa) < 7) return 'start';
        if (Math.abs(clientX - xb) < 7) return 'end';
        return null;
    };

    return (
        <div
            className="timeline"
            ref={wrap}
            onPointerDown={(e) => {
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                drag.current = handleAt(e.clientX);
                if (!drag.current) seek(timeAt(e.clientX));
            }}
            onPointerMove={(e) => {
                const t = timeAt(e.clientX);
                setHover(t);
                (e.currentTarget as HTMLElement).style.cursor = drag.current || handleAt(e.clientX) ? 'ew-resize' : 'pointer';
                if (e.buttons !== 1) return;
                if (drag.current) {
                    const which = drag.current;
                    projectStore.update((p) => {
                        const a = p.export.rangeStart ?? 0;
                        const b = p.export.rangeEnd ?? duration;
                        if (which === 'start') p.export.rangeStart = Math.min(t, b - 0.5);
                        else p.export.rangeEnd = Math.max(t, a + 0.5);
                    });
                } else {
                    seek(t);
                }
            }}
            onPointerUp={() => (drag.current = null)}
            onDoubleClick={(e) => toggleDropAt(timeAt(e.clientX))}
            title="Click to seek, double-click to add or remove a drop"
            onPointerLeave={() => setHover(null)}
        >
            <canvas ref={canvas} />
            <div className="playhead" ref={head} />
            {hover !== null && duration > 0 && (
                <div className="tl-hover" style={{ left: `${(hover / duration) * 100}%` }}>
                    {formatTime(hover)}
                </div>
            )}
            {!env && <div className="tl-empty">Load a track to see its kicks, build-ups and drops</div>}
        </div>
    );
}
