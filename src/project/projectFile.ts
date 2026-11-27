// .canvasbeats project files: the project JSON plus embedded images/fonts.

import { assets } from './assets';
import { createDefaultProject, normalizeProject } from './defaults';
import type { Project } from './types';

interface ProjectFileV2 {
    app: 'canvasbeats';
    format: 2;
    project: Project;
    assets: { id: string; name: string; type: string; data: string }[];
}

export function assetIds(p: Project): (string | null)[] {
    const ids: (string | null)[] = [p.background.imageId, p.center.imageId, p.watermark.imageId];
    if (p.text.font.startsWith('Custom ')) ids.push(p.text.font.slice(7));
    return ids;
}

export async function serializeProject(p: Project): Promise<string> {
    const file: ProjectFileV2 = { app: 'canvasbeats', format: 2, project: p, assets: await assets.embed(assetIds(p)) };
    return JSON.stringify(file);
}

/** Loads a project file (current format or the old v1 save format). */
export async function parseProjectFile(text: string): Promise<Project> {
    const data = JSON.parse(text);
    if (data && data.app === 'canvasbeats' && data.format === 2) {
        await assets.loadEmbedded(data.assets ?? []);
        return normalizeProject(data.project);
    }
    return importLegacy(data);
}

interface LegacySave {
    text?: { textInput?: unknown; fontColor?: unknown };
    background?: { backgroundImage?: unknown; backgroundColor?: unknown };
    simpleBars?: { barColor?: unknown };
}

async function importLegacy(old: LegacySave): Promise<Project> {
    const p = createDefaultProject();
    const text = old?.text;
    if (text?.textInput) p.meta.artist = String(text.textInput);
    p.meta.title = '';
    if (typeof text?.fontColor === 'string') p.text.color = text.fontColor;
    const bg = old?.background;
    if (typeof bg?.backgroundImage === 'string' && bg.backgroundImage.startsWith('data:')) {
        const blob = await (await fetch(bg.backgroundImage)).blob();
        p.background.imageId = await assets.add(blob, 'background');
        p.background.mode = 'image';
    }
    if (typeof bg?.backgroundColor === 'string' && /^#[0-9a-f]{6}$/i.test(bg.backgroundColor)) p.palette.b = bg.backgroundColor;
    const bars = old?.simpleBars;
    if (typeof bars?.barColor === 'string' && /^#[0-9a-f]{6}$/i.test(bars.barColor)) p.palette.a = bars.barColor;
    return p;
}
