import { HEADER } from './common';

export const SPECTRUM_SHADER = `${HEADER}
uniform sampler2D uSpec;
uniform float uSpecBars;
uniform float uSpecRow;
uniform float uSpecHist;
uniform sampler2D uWave;
uniform int uStyle;
uniform vec2 uSpCenter;
uniform float uSpRadius;
uniform float uSpHeight;
uniform float uSpWidth;
uniform float uSpThick;
uniform float uSpGap;
uniform float uSpLayers;
uniform float uSpMirror;
uniform float uSpRot;
uniform float uSpOpacity;
uniform int uSpColor;

float specRaw(float idx, float back) {
    float row = mod(uSpecRow - back + uSpecHist, uSpecHist);
    int i = int(clamp(idx, 0.0, uSpecBars - 1.0));
    return texelFetch(uSpec, ivec2(i, int(row)), 0).r;
}

// Cubic (Catmull-Rom) interpolation along the bars for smooth curves.
float specSmooth(float x, float back) {
    float fx = clamp(x, 0.0, 1.0) * (uSpecBars - 1.0);
    float i = floor(fx);
    float t = fx - i;
    float p0 = specRaw(i - 1.0, back);
    float p1 = specRaw(i, back);
    float p2 = specRaw(i + 1.0, back);
    float p3 = specRaw(i + 2.0, back);
    float v = p1 + 0.5 * t * (p2 - p0 + t * (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3 + t * (3.0 * (p1 - p2) + p3 - p0)));
    return clamp(v, 0.0, 1.0);
}

float waveAt(float x, float ch) {
    return texture(uWave, vec2(clamp(x, 0.0, 1.0), (ch + 0.5) * 0.5)).r;
}

vec3 spColor(float x, float v) {
    if (uSpColor == 0) return grad(x);
    if (uSpColor == 1) return mix(uColA, uColC, smoothstep(0.15, 0.95, v)) * (0.6 + 0.6 * v);
    if (uSpColor == 2) return hsv2rgb(vec3(fract(x * 0.85 + uTime * 0.05), 0.85, 1.0));
    return uColA;
}

float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 d = abs(p) - b + r;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
    return length(pa - ba * h);
}

vec4 radialBars(vec2 p) {
    vec2 q = rot(-uSpRot) * (p - uSpCenter);
    float r = length(q);
    float ang = atan(q.x, q.y);
    float x;
    float nAround;
    if (uSpMirror > 0.5) { x = abs(ang) / PI; nAround = uSpecBars * 2.0; }
    else { x = ang / TAU + 0.5; nAround = uSpecBars; }
    float fi = x * uSpecBars;
    float idx = min(floor(fi), uSpecBars - 1.0);
    float fx = fi - idx;
    if (uSpMirror > 0.5 && ang < 0.0) fx = 1.0 - fx;
    float v = specRaw(idx, 0.0);
    float len = uSpHeight * pow(v, 1.35) + uSpThick;
    float step0 = TAU / nAround;
    float bw = step0 * uSpRadius * (1.0 - uSpGap);
    float lx = sin((fx - 0.5) * step0) * r;
    float ly = r - uSpRadius;
    float rr = min(bw * 0.5, 0.004);
    float sd = sdRoundBox(vec2(lx, ly - len * 0.5), vec2(bw * 0.5, len * 0.5), rr);
    float aa = px() * 1.2;
    float m = smoothstep(aa, -aa, sd);
    float glow = exp(-max(sd, 0.0) / 0.005) * 0.18;
    vec3 c = spColor(x, v) * (0.75 + 0.6 * v);
    c = mix(c, vec3(1.0), smoothstep(0.55, 1.0, ly / max(len, 1e-4)) * 0.35 * v);
    return vec4(c * (m + glow), m);
}

vec4 radialWave(vec2 p) {
    vec2 q = rot(-uSpRot) * (p - uSpCenter);
    float r = length(q);
    float ang = atan(q.x, q.y);
    float x = uSpMirror > 0.5 ? abs(ang) / PI : ang / TAU + 0.5;
    vec3 col = vec3(0.0);
    float alpha = 0.0;
    int layers = int(uSpLayers);
    float aa = px() * 1.5;
    for (int L = 7; L >= 0; L--) {
        if (L >= layers) continue;
        float fl = float(L);
        float v = specSmooth(x, fl * 2.0);
        float rc = uSpRadius + uSpHeight * pow(v, 1.25) * (1.0 + fl * 0.07) + uSpThick;
        float inside = smoothstep(rc + aa, rc - aa, r) * smoothstep(uSpRadius * 0.6, uSpRadius * 0.9, r);
        vec3 lc = layers == 1 ? spColor(x, v) : pal(fl / max(float(layers), 1.0) * 0.85 + 0.05);
        float a = inside * (L == 0 ? 1.0 : 0.9);
        col = mix(col, lc * (0.5 + 0.6 * v), a);
        alpha = max(alpha, a);
        col += lc * exp(-abs(r - rc) / (uSpThick + 0.0025)) * 0.3;
    }
    return vec4(col, alpha);
}

vec2 linearCoords(vec2 p, out float x, out float bx, out vec2 q) {
    vec2 hs = halfSize();
    float W = uSpWidth * hs.x * 2.0;
    q = p - uSpCenter;
    x = q.x / W + 0.5;
    bx = uSpMirror > 0.5 ? abs(x - 0.5) * 2.0 : x;
    return vec2(W, 0.0);
}

vec4 linearBars(vec2 p) {
    float x, bx; vec2 q;
    float W = linearCoords(p, x, bx, q).x;
    if (x < 0.0 || x > 1.0) return vec4(0.0);
    float nb = uSpMirror > 0.5 ? uSpecBars * 2.0 : uSpecBars;
    float fi = x * nb;
    float cellI = floor(fi);
    float fx = fi - cellI;
    float idx = uSpMirror > 0.5 ? (cellI < uSpecBars ? uSpecBars - 1.0 - cellI : cellI - uSpecBars) : cellI;
    float v = specRaw(idx, 0.0);
    float h = uSpHeight * pow(v, 1.3) + uSpThick;
    float cw = W / nb;
    float bw = cw * (1.0 - uSpGap);
    float lx = (fx - 0.5) * cw;
    float rr = min(bw * 0.5, 0.004);
    float aa = px() * 1.2;
    float m = smoothstep(aa, -aa, sdRoundBox(vec2(lx, q.y - h * 0.5), vec2(bw * 0.5, h * 0.5), rr));
    float m2 = smoothstep(aa, -aa, sdRoundBox(vec2(lx, -q.y - h * 0.5), vec2(bw * 0.5, h * 0.5), rr));
    m2 *= 0.22 * smoothstep(-h, 0.0, q.y);
    vec3 c = spColor(bx, v) * (0.7 + 0.6 * v);
    return vec4(c * (m + m2), m + m2 * 0.5);
}

vec4 linearWave(vec2 p) {
    float x, bx; vec2 q;
    linearCoords(p, x, bx, q);
    if (x < 0.0 || x > 1.0) return vec4(0.0);
    float aa = px() * 1.5;
    vec3 col = vec3(0.0);
    float alpha = 0.0;
    int layers = int(max(uSpLayers, 1.0));
    float edgeFade = smoothstep(0.0, 0.03, x) * smoothstep(1.0, 0.97, x);
    for (int L = 7; L >= 0; L--) {
        if (L >= layers) continue;
        float fl = float(L);
        float sx = uSpMirror > 0.5 ? 1.0 - bx : bx;
        float v = specSmooth(sx, fl * 2.0) * edgeFade;
        float h = uSpHeight * pow(v, 1.2) * (1.0 + fl * 0.08) + uSpThick;
        float y = abs(q.y);
        float inside = smoothstep(h + aa, h - aa, y) * (q.y >= 0.0 ? 1.0 : 0.3);
        vec3 lc = layers == 1 ? spColor(bx, v) : pal(fl / float(layers) * 0.85);
        float a = inside * (L == 0 ? 0.9 : 0.75) * mix(0.55, 1.0, smoothstep(0.0, h, y));
        col = mix(col, lc * (0.5 + 0.6 * v), a);
        alpha = max(alpha, a);
        col += lc * exp(-abs(y - h) / (uSpThick + 0.002)) * 0.35 * (q.y >= 0.0 ? 1.0 : 0.3);
    }
    return vec4(col, alpha);
}

vec4 oscilloscope(vec2 p) {
    float x, bx; vec2 q;
    float W = linearCoords(p, x, bx, q).x;
    if (x < -0.01 || x > 1.01) return vec4(0.0);
    float amp = uSpHeight * 1.6;
    float dx = 1.0 / 511.0;
    float d = 1e9;
    float d2 = 1e9;
    for (int i = -2; i <= 2; i++) {
        float x0 = floor(x / dx + float(i)) * dx;
        float x1 = x0 + dx;
        vec2 a = vec2((x0 - 0.5) * W, waveAt(x0, 0.0) * amp);
        vec2 b = vec2((x1 - 0.5) * W, waveAt(x1, 0.0) * amp);
        d = min(d, sdSegment(q, a, b));
        vec2 a2 = vec2((x0 - 0.5) * W, waveAt(x0, 1.0) * amp);
        vec2 b2 = vec2((x1 - 0.5) * W, waveAt(x1, 1.0) * amp);
        d2 = min(d2, sdSegment(q, a2, b2));
    }
    float w = uSpThick * 0.6 + 0.0012;
    float aa = px();
    float edge = smoothstep(0.0, 0.06, x) * smoothstep(1.0, 0.94, x);
    float l1 = (smoothstep(w + aa, w - aa, d) + exp(-d / (w * 5.0)) * 0.35) * edge;
    float l2 = (smoothstep(w + aa, w - aa, d2) + exp(-d2 / (w * 5.0)) * 0.35) * edge * 0.6;
    vec3 c1 = spColor(x, 0.6 + 0.4 * uEnergy);
    vec3 c2 = uSpColor == 3 ? uColB : spColor(1.0 - x, 0.5);
    return vec4(c1 * l1 + c2 * l2, max(l1, l2));
}

vec4 circleScope(vec2 p) {
    vec2 q = rot(-uSpRot) * (p - uSpCenter);
    float r = length(q);
    float ang = atan(q.x, q.y);
    float x = ang / TAU + 0.5;
    float seam = smoothstep(0.0, 0.06, x) * smoothstep(1.0, 0.94, x);
    float aa = px();
    float w = uSpThick * 0.6 + 0.0012;
    vec3 col = vec3(0.0);
    float alpha = 0.0;
    for (int ch = 0; ch < 2; ch++) {
        float wv = waveAt(x, float(ch)) * seam;
        float rc = uSpRadius + uSpHeight * (0.35 + 0.15 * float(ch)) + wv * uSpHeight * 0.9;
        float d = abs(r - rc);
        float l = smoothstep(w + aa, w - aa, d) + exp(-d / (w * 5.0)) * 0.35;
        vec3 c = ch == 0 ? spColor(x, 0.7) : pal(x + 0.5);
        col += c * l * (ch == 0 ? 1.0 : 0.6);
        alpha = max(alpha, l);
    }
    return vec4(col, alpha);
}

void main() {
    vec2 p = centered(vUv);
    vec4 c = vec4(0.0);
    if (uStyle == 0) c = radialBars(p);
    else if (uStyle == 1) c = radialWave(p);
    else if (uStyle == 2) c = linearBars(p);
    else if (uStyle == 3) c = linearWave(p);
    else if (uStyle == 4) c = oscilloscope(p);
    else if (uStyle == 5) c = circleScope(p);
    outColor = vec4(c.rgb * uSpOpacity, c.a * uSpOpacity);
}`;

export const CENTER_SHADER = `${HEADER}
uniform sampler2D uLogo;
uniform float uHasLogo;
uniform vec2 uLogoSize;
uniform vec2 uCtr;
uniform float uCtrR;
uniform float uRing;
uniform float uRingGlow;
uniform float uCtrSpin;
uniform float uShockRings;
void main() {
    vec2 p = centered(vUv);
    vec2 q = p - uCtr;
    float r = length(q);
    float aa = px() * 1.2;
    float disc = smoothstep(uCtrR + aa, uCtrR - aa, r);
    vec3 inner;
    if (uHasLogo > 0.5) {
        vec2 lq = rot(uCtrSpin) * q;
        float ia = uLogoSize.x / max(uLogoSize.y, 1.0);
        vec2 sc = ia > 1.0 ? vec2(1.0 / ia, 1.0) : vec2(1.0, ia);
        vec2 luv = lq / (2.0 * uCtrR) * sc + 0.5;
        luv.y = 1.0 - luv.y;
        inner = texture(uLogo, luv).rgb;
    } else {
        float a = atan(q.y, q.x);
        float rays = 0.5 + 0.5 * sin(a * 12.0 + uSpin * 2.0 + uCtrSpin);
        inner = mix(vec3(0.015, 0.015, 0.03), uColB * 0.3, smoothstep(0.0, uCtrR, r));
        inner += uColA * pow(rays, 10.0) * 0.1 * smoothstep(uCtrR * 0.3, uCtrR, r);
        inner += mix(uColA, uColC, 0.3) * exp(-r / (uCtrR * 0.22)) * 0.3 * (0.3 + uBass + uKick);
        float ringIn = abs(r - uCtrR * 0.72);
        inner += uColA * exp(-ringIn / 0.002) * 0.25 * (0.4 + uKick);
    }
    vec3 col = inner * disc;
    float alpha = disc;
    if (uRing > 0.001) {
        float rw = uRing * 0.008 + 0.0015;
        float d = abs(r - uCtrR - rw * 0.5);
        float ringM = smoothstep(rw * 0.5 + aa, rw * 0.5 - aa, d);
        vec3 rc = grad(0.5 + 0.5 * sin(atan(q.y, q.x) + uTime * 0.6));
        col = mix(col, rc * (1.0 + 0.8 * uKick), ringM);
        alpha = max(alpha, ringM);
        col += rc * exp(-d / (0.006 + uRingGlow * 0.03)) * uRingGlow * (0.3 + 0.9 * uKick) * (1.0 - disc) * 0.6;
    }
    if (uShockRings > 0.001) {
        for (int k = 0; k < 4; k++) {
            float age = uKickAge[k];
            float rr = uCtrR + age * 0.75;
            float w = 0.0015 + age * 0.012;
            float a = uKickStr[k] * exp(-age * 3.2) * uShockRings;
            float d = abs(r - rr);
            col += mix(uColA, uColC, float(k) / 3.0) * smoothstep(w + aa, 0.0, d) * a;
        }
    }
    outColor = vec4(col, alpha);
}`;

export const TEXT_SHADER = `${HEADER}
uniform sampler2D uTextTex;
uniform vec2 uTextPos;
uniform vec2 uTextHalf;
uniform float uTextScale;
uniform float uGlitchT;
uniform float uGlitchSeed;
void main() {
    vec2 p = centered(vUv);
    vec2 q = (p - uTextPos) / uTextScale;
    vec2 tuv = q / (uTextHalf * 2.0) + 0.5;
    float seed = uGlitchSeed;
    if (uGlitchT > 0.001) {
        float row = floor(tuv.y * 10.0);
        float h = hash21(vec2(row, seed));
        if (h < uGlitchT * 0.6) tuv.x += (hash21(vec2(row + 3.1, seed)) - 0.5) * 0.12 * uGlitchT;
    }
    if (tuv.x < 0.0 || tuv.x > 1.0 || tuv.y < 0.0 || tuv.y > 1.0) { outColor = vec4(0.0); return; }
    tuv.y = 1.0 - tuv.y;
    vec4 c = texture(uTextTex, tuv);
    float split = uGlitchT * 0.012;
    if (split > 0.0005) {
        float aR = texture(uTextTex, tuv + vec2(split, 0.0)).a;
        float aB = texture(uTextTex, tuv - vec2(split, 0.0)).a;
        vec3 fr = vec3(1.0, 0.1, 0.25) * aR * (1.0 - c.a);
        vec3 fb = vec3(0.1, 0.6, 1.0) * aB * (1.0 - c.a);
        outColor = vec4(c.rgb + (fr + fb) * 0.8, max(c.a, max(aR, aB) * 0.6));
        return;
    }
    outColor = c;
}`;

export const IMAGE_SHADER = `${HEADER}
uniform sampler2D uImg;
uniform vec2 uImgPos;
uniform vec2 uImgHalf;
uniform float uImgOpacity;
void main() {
    vec2 p = centered(vUv);
    vec2 q = (p - uImgPos) / (uImgHalf * 2.0) + 0.5;
    if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) { outColor = vec4(0.0); return; }
    q.y = 1.0 - q.y;
    vec4 c = texture(uImg, q);
    float a = c.a * uImgOpacity;
    outColor = vec4(c.rgb * a, a);
}`;

export const PROGRESS_SHADER = `${HEADER}
uniform float uProgress;
uniform float uPrY;
uniform float uPrThick;
uniform vec3 uPrColor;
uniform float uPrGlow;
void main() {
    vec2 p = centered(vUv);
    vec2 hs = halfSize();
    float x = (p.x + hs.x * 0.9) / (hs.x * 1.8);
    float d = abs(p.y - uPrY);
    float aa = px();
    float inX = step(0.0, x) * step(x, 1.0);
    float line = smoothstep(uPrThick * 0.5 + aa, uPrThick * 0.5 - aa, d) * inX;
    float filled = step(x, uProgress);
    vec3 col = uPrColor * line * mix(0.18, 1.0, filled);
    float head = exp(-length(vec2((x - uProgress) * hs.x * 1.8, d)) / (0.004 + 0.01 * uKick)) * uPrGlow;
    col += uPrColor * head * inX;
    col += uPrColor * exp(-d / (uPrThick * 3.0)) * 0.25 * uPrGlow * filled * inX;
    outColor = vec4(col, line * mix(0.25, 1.0, filled));
}`;

export const PARTICLE_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aA;
layout(location=2) in vec4 aB;
uniform vec2 uRes;
out vec2 vLocal;
out float vAlpha;
out float vColT;
out float vStretch;
void main() {
    vec2 dir = length(aB.xy) > 1e-6 ? normalize(aB.xy) : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    float size = aA.z;
    float stretch = aB.z;
    vec2 off = dir * aCorner.x * size * (1.0 + stretch) + nrm * aCorner.y * size;
    vec2 pos = aA.xy + off;
    vec2 hs = 0.5 * uRes / min(uRes.x, uRes.y);
    gl_Position = vec4(pos / hs, 0.0, 1.0);
    vLocal = aCorner;
    vAlpha = aA.w;
    vColT = aB.w;
    vStretch = stretch;
}`;

export const PARTICLE_FS = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vAlpha;
in float vColT;
in float vStretch;
out vec4 outColor;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
uniform int uPColor;
vec3 fireRamp(float t) {
    vec3 c = mix(vec3(0.8, 0.1, 0.0), vec3(1.0, 0.5, 0.05), smoothstep(0.0, 0.5, t));
    return mix(c, vec3(1.0, 0.92, 0.6), smoothstep(0.5, 1.0, t));
}
void main() {
    float x = vLocal.x;
    float y = vLocal.y;
    float shape;
    if (vStretch > 0.05) {
        float along = smoothstep(-1.0, 0.6, x) * smoothstep(1.0, 0.7, x);
        shape = exp(-y * y * 5.0) * along;
    } else {
        float d2 = x * x + y * y;
        shape = exp(-d2 * 4.5) + 0.6 * exp(-d2 * 18.0);
    }
    vec3 c;
    if (uPColor == 1) c = vec3(1.0);
    else if (uPColor == 2) c = fireRamp(vColT);
    else {
        float t = fract(vColT) * 3.0;
        c = t < 1.0 ? mix(uColA, uColB, t) : t < 2.0 ? mix(uColB, uColC, t - 1.0) : mix(uColC, uColA, t - 2.0);
        c = mix(c, vec3(1.0), 0.25);
    }
    float a = shape * vAlpha;
    outColor = vec4(c * a, 0.0);
}`;
