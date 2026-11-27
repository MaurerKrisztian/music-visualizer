import type { BackgroundMode } from '../../project/types';
import { HEADER } from './common';

const BG_UNIFORMS = `
uniform float uBgSpeed;
uniform float uBgScale;
uniform float uBgDetail;
uniform float uBgTwist;
uniform float uBgBright;
uniform float uBgReact;
uniform sampler2D uImage;
uniform vec2 uImageSize;
uniform float uHasImage;
uniform float uImgBlur;
uniform float uImgDim;
uniform float uImgZoom;
uniform float uImgRot;
uniform float uImgKaleido;
uniform vec2 uImgShift;
`;

// Shared effect functions (used by background modes and the overlay pass).
const FX_FUNCS = `
vec3 lasers(vec2 p, float count, float spread, float amount) {
    vec2 hs = halfSize();
    vec3 col = vec3(0.0);
    float haze = 0.55 + 0.45 * fbm3(p * 2.5 + vec2(uTime * 0.07, -uTime * 0.03));
    int n = int(count);
    for (int i = 0; i < 16; i++) {
        if (i >= n) break;
        float fi = float(i);
        float side = (fi + 0.5) / count;
        vec2 o = vec2((side - 0.5) * hs.x * 1.7, -hs.y - 0.04);
        float ph = hash11(fi * 3.17 + 1.0) * TAU;
        float sweep = (side - 0.5) * spread + sin(uBar * TAU + ph) * 0.32 * spread * (0.4 + 0.6 * uIntensity);
        vec2 dir = vec2(sin(sweep), cos(sweep));
        vec2 d = p - o;
        float along = dot(d, dir);
        if (along < 0.0) continue;
        float perp = abs(d.x * dir.y - d.y * dir.x);
        float w = 0.0016 + along * 0.0035;
        float core = exp(-perp * perp / (w * w));
        float glow = exp(-perp / (w * 7.0)) * 0.22;
        float fade = exp(-along * 0.45);
        float pattern = step(0.3, hash11(floor(uBeatN) * 1.7 + fi * 7.1));
        float gate = mix(1.0, pattern, 0.65) * (0.3 + 0.7 * max(uBeatPulse, uKick));
        vec3 c = pal(side * 0.55 + uTime * 0.03);
        col += c * (core + glow) * fade * gate * haze;
    }
    return col * amount;
}

vec3 fireRamp(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(vec3(0.0), vec3(0.75, 0.04, 0.0), smoothstep(0.0, 0.35, t));
    c = mix(c, vec3(1.0, 0.42, 0.02), smoothstep(0.3, 0.65, t));
    c = mix(c, vec3(1.0, 0.88, 0.55), smoothstep(0.65, 1.0, t));
    return c;
}

vec3 fire(vec2 p, float height, float amount) {
    vec2 hs = halfSize();
    float y = p.y + hs.y;
    float H = height * (0.5 + 0.35 * uBass + 0.55 * uKick + 0.7 * uDrop + 0.4 * uBuild);
    float tongue = fbm3(vec2(p.x * 4.5, uTime * 0.7));
    float Hx = H * (0.45 + 1.1 * tongue);
    vec2 q = vec2(p.x * 4.0, y * 3.0 - uTime * 2.2);
    float n = fbm(q + vec2(0.0, fbm3(q * 0.7 + uTime * 0.3) * 1.5));
    float n2 = fbm(q * 2.3 + vec2(3.1, -uTime * 1.3));
    float shape = (Hx - y) / max(Hx, 1e-3) + (n - 0.5) * 1.2 + (n2 - 0.5) * 0.5;
    float flame = smoothstep(0.0, 1.0, shape);
    float jets = 0.0;
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float xi = (fi - 1.5) / 1.5 * hs.x * 0.72;
        float act = mod(floor(uBeatN) + fi, 2.0) < 1.0 ? 1.0 : 0.45;
        float jh = uKick * act * (0.5 + 0.5 * uDrop) * (0.2 + height) * 1.6;
        float wx = exp(-pow((p.x - xi) / (0.035 + y * 0.12), 2.0));
        float jn = fbm3(vec2((p.x - xi) * 8.0, y * 4.0 - uTime * 6.0));
        jets += wx * smoothstep(jh, 0.0, y - (jn - 0.5) * 0.18) * step(0.002, jh);
    }
    float t = clamp(flame + jets, 0.0, 1.5);
    return fireRamp(t) * t * amount * 1.3;
}

vec3 smoke(vec2 p, float amount) {
    vec2 hs = halfSize();
    vec2 q = p * 1.5 + vec2(uTime * 0.05, -uTime * 0.01);
    float n = fbm(q + vec2(fbm3(q + uTime * 0.04), 0.0));
    float low = smoothstep(0.8, -0.6, p.y / hs.y);
    float dens = smoothstep(0.38, 0.95, n) * (0.35 + 0.65 * low);
    vec3 tint = mix(uColB, uColA, n) * 0.45 + 0.12;
    return tint * dens * amount * (0.35 + 0.45 * uKick + 0.35 * uEnergy);
}
`;

const BACKGROUNDS: Record<BackgroundMode, string> = {
    image: `
vec3 sampleImage(vec2 q) {
    vec2 hs = halfSize();
    float ia = uImageSize.x / max(uImageSize.y, 1.0);
    vec2 ih = vec2(ia, 1.0) * 0.5;
    float s = max(hs.x / ih.x, hs.y / ih.y);
    vec2 iuv = q / (ih * s) * 0.5 + 0.5;
    iuv.y = 1.0 - iuv.y;
    if (uImgBlur < 0.01) return texture(uImage, iuv).rgb;
    float lod = uImgBlur * 6.5;
    vec2 texel = exp2(lod) / uImageSize;
    vec3 c = vec3(0.0);
    for (int i = -1; i <= 1; i++)
        for (int j = -1; j <= 1; j++)
            c += textureLod(uImage, iuv + vec2(float(i), float(j)) * texel * 0.7, lod).rgb;
    return c / 9.0;
}
vec3 background(vec2 uv, vec2 p) {
    if (uHasImage < 0.5) {
        float r = length(p);
        return mix(uColB * 0.35, uColA * 0.03, smoothstep(0.0, 0.9, r)) * (0.8 + 0.4 * uBass);
    }
    vec2 q = rot(uImgRot) * p / uImgZoom + uImgShift;
    if (uImgKaleido > 1.5) {
        float a = atan(q.y, q.x) + uSpin * 0.2;
        float r = length(q);
        float seg = TAU / uImgKaleido;
        a = mod(a, seg);
        a = abs(a - seg * 0.5);
        q = vec2(cos(a), sin(a)) * r;
    }
    vec3 c = sampleImage(q);
    return c * (1.0 - uImgDim) * (1.0 + uKick * 0.22 * uBgReact) * uBgBright * 1.25;
}`,

    tunnel: `
vec3 background(vec2 uv, vec2 p) {
    p = rot(uSpin * 0.25) * p;
    p += vec2(sin(uTime * 0.37), cos(uTime * 0.29)) * 0.05 * uBgTwist;
    float sides = floor(mix(3.0, 9.0, uBgDetail));
    float a = atan(p.y, p.x);
    float r = length(p);
    float seg = TAU / sides;
    float pr = max(r * cos(mod(a, seg) - seg * 0.5), 1e-4);
    float sc = mix(1.2, 5.0, uBgScale);
    float z = 0.25 / pr;
    float depth = z + uMove;
    float u = a / seg + uBgTwist * z * 0.12;
    vec2 tc = vec2(u, depth * sc);
    vec2 cell = floor(tc);
    vec2 f = fract(tc);
    float dRing = min(f.y, 1.0 - f.y) / sc * pr * pr / 0.25;
    float dEdge = min(f.x, 1.0 - f.x) * seg * pr;
    float w = 0.0022;
    float ringI = exp(-dRing / w) + 0.3 * exp(-dRing / (w * 7.0));
    float edgeI = exp(-dEdge / w) * 0.7 + 0.15 * exp(-dEdge / (w * 8.0));
    vec3 rc = pal(cell.y * 0.13 + uTime * 0.02);
    float pulse = 0.35 + 0.6 * uEnergy + 1.5 * uKick * exp(-z * 0.1);
    float panel = step(0.86, hash21(cell + floor(uBeatN * 0.5))) * (0.3 + uHigh);
    float fog = smoothstep(0.0, 0.2, pr);
    float far = exp(-z * 0.035);
    float face = mod(cell.x, 2.0);
    vec3 wall = pal(cell.x / sides * 0.5 + 0.15) * (0.035 + 0.03 * face) * (0.6 + 0.6 * uBass);
    vec3 col = (wall + rc * ringI * pulse + uColB * edgeI * (0.35 + 0.8 * uMid)) * fog * far;
    col += pal(hash21(cell) + 0.3) * panel * 0.25 * fog * far;
    col += uColA * exp(-r * 9.0) * (0.3 + 0.6 * uBass + 0.7 * uKick);
    return col * uBgBright * 1.35;
}`,

    warp: `
vec3 background(vec2 uv, vec2 p) {
    p = rot(uSpin * 0.1) * p;
    float r = length(p);
    float a = atan(p.y, p.x);
    vec3 col = vec3(0.0);
    float density = mix(40.0, 170.0, uBgScale);
    for (int L = 0; L < 4; L++) {
        float fl = float(L);
        float n = floor(density * (0.6 + 0.3 * fl));
        float t = (a / TAU + 0.5) * n;
        float cell = floor(t);
        float fx = fract(t) - 0.5;
        float h = hash21(vec2(cell, fl * 13.0 + 1.0));
        float h2 = hash21(vec2(cell * 1.7, fl * 7.0 + 3.0));
        float spd = 0.2 + 0.4 * h2;
        float z = fract(h * 11.0 + uMove * spd * (0.6 + fl * 0.25));
        float sr = 0.02 + pow(z, 2.2) * 1.7;
        float len = (0.01 + 0.32 * pow(z, 2.0)) * (0.3 + 0.6 * uEnergy + 0.9 * uKick) * mix(0.5, 1.6, uBgDetail);
        float ad = abs(fx) * TAU / n * r;
        float w = 0.001 + 0.0032 * z;
        float tail = smoothstep(sr - len, sr, r) * (1.0 - smoothstep(sr, sr + 0.004, r));
        float star = exp(-ad * ad / (w * w)) * tail;
        float present = step(0.45, h2);
        col += mix(vec3(1.0), pal(h + fl * 0.25), 0.55) * star * present * (0.4 + z * 1.5);
    }
    col += mix(uColA, uColB, 0.5) * exp(-r * 4.0) * (0.12 + 0.45 * uBass);
    col += uColC * 0.07 * fbm3(p * 3.0 + uMove * 0.1);
    return col * uBgBright * 1.3;
}`,

    lasers: `
vec3 background(vec2 uv, vec2 p) {
    vec2 hs = halfSize();
    vec3 col = mix(uColB * 0.05, vec3(0.0), smoothstep(-hs.y, hs.y, p.y));
    col += lasers(p, floor(mix(4.0, 14.0, uBgDetail)), mix(0.6, 2.2, uBgScale), 1.0);
    // second fan from the top, mirrored and offset in time
    vec2 pt = vec2(p.x, -p.y);
    col += lasers(rot(0.0) * pt + vec2(0.0, 0.0), floor(mix(3.0, 8.0, uBgDetail)), mix(0.4, 1.4, uBgScale), 0.45 * uBgTwist);
    col += smoke(p, 0.35);
    return col * uBgBright * 1.2;
}`,

    hex: `
vec4 hexCoord(vec2 p) {
    const vec2 s = vec2(1.0, 1.7320508);
    vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
    vec4 h = vec4(p - hC.xy * s, p - (hC.zw + 0.5) * s);
    return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy) : vec4(h.zw, hC.zw + 0.5);
}
float hexEdge(vec2 p) { p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
vec3 background(vec2 uv, vec2 p) {
    float sc = mix(5.0, 18.0, uBgScale);
    vec2 pp = rot(uSpin * 0.05) * p;
    // slight perspective tilt
    pp.y *= 1.0 + uBgTwist * 0.6 * pp.y;
    vec2 q = pp * sc;
    vec4 h = hexCoord(q);
    float e = hexEdge(h.xy);
    vec2 cc = h.zw * vec2(1.0, 1.7320508) / sc;
    float cellR = length(cc);
    float rnd = hash21(h.zw);
    float wave = 0.0;
    for (int k = 0; k < 4; k++) {
        float age = uKickAge[k];
        float rr = age * mix(0.7, 2.2, uBgSpeed);
        float d = cellR - rr;
        wave += uKickStr[k] * exp(-d * d * 30.0) * exp(-age * 1.3);
    }
    float sparkle = step(0.97 - uHigh * 0.06, hash21(h.zw + floor(uTime * 6.0)));
    float dE = (0.5 - e) / sc;
    float edge = exp(-dE / 0.0022) * 0.85 + exp(-dE / 0.012) * 0.2;
    float fill = smoothstep(0.5, 0.25, e);
    vec3 c = pal(rnd * 0.25 + cellR * 0.4 - uTime * 0.03);
    vec3 col = c * edge * (0.12 + 0.45 * uEnergy + 0.7 * wave) + c * fill * (wave * 0.7 + sparkle * 0.5 * uBgDetail);
    col *= smoothstep(1.8, 0.1, cellR) + 0.12;
    return col * uBgBright * 1.3;
}`,

    grid: `
vec3 background(vec2 uv, vec2 p) {
    vec2 hs = halfSize();
    float horizon = 0.04;
    vec3 col = mix(uColB * 0.3, uColA * 0.02, smoothstep(horizon, hs.y, p.y));
    vec2 sp = p - vec2(0.0, horizon + 0.17);
    float sr = 0.21 * (1.0 + 0.05 * uKick);
    float aa = px() * 1.5;
    float sun = smoothstep(sr + aa, sr - aa, length(sp));
    float stripes = step(0.45, fract(sp.y * 26.0 + uTime * 0.5));
    sun *= mix(1.0, stripes, smoothstep(0.06, -0.16, sp.y));
    col = mix(col, mix(uColC, uColA, smoothstep(-0.2, 0.22, sp.y)) * (0.9 + 0.4 * uBass), sun * step(horizon, p.y));
    col += uColC * exp(-length(sp) * 5.0) * 0.22 * step(horizon, p.y);
    float d = horizon - p.y;
    float ceilY = horizon + 0.42;
    bool isFloor = d > 0.0;
    bool isCeil = uBgDetail > 0.5 && p.y > ceilY;
    if (isFloor || isCeil) {
        float dd = isFloor ? d : (p.y - ceilY);
        float z = 0.16 / dd;
        float sc = mix(1.5, 5.0, uBgScale);
        vec2 g = vec2(p.x * z * sc + sin(uTime * 0.3) * uBgTwist * z * 0.3, z * sc + uMove * 2.0);
        vec2 f = abs(fract(g) - 0.5);
        vec2 fw = fwidth(g) + 1e-5;
        vec2 dl = (0.5 - f) / fw * px();
        float line = exp(-dl.x / 0.0016) + exp(-dl.y / 0.0016) + 0.25 * (exp(-dl.x / 0.008) + exp(-dl.y / 0.008));
        float fog = exp(-z * 0.1);
        vec3 gc = mix(uColA, uColC, 0.5 + 0.5 * sin(floor(g.y) * 0.7));
        col += gc * line * fog * (0.45 + 0.9 * uKick + 0.4 * uEnergy);
    }
    col += uColC * exp(-abs(p.y - horizon) * 28.0) * (0.35 + uBass * 0.6);
    return col * uBgBright;
}`,

    nebula: `
vec3 background(vec2 uv, vec2 p) {
    vec2 q = rot(uSpin * 0.05) * p * mix(1.0, 3.2, uBgScale);
    float t = uMove * 0.15;
    vec2 w = vec2(fbm(q + vec2(0.0, t)), fbm(q + vec2(5.2, 1.3 - t)));
    vec2 w2 = vec2(fbm(q + 3.5 * w + vec2(1.7, 9.2) + t * 0.5), fbm(q + 3.5 * w + vec2(8.3, 2.8)));
    float n = fbm(q + 3.5 * w2);
    vec3 col = mix(uColA * 0.06, uColB, smoothstep(0.25, 0.95, n));
    col = mix(col, uColC, smoothstep(0.55, 1.1, length(w2)) * 0.55);
    col *= 0.3 + 1.1 * n * n * (0.6 + uBass * 0.7 + uKick * 0.5);
    float st = pow(hash21(floor(uv * uRes / 2.0)), 400.0) * (0.5 + uHigh);
    col += vec3(st) * mix(0.3, 1.0, uBgDetail);
    return col * uBgBright * 1.2;
}`,

    plasma: `
vec3 background(vec2 uv, vec2 p) {
    vec2 q = rot(uSpin * 0.08) * p * mix(1.5, 5.0, uBgScale);
    float t = uMove * 0.5;
    q += vec2(fbm3(q + t * 0.2), fbm3(q - t * 0.2)) * uBgTwist * 1.5;
    float v = sin(q.x * 1.3 + t) + sin(q.y * 1.7 - t * 1.2) + sin((q.x + q.y) * 0.9 + t * 0.7) + sin(length(q) * 2.5 - t * 1.5 + uBass * 2.0);
    v *= 0.25;
    float bands = 0.5 + 0.5 * sin(v * PI * mix(1.0, 5.0, uBgDetail) + uKick);
    vec3 col = pal(v * 0.5 + 0.5 + uTime * 0.02) * (0.25 + 0.75 * bands);
    return col * (0.35 + uEnergy * 0.45 + uKick * 0.35) * uBgBright * 1.2;
}`,

    kaleido: `
vec3 background(vec2 uv, vec2 p) {
    vec2 q = rot(uSpin * 0.12) * p;
    float segs = floor(mix(4.0, 14.0, uBgDetail));
    float a = atan(q.y, q.x);
    float r = length(q);
    float s = TAU / segs;
    a = abs(mod(a, s) - s * 0.5);
    q = vec2(cos(a), sin(a)) * r;
    vec2 z = q * mix(1.2, 3.5, uBgScale);
    vec3 col = vec3(0.0);
    vec2 c = vec2(0.92 + 0.08 * sin(uMove * 0.3), 0.62 + 0.08 * cos(uMove * 0.21)) * (1.0 + 0.04 * uBass + 0.03 * uKick);
    for (int i = 0; i < 9; i++) {
        z = abs(z) / max(dot(z, z), 1e-3) - c;
        col += pal(float(i) * 0.09 + uTime * 0.04 + r) * exp(-length(z) * mix(1.6, 0.8, uBgTwist)) * 0.55;
    }
    return col * (0.6 + 0.9 * uKick + 0.4 * uEnergy) * uBgBright;
}`,

    void: `
vec3 background(vec2 uv, vec2 p) {
    float r = length(p);
    vec3 col = mix(uColB * 0.22, vec3(0.0), smoothstep(0.0, 1.0, r));
    col += uColA * exp(-r * 5.0) * (0.08 + 0.35 * uBass + 0.25 * uKick);
    col += (fbm3(p * 4.0 + uMove * 0.05) - 0.5) * 0.04 * uBgDetail;
    return max(col, 0.0) * uBgBright;
}`,
};

export function backgroundShader(mode: BackgroundMode): string {
    return `${HEADER}${BG_UNIFORMS}${FX_FUNCS}${BACKGROUNDS[mode]}
void main() {
    vec2 p = centered(vUv);
    outColor = vec4(max(background(vUv, p), 0.0), 1.0);
}`;
}

export const OVERLAY_SHADER = `${HEADER}${BG_UNIFORMS}${FX_FUNCS}
uniform float uFireAmt;
uniform float uFireH;
uniform float uLaserAmt;
uniform float uSmokeAmt;
void main() {
    vec2 p = centered(vUv);
    vec3 col = vec3(0.0);
    if (uSmokeAmt > 0.001) col += smoke(p, uSmokeAmt);
    if (uLaserAmt > 0.001) col += lasers(p, 8.0, 1.3, uLaserAmt);
    if (uFireAmt > 0.001) col += fire(p, uFireH, uFireAmt);
    outColor = vec4(col, 0.0);
}`;
