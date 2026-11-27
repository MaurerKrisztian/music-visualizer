// App-level state that is not part of the saved project: the loaded track,
// analysis results, playback and export status. Plus load/restore logic.

import { applyDropEdits, DEFAULT_SYNC, interpret, type Envelopes, type Interpretation, type SyncOptions } from '../audio/analysis';
import { analyzeInWorker, decodeAudioFile } from '../audio/decode';
import { DEFAULT_REACT, FeatureExtractor, type ReactOptions } from '../audio/features';
import { Player } from '../audio/player';
import { assets } from '../project/assets';
import { createDefaultProject, normalizeProject } from '../project/defaults';
import { parseLyrics } from '../project/lyrics';
import { idbGet, idbPut } from '../project/idb';
import { projectStore, setProject, Store } from '../project/store';
import type { Project } from '../project/types';
import demoUrl from '../assets/demo.mp3';

export interface TrackInfo {
    name: string;
    duration: number;
    sampleRate: number;
    channels: number;
    isDemo: boolean;
}

export interface AppState {
    track: TrackInfo | null;
    stage: 'idle' | 'decoding' | 'analyzing' | 'ready' | 'error';
    progress: number;
    message: string;
    env: Envelopes | null;
    interp: Interpretation | null;
    playing: boolean;
    exporting: boolean;
    tab: string;
    toast: { text: string; kind: 'info' | 'error'; id: number } | null;
}

export const appStore = new Store<AppState>({
    track: null,
    stage: 'idle',
    progress: 0,
    message: '',
    env: null,
    interp: null,
    playing: false,
    exporting: false,
    tab: 'look',
    toast: null,
}, false, false);

export const player = new Player();
let buffer: AudioBuffer | null = null;
let extractor: FeatureExtractor | null = null;
let channels: Float32Array[] = [];
let loadToken = 0;

player.onEnded = () => appStore.update((s) => void (s.playing = false), false);

export function getAudioBuffer(): AudioBuffer | null {
    return buffer;
}

export function getChannels(): Float32Array[] {
    return channels;
}

export function getExtractor(): FeatureExtractor | null {
    return extractor;
}

export function toast(text: string, kind: 'info' | 'error' = 'info'): void {
    appStore.update((s) => void (s.toast = { text, kind, id: Date.now() }), false);
}

/** Full interpretation for a project: detection plus the user's manual drop edits. */
export function interpretFor(env: Envelopes, p: Project): Interpretation {
    return applyDropEdits(interpret(env, syncOptions(p)), p.sync.addedDrops ?? [], p.sync.removedDrops ?? []);
}

function syncKey(p: Project): string {
    return JSON.stringify([syncOptions(p), p.sync.addedDrops, p.sync.removedDrops]);
}

export function syncOptions(p: Project): SyncOptions {
    return {
        ...DEFAULT_SYNC,
        sensitivity: p.sync.sensitivity,
        bpmOverride: p.sync.bpmOverride,
        beatOffsetMs: p.sync.beatOffsetMs,
    };
}

export function reactOptions(p: Project): ReactOptions {
    return {
        ...DEFAULT_REACT,
        kickDecay: p.sync.kickDecay,
        spectrumRelease: p.spectrum.release,
        spectrum: {
            bars: Math.max(8, Math.min(256, Math.round(p.spectrum.bars))),
            minHz: p.spectrum.minHz,
            maxHz: p.spectrum.maxHz,
            gainDb: p.spectrum.gainDb,
            rangeDb: Math.max(10, p.spectrum.rangeDb),
            tiltDb: p.spectrum.tiltDb,
        },
    };
}

/** Splits "Artist - Title.mp3" into its parts. */
export function parseTrackName(fileName: string): { artist: string; title: string } | null {
    const base = fileName
        .replace(/\.[a-z0-9]{2,5}$/i, '')
        .replace(/_/g, ' ')
        .replace(/^\s*\d{1,3}\s*[.)\-–]\s*/, '')
        .trim();
    const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(base);
    if (m) return { artist: m[1].trim(), title: m[2].trim() };
    return base ? { artist: '', title: base } : null;
}

export async function loadAudio(blob: Blob, name: string, opts: { isDemo?: boolean; persist?: boolean; autoMeta?: boolean } = {}): Promise<void> {
    const token = ++loadToken;
    if (blob.size > 250 * 1024 * 1024) toast('Very large file: long DJ mixes can run out of browser memory. Tracks under ~20 minutes work best.');
    player.pause();
    appStore.update((s) => {
        s.stage = 'decoding';
        s.progress = 0;
        s.message = `Decoding ${name}…`;
        s.playing = false;
    }, false);
    try {
        const buf = await decodeAudioFile(blob);
        if (token !== loadToken) return;
        appStore.update((s) => {
            s.stage = 'analyzing';
            s.message = 'Analysing kicks, tempo and drops…';
        }, false);
        const env = await analyzeInWorker(buf, (p) => {
            if (token === loadToken) appStore.update((s) => void (s.progress = p), false);
        });
        if (token !== loadToken) return;
        buffer = buf;
        channels = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
        extractor = new FeatureExtractor({ channels, sampleRate: buf.sampleRate, duration: buf.duration });
        const interp = interpretFor(env, projectStore.get());
        extractor.setAnalysis(env, interp);
        player.load(buf);
        lastSyncKey = syncKey(projectStore.get());
        appStore.update((s) => {
            s.track = { name, duration: buf.duration, sampleRate: buf.sampleRate, channels: buf.numberOfChannels, isDemo: !!opts.isDemo };
            s.stage = 'ready';
            s.progress = 1;
            s.message = '';
            s.env = env;
            s.interp = interp;
        }, false);
        if (opts.autoMeta) {
            const parsed = parseTrackName(name);
            if (parsed) {
                projectStore.update((p) => {
                    if (parsed.artist) p.meta.artist = parsed.artist;
                    p.meta.title = parsed.title;
                    p.export.rangeStart = null;
                    p.export.rangeEnd = null;
                    p.sync.addedDrops = [];
                    p.sync.removedDrops = [];
                    p.lyrics.cues = [];
                });
            }
        }
        if (opts.persist && blob.size < 80 * 1024 * 1024) {
            void idbPut('kv', 'lastAudio', { blob, name }).catch(() => undefined);
        }
    } catch (err) {
        console.error(err);
        if (token !== loadToken) return;
        appStore.update((s) => {
            s.stage = 'error';
            s.message = `Could not load "${name}": ${err instanceof Error ? err.message : String(err)}`;
        }, false);
        toast(`Could not decode ${name}. Try MP3, WAV, FLAC, OGG or M4A.`, 'error');
    }
}

export async function loadDemo(): Promise<void> {
    const res = await fetch(demoUrl);
    const blob = await res.blob();
    await loadAudio(blob, 'Canvasbeats demo (150 BPM)', { isDemo: true });
}

// Re-run the (cheap) interpretation when sync settings change.
let lastSyncKey = '';
projectStore.subscribe(() => {
    const st = appStore.get();
    if (!st.env) return;
    const key = syncKey(projectStore.get());
    if (key === lastSyncKey) return;
    lastSyncKey = key;
    const interp = interpretFor(st.env, projectStore.get());
    extractor?.setAnalysis(st.env, interp);
    appStore.update((s) => void (s.interp = interp), false);
});

export async function togglePlay(): Promise<void> {
    if (!player.hasAudio) return;
    if (player.playing) {
        player.pause();
        appStore.update((s) => void (s.playing = false), false);
    } else {
        await player.play();
        appStore.update((s) => void (s.playing = true), false);
    }
}

export function seek(t: number): void {
    player.seek(t);
    extractor?.reset();
}

// ---------------------------------------------------------------------------
// Autosave / restore
// ---------------------------------------------------------------------------

const LS_KEY = 'canvasbeats.project.v2';
let saveTimer: number | undefined;
let autosaveOn = false;
let restoreStarted = false;

export function startAutosave(): void {
    if (autosaveOn) return;
    autosaveOn = true;
    projectStore.subscribe(() => {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => {
            try {
                localStorage.setItem(LS_KEY, JSON.stringify(projectStore.get()));
            } catch {
                /* quota or private mode */
            }
        }, 400);
    });
}

export async function restoreSession(): Promise<void> {
    if (restoreStarted) return;
    restoreStarted = true;
    let restored: Project | null = null;
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) restored = normalizeProject(JSON.parse(raw));
    } catch {
        restored = null;
    }
    if (restored) {
        await assets.restore([restored.background.imageId, restored.center.imageId, restored.watermark.imageId, restored.text.font.startsWith('Custom ') ? restored.text.font.slice(7) : null]);
        projectStore.set(restored, false);
    } else {
        projectStore.set(createDefaultProject(), false);
    }
    const last = await idbGet<{ blob: Blob; name: string }>('kv', 'lastAudio').catch(() => undefined);
    if (last?.blob) await loadAudio(last.blob, last.name, { persist: false });
    else await loadDemo();
}

export async function loadLyricsFile(f: File): Promise<void> {
    const cues = parseLyrics(f.name, await f.text());
    if (!cues.length) {
        toast(`No timed lines found in ${f.name}.`, 'error');
        return;
    }
    setProject('lyrics.cues', cues);
    toast(`Loaded ${cues.length} lyric lines.`);
}

/** Adds a drop at the nearest bar start, or removes the drop near t. */
export function toggleDropAt(t: number): void {
    const st = appStore.get();
    if (!st.interp) return;
    const it = st.interp;
    const bar = (60 / it.bpm) * 4;
    const existing = Array.from(it.drops).find((d) => Math.abs(d - t) < bar * 0.5);
    projectStore.update((p) => {
        const added = p.sync.addedDrops ?? [];
        const removed = p.sync.removedDrops ?? [];
        if (existing !== undefined) {
            const manualIdx = added.findIndex((a) => Math.abs(a - existing) < bar * 0.5);
            if (manualIdx >= 0) added.splice(manualIdx, 1);
            else removed.push(existing);
        } else {
            let snapped = t;
            let best = Infinity;
            for (let b = it.downbeat; b < it.beats.length; b += 4) {
                const d = Math.abs(it.beats[b] - t);
                if (d < best) {
                    best = d;
                    snapped = it.beats[b];
                }
            }
            const wasRemoved = removed.findIndex((r) => Math.abs(r - snapped) < bar * 0.5);
            if (wasRemoved >= 0) removed.splice(wasRemoved, 1);
            else added.push(snapped);
        }
        p.sync.addedDrops = added;
        p.sync.removedDrops = removed;
    });
}
