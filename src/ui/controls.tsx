import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { assets } from '../project/assets';
import { createDefaultProject } from '../project/defaults';
import { getPath } from '../project/store';
import { useAssets, useBind } from './hooks';

const DEFAULTS = createDefaultProject();

export function Section({ title, children, defaultOpen = true, aside }: { title: string; children: ReactNode; defaultOpen?: boolean; aside?: ReactNode }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <section className={`sec${open ? ' open' : ''}`}>
            <header onClick={() => setOpen(!open)}>
                <span className="chev" aria-hidden>
                    ▸
                </span>
                <span className="sec-title">{title}</span>
                {aside && (
                    <span className="sec-aside" onClick={(e) => e.stopPropagation()}>
                        {aside}
                    </span>
                )}
            </header>
            {open && <div className="sec-body">{children}</div>}
        </section>
    );
}

interface SliderProps {
    label: string;
    path: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    digits?: number;
    hint?: string;
    /** Multiplies the displayed number (e.g. 100 for percentages). */
    display?: number;
}

export function Slider({ label, path, min = 0, max = 1, step = 0.01, unit = '', digits, hint, display = 1 }: SliderProps) {
    const [v, set] = useBind<number>(path);
    const def = getPath(DEFAULTS, path) as number;
    const d = digits ?? (step * display >= 1 ? 0 : step * display >= 0.1 ? 1 : 2);
    const value = typeof v === 'number' ? v : def;
    const fill = `${(((value - min) / (max - min)) * 100).toFixed(1)}%`;
    return (
        <label className="ctl slider" title={hint ? `${hint} (double-click to reset)` : 'Double-click to reset'}>
            <span className="lbl">{label}</span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                style={{ ['--fill' as string]: fill }}
                onChange={(e) => set(parseFloat(e.target.value))}
                onDoubleClick={() => set(def)}
            />
            <span className="val">
                {(value * display).toFixed(d)}
                {unit}
            </span>
        </label>
    );
}

export function Toggle({ label, path, hint }: { label: string; path: string; hint?: string }) {
    const [v, set] = useBind<boolean>(path);
    return (
        <label className="ctl toggle" title={hint}>
            <span className="lbl">{label}</span>
            <button type="button" className={`switch${v ? ' on' : ''}`} role="switch" aria-checked={!!v} onClick={() => set(!v)}>
                <i />
            </button>
        </label>
    );
}

export function Select<T extends string>({ label, path, options }: { label: string; path: string; options: { value: T; label: string }[] }) {
    const [v, set] = useBind<T>(path);
    return (
        <label className="ctl select">
            <span className="lbl">{label}</span>
            <select value={v} onChange={(e) => set(e.target.value as T)}>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

export function Segmented<T extends string | number>({ label, path, options }: { label?: string; path: string; options: { value: T; label: string }[] }) {
    const [v, set] = useBind<T>(path);
    return (
        <div className="ctl seg-row">
            {label && <span className="lbl">{label}</span>}
            <div className="segmented">
                {options.map((o) => (
                    <button key={String(o.value)} type="button" className={o.value === v ? 'on' : ''} onClick={() => set(o.value)}>
                        {o.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function Color({ label, path }: { label: string; path: string }) {
    const [v, set] = useBind<string>(path);
    return (
        <label className="ctl color">
            <span className="lbl">{label}</span>
            <span className="color-wrap">
                <input type="color" value={v} onChange={(e) => set(e.target.value)} />
                <code>{v}</code>
            </span>
        </label>
    );
}

export function TextField({ label, path, placeholder }: { label: string; path: string; placeholder?: string }) {
    const [v, set] = useBind<string>(path);
    return (
        <label className="ctl text">
            <span className="lbl">{label}</span>
            <input type="text" value={v ?? ''} placeholder={placeholder} onChange={(e) => set(e.target.value)} spellCheck={false} />
        </label>
    );
}

export function ImageSlot({ label, path, hint }: { label: string; path: string; hint?: string }) {
    const [id, set] = useBind<string | null>(path);
    useAssets();
    const rec = assets.get(id);
    const url = useMemo(() => (rec ? URL.createObjectURL(rec.blob) : null), [rec]);
    useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
    const input = useRef<HTMLInputElement>(null);
    const onFile = async (f: File | undefined) => {
        if (!f) return;
        const newId = await assets.add(f, f.name);
        set(newId);
    };
    return (
        <div className="ctl imgslot" title={hint}>
            <span className="lbl">{label}</span>
            <div className="imgslot-body">
                <button type="button" className="thumb" style={url ? { backgroundImage: `url(${url})` } : undefined} onClick={() => input.current?.click()}>
                    {!url && <span>+</span>}
                </button>
                <div className="imgslot-actions">
                    <button type="button" className="btn small" onClick={() => input.current?.click()}>
                        {url ? 'Replace' : 'Upload image'}
                    </button>
                    {id && (
                        <button type="button" className="btn small ghost" onClick={() => set(null)}>
                            Remove
                        </button>
                    )}
                </div>
            </div>
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
    );
}

export function Row({ children }: { children: ReactNode }) {
    return <div className="row">{children}</div>;
}

export function Hint({ children }: { children: ReactNode }) {
    return <p className="hint">{children}</p>;
}
