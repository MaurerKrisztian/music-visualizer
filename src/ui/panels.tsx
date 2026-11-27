import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { presetThumb, renderThumbs, subscribeThumbs, thumbsVersion } from '../app/thumbs';
import { appStore, loadAudio, loadDemo, loadLyricsFile, seek, toast } from '../app/session';
import { assets } from '../project/assets';
import { customFontList, ensureFont, FONTS } from '../project/fonts';
import { applyPreset, PRESETS, surprise } from '../project/presets';
import { projectStore, setProject, useProject, useStore } from '../project/store';
import { BACKGROUND_MODES, PARTICLE_MODES, SPECTRUM_STYLES, type BackgroundMode, type SpectrumStyle } from '../project/types';
import { Color, Hint, ImageSlot, Section, Segmented, Select, Slider, TextField, Toggle } from './controls';
import { useAssets } from './hooks';
import { formatTime } from './format';
import { IconMusic } from './icons';

const BG_LABELS: Record<BackgroundMode, string> = {
    image: 'Image / cover art',
    stage: 'Festival stage',
    tunnel: 'Neon tunnel',
    warp: 'Hyperspace warp',
    lasers: 'Laser show',
    hex: 'Hex shockwave grid',
    grid: 'Retro grid + sun',
    nebula: 'Nebula smoke',
    plasma: 'Liquid plasma',
    kaleido: 'Kaleidoscope fractal',
    gradient: 'Soft gradient',
    void: 'Minimal void',
};

const SPEC_LABELS: Record<SpectrumStyle, string> = {
    'radial-bars': 'Radial bars',
    'radial-wave': 'Radial layered wave',
    'linear-bars': 'Bars',
    'center-bars': 'Centre bars (audiogram)',
    blocks: 'LED meter',
    dots: 'Dot matrix',
    line: 'Thin line',
    'linear-wave': 'Mountain wave',
    oscilloscope: 'Oscilloscope',
    'circle-scope': 'Circular scope',
    terrain: '3D terrain',
    none: 'Off',
};

const PALETTES: [string, string, string][] = [
    ['#00e5ff', '#7a2cff', '#ff2bd6'],
    ['#ff5a00', '#ff0033', '#ffc400'],
    ['#ff0022', '#ffffff', '#7a0010'],
    ['#39ff14', '#ff00aa', '#fff200'],
    ['#ffb300', '#ffffff', '#2979ff'],
    ['#2af5ff', '#3d5afe', '#e0f7ff'],
    ['#05d9e8', '#7700ff', '#ff2a6d'],
    ['#00d2ff', '#4a00e0', '#8e2de2'],
    ['#f72585', '#7209b7', '#4cc9f0'],
    ['#ffffff', '#8a8a8a', '#ffffff'],
];

// ---------------------------------------------------------------------------

export function LookPanel() {
    const [active, setActive] = useState<string | null>(null);
    const interp = useStore(appStore, (s) => s.interp);
    const artist = useProject((p) => p.meta.artist);
    const title = useProject((p) => p.meta.title);
    const bgImage = useProject((p) => p.background.imageId);
    const logo = useProject((p) => p.center.imageId);
    useSyncExternalStore(subscribeThumbs, thumbsVersion);
    useEffect(() => {
        const t = setTimeout(() => void renderThumbs(), 400);
        return () => clearTimeout(t);
    }, [interp, artist, title, bgImage, logo]);
    return (
        <div className="panel">
            <div className="row look-head">
                <Hint>Pick a starting look, then fine-tune it in the other tabs. Your text, images and sync settings are kept.</Hint>
                <button
                    className="btn small"
                    title="Random preset and colours"
                    onClick={() => {
                        const p = surprise(projectStore.get());
                        projectStore.set(p);
                        setActive(null);
                        void ensureFont(p.text.font);
                    }}
                >
                    🎲 Surprise me
                </button>
            </div>
            {[
                { title: 'Full effects', list: PRESETS.filter((p) => p.group !== 'simple') },
                { title: 'Simple', list: PRESETS.filter((p) => p.group === 'simple') },
            ].map(({ title, list }) => (
                <div key={title}>
                    <div className="preset-group">{title}</div>
                    <div className="preset-grid">
                        {list.map((p) => (
                            <button
                                key={p.id}
                                className={`preset${active === p.id ? ' on' : ''}`}
                                onClick={() => {
                                    projectStore.set(applyPreset(projectStore.get(), p));
                                    setActive(p.id);
                                    void ensureFont(String(p.patch.text?.font ?? 'Orbitron'));
                                }}
                            >
                                <span className="swatch" style={{ background: `linear-gradient(120deg, ${p.swatch[0]}, ${p.swatch[1]} 55%, ${p.swatch[2]})` }}>
                                    {presetThumb(p.id) && <img src={presetThumb(p.id)} alt="" loading="lazy" />}
                                </span>
                                <span className="preset-name">{p.name}</span>
                                <span className="preset-tags">{p.tags}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------

export function AudioPanel() {
    const track = useStore(appStore, (s) => s.track);
    const interp = useStore(appStore, (s) => s.interp);
    const bpmOverride = useProject((p) => p.sync.bpmOverride);
    const editedDrops = useProject((p) => (p.sync.addedDrops?.length ?? 0) + (p.sync.removedDrops?.length ?? 0));
    const input = useRef<HTMLInputElement>(null);
    const [tap, setTap] = useState<number[]>([]);

    const onTap = () => {
        const now = performance.now();
        const taps = [...tap.filter((t) => now - t < 3000), now];
        setTap(taps);
        if (taps.length >= 4) {
            const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
            setProject('sync.bpmOverride', Math.round((60000 / iv) * 10) / 10);
        }
    };
    const shown = bpmOverride ?? interp?.bpm ?? 0;

    return (
        <div className="panel">
            <Section title="Track">
                <div className="track-card">
                    <IconMusic />
                    <div>
                        <div className="track-name">{track ? track.name : 'No track loaded'}</div>
                        <div className="track-meta">{track ? `${formatTime(track.duration)} · ${track.sampleRate / 1000} kHz · ${track.channels === 1 ? 'mono' : 'stereo'}` : 'Drop an audio file anywhere'}</div>
                    </div>
                </div>
                <div className="row">
                    <button className="btn primary" onClick={() => input.current?.click()}>
                        Open audio…
                    </button>
                    {!track?.isDemo && (
                        <button className="btn ghost" onClick={() => void loadDemo()}>
                            Load demo
                        </button>
                    )}
                </div>
                <input
                    ref={input}
                    type="file"
                    accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
                    hidden
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void loadAudio(f, f.name, { persist: true, autoMeta: true });
                        e.target.value = '';
                    }}
                />
                <TextField label="Artist" path="meta.artist" placeholder="Artist" />
                <TextField label="Title" path="meta.title" placeholder="Track title" />
            </Section>

            <Section title="Analysis">
                {interp ? (
                    <>
                        <div className="stats">
                            <div>
                                <b>{interp.bpm.toFixed(interp.bpm % 1 ? 2 : 0)}</b>
                                <span>BPM{bpmOverride ? ' (manual)' : ''}</span>
                            </div>
                            <div>
                                <b>{interp.kicks.length}</b>
                                <span>kicks</span>
                            </div>
                            <div>
                                <b>{interp.drops.length}</b>
                                <span>drops</span>
                            </div>
                            <div>
                                <b>{Math.round(interp.bpmConfidence * 100)}%</b>
                                <span>grid fit</span>
                            </div>
                        </div>
                        <Hint>Double-click the timeline to add a drop the analysis missed, or to remove a wrong one.</Hint>
                        {editedDrops > 0 && (
                            <button
                                className="btn small ghost"
                                onClick={() =>
                                    projectStore.update((p) => {
                                        p.sync.addedDrops = [];
                                        p.sync.removedDrops = [];
                                    })
                                }
                            >
                                Reset drop edits ({editedDrops})
                            </button>
                        )}
                        {interp.drops.length > 0 && (
                            <div className="chips">
                                {Array.from(interp.drops).map((d, i) => (
                                    <button key={i} className="chip" onClick={() => seek(Math.max(0, d - 4))} title="Jump 4 s before the drop">
                                        Drop {i + 1} · {formatTime(d)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <Hint>Analysis appears here once a track is loaded.</Hint>
                )}
            </Section>

            <Section title="Sync">
                <div className="ctl bpm-row">
                    <span className="lbl">Tempo</span>
                    <div className="bpm-ctl">
                        <input
                            type="number"
                            min={40}
                            max={400}
                            step={0.1}
                            value={shown ? Number(shown.toFixed(2)) : ''}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setProject('sync.bpmOverride', Number.isFinite(v) && v > 0 ? v : null);
                            }}
                        />
                        <button className="btn small ghost" onClick={() => setProject('sync.bpmOverride', shown / 2)} title="Half tempo">
                            ½
                        </button>
                        <button className="btn small ghost" onClick={() => setProject('sync.bpmOverride', shown * 2)} title="Double tempo">
                            ×2
                        </button>
                        <button className="btn small ghost" onClick={onTap} title="Tap along to the beat (4+ taps)">
                            Tap
                        </button>
                        <button className={`btn small${bpmOverride ? '' : ' on'}`} onClick={() => setProject('sync.bpmOverride', null)} title="Use detected tempo">
                            Auto
                        </button>
                    </div>
                </div>
                <Slider label="Beat offset" path="sync.beatOffsetMs" min={-250} max={250} step={1} unit=" ms" hint="Shifts the beat grid" />
                <Slider label="Kick sensitivity" path="sync.sensitivity" min={0} max={1} step={0.01} display={100} unit="%" hint="Higher finds softer kicks" />
                <Slider label="Kick decay" path="sync.kickDecay" min={0.05} max={0.6} step={0.01} unit=" s" hint="How long each kick pulse lasts" />
                <Slider label="Preview delay" path="sync.previewOffsetMs" min={-150} max={150} step={1} unit=" ms" hint="Only for the live preview; compensates Bluetooth / audio latency. Exports are always exact." />
                <Hint>Kicks, build-ups and drops are detected offline from the whole track, so the visuals hit exactly on the kick, including in the exported video.</Hint>
            </Section>
        </div>
    );
}

// ---------------------------------------------------------------------------

export function ScenePanel() {
    const mode = useProject((p) => p.background.mode);
    const dropColors = useProject((p) => p.palette.dropColors);
    const fire = useProject((p) => p.overlays.fire);
    const crowd = useProject((p) => p.overlays.crowd);
    return (
        <div className="panel">
            <Section title="Colours">
                <div className="palette-row">
                    <Color label="Primary" path="palette.a" />
                    <Color label="Secondary" path="palette.b" />
                    <Color label="Accent" path="palette.c" />
                </div>
                <div className="palettes">
                    {PALETTES.map((pal, i) => (
                        <button
                            key={i}
                            className="pal"
                            title="Apply palette"
                            style={{ background: `linear-gradient(90deg, ${pal[0]} 0 33%, ${pal[1]} 33% 66%, ${pal[2]} 66%)` }}
                            onClick={() =>
                                projectStore.update((p) => {
                                    p.palette.a = pal[0];
                                    p.palette.b = pal[1];
                                    p.palette.c = pal[2];
                                })
                            }
                        />
                    ))}
                </div>
                <Toggle label="Drop colours" path="palette.dropColors" hint="Blend to a second palette when the track gets intense (drops)" />
                {dropColors && (
                    <div className="palette-row">
                        <Color label="Drop primary" path="palette.da" />
                        <Color label="Drop secondary" path="palette.db" />
                        <Color label="Drop accent" path="palette.dc" />
                    </div>
                )}
                <Slider label="Hue drift" path="palette.hueSpeed" min={-30} max={30} step={0.5} unit="°/s" />
                <Slider label="Hue jump on drop" path="palette.dropHueShift" min={0} max={180} step={1} unit="°" />
            </Section>

            <Section title="Background">
                <Select label="Style" path="background.mode" options={BACKGROUND_MODES.map((m) => ({ value: m, label: BG_LABELS[m] }))} />
                <Select
                    label="Drop scene"
                    path="background.dropMode"
                    options={[{ value: 'same', label: 'Same as style' }, ...BACKGROUND_MODES.map((m) => ({ value: m, label: BG_LABELS[m] }))]}
                />
                {mode === 'image' ? (
                    <>
                        <ImageSlot label="Image" path="background.imageId" hint="Cover art or any picture; it pulses with the kicks" />
                        <Slider label="Blur" path="background.imageBlur" />
                        <Slider label="Darken" path="background.imageDim" />
                        <Slider label="Kick zoom" path="background.imageKickZoom" />
                        <Slider label="Drift" path="background.imageDrift" hint="Slow Ken Burns motion" />
                        <Slider label="Kaleidoscope" path="background.imageKaleido" min={0} max={12} step={1} hint="0 = off" />
                    </>
                ) : (
                    <>
                        <Slider label="Speed" path="background.speed" />
                        <Slider label="Scale" path="background.scale" />
                        <Slider label="Detail" path="background.detail" />
                        <Slider label="Twist" path="background.twist" />
                    </>
                )}
                <Slider label="Brightness" path="background.brightness" min={0} max={1.5} />
                <Slider label="Music reactivity" path="background.react" hint="How much energy and kicks drive the motion" />
            </Section>

            <Section title="Atmosphere">
                <Slider label="Lasers" path="overlays.lasers" />
                <Slider label="Smoke" path="overlays.smoke" />
                <Slider label="Fire & pyro" path="overlays.fire" hint="Flames at the bottom; pyro jets fire on kicks" />
                {fire > 0 && <Slider label="Flame height" path="overlays.fireHeight" />}
                <Slider label="God rays" path="overlays.rays" hint="Light rays streaming from the centre, brighter on kicks" />
                <Slider label="Lightning" path="overlays.lightning" hint="Lightning strikes on every drop and on some big kicks" />
                <Slider label="Festival crowd" path="overlays.crowd" hint="Backlit crowd silhouettes in the foreground; people jump on the kicks" />
                {crowd > 0 && <Slider label="Crowd height" path="overlays.crowdHeight" />}
            </Section>
        </div>
    );
}

// ---------------------------------------------------------------------------

export function ElementsPanel() {
    const style = useProject((p) => p.spectrum.style);
    const centerOn = useProject((p) => p.center.enabled);
    const pmode = useProject((p) => p.particles.mode);
    const radial = style.startsWith('radial') || style === 'circle-scope';
    const layered = style === 'radial-wave' || style === 'linear-wave';
    const bars = style === 'radial-bars' || style === 'linear-bars' || style === 'center-bars' || style === 'blocks' || style === 'dots';
    const peaks = style === 'radial-bars' || style === 'linear-bars' || style === 'blocks' || style === 'dots';
    const segmented = style === 'blocks' || style === 'dots';
    return (
        <div className="panel">
            <Section title="Spectrum">
                <Select label="Style" path="spectrum.style" options={SPECTRUM_STYLES.map((s) => ({ value: s, label: SPEC_LABELS[s] }))} />
                {style !== 'none' && (
                    <>
                        {style !== 'oscilloscope' && style !== 'circle-scope' && <Slider label="Bands" path="spectrum.bars" min={16} max={160} step={1} />}
                        {radial ? (
                            <Slider label="Radius" path="spectrum.radius" min={0.05} max={0.4} step={0.005} />
                        ) : (
                            <>
                                <Slider label="Width" path="spectrum.width" min={0.2} max={1} />
                                <Slider label="Position X" path="spectrum.x" min={-1} max={1} />
                                <Slider label="Position Y" path="spectrum.y" min={-1} max={1} />
                            </>
                        )}
                        <Slider label="Height" path="spectrum.height" min={0.02} max={0.45} step={0.005} />
                        {!segmented && <Slider label="Thickness" path="spectrum.thickness" min={0} max={0.02} step={0.0005} digits={4} />}
                        {bars && <Slider label="Gap" path="spectrum.gap" min={0} max={0.9} />}
                        {peaks && <Toggle label="Peak caps" path="spectrum.peaks" hint="Small caps that hold at the peak and fall slowly" />}
                        {layered && <Slider label="Layers" path="spectrum.layers" min={1} max={8} step={1} />}
                        <Toggle label="Mirror" path="spectrum.mirror" />
                        {radial && <Slider label="Rotation" path="spectrum.rotate" min={-180} max={180} step={1} unit="°" />}
                        <Segmented
                            label="Colour"
                            path="spectrum.colorMode"
                            options={[
                                { value: 'palette', label: 'Palette' },
                                { value: 'reactive', label: 'Reactive' },
                                { value: 'rainbow', label: 'Rainbow' },
                                { value: 'mono', label: 'Mono' },
                            ]}
                        />
                        <Slider label="Kick bounce" path="spectrum.kickScale" min={0} max={1.5} />
                        {radial && <Slider label="Kick echo" path="spectrum.echo" hint="Copies of the spectrum fly outward as rings on each kick" />}
                        <Slider label="Opacity" path="spectrum.opacity" />
                    </>
                )}
            </Section>
            {style !== 'none' && (
                <Section title="Spectrum tuning" defaultOpen={false}>
                    <Slider label="Fall speed" path="spectrum.release" min={0.03} max={0.6} step={0.01} unit=" s" />
                    <Slider label="Gain" path="spectrum.gainDb" min={-24} max={24} step={0.5} unit=" dB" />
                    <Slider label="Range" path="spectrum.rangeDb" min={20} max={90} step={1} unit=" dB" />
                    <Slider label="Treble lift" path="spectrum.tiltDb" min={0} max={8} step={0.1} unit=" dB/oct" />
                    <Slider label="Lowest freq" path="spectrum.minHz" min={20} max={200} step={1} unit=" Hz" />
                    <Slider label="Highest freq" path="spectrum.maxHz" min={2000} max={20000} step={100} unit=" Hz" />
                </Section>
            )}

            <Section title="Logo / centre" aside={<CenterSwitch />}>
                {centerOn ? (
                    <>
                        <Segmented
                            label="Shape"
                            path="center.shape"
                            options={[
                                { value: 'circle', label: 'Circle' },
                                { value: 'square', label: 'Cover' },
                                { value: 'vinyl', label: 'Vinyl' },
                            ]}
                        />
                        <ImageSlot label="Logo / cover" path="center.imageId" hint="Your logo or cover art. On the vinyl it becomes the record label." />
                        <Slider label="Size" path="center.radius" min={0.04} max={0.4} step={0.005} />
                        <Slider label="Kick pulse" path="center.kickScale" min={0} max={1.5} />
                        <Slider label="Ring" path="center.ring" />
                        <Slider label="Ring glow" path="center.ringGlow" />
                        <Slider label="Shock rings" path="center.shockRings" hint="Rings that fly out on each kick" />
                        <Slider label="Jelly wobble" path="center.wobble" hint="Squash and stretch on each kick" />
                        <Slider label="Spin" path="center.spin" min={-1} max={1} />
                        <Slider label="Position X" path="center.x" min={-1} max={1} />
                        <Slider label="Position Y" path="center.y" min={-1} max={1} />
                    </>
                ) : (
                    <Hint>Centre element is off. Radial spectrums still use this position.</Hint>
                )}
            </Section>

            <Section title="Particles">
                <Segmented
                    path="particles.mode"
                    options={PARTICLE_MODES.map((m) => ({ value: m, label: m === 'none' ? 'Off' : m[0].toUpperCase() + m.slice(1) }))}
                />
                {pmode !== 'none' && (
                    <>
                        <Slider label="Amount" path="particles.count" min={20} max={2500} step={10} />
                        <Slider label="Size" path="particles.size" />
                        <Slider label="Speed" path="particles.speed" />
                        <Slider label="Kick boost" path="particles.kickBoost" min={0} max={1.5} />
                        <Slider label="Opacity" path="particles.opacity" />
                        <Toggle label="Drop burst" path="particles.dropBurst" hint="An explosion of sparks on every drop" />
                        <Segmented
                            label="Colour"
                            path="particles.colorMode"
                            options={[
                                { value: 'palette', label: 'Palette' },
                                { value: 'white', label: 'White' },
                                { value: 'fire', label: 'Fire' },
                            ]}
                        />
                    </>
                )}
            </Section>
        </div>
    );
}

function CenterSwitch() {
    const on = useProject((p) => p.center.enabled);
    return (
        <button type="button" className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} onClick={() => setProject('center.enabled', !on)}>
            <i />
        </button>
    );
}

// ---------------------------------------------------------------------------

export function TextPanel() {
    const enabled = useProject((p) => p.text.enabled);
    const font = useProject((p) => p.text.font);
    const progress = useProject((p) => p.progress.enabled);
    const stroke = useProject((p) => p.text.stroke);
    const watermark = useProject((p) => !!p.watermark.imageId);
    const cueCount = useProject((p) => p.lyrics.cues.length);
    const lyricInput = useRef<HTMLInputElement>(null);
    useAssets();
    const fontInput = useRef<HTMLInputElement>(null);
    const custom = customFontList();
    return (
        <div className="panel">
            <Section title="Title text" aside={<TextSwitch />}>
                <TextField label="Artist" path="meta.artist" placeholder="Artist" />
                <TextField label="Title" path="meta.title" placeholder="Track title" />
                {enabled && (
                    <>
                        <label className="ctl select">
                            <span className="lbl">Font</span>
                            <select
                                value={font}
                                style={{ fontFamily: `"${font}"` }}
                                onChange={(e) => {
                                    void ensureFont(e.target.value);
                                    setProject('text.font', e.target.value);
                                }}
                            >
                                {custom.length > 0 && (
                                    <optgroup label="Your fonts">
                                        {custom.map((f) => (
                                            <option key={f.family} value={f.family}>
                                                {f.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                                <optgroup label="Built-in">
                                    {FONTS.map((f) => (
                                        <option key={f.family} value={f.family}>
                                            {f.label}
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        </label>
                        <div className="row end">
                            <button className="btn small ghost" onClick={() => fontInput.current?.click()}>
                                Upload font…
                            </button>
                            <input
                                ref={fontInput}
                                type="file"
                                accept=".ttf,.otf,.woff,.woff2"
                                hidden
                                onChange={async (e) => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    try {
                                        const id = await assets.add(f, f.name);
                                        setProject('text.font', assets.fontFamily(id));
                                    } catch {
                                        toast('That font file could not be loaded.', 'error');
                                    }
                                    e.target.value = '';
                                }}
                            />
                        </div>
                        <Slider label="Size" path="text.size" min={0.015} max={0.15} step={0.001} digits={3} />
                        <Slider label="Title size" path="text.subSize" min={0.2} max={1.2} hint="Size of the second line relative to the first" />
                        <Slider label="Letter spacing" path="text.spacing" min={-0.05} max={0.5} />
                        <Toggle label="UPPERCASE" path="text.uppercase" />
                        <Segmented
                            label="Align"
                            path="text.align"
                            options={[
                                { value: 'left', label: 'Left' },
                                { value: 'center', label: 'Centre' },
                                { value: 'right', label: 'Right' },
                            ]}
                        />
                        <Slider label="Position X" path="text.x" min={-1} max={1} />
                        <Slider label="Position Y" path="text.y" min={-1} max={1} />
                        <Color label="Artist colour" path="text.color" />
                        <Color label="Title colour" path="text.subColor" />
                        <Slider label="Outline" path="text.stroke" />
                        {stroke > 0 && <Color label="Outline colour" path="text.strokeColor" />}
                        <Slider label="Glow" path="text.glow" />
                        <Slider label="Kick pulse" path="text.pulse" />
                        <Slider label="Glitch" path="text.glitch" />
                        <Select
                            label="Letter animation"
                            path="text.anim"
                            options={[
                                { value: 'none', label: 'None' },
                                { value: 'bounce', label: 'Bounce on kicks' },
                                { value: 'wave', label: 'Wave' },
                                { value: 'jitter', label: 'Jitter' },
                                { value: 'flicker', label: 'Neon flicker' },
                                { value: 'explode', label: 'Explode on drops' },
                            ]}
                        />
                        <Slider label="Animation amount" path="text.animAmount" />
                        <Slider label="Intro title card" path="text.intro" min={0} max={10} step={0.5} unit=" s" hint="Shows the title big in the centre at the start of the video, then glides it into place (0 = off)" />
                    </>
                )}
            </Section>
            <Section title="Lyrics / subtitles" defaultOpen={false}>
                <Hint>Load time-coded lyrics (.lrc) or subtitles (.srt). Each line pops in on time, using the title font.</Hint>
                <div className="row">
                    <button className="btn small" onClick={() => lyricInput.current?.click()}>
                        Load .lrc / .srt…
                    </button>
                    {cueCount > 0 && (
                        <button className="btn small ghost" onClick={() => setProject('lyrics.cues', [])}>
                            Clear ({cueCount} lines)
                        </button>
                    )}
                </div>
                <input
                    ref={lyricInput}
                    type="file"
                    accept=".lrc,.srt,.txt"
                    hidden
                    onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (!f) return;
                        await loadLyricsFile(f);
                    }}
                />
                {cueCount > 0 && (
                    <>
                        <Slider label="Position Y" path="lyrics.y" min={-1} max={1} />
                        <Slider label="Size" path="lyrics.size" min={0.015} max={0.12} step={0.001} digits={3} />
                        <Color label="Colour" path="lyrics.color" />
                        <Slider label="Glow" path="lyrics.glow" />
                        <Toggle label="UPPERCASE" path="lyrics.uppercase" />
                    </>
                )}
            </Section>
            <Section title="Channel logo (watermark)">
                <ImageSlot label="Image" path="watermark.imageId" hint="PNG with transparency works best" />
                {watermark && (
                    <>
                        <Segmented
                            label="Corner"
                            path="watermark.corner"
                            options={[
                                { value: 'tl', label: '↖' },
                                { value: 'tr', label: '↗' },
                                { value: 'bl', label: '↙' },
                                { value: 'br', label: '↘' },
                            ]}
                        />
                        <Slider label="Size" path="watermark.size" min={0.03} max={0.4} step={0.005} />
                        <Slider label="Margin" path="watermark.margin" min={0} max={0.15} step={0.005} />
                        <Slider label="Opacity" path="watermark.opacity" />
                        <Slider label="Kick pulse" path="watermark.pulse" />
                    </>
                )}
            </Section>
            <Section title="Progress bar" aside={<ProgressSwitch />}>
                {progress ? (
                    <>
                        <Slider label="Position Y" path="progress.y" min={-1} max={1} />
                        <Slider label="Thickness" path="progress.thickness" min={0.001} max={0.02} step={0.0005} digits={4} />
                        <Color label="Colour" path="progress.color" />
                        <Slider label="Glow" path="progress.glow" />
                    </>
                ) : (
                    <Hint>Shows how far into the track the video is.</Hint>
                )}
            </Section>
        </div>
    );
}

function TextSwitch() {
    const on = useProject((p) => p.text.enabled);
    return (
        <button type="button" className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} onClick={() => setProject('text.enabled', !on)}>
            <i />
        </button>
    );
}

function ProgressSwitch() {
    const on = useProject((p) => p.progress.enabled);
    return (
        <button type="button" className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} onClick={() => setProject('progress.enabled', !on)}>
            <i />
        </button>
    );
}

// ---------------------------------------------------------------------------

export function FxPanel() {
    const strobe = useProject((p) => p.fx.strobe);
    return (
        <div className="panel">
            <Section title="Impact">
                <Slider label="Camera shake" path="fx.shake" />
                <Slider label="Zoom punch" path="fx.zoomPunch" />
                <Slider label="Zoom blur" path="fx.zoomBlur" hint="Radial motion blur on kicks and drops" />
                <Slider label="Shockwave" path="fx.shockwave" hint="Screen ripple on each kick" />
                <Slider label="Flash" path="fx.flash" hint="Light flash on kicks and drops" />
                <Slider label="Strobe" path="fx.strobe" hint="Flashes on every beat during drops" />
                {strobe > 0.2 && <Hint>⚠ Strong strobe can trigger photosensitive viewers. Consider a warning in your video description.</Hint>}
                <Slider label="Breakdown calm" path="fx.dynamics" hint="How much calmer breakdowns are than drops (uses the detected intensity)" />
                <Slider label="Build-up tension" path="fx.buildBoost" hint="Extra shake and zoom ramping into each drop" />
                <Slider label="Camera cuts" path="fx.cuts" hint="Jumps to a new camera angle on every bar during intense parts, like a VJ edit" />
                <Slider label="Camera drift" path="fx.drift" hint="Slow, living camera motion" />
                <Slider label="Breakdown blur" path="fx.dreamy" hint="Soft focus in breakdowns that sharpens through the build-up into the drop" />
            </Section>
            <Section title="Glow & colour">
                <Slider label="Bloom" path="fx.bloom" min={0} max={1.5} />
                <Slider label="Bloom threshold" path="fx.bloomThreshold" min={0} max={1.5} />
                <Slider label="Bloom radius" path="fx.bloomRadius" />
                <Slider label="Lens flares" path="fx.flare" hint="Horizontal anamorphic streaks on bright lights, like a festival camera" />
                <Slider label="Exposure" path="fx.exposure" min={0.3} max={2} />
                <Slider label="Contrast" path="fx.contrast" min={0.5} max={1.6} />
                <Slider label="Saturation" path="fx.saturation" min={0} max={2} />
            </Section>
            <Section title="Distortion">
                <Slider label="Chromatic aberration" path="fx.chromatic" />
                <Slider label="Glitch" path="fx.glitch" hint="Slice / block glitches on strong kicks and drops" />
                <Slider label="Trails" path="fx.trails" hint="Echo trails on spectrum and particles" />
                <Slider label="Trail zoom" path="fx.trailZoom" />
                <Slider label="Trail spin" path="fx.trailSpin" min={-1} max={1} />
            </Section>
            <Section title="Film">
                <Slider label="Vignette" path="fx.vignette" />
                <Slider label="Grain" path="fx.grain" hint="Grain makes video files bigger; keep it low for YouTube" />
                <Slider label="Scanlines" path="fx.scanlines" />
                <Slider label="Letterbox" path="fx.letterbox" />
                <Slider label="Fade in" path="fx.fadeIn" min={0} max={8} step={0.1} unit=" s" />
                <Slider label="Fade out" path="fx.fadeOut" min={0} max={8} step={0.1} unit=" s" />
            </Section>
        </div>
    );
}

