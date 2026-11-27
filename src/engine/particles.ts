// CPU particle simulation, uploaded as instanced quads. Seeded RNG and fixed
// time steps keep exports deterministic.

import type { Features } from '../audio/features';
import { mulberry32 } from '../audio/dsp';
import type { Project } from '../project/types';

export const MAX_PARTICLES = 4000;
export const PARTICLE_STRIDE = 8;

export class ParticleSystem {
    readonly data = new Float32Array(MAX_PARTICLES * PARTICLE_STRIDE);
    count = 0;
    private readonly x = new Float32Array(MAX_PARTICLES);
    private readonly y = new Float32Array(MAX_PARTICLES);
    private readonly vx = new Float32Array(MAX_PARTICLES);
    private readonly vy = new Float32Array(MAX_PARTICLES);
    private readonly life = new Float32Array(MAX_PARTICLES);
    private readonly maxLife = new Float32Array(MAX_PARTICLES);
    private readonly size = new Float32Array(MAX_PARTICLES);
    private readonly seed = new Float32Array(MAX_PARTICLES);
    private readonly colT = new Float32Array(MAX_PARTICLES);
    private alive = 0;
    private rng = mulberry32(1);
    private mode = 'none';
    private spawnAcc = 0;
    private time = 0;

    reset(seed = 1): void {
        this.rng = mulberry32(seed);
        this.alive = 0;
        this.spawnAcc = 0;
        this.time = 0;
        this.count = 0;
    }

    private spawn(): number {
        if (this.alive >= MAX_PARTICLES) return -1;
        const i = this.alive++;
        this.seed[i] = this.rng();
        this.colT[i] = this.rng();
        this.life[i] = 0;
        return i;
    }

    private kill(i: number): void {
        const last = --this.alive;
        if (i === last) return;
        this.x[i] = this.x[last];
        this.y[i] = this.y[last];
        this.vx[i] = this.vx[last];
        this.vy[i] = this.vy[last];
        this.life[i] = this.life[last];
        this.maxLife[i] = this.maxLife[last];
        this.size[i] = this.size[last];
        this.seed[i] = this.seed[last];
        this.colT[i] = this.colT[last];
    }

    update(
        dt: number,
        s: Project['particles'],
        f: Features,
        hsx: number,
        hsy: number,
        cx: number,
        cy: number,
        ringR: number,
        dyn: number,
    ): void {
        if (s.mode !== this.mode) {
            this.reset();
            this.mode = s.mode;
        }
        if (s.mode === 'none') {
            this.count = 0;
            return;
        }
        dt = Math.min(Math.max(dt, 0), 0.1);
        this.time += dt;
        const rnd = this.rng;
        const target = Math.min(MAX_PARTICLES, Math.max(0, Math.round(s.count)));
        const speed = 0.25 + 1.5 * s.speed;
        const kick = f.kick * s.kickBoost * dyn;
        const sizeMul = 0.4 + 1.6 * s.size;

        // spawning
        if (s.mode === 'warp' || s.mode === 'dust') {
            let n = Math.min(target - this.alive, Math.ceil(target * dt * 3) + 2);
            while (n-- > 0) {
                const i = this.spawn();
                if (i < 0) break;
                if (s.mode === 'warp') {
                    const a = rnd() * Math.PI * 2;
                    const r = 0.01 + rnd() * 0.12;
                    this.x[i] = cx + Math.cos(a) * r;
                    this.y[i] = cy + Math.sin(a) * r;
                    const v = 0.04 + rnd() * 0.08;
                    this.vx[i] = Math.cos(a) * v;
                    this.vy[i] = Math.sin(a) * v;
                    this.size[i] = 0.0012 + rnd() * 0.0025;
                    this.maxLife[i] = 1e9;
                } else {
                    this.x[i] = (rnd() * 2 - 1) * hsx;
                    this.y[i] = (rnd() * 2 - 1) * hsy;
                    const a = rnd() * Math.PI * 2;
                    const v = 0.004 + rnd() * 0.012;
                    this.vx[i] = Math.cos(a) * v;
                    this.vy[i] = Math.sin(a) * v;
                    this.size[i] = 0.002 + Math.pow(rnd(), 3) * 0.012;
                    this.maxLife[i] = 5 + rnd() * 8;
                }
            }
        } else if (s.mode === 'embers') {
            this.spawnAcc += (target / 4.5) * dt * (1 + kick * 1.5);
            while (this.spawnAcc >= 1) {
                this.spawnAcc -= 1;
                const i = this.spawn();
                if (i < 0) break;
                this.x[i] = (rnd() * 2 - 1) * hsx * 1.05;
                this.y[i] = -hsy - 0.02 - rnd() * 0.05;
                this.vx[i] = (rnd() - 0.5) * 0.03;
                this.vy[i] = 0.05 + rnd() * 0.12;
                this.size[i] = 0.0015 + rnd() * 0.0035;
                this.maxLife[i] = 3 + rnd() * 4;
            }
        } else if (s.mode === 'sparks') {
            this.spawnAcc += target * 0.15 * dt;
            let burst = f.kickHit > 0 ? Math.round(target * 0.22 * f.kickHit * (0.4 + 0.6 * s.kickBoost) * dyn) : 0;
            if (f.dropHit > 0) burst += Math.round(target * 0.6);
            while (this.spawnAcc >= 1 || burst > 0) {
                if (burst > 0) burst--;
                else this.spawnAcc -= 1;
                const i = this.spawn();
                if (i < 0) break;
                const a = rnd() * Math.PI * 2;
                this.x[i] = cx + Math.cos(a) * ringR;
                this.y[i] = cy + Math.sin(a) * ringR;
                const v = 0.15 + rnd() * 0.55;
                this.vx[i] = Math.cos(a) * v;
                this.vy[i] = Math.sin(a) * v;
                this.size[i] = 0.0012 + rnd() * 0.002;
                this.maxLife[i] = 0.5 + rnd() * 0.9;
            }
        }

        // simulation + instance data
        const d = this.data;
        const t = this.time;
        let out = 0;
        for (let i = 0; i < this.alive; i++) {
            this.life[i] += dt;
            const life = this.life[i];
            if (life > this.maxLife[i]) {
                this.kill(i);
                i--;
                continue;
            }
            let alpha = s.opacity;
            let stretch = 0;
            let sz = this.size[i] * sizeMul;
            const sd = this.seed[i];
            if (s.mode === 'warp') {
                const dx = this.x[i] - cx;
                const dy = this.y[i] - cy;
                const r = Math.sqrt(dx * dx + dy * dy);
                const acc = 1 + dt * (0.9 + 2.5 * f.energy) * speed;
                this.vx[i] *= acc;
                this.vy[i] *= acc;
                const boost = 1 + kick * 3;
                this.x[i] += this.vx[i] * dt * speed * boost;
                this.y[i] += this.vy[i] * dt * speed * boost;
                const v = Math.hypot(this.vx[i], this.vy[i]);
                stretch = Math.min(14, v * speed * boost * 9);
                sz *= 1 + r * 2.5;
                alpha *= Math.min(1, Math.max(0, (r - 0.03) / 0.15));
                if (Math.abs(this.x[i]) > hsx + 0.1 || Math.abs(this.y[i]) > hsy + 0.1) {
                    this.kill(i);
                    i--;
                    continue;
                }
            } else if (s.mode === 'embers') {
                this.vx[i] += Math.sin(t * 1.3 + sd * 40) * 0.05 * dt;
                const boost = 1 + kick * 2;
                this.x[i] += this.vx[i] * dt * speed * boost;
                this.y[i] += this.vy[i] * dt * speed * boost;
                const k = life / this.maxLife[i];
                alpha *= Math.min(1, life * 2) * (1 - k) * (0.65 + 0.35 * Math.sin(t * 18 + sd * 90));
                stretch = Math.min(3, this.vy[i] * boost * 6);
            } else if (s.mode === 'dust') {
                this.x[i] += this.vx[i] * dt * speed * (1 + kick);
                this.y[i] += this.vy[i] * dt * speed * (1 + kick);
                const k = life / this.maxLife[i];
                alpha *= Math.min(1, life / 1.5) * Math.min(1, (1 - k) * 3) * (0.45 + 0.35 * f.energy + 0.6 * kick);
                if (this.x[i] > hsx + 0.05) this.x[i] = -hsx - 0.05;
                if (this.x[i] < -hsx - 0.05) this.x[i] = hsx + 0.05;
                if (this.y[i] > hsy + 0.05) this.y[i] = -hsy - 0.05;
                if (this.y[i] < -hsy - 0.05) this.y[i] = hsy + 0.05;
            } else {
                const drag = Math.exp(-dt * 2.8);
                this.vx[i] *= drag;
                this.vy[i] = this.vy[i] * drag - 0.12 * dt;
                this.x[i] += this.vx[i] * dt * speed;
                this.y[i] += this.vy[i] * dt * speed;
                const k = life / this.maxLife[i];
                alpha *= 1 - k * k;
                stretch = Math.min(10, Math.hypot(this.vx[i], this.vy[i]) * speed * 14);
            }
            const o = out * 8;
            d[o] = this.x[i];
            d[o + 1] = this.y[i];
            d[o + 2] = sz;
            d[o + 3] = alpha;
            d[o + 4] = this.vx[i];
            d[o + 5] = this.vy[i];
            d[o + 6] = stretch;
            d[o + 7] = this.colT[i];
            out++;
        }
        this.count = out;
    }
}
