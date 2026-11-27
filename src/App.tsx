import { useEffect, useRef, useState } from 'react';
import { appStore, loadAudio, loadLyricsFile, player, restoreSession, seek, startAutosave, toast, togglePlay } from './app/session';
import { safeFileName } from './export/settings';
import { assets } from './project/assets';
import { ensureFont } from './project/fonts';
import { parseProjectFile, serializeProject } from './project/projectFile';
import { projectStore, setProject, useProject, useStore } from './project/store';
import { ExportPanel } from './ui/ExportPanel';
import { IconFilm, IconOpen, IconRedo, IconSave, IconUndo } from './ui/icons';
import { AudioPanel, ElementsPanel, FxPanel, LookPanel, ScenePanel, TextPanel } from './ui/panels';
import { Preview } from './ui/Preview';
import { Timeline } from './ui/Timeline';
import { Transport } from './ui/Transport';

const TABS = [
    { id: 'look', label: 'Presets' },
    { id: 'audio', label: 'Audio' },
    { id: 'scene', label: 'Scene' },
    { id: 'elements', label: 'Elements' },
    { id: 'text', label: 'Text' },
    { id: 'fx', label: 'FX' },
    { id: 'export', label: 'Export' },
];

const isAudio = (f: File) => f.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|oga|m4a|aac|opus|aiff?)$/i.test(f.name);
const isImage = (f: File) => f.type.startsWith('image/');
const isFont = (f: File) => /\.(ttf|otf|woff2?)$/i.test(f.name);
const isProject = (f: File) => /\.(canvasbeats|json)$/i.test(f.name);
const isLyrics = (f: File) => /\.(lrc|srt)$/i.test(f.name);

async function handleFiles(files: FileList | File[]) {
    for (const f of Array.from(files)) {
        if (isAudio(f)) {
            void loadAudio(f, f.name, { persist: true, autoMeta: true });
        } else if (isImage(f)) {
            const id = await assets.add(f, f.name);
            projectStore.update((p) => {
                p.background.imageId = id;
                p.background.mode = 'image';
            });
            toast('Image set as background. Use Elements › Logo to put an image in the centre.');
        } else if (isFont(f)) {
            const id = await assets.add(f, f.name);
            setProject('text.font', assets.fontFamily(id));
            toast(`Font "${f.name}" loaded.`);
        } else if (isProject(f)) {
            await openProjectFile(f);
        } else if (isLyrics(f)) {
            await loadLyricsFile(f);
        } else {
            toast(`Unsupported file: ${f.name}`, 'error');
        }
    }
}

async function openProjectFile(f: File) {
    try {
        const p = await parseProjectFile(await f.text());
        projectStore.set(p);
        void ensureFont(p.text.font);
        toast(`Project "${f.name}" loaded.`);
    } catch (e) {
        toast(`Could not open project: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
}

async function saveProjectFile() {
    const p = projectStore.get();
    const json = await serializeProject(p);
    const name = safeFileName([p.meta.artist, p.meta.title].filter(Boolean).join(' - ') || 'project');
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.canvasbeats`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    toast('Project saved.');
}

export default function App() {
    const tab = useStore(appStore, (s) => s.tab);
    const track = useStore(appStore, (s) => s.track);
    const toastMsg = useStore(appStore, (s) => s.toast);
    const font = useProject((p) => p.text.font);
    const [dragging, setDragging] = useState(false);
    const audioInput = useRef<HTMLInputElement>(null);
    const projectInput = useRef<HTMLInputElement>(null);
    const [toastVisible, setToastVisible] = useState(false);

    useEffect(() => {
        startAutosave();
        void restoreSession();
    }, []);

    useEffect(() => {
        void ensureFont(font);
    }, [font]);

    useEffect(() => {
        if (!toastMsg) return;
        setToastVisible(true);
        const t = setTimeout(() => setToastVisible(false), 4000);
        return () => clearTimeout(t);
    }, [toastMsg]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement;
            const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key.toLowerCase() === 'z') {
                if (typing) return;
                e.preventDefault();
                if (e.shiftKey) projectStore.redo();
                else projectStore.undo();
            } else if (mod && e.key.toLowerCase() === 'y') {
                if (typing) return;
                e.preventDefault();
                projectStore.redo();
            } else if (mod && e.key.toLowerCase() === 's') {
                e.preventDefault();
                void saveProjectFile();
            } else if (mod && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                projectInput.current?.click();
            } else if (typing) {
                return;
            } else if (e.code === 'Space') {
                e.preventDefault();
                void togglePlay();
            } else if (e.key === 'ArrowLeft') {
                seek(Math.max(0, player.currentTime - (e.shiftKey ? 1 : 5)));
            } else if (e.key === 'ArrowRight') {
                seek(player.currentTime + (e.shiftKey ? 1 : 5));
            }
        };
        let depth = 0;
        const onEnter = (e: DragEvent) => {
            if (!e.dataTransfer?.types.includes('Files')) return;
            depth++;
            setDragging(true);
        };
        const onLeave = () => {
            depth = Math.max(0, depth - 1);
            if (depth === 0) setDragging(false);
        };
        const onOver = (e: DragEvent) => e.preventDefault();
        const onDrop = (e: DragEvent) => {
            e.preventDefault();
            depth = 0;
            setDragging(false);
            if (e.dataTransfer?.files?.length) void handleFiles(e.dataTransfer.files);
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('dragenter', onEnter);
        window.addEventListener('dragleave', onLeave);
        window.addEventListener('dragover', onOver);
        window.addEventListener('drop', onDrop);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('dragenter', onEnter);
            window.removeEventListener('dragleave', onLeave);
            window.removeEventListener('dragover', onOver);
            window.removeEventListener('drop', onDrop);
        };
    }, []);

    const setTab = (id: string) => appStore.update((s) => void (s.tab = id), false);

    return (
        <div className="app">
            <header className="topbar">
                <div className="brand">
                    <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={26} height={26} />
                    <span className="brand-name">Canvasbeats</span>
                    <span className="brand-tag">hard dance visualizer</span>
                </div>
                <div className="now-playing" title={track?.name}>
                    {track ? track.name : ''}
                </div>
                <div className="actions">
                    <button className="btn ghost" onClick={() => audioInput.current?.click()} title="Open an audio file (or drop it anywhere)">
                        Open audio
                    </button>
                    <button className="icon-btn" onClick={() => projectStore.undo()} title="Undo (Ctrl+Z)">
                        <IconUndo />
                    </button>
                    <button className="icon-btn" onClick={() => projectStore.redo()} title="Redo (Ctrl+Shift+Z)">
                        <IconRedo />
                    </button>
                    <button className="icon-btn" onClick={() => projectInput.current?.click()} title="Open project (Ctrl+O)">
                        <IconOpen />
                    </button>
                    <button className="icon-btn" onClick={() => void saveProjectFile()} title="Save project file (Ctrl+S)">
                        <IconSave />
                    </button>
                    <button className="btn primary" onClick={() => setTab('export')}>
                        <IconFilm /> Export video
                    </button>
                </div>
                <input
                    ref={audioInput}
                    type="file"
                    accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
                    hidden
                    onChange={(e) => {
                        if (e.target.files) void handleFiles(e.target.files);
                        e.target.value = '';
                    }}
                />
                <input
                    ref={projectInput}
                    type="file"
                    accept=".canvasbeats,.json"
                    hidden
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void openProjectFile(f);
                        e.target.value = '';
                    }}
                />
            </header>
            <main className="main">
                <div className="stage-col">
                    <Preview />
                    <Transport />
                    <Timeline />
                </div>
                <aside className="sidebar">
                    <nav className="tabs">
                        {TABS.map((t) => (
                            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
                                {t.label}
                            </button>
                        ))}
                    </nav>
                    <div className="tab-body">
                        {tab === 'look' && <LookPanel />}
                        {tab === 'audio' && <AudioPanel />}
                        {tab === 'scene' && <ScenePanel />}
                        {tab === 'elements' && <ElementsPanel />}
                        {tab === 'text' && <TextPanel />}
                        {tab === 'fx' && <FxPanel />}
                        {tab === 'export' && <ExportPanel />}
                    </div>
                </aside>
            </main>
            {dragging && (
                <div className="drop-overlay">
                    <div>
                        <b>Drop it</b>
                        <span>audio · cover art / images · fonts · .lrc / .srt lyrics · .canvasbeats projects</span>
                    </div>
                </div>
            )}
            {toastMsg && (
                <div key={toastMsg.id} className={`toast ${toastMsg.kind}${toastVisible ? ' show' : ''}`}>
                    {toastMsg.text}
                </div>
            )}
        </div>
    );
}
