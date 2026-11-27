// Sample-accurate playback of a decoded AudioBuffer with seeking, volume and
// latency-compensated "visual time" for tight kick sync in the preview.

export class Player {
    private ctx: AudioContext | null = null;
    private gain: GainNode | null = null;
    private source: AudioBufferSourceNode | null = null;
    private buffer: AudioBuffer | null = null;
    private offset = 0;
    private startedAt = 0;
    private volume = 0.9;
    playing = false;
    onEnded: (() => void) | null = null;
    private recordDest: MediaStreamAudioDestinationNode | null = null;

    private ensureContext(): AudioContext {
        if (!this.ctx) {
            this.ctx = new AudioContext({ latencyHint: 'interactive' });
            this.gain = this.ctx.createGain();
            this.gain.gain.value = this.volume;
            this.gain.connect(this.ctx.destination);
        }
        return this.ctx;
    }

    load(buffer: AudioBuffer): void {
        this.stopSource();
        this.buffer = buffer;
        this.offset = 0;
        this.playing = false;
    }

    get duration(): number {
        return this.buffer?.duration ?? 0;
    }

    get hasAudio(): boolean {
        return !!this.buffer;
    }

    /** Playback position of what is being heard right now. */
    get currentTime(): number {
        if (!this.playing || !this.ctx) return this.offset;
        const t = this.offset + (this.ctx.currentTime - this.startedAt);
        return Math.min(t, this.duration);
    }

    /** Position compensated for output latency, for drawing in sync. */
    get visualTime(): number {
        if (!this.playing || !this.ctx) return this.offset;
        const latency = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
        return Math.max(0, Math.min(this.duration, this.currentTime - latency));
    }

    async play(from?: number): Promise<void> {
        if (!this.buffer) return;
        const ctx = this.ensureContext();
        if (ctx.state === 'suspended') await ctx.resume();
        if (from !== undefined) this.offset = from;
        if (this.offset >= this.duration - 0.01) this.offset = 0;
        this.stopSource();
        const src = ctx.createBufferSource();
        src.buffer = this.buffer;
        src.connect(this.gain!);
        if (this.recordDest) src.connect(this.recordDest);
        src.onended = () => {
            if (this.source === src && this.playing) {
                this.playing = false;
                this.offset = this.duration;
                this.source = null;
                this.onEnded?.();
            }
        };
        this.startedAt = ctx.currentTime;
        src.start(0, this.offset);
        this.source = src;
        this.playing = true;
    }

    pause(): void {
        if (!this.playing) return;
        this.offset = this.currentTime;
        this.playing = false;
        this.stopSource();
    }

    seek(t: number): void {
        const clamped = Math.max(0, Math.min(this.duration, t));
        if (this.playing) {
            void this.play(clamped);
        } else {
            this.offset = clamped;
        }
    }

    setVolume(v: number): void {
        this.volume = v;
        if (this.gain) this.gain.gain.value = v;
    }

    /** Audio stream for the real-time (MediaRecorder) export fallback. */
    getRecordStream(): MediaStream {
        const ctx = this.ensureContext();
        if (!this.recordDest) this.recordDest = ctx.createMediaStreamDestination();
        return this.recordDest.stream;
    }

    private stopSource(): void {
        if (this.source) {
            const s = this.source;
            this.source = null;
            try {
                s.onended = null;
                s.stop();
            } catch {
                /* already stopped */
            }
            s.disconnect();
        }
    }
}
