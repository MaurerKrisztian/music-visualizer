import { HEADER } from './common';

export const SPECTRUM_SHADER = `${HEADER}
uniform sampler2D uSpec;
uniform sampler2D uPeaks;
uniform float uSpPeaks;
uniform float uSpecBars;
uniform float uSpecRow;
uniform float uSpecHist;
uniform float uSpecPhase;
uniform float uSpEcho;
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
    if (uSpPeaks > 0.5) {
        float pk = texelFetch(uPeaks, ivec2(int(idx), 0), 0).r;
        float capY = uSpHeight * pow(pk, 1.35) + uSpThick + 0.006;
        float capH = max(0.0025, bw * 0.35);
        float sdc = sdRoundBox(vec2(lx, ly - capY), vec2(bw * 0.5, capH * 0.5), capH * 0.5);
        float mc = smoothstep(aa, -aa, sdc) * smoothstep(0.02, 0.08, pk);
        c = mix(c, vec3(1.0), mc * 0.6);
        m = max(m, mc);
    }
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
        float v = specSmooth(x, fl);
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
    if (uSpPeaks > 0.5) {
        float pk = texelFetch(uPeaks, ivec2(int(clamp(idx, 0.0, uSpecBars - 1.0)), 0), 0).r;
        float capY = uSpHeight * pow(pk, 1.3) + uSpThick + 0.006;
        float capH = max(0.0025, bw * 0.3);
        float mc = smoothstep(aa, -aa, sdRoundBox(vec2(lx, q.y - capY), vec2(bw * 0.5, capH * 0.5), capH * 0.5)) * smoothstep(0.02, 0.08, pk);
        c = mix(c, vec3(1.0), mc * 0.6);
        m = max(m, mc);
    }
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
        float v = specSmooth(sx, fl) * edgeFade;
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


// 3D landscape of the last second of spectrum frames, scrolling away from the viewer.
vec4 terrain(vec2 p) {
    vec2 hs = halfSize();
    float W = uSpWidth * hs.x * 2.0;
    vec2 q = p - uSpCenter;
    float aa = px() * 1.2;
    const int N = 40;
    const float SPAN = 5.0;
    float rise = uSpHeight * 2.4;
    float backSc = 1.0 / (1.0 + SPAN);
    for (int k = 0; k < N; k++) {
        float fk = (float(k) + uSpecPhase) / float(N);
        float sc = 1.0 / (1.0 + fk * SPAN);
        float yBase = rise * (1.0 - sc) / (1.0 - backSc);
        float xr = q.x / (W * sc) + 0.5;
        if (xr < 0.0 || xr > 1.0) continue;
        if (q.y < yBase - 0.002) continue;
        float sx = uSpMirror > 0.5 ? 1.0 - abs(xr - 0.5) * 2.0 : xr;
        float env = smoothstep(0.0, 0.14, xr) * smoothstep(1.0, 0.86, xr);
        float v = specSmooth(sx, float(k));
        float yLine = yBase + uSpHeight * sc * 1.5 * pow(v, 1.25) * env;
        float dy = q.y - yLine;
        float thick = (uSpThick * 0.6 + 0.0012) * (0.35 + 0.65 * sc);
        float fade = (1.0 - fk) * (0.55 + 0.45 * sc);
        float line = smoothstep(thick + aa, thick - aa, abs(dy));
        if (line > 0.01 || dy < 0.0) {
            vec3 c = spColor(sx, v) * (0.6 + 0.9 * v);
            // the body below a ridge is a dark, nearly opaque fill that hides what is behind
            float body = dy < 0.0 ? 1.0 : 0.0;
            float bodyA = body * 0.94 * smoothstep(0.0, 0.06, 1.0 - fk);
            vec3 bodyCol = c * 0.035 * bodyA;
            float la = line * fade;
            return vec4(mix(bodyCol, c * fade * 1.3, la), max(bodyA, la));
        }
        // soft neon glow above the ridge (additive: alpha 0)
        if (q.y > yLine && q.y < yLine + 0.02) {
            float g = exp(-(q.y - yLine) / (thick * 4.0)) * 0.3 * fade;
            if (g > 0.003) return vec4(spColor(sx, v) * g, 0.0);
        }
    }
    return vec4(0.0);
}

// Copies of the radial spectrum that fly outward on each kick.
vec3 echoRings(vec2 p) {
    vec2 q = rot(-uSpRot) * (p - uSpCenter);
    float r = length(q);
    float ang = atan(q.x, q.y);
    float x = uSpMirror > 0.5 ? abs(ang) / PI : ang / TAU + 0.5;
    vec3 col = vec3(0.0);
    for (int k = 0; k < 3; k++) {
        float age = uKickAge[k];
        if (age > 0.75) continue;
        float back = min(age * 40.0, uSpecHist - 4.0);
        float v = specSmooth(x, back);
        float rc = (uSpRadius + uSpHeight * pow(v, 1.25) + uSpThick) * (1.0 + age * 1.5);
        float w = 0.0015 + age * 0.006;
        float a = uKickStr[k] * exp(-age * 3.6) * uSpEcho;
        col += spColor(x, v) * (smoothstep(w + px(), 0.0, abs(r - rc)) + exp(-abs(r - rc) / (w * 4.0)) * 0.3) * a * 1.4;
    }
    return col;
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
    else if (uStyle == 6) { outColor = terrain(p) * uSpOpacity; return; }
    if (uSpEcho > 0.001 && (uStyle == 0 || uStyle == 1 || uStyle == 5)) c.rgb += echoRings(p);
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
uniform float uShape;
uniform float uVinylSpin;
uniform vec2 uJelly;
uniform float uJellyRot;

vec3 logoSample(vec2 lq, float halfSize) {
    float ia = uLogoSize.x / max(uLogoSize.y, 1.0);
    vec2 sc = ia > 1.0 ? vec2(1.0 / ia, 1.0) : vec2(1.0, ia);
    vec2 luv = lq / (2.0 * halfSize) * sc + 0.5;
    luv.y = 1.0 - luv.y;
    return texture(uLogo, luv).rgb;
}

vec3 emblem(vec2 q, float R) {
    float r = length(q);
    float a = atan(q.y, q.x);
    float rays = 0.5 + 0.5 * sin(a * 12.0 + uSpin * 2.0 + uCtrSpin);
    vec3 c = mix(vec3(0.015, 0.015, 0.03), uColB * 0.3, smoothstep(0.0, R, r));
    c += uColA * pow(rays, 10.0) * 0.1 * smoothstep(R * 0.3, R, r);
    c += mix(uColA, uColC, 0.3) * exp(-r / (R * 0.22)) * 0.3 * (0.3 + uBass + uKick);
    c += uColA * exp(-abs(r - R * 0.72) / 0.002) * 0.25 * (0.4 + uKick);
    return c;
}

void main() {
    vec2 p = centered(vUv);
    vec2 q = rot(uJellyRot) * (p - uCtr) / uJelly;
    float r = length(q);
    float aa = px() * 1.2;
    float R = uCtrR;
    float sd;
    vec3 inner;
    if (uShape > 1.5) {
        // spinning vinyl record, the logo is the label
        sd = r - R;
        float label = R * 0.42;
        vec2 rq = rot(uVinylSpin) * q;
        float ang = atan(rq.y, rq.x);
        float grooveZone = smoothstep(label * 1.02, label * 1.12, r) * smoothstep(R, R * 0.965, r);
        float grooves = 0.5 + 0.5 * sin(r / R * 300.0 + sin(ang * 3.0) * 0.5);
        vec3 vinyl = vec3(0.02, 0.02, 0.025) + vec3(0.035) * grooves * grooveZone;
        float gaps = smoothstep(0.004, 0.0, abs(r - R * 0.68)) + smoothstep(0.004, 0.0, abs(r - R * 0.83));
        vinyl *= 1.0 - gaps * 0.6;
        float a0 = atan(q.y, q.x);
        float sheen = pow(max(0.0, cos(2.0 * (a0 - 0.8))), 16.0) + 0.6 * pow(max(0.0, cos(2.0 * (a0 + 2.2))), 28.0);
        vinyl += mix(vec3(0.6, 0.7, 1.0), uColA, 0.45) * sheen * 0.26 * (0.55 + 0.7 * uKick) * grooveZone;
        vinyl += vec3(0.22) * smoothstep(0.004, 0.0, abs(r - R * 0.985));
        if (r < label * 1.02) {
            vec3 lab = uHasLogo > 0.5 ? logoSample(rq, label) : emblem(rq * (R / label), R) + uColB * 0.15;
            vinyl = mix(vinyl, lab, smoothstep(label * 1.02, label * 0.99, r));
            vinyl = mix(vinyl, vec3(0.0), smoothstep(R * 0.03 + aa, R * 0.03 - aa, r));
        }
        inner = vinyl;
    } else if (uShape > 0.5) {
        // square cover art with slightly rounded corners
        float hsq = R * 0.9;
        vec2 d = abs(q) - vec2(hsq) + R * 0.06;
        sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - R * 0.06;
        inner = uHasLogo > 0.5 ? logoSample(q, hsq) : emblem(q, R);
    } else {
        sd = r - R;
        inner = uHasLogo > 0.5 ? logoSample(rot(uCtrSpin) * q, R) : emblem(q, R);
    }
    float disc = smoothstep(aa, -aa, sd);
    vec3 col = inner * disc;
    float alpha = disc;
    if (uRing > 0.001) {
        float rw = uRing * 0.008 + 0.0015;
        float d = abs(sd - rw * 0.5);
        float ringM = smoothstep(rw * 0.5 + aa, rw * 0.5 - aa, d);
        vec3 rc = grad(0.5 + 0.5 * sin(atan(q.y, q.x) + uTime * 0.6));
        col = mix(col, rc * (1.0 + 0.8 * uKick), ringM);
        alpha = max(alpha, ringM);
        col += rc * exp(-d / (0.006 + uRingGlow * 0.03)) * uRingGlow * (0.3 + 0.9 * uKick) * (1.0 - disc) * 0.6;
    }
    if (uShockRings > 0.001) {
        for (int k = 0; k < 4; k++) {
            float age = uKickAge[k];
            float rr = age * 0.75;
            float w = 0.0015 + age * 0.012;
            float a = uKickStr[k] * exp(-age * 3.2) * uShockRings;
            float d = abs(sd - rr);
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
uniform float uTextAlpha;
uniform int uAnim;
uniform float uAnimAmt;
uniform vec4 uGlyphA[64];
uniform vec4 uGlyphB[64];
uniform int uGlyphCount;
uniform vec2 uTexPx;
uniform float uLineH;
uniform float uReveal;
uniform float uDropB;

// Per-letter animation: offset in texture pixels (y down), scale, angle, alpha.
void glyphAnim(int i, out vec2 off, out float sc, out float ang, out float alpha) {
    vec4 b = uGlyphB[i];
    float ci = b.x;
    float n = max(b.z, 1.0);
    float sd = b.w;
    float A = uAnimAmt;
    float H = uLineH;
    off = vec2(0.0);
    sc = 1.0;
    ang = 0.0;
    alpha = 1.0;
    if (uAnim == 1) {
        // wave riding the bar
        off.y = -A * 0.24 * H * sin(TAU * (uBar * 2.0 - ci / n * 0.85));
        ang = A * 0.06 * cos(TAU * (uBar * 2.0 - ci / n * 0.85));
    } else if (uAnim == 2) {
        // each kick sends a hop through the word
        float hop = 0.0;
        for (int k = 0; k < 4; k++) {
            float a = uKickAge[k] - ci * 0.024;
            if (a > 0.0 && a < 0.26) hop = max(hop, uKickStr[k] * sin(a / 0.26 * PI));
        }
        off.y = -A * 0.45 * H * hop;
        sc = 1.0 + A * 0.14 * hop;
    } else if (uAnim == 3) {
        // aggressive jitter, louder on kicks
        float fr = floor(uTime * 24.0);
        vec2 r = hash22(vec2(sd * 91.0, fr)) - 0.5;
        off = r * A * H * (0.04 + 0.32 * uKick);
        ang = (hash21(vec2(sd * 17.0, fr)) - 0.5) * A * 0.5 * uKick;
    } else if (uAnim == 4) {
        // neon sign: random letters flicker, kicks power it up
        float fr = floor(uTime * 15.0);
        float h = hash21(vec2(sd * 37.0, fr));
        float faulty = step(0.78, hash11(sd * 13.0));
        float on = step(0.2 + 0.55 * faulty, h) * (0.6 + 0.4 * h);
        alpha = mix(1.0, on, A * (0.35 + 0.65 * faulty));
        alpha = max(alpha, uKick * 0.95);
    } else if (uAnim == 5) {
        // letters fly apart on drops and snap back
        vec2 dir = normalize(hash22(vec2(sd * 7.0, 3.0)) - 0.5 + 1e-4);
        float e = uDropB;
        off = dir * A * H * 2.4 * e;
        ang = (hash11(sd * 23.0) - 0.5) * 3.2 * A * e;
        sc = 1.0 + 0.35 * A * e;
        float hop = uKickStr[0] * max(0.0, 1.0 - uKickAge[0] / 0.2);
        off.y -= A * 0.16 * H * hop;
    }
    if (uReveal < 1.0) {
        float idx = float(i) / max(float(uGlyphCount), 1.0);
        float rv = clamp((uReveal * 1.35 - idx) * 5.0, 0.0, 1.0);
        alpha *= rv;
        sc *= 0.55 + 0.45 * rv + 0.28 * sin(rv * PI);
        off.y += (1.0 - rv) * H * 0.35;
    }
}

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
    bool animated = uGlyphCount > 0 && (uAnim > 0 || uReveal < 1.0);
    float lim = animated ? 0.75 : 0.0;
    if (tuv.x < -lim || tuv.x > 1.0 + lim || tuv.y < -lim || tuv.y > 1.0 + lim) { outColor = vec4(0.0); return; }
    vec2 cuv = vec2(tuv.x, 1.0 - tuv.y);
    if (animated) {
        vec2 P = cuv * uTexPx;
        vec4 c = vec4(0.0);
        for (int i = 0; i < 64; i++) {
            if (i >= uGlyphCount) break;
            vec4 a = uGlyphA[i];
            vec2 lo = a.xz * uTexPx;
            vec2 hi = a.yw * uTexPx;
            vec2 ctr = (lo + hi) * 0.5;
            vec2 off;
            float sc;
            float ang;
            float al;
            glyphAnim(i, off, sc, ang, al);
            if (al <= 0.001) continue;
            vec2 L = ctr + rot(-ang) * (P - ctr - off) / max(sc, 0.05);
            if (L.x < lo.x || L.x > hi.x || L.y < lo.y || L.y > hi.y) continue;
            vec4 g = texture(uTextTex, L / uTexPx) * al;
            if (g.a > c.a) c = g;
        }
        outColor = c * uTextAlpha;
        return;
    }
    vec4 c = texture(uTextTex, cuv);
    float split = uGlitchT * 0.012;
    if (split > 0.0005) {
        float aR = texture(uTextTex, cuv + vec2(split, 0.0)).a;
        float aB = texture(uTextTex, cuv - vec2(split, 0.0)).a;
        vec3 fr = vec3(1.0, 0.1, 0.25) * aR * (1.0 - c.a);
        vec3 fb = vec3(0.1, 0.6, 1.0) * aB * (1.0 - c.a);
        outColor = vec4(c.rgb + (fr + fb) * 0.8, max(c.a, max(aR, aB) * 0.6)) * uTextAlpha;
        return;
    }
    outColor = c * uTextAlpha;
}`;

export const CROWD_SHADER = `${HEADER}
uniform float uCrowd;
uniform float uCrowdH;
float sdBox2(vec2 p, vec2 b, float r) {
    vec2 d = abs(p) - b + r;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
    return length(pa - ba * h);
}
// one row of people; returns signed distance (negative inside)
float crowdRow(vec2 p, float rowSeed, float scale, float baseY) {
    float spacing = 0.06 * scale;
    float x = p.x / spacing + rowSeed * 0.37;
    float id = floor(x);
    float d = 1e9;
    for (int k = -1; k <= 1; k++) {
        float cid = id + float(k);
        float h = hash11(cid * 1.37 + rowSeed * 17.0);
        float h2 = hash11(cid * 3.11 + rowSeed * 5.0);
        float cx = (cid + 0.5 + (h2 - 0.5) * 0.5 - rowSeed * 0.37) * spacing;
        float jump = uKick * step(0.45, h2) * (0.012 + 0.02 * h) * scale + uBeatPulse * 0.004 * scale;
        float by = baseY + (h - 0.5) * 0.02 * scale + jump;
        vec2 q = vec2(p.x - cx, p.y - by);
        float headR = 0.0125 * scale * (0.9 + 0.25 * h2);
        float dHead = length(q - vec2(0.0, headR * 0.4)) - headR;
        float dBody = sdBox2(q - vec2(0.0, -0.06 * scale), vec2(0.024 * scale, 0.055 * scale), 0.014 * scale);
        float dPerson = min(dHead, dBody);
        if (h > 0.5) {
            float sway = sin(uBeat * TAU + h * 9.0) * 0.006 + sin(uTime * 1.3 + h * 20.0) * 0.003;
            vec2 sh = vec2(0.017, -0.016) * scale;
            vec2 hand = sh + vec2(0.012 + sway / scale, 0.072) * scale;
            dPerson = min(dPerson, sdSeg(q, sh, hand) - 0.0042 * scale);
            dPerson = min(dPerson, length(q - hand) - 0.006 * scale);
            if (h > 0.78) {
                vec2 sh2 = vec2(-sh.x, sh.y);
                vec2 hand2 = sh2 + vec2(-0.012 + sway / scale, 0.072) * scale;
                dPerson = min(dPerson, sdSeg(q, sh2, hand2) - 0.0042 * scale);
                dPerson = min(dPerson, length(q - hand2) - 0.006 * scale);
            }
        }
        d = min(d, dPerson);
    }
    // the crowd continues below the shoulders
    d = min(d, p.y - (baseY - 0.075 * scale));
    return d;
}
void main() {
    vec2 p = centered(vUv);
    vec2 hs = halfSize();
    float bottom = -hs.y;
    float aa = px() * 1.2;
    float hgt = uCrowdH;
    // back row (smaller, lit a little), then front row
    float dBack = crowdRow(p, 1.0, 0.8 * (0.85 + hgt), bottom + (0.12 + 0.1 * hgt));
    float dFront = crowdRow(p, 0.0, 1.05 * (0.85 + hgt), bottom + (0.05 + 0.07 * hgt));
    float aBack = smoothstep(aa, -aa, dBack);
    float aFront = smoothstep(aa, -aa, dFront);
    vec3 rimCol = mix(uColA, uColC, 0.5 + 0.5 * sin(p.x * 3.0 + uTime * 0.5));
    float rimB = smoothstep(-0.004, 0.0, dBack) * aBack;
    float rimF = smoothstep(-0.003, 0.0, dFront) * aFront;
    vec3 back = vec3(0.025, 0.025, 0.04) + rimCol * rimB * (0.25 + 0.6 * uKick);
    vec3 front = vec3(0.0) + rimCol * rimF * (0.15 + 0.4 * uKick);
    vec3 col = back * aBack * (1.0 - aFront) + front * aFront;
    float a = max(aBack, aFront) * uCrowd;
    outColor = vec4(col * uCrowd, a);
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
out float vShape;
void main() {
    vec2 dir = length(aB.xy) > 1e-6 ? normalize(aB.xy) : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    float size = aA.z;
    float shape = floor(aB.w / 10.0);
    float stretch = aB.z;
    vec2 off;
    if (shape > 0.5) {
        // confetti: a rectangle that flips (stretch = |cos(flip)|)
        off = dir * aCorner.x * size * 1.5 + nrm * aCorner.y * size * max(0.12, stretch);
        vStretch = 0.0;
    } else {
        off = dir * aCorner.x * size * (1.0 + stretch) + nrm * aCorner.y * size;
        vStretch = stretch;
    }
    vec2 pos = aA.xy + off;
    vec2 hs = 0.5 * uRes / min(uRes.x, uRes.y);
    gl_Position = vec4(pos / hs, 0.0, 1.0);
    vLocal = aCorner;
    vAlpha = aA.w;
    vColT = aB.w - shape * 10.0;
    vShape = shape;
}`;

export const PARTICLE_FS = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vAlpha;
in float vColT;
in float vStretch;
in float vShape;
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
    if (vShape > 0.5) {
        shape = smoothstep(1.0, 0.78, max(abs(x), abs(y)));
    } else if (vStretch > 0.05) {
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
        c = mix(c, vec3(1.0), vShape > 0.5 ? 0.04 : 0.25);
    }
    float a = shape * vAlpha;
    outColor = vec4(c * a, 0.0);
}`;
