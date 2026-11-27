import { useEffect, useRef, useState } from 'react';
import { live } from '../app/preview';
import { appStore, player, seek, togglePlay } from '../app/session';
import { useStore } from '../project/store';
import { formatTime } from './format';
import { IconPause, IconPlay, IconVolume } from './icons';

const SECTION_LABEL: Record<string, string> = {
    intro: 'Intro',
    breakdown: 'Breakdown',
    build: 'Build-up',
    drop: 'Drop',
    main: 'Main',
    outro: 'Outro',
};

export function Transport() {
    const playing = useStore(appStore, (s) => s.playing);
    const duration = useStore(appStore, (s) => s.track?.duration ?? 0);
    const bpm = useStore(appStore, (s) => s.interp?.bpm ?? 0);
    const ready = useStore(appStore, (s) => s.stage === 'ready');
    const timeRef = useRef<HTMLSpanElement>(null);
    const ledRef = useRef<HTMLSpanElement>(null);
    const beatRef = useRef<HTMLSpanElement>(null);
    const secRef = useRef<HTMLSpanElement>(null);
    const playRef = useRef<HTMLButtonElement>(null);
    const [vol, setVol] = useState(0.9);

    useEffect(() => {
        let raf = 0;
        let lastSection = '';
        const tick = () => {
            raf = requestAnimationFrame(tick);
            if (playRef.current) playRef.current.style.setProperty('--k', live.kick.toFixed(3));
            const t = player.playing ? live.time : player.currentTime;
            if (timeRef.current) timeRef.current.textContent = formatTime(t, true);
            if (ledRef.current) ledRef.current.style.opacity = String(0.15 + 0.85 * live.kick);
            if (beatRef.current) beatRef.current.style.transform = `scaleX(${live.beatPhase.toFixed(3)})`;
            if (secRef.current && live.section !== lastSection) {
                lastSection = live.section;
                const el = secRef.current;
                el.textContent = SECTION_LABEL[live.section] ?? '';
                el.classList.toggle('hot', live.section === 'drop');
                el.classList.remove('flash');
                void el.offsetWidth;
                if (live.section === 'drop' || live.section === 'build') el.classList.add('flash');
            }
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    return (
        <div className="transport">
            <button ref={playRef} className="play" onClick={() => void togglePlay()} disabled={!ready} title="Play / pause (Space)">
                {playing ? <IconPause /> : <IconPlay />}
            </button>
            <div className="time">
                <span ref={timeRef}>0:00.0</span>
                <span className="dur"> / {formatTime(duration)}</span>
            </div>
            <button className="btn ghost small" onClick={() => seek(Math.max(0, player.currentTime - 5))} title="Back 5 s (←)">
                −5s
            </button>
            <button className="btn ghost small" onClick={() => seek(Math.min(duration, player.currentTime + 5))} title="Forward 5 s (→)">
                +5s
            </button>
            <div className="spacer" />
            <div className="live" title="Kick detector and beat phase">
                <span className="led" ref={ledRef} />
                <span className="beat">
                    <i ref={beatRef} />
                </span>
                <span className="bpm">{bpm ? `${bpm.toFixed(bpm % 1 ? 1 : 0)} BPM` : '— BPM'}</span>
                <span className="section" ref={secRef} />
            </div>
            <label className="volume" title="Preview volume">
                <IconVolume />
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={vol}
                    style={{ ['--fill' as string]: `${vol * 100}%` }}
                    onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setVol(v);
                        player.setVolume(v);
                    }}
                />
            </label>
        </div>
    );
}
