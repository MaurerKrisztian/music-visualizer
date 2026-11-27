"""Synthesises the bundled demo track (original, procedurally generated):
150 BPM hardstyle sketch with intro, breakdown, build-up and drop.
Usage: python3 scripts/make-demo.py out.wav  (then encode with ffmpeg)"""
import sys
import numpy as np

sr = 44100
bpm = 150.0
beat = 60.0 / bpm
bar = beat * 4
rng = np.random.default_rng(7)

SECTIONS = [("intro", 8), ("break", 8), ("build", 4), ("drop", 12)]
total_bars = sum(b for _, b in SECTIONS)
N = int((total_bars * bar + 2.0) * sr)
L = np.zeros(N)
R = np.zeros(N)
duck = np.ones(N)  # sidechain gain for melodic parts


def add(sig, t0, gl=1.0, gr=1.0):
    i = int(round(t0 * sr))
    if i >= N:
        return
    n = min(len(sig), N - i)
    L[i:i + n] += sig[:n] * gl
    R[i:i + n] += sig[:n] * gr


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / sr)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):  # small signals only
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def lp(x, fc):
    # vectorised-ish lowpass via FFT brickwall with soft rolloff
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / sr)
    X *= 1 / np.sqrt(1 + (f / fc) ** 4)
    return np.fft.irfft(X, len(x))


def hp(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / sr)
    X *= 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** 4)
    return np.fft.irfft(X, len(x))


def kick(length=0.34):
    n = int(length * sr)
    t = np.arange(n) / sr
    f = 50 + 2600 * np.exp(-t / 0.003) + 170 * np.exp(-t / 0.028)
    ph = 2 * np.pi * np.cumsum(f) / sr
    env = np.exp(-t / 0.3)
    x = np.sin(ph) * env * 4.0
    x = np.tanh(x * 2.5)
    crunch = np.tanh(hp(x, 300) * 6) * 0.25 * np.exp(-t / 0.12)
    click = rng.standard_normal(n) * np.exp(-t / 0.0018) * 0.5
    fade = np.ones(n)
    k = int(0.015 * sr)
    fade[-k:] = np.linspace(1, 0, k)
    return (x * 0.8 + crunch + click) * fade


def reverse_bass():
    n = int(beat * 0.55 * sr)
    t = np.arange(n) / sr
    ph = 2 * np.pi * 50 * t
    env = (t / t[-1]) ** 2.2
    x = np.tanh(np.sin(ph) * 3.0 * env) * 0.55
    k = int(0.01 * sr)
    x[-k:] *= np.linspace(1, 0, k)
    return x


def noise_hit(dur, decay, hpf=6000, gain=0.2):
    n = int(dur * sr)
    t = np.arange(n) / sr
    x = hp(rng.standard_normal(n), hpf) * np.exp(-t / decay)
    return x * gain


def clap():
    n = int(0.25 * sr)
    t = np.arange(n) / sr
    env = np.zeros(n)
    for d in (0.0, 0.008, 0.017):
        env += np.where(t >= d, np.exp(-(t - d) / 0.012), 0)
    env += np.exp(-t / 0.08) * 0.4
    x = hp(lp(rng.standard_normal(n), 3500), 900) * env
    return x * 0.35


def snare(gain):
    n = int(0.18 * sr)
    t = np.arange(n) / sr
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04)
    nz = hp(rng.standard_normal(n), 1200) * np.exp(-t / 0.06)
    return (body * 0.5 + nz * 0.6) * gain


def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def supersaw(freq, dur, voices=7, spread=0.22, att=0.01, rel=0.08, bright=6000):
    n = int(dur * sr)
    t = np.arange(n) / sr
    outL = np.zeros(n)
    outR = np.zeros(n)
    for v in range(voices):
        k = (v - (voices - 1) / 2) / ((voices - 1) / 2)
        f = freq * 2 ** (spread * k / 12)
        ph0 = rng.random()
        saw = 2 * ((t * f + ph0) % 1.0) - 1
        pan = 0.5 + 0.45 * k
        outL += saw * (1 - pan)
        outR += saw * pan
    env = np.minimum(1, t / att) * np.minimum(1, np.maximum(0, (dur - t) / rel))
    outL = lp(outL * env, bright) / voices
    outR = lp(outR * env, bright) / voices
    return outL, outR


def add_st(lr, t0, gain=1.0):
    l, r = lr
    i = int(round(t0 * sr))
    n = min(len(l), N - i)
    L[i:i + n] += l[:n] * gain * duck[i:i + n]
    R[i:i + n] += r[:n] * gain * duck[i:i + n]


# chord progression (A minor): Am F C G, one bar each
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
MELODY = [  # (beat offset within 2 bars, midi, length in beats)
    (0, 76, 1), (1, 74, 0.5), (1.5, 72, 0.5), (2, 71, 1), (3, 72, 1),
    (4, 69, 1.5), (5.5, 71, 0.5), (6, 72, 1), (7, 67, 1),
]

# --- sidechain envelope from kick positions (computed first) ---
kick_times = []
t_bar = 0.0
for name, bars in SECTIONS:
    for b in range(bars):
        for q in range(4):
            tk = t_bar + (b * 4 + q) * beat
            if name in ("intro", "drop"):
                kick_times.append(tk)
    t_bar += bars * bar
tt = np.arange(N) / sr
for tk in kick_times:
    i = int(tk * sr)
    n = int(beat * sr)
    seg = np.arange(min(n, N - i)) / sr
    duck[i:i + len(seg)] = np.minimum(duck[i:i + len(seg)], 1 - 0.75 * np.exp(-seg / 0.11))

K = kick()
RB = reverse_bass()
CL = clap()
t_bar = 0.0
for name, bars in SECTIONS:
    for b in range(bars):
        t0 = t_bar + b * bar
        chord = CHORDS[b % 4]
        if name == "intro":
            for q in range(4):
                add(K, t0 + q * beat, 0.95, 0.95)
                add(noise_hit(0.06, 0.012, 7000, 0.12), t0 + q * beat + beat / 2, 0.8, 1.0)
            if b >= 4:
                add_st(supersaw(note(chord[0] + 12), bar * 0.98, bright=900 + 250 * b), t0, 0.35)
        elif name == "break":
            for m in chord:
                add_st(supersaw(note(m), bar, att=0.25, rel=0.4, bright=2200), t0, 0.22)
            add_st(supersaw(note(chord[0] - 12), bar, voices=3, spread=0.08, att=0.2, rel=0.3, bright=500), t0, 0.25)
            if b >= 2:
                for (o, m, ln) in MELODY:
                    if (b % 2 == 0 and o < 4) or (b % 2 == 1 and o >= 4):
                        oo = o if o < 4 else o - 4
                        add_st(supersaw(note(m), ln * beat * 0.95, voices=5, spread=0.12, att=0.005, rel=0.15, bright=3200), t0 + oo * beat, 0.18)
        elif name == "build":
            prog = b / bars
            div = 2 if b < 2 else (4 if b == 2 else 8)
            for s_ in range(4 * div):
                add(snare(0.25 + 0.5 * (prog + s_ / (16 * div))), t0 + s_ * beat / div, 0.9, 1.0)
            for m in chord:
                add_st(supersaw(note(m), bar, att=0.05, rel=0.2, bright=1500 + 3000 * prog), t0, 0.2)
            n = int(bar * sr)
            tr = np.arange(n) / sr
            riser = hp(rng.standard_normal(n), 2000 + 6000 * prog) * ((b + tr / bar) / bars) ** 2 * 0.25
            add(riser, t0, 0.9, 1.0)
            sweep_f = 200 * 2 ** ((b * bar + tr) / (bars * bar) * 3)
            add(np.sin(2 * np.pi * np.cumsum(sweep_f) / sr) * 0.06 * ((b + tr / bar) / bars), t0)
        elif name == "drop":
            for q in range(4):
                add(K, t0 + q * beat, 1.0, 1.0)
                add(RB, t0 + q * beat + beat * 0.42, 1.0, 1.0)
                add(noise_hit(0.07, 0.015, 7000, 0.14), t0 + q * beat + beat / 2, 1.0, 0.8)
                if q in (1, 3):
                    add(CL, t0 + q * beat, 1.0, 1.0)
            for m in chord:
                add_st(supersaw(note(m + 12), bar, att=0.01, rel=0.1, bright=5200), t0, 0.16)
            for (o, m, ln) in MELODY:
                if (b % 2 == 0 and o < 4) or (b % 2 == 1 and o >= 4):
                    oo = o if o < 4 else o - 4
                    add_st(supersaw(note(m), ln * beat * 0.95, voices=7, spread=0.25, att=0.005, rel=0.08, bright=7000), t0 + oo * beat, 0.24)
    t_bar += bars * bar

# simple stereo delay for space
d = int(beat * 0.75 * sr)
L2 = L.copy()
R2 = R.copy()
L2[d:] += R[:-d] * 0.18
R2[d:] += L[:-d] * 0.18
mix = np.stack([L2, R2], axis=1)
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.6) / np.tanh(1.6)
fade = int(1.5 * sr)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix *= 0.89 / np.max(np.abs(mix))

out = sys.argv[1] if len(sys.argv) > 1 else "demo.wav"
pcm = (mix * 32767).astype(np.int16)
import wave
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes(pcm.tobytes())
print("wrote", out, len(mix) / sr, "s")
