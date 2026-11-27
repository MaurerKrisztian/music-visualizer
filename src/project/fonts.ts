// Font catalogue. Bundled OFL fonts come from @fontsource (self-hosted, no
// third-party requests); the older display fonts live in /public/fonts; users
// can also upload their own .ttf/.otf/.woff files.

import '@fontsource/orbitron/900.css';
import '@fontsource/black-ops-one/400.css';
import '@fontsource/russo-one/400.css';
import '@fontsource/audiowide/400.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/anton/400.css';
import '@fontsource/unifrakturmaguntia/400.css';
import '@fontsource/pirata-one/400.css';
import '@fontsource/metal-mania/400.css';
import '@fontsource/monoton/400.css';
import '@fontsource/michroma/400.css';
import '@fontsource/rubik-glitch/400.css';
import '@fontsource/teko/600.css';
import '@fontsource/bungee/400.css';
import '@fontsource/syncopate/700.css';

export interface FontDef {
    family: string;
    weight: string;
    label: string;
    /** file in /public/fonts for the legacy fonts */
    url?: string;
}

export const FONTS: FontDef[] = [
    { family: 'Orbitron', weight: '900', label: 'Orbitron (tech)' },
    { family: 'Black Ops One', weight: '400', label: 'Black Ops One (raw)' },
    { family: 'Russo One', weight: '400', label: 'Russo One' },
    { family: 'Audiowide', weight: '400', label: 'Audiowide' },
    { family: 'Michroma', weight: '400', label: 'Michroma' },
    { family: 'Syncopate', weight: '700', label: 'Syncopate' },
    { family: 'Bebas Neue', weight: '400', label: 'Bebas Neue' },
    { family: 'Anton', weight: '400', label: 'Anton' },
    { family: 'Teko', weight: '600', label: 'Teko' },
    { family: 'Bungee', weight: '400', label: 'Bungee' },
    { family: 'UnifrakturMaguntia', weight: '400', label: 'Unifraktur (gabber / terror)' },
    { family: 'Pirata One', weight: '400', label: 'Pirata One (gothic)' },
    { family: 'Metal Mania', weight: '400', label: 'Metal Mania' },
    { family: 'Rubik Glitch', weight: '400', label: 'Rubik Glitch' },
    { family: 'Monoton', weight: '400', label: 'Monoton (retro)' },
    { family: 'Kill The Noise', weight: '400', label: 'Kill The Noise', url: 'fonts/test.ttf' },
    { family: 'Broleh', weight: '400', label: 'Broleh', url: 'fonts/BROLEH.ttf' },
    { family: 'Daughter of a Glitch', weight: '400', label: 'Daughter of a Glitch', url: 'fonts/DaughterOfAGlitch-mMBv.ttf' },
    { family: 'Athletic', weight: '400', label: 'Athletic', url: 'fonts/Athletic-1VmB.ttf' },
    { family: 'GreyHood Seven', weight: '400', label: 'GreyHood Seven', url: 'fonts/SandsGreyhoodSeven-D4W0.otf' },
    { family: 'Marshal The Dead', weight: '400', label: 'Marshal The Dead', url: 'fonts/MarshalTheDead-ywjxM.ttf' },
    { family: 'Bamboo Brush', weight: '400', label: 'Bamboo Brush', url: 'fonts/BambooBrush-gxd05.ttf' },
    { family: 'Lucy Said Ok', weight: '400', label: 'Lucy Said Ok', url: 'fonts/LucySaidOkPersonalUseItalic-OV9ee.ttf' },
    { family: 'Arial', weight: '700', label: 'Arial (system)' },
];

const customFonts = new Map<string, string>();
let version = 0;
const listeners = new Set<() => void>();
const loading = new Map<string, Promise<void>>();

export function fontsVersion(): number {
    return version;
}

export function onFontsChanged(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function bump() {
    version++;
    listeners.forEach((l) => l());
}

export function fontWeight(family: string): string {
    return FONTS.find((f) => f.family === family)?.weight ?? '400';
}

export function registerCustomFont(family: string, label: string): void {
    customFonts.set(family, label);
}

export function customFontList(): { family: string; label: string }[] {
    return Array.from(customFonts.entries()).map(([family, label]) => ({ family, label }));
}

/** Loads a font face from binary data (uploads / saved projects). */
export async function loadFontData(family: string, data: ArrayBuffer | Blob): Promise<void> {
    const buf = data instanceof Blob ? await data.arrayBuffer() : data;
    const face = new FontFace(family, buf);
    await face.load();
    document.fonts.add(face);
    bump();
}

/** Makes sure a font is ready before the canvas draws with it. */
export function ensureFont(family: string): Promise<void> {
    const existing = loading.get(family);
    if (existing) return existing;
    const def = FONTS.find((f) => f.family === family);
    let p: Promise<void>;
    if (def?.url) {
        const face = new FontFace(family, `url(${import.meta.env.BASE_URL}${def.url})`);
        p = face
            .load()
            .then((f) => {
                document.fonts.add(f);
                bump();
            })
            .catch(() => undefined);
    } else {
        const weight = def?.weight ?? '400';
        p = document.fonts
            .load(`${weight} 64px "${family}"`)
            .then(() => bump())
            .catch(() => undefined);
    }
    loading.set(family, p);
    return p;
}
