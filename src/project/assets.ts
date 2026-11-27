// Images and fonts used by a project. Blobs live in memory and in IndexedDB
// (so a reload restores them); project files embed them as data URLs.

import { loadFontData, registerCustomFont } from './fonts';
import { idbDelete, idbGet, idbPut } from './idb';

export interface AssetRecord {
    id: string;
    name: string;
    type: string;
    blob: Blob;
}

export interface LoadedImage {
    id: string;
    source: ImageBitmap;
    width: number;
    height: number;
}

export interface EmbeddedAsset {
    id: string;
    name: string;
    type: string;
    data: string;
}

const MAX_IMAGE = 4096;

class AssetStore {
    private readonly records = new Map<string, AssetRecord>();
    private readonly images = new Map<string, LoadedImage>();
    private readonly listeners = new Set<() => void>();

    subscribe(fn: () => void): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    private emit(): void {
        this.listeners.forEach((l) => l());
    }

    async add(blob: Blob, name: string, id = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`): Promise<string> {
        const rec: AssetRecord = { id, name, type: blob.type || guessType(name), blob };
        this.records.set(id, rec);
        await this.decode(rec);
        void idbPut('assets', id, rec).catch(() => undefined);
        this.emit();
        return id;
    }

    get(id: string | null | undefined): AssetRecord | undefined {
        return id ? this.records.get(id) : undefined;
    }

    image(id: string | null | undefined): LoadedImage | null {
        return id ? this.images.get(id) ?? null : null;
    }

    fontFamily(id: string): string {
        return `Custom ${id}`;
    }

    private async decode(rec: AssetRecord): Promise<void> {
        if (rec.type.startsWith('image/')) {
            let bmp = await createImageBitmap(rec.blob);
            if (bmp.width > MAX_IMAGE || bmp.height > MAX_IMAGE) {
                const s = MAX_IMAGE / Math.max(bmp.width, bmp.height);
                const scaled = await createImageBitmap(bmp, { resizeWidth: Math.round(bmp.width * s), resizeHeight: Math.round(bmp.height * s), resizeQuality: 'high' });
                bmp.close();
                bmp = scaled;
            }
            this.images.set(rec.id, { id: rec.id, source: bmp, width: bmp.width, height: bmp.height });
        } else if (isFont(rec)) {
            const family = this.fontFamily(rec.id);
            registerCustomFont(family, rec.name.replace(/\.(ttf|otf|woff2?)$/i, ''));
            await loadFontData(family, rec.blob);
        }
    }

    /** Restores assets referenced by a project from IndexedDB. */
    async restore(ids: (string | null | undefined)[]): Promise<void> {
        for (const id of ids) {
            if (!id || this.records.has(id)) continue;
            const rec = await idbGet<AssetRecord>('assets', id).catch(() => undefined);
            if (rec) {
                this.records.set(id, rec);
                try {
                    await this.decode(rec);
                } catch {
                    /* corrupt asset */
                }
            }
        }
        this.emit();
    }

    async remove(id: string): Promise<void> {
        this.records.delete(id);
        this.images.get(id)?.source.close();
        this.images.delete(id);
        await idbDelete('assets', id).catch(() => undefined);
        this.emit();
    }

    async embed(ids: (string | null | undefined)[]): Promise<EmbeddedAsset[]> {
        const out: EmbeddedAsset[] = [];
        for (const id of new Set(ids)) {
            const rec = this.get(id);
            if (!rec) continue;
            out.push({ id: rec.id, name: rec.name, type: rec.type, data: await blobToDataUrl(rec.blob) });
        }
        return out;
    }

    async loadEmbedded(list: EmbeddedAsset[]): Promise<void> {
        for (const a of list) {
            if (this.records.has(a.id)) continue;
            const blob = await (await fetch(a.data)).blob();
            await this.add(new Blob([blob], { type: a.type }), a.name, a.id);
        }
    }
}

function isFont(rec: AssetRecord): boolean {
    return /font|ttf|otf|woff/i.test(rec.type) || /\.(ttf|otf|woff2?)$/i.test(rec.name);
}

function guessType(name: string): string {
    if (/\.(png)$/i.test(name)) return 'image/png';
    if (/\.(jpe?g)$/i.test(name)) return 'image/jpeg';
    if (/\.(webp)$/i.test(name)) return 'image/webp';
    if (/\.(gif)$/i.test(name)) return 'image/gif';
    if (/\.(ttf)$/i.test(name)) return 'font/ttf';
    if (/\.(otf)$/i.test(name)) return 'font/otf';
    if (/\.(woff2?)$/i.test(name)) return 'font/woff2';
    return 'application/octet-stream';
}

export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
    });
}

export const assets = new AssetStore();
