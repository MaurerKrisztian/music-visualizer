import { HEADER } from './common';

export const COPY_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform float uAmt;
void main() { outColor = texture(uTex, vUv) * uAmt; }`;

export const FEEDBACK_SHADER = `${HEADER}
uniform sampler2D uPrev;
uniform float uDecay;
uniform float uFbZoom;
uniform float uFbRot;
void main() {
    vec2 p = centered(vUv);
    p = rot(uFbRot) * p / uFbZoom;
    vec2 uv = p / (uRes / min(uRes.x, uRes.y)) + 0.5;
    vec4 c = texture(uPrev, uv);
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    // soft cap so long trails never wash the frame out
    vec3 col = c.rgb * uDecay;
    float m = max(col.r, max(col.g, col.b));
    col *= m > 0.9 ? (0.9 + 0.6 * tanh((m - 0.9) / 0.6)) / m : 1.0;
    outColor = vec4(col, c.a * uDecay) * inside;
}`;

// 13-tap downsample (Jimenez 2014) with optional soft-threshold prefilter.
export const DOWN_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uPrefilter;
uniform float uThreshold;
vec3 tap(vec2 o) { return texture(uTex, vUv + o * uTexel).rgb; }
vec3 prefilter(vec3 c) {
    float br = max(c.r, max(c.g, c.b));
    float knee = 0.25;
    float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
    return c * contrib;
}
void main() {
    vec3 a = tap(vec2(-2.0, 2.0)), b = tap(vec2(0.0, 2.0)), c = tap(vec2(2.0, 2.0));
    vec3 d = tap(vec2(-2.0, 0.0)), e = tap(vec2(0.0, 0.0)), f = tap(vec2(2.0, 0.0));
    vec3 g = tap(vec2(-2.0, -2.0)), h = tap(vec2(0.0, -2.0)), i = tap(vec2(2.0, -2.0));
    vec3 j = tap(vec2(-1.0, 1.0)), k = tap(vec2(1.0, 1.0)), l = tap(vec2(-1.0, -1.0)), m = tap(vec2(1.0, -1.0));
    vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
    if (uPrefilter > 0.5) col = prefilter(col);
    outColor = vec4(min(col, vec3(64.0)), 1.0);
}`;

export const UP_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uWeight;
void main() {
    vec3 s = texture(uTex, vUv + vec2(-1.0, 1.0) * uTexel).rgb
        + texture(uTex, vUv + vec2(0.0, 1.0) * uTexel).rgb * 2.0
        + texture(uTex, vUv + vec2(1.0, 1.0) * uTexel).rgb
        + texture(uTex, vUv + vec2(-1.0, 0.0) * uTexel).rgb * 2.0
        + texture(uTex, vUv).rgb * 4.0
        + texture(uTex, vUv + vec2(1.0, 0.0) * uTexel).rgb * 2.0
        + texture(uTex, vUv + vec2(-1.0, -1.0) * uTexel).rgb
        + texture(uTex, vUv + vec2(0.0, -1.0) * uTexel).rgb * 2.0
        + texture(uTex, vUv + vec2(1.0, -1.0) * uTexel).rgb;
    outColor = vec4(s / 16.0 * uWeight, 1.0);
}`;

// Horizontal-only blur for anamorphic streaks (run a few times with growing steps).
export const STREAK_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uStep;
uniform float uGain;
uniform float uKnee;
void main() {
    vec3 c = vec3(0.0);
    float wsum = 0.0;
    for (int i = -4; i <= 4; i++) {
        float w = exp(-float(i * i) / 9.0);
        vec3 s = texture(uTex, vUv + vec2(float(i) * uStep * uTexel.x, 0.0)).rgb;
        // first pass keeps only the brightest cores so streaks stay thin and sparse
        if (uKnee > 0.0) s = max(s - uKnee, vec3(0.0)) * 1.8;
        c += s * w;
        wsum += w;
    }
    outColor = vec4(c / wsum * uGain, 1.0);
}`;

export const FINAL_SHADER = `${HEADER}
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomAmt;
uniform sampler2D uFlare;
uniform float uFlareAmt;
uniform float uZoomBlur;
uniform vec2 uZbCenter;
uniform vec3 uFlareTint;

uniform float uCA;
uniform float uGlitch;
uniform float uGlitchSeed;
uniform float uShock;
uniform vec2 uShockCenter;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uVignette;
uniform float uGrain;
uniform float uScan;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform float uFade;
uniform float uLetterbox;
uniform vec2 uShake;
uniform float uShakeRot;
uniform float uZoom;
uniform float uFrame;

vec3 tonemap(vec3 c) {
    float m = max(c.r, max(c.g, c.b));
    float k = 0.8;
    if (m <= k) return c;
    float nm = k + (1.0 - k) * tanh((m - k) / (1.0 - k));
    return c * (nm / m);
}

void main() {
    vec2 s = uRes / min(uRes.x, uRes.y);
    vec2 p = (vUv - 0.5) * s;
    p = rot(uShakeRot) * p / uZoom + uShake;

    // shockwave ripple from recent kicks
    if (uShock > 0.001) {
        vec2 d = p - uShockCenter;
        float r = length(d);
        vec2 n = r > 1e-4 ? d / r : vec2(0.0);
        for (int k = 0; k < 4; k++) {
            float age = uKickAge[k];
            float rr = age * 1.25;
            float x = r - rr;
            float amp = uShock * uKickStr[k] * exp(-age * 3.5) * 0.035;
            p -= n * amp * x * 40.0 * exp(-x * x * 90.0);
        }
    }

    vec2 uv = p / s + 0.5;

    if (uGlitch > 0.001) {
        float rows = mix(6.0, 36.0, hash11(uGlitchSeed));
        float row = floor(uv.y * rows);
        float h = hash21(vec2(row, uGlitchSeed));
        if (h < uGlitch * 0.55) uv.x += (hash21(vec2(row, uGlitchSeed + 1.7)) - 0.5) * 0.16 * uGlitch;
        vec2 blk = floor(uv * vec2(14.0, 8.0));
        if (uGlitch > 0.05 && hash21(blk + uGlitchSeed * 3.1) < uGlitch * 0.07) uv += (hash22(blk + uGlitchSeed) - 0.5) * 0.08 * min(1.0, uGlitch * 3.0);
    }

    vec2 dir = (uv - 0.5);
    float ca = uCA * 0.01 + uGlitch * 0.012;
    vec3 col;
    col.r = texture(uScene, uv + dir * ca).r;
    col.g = texture(uScene, uv).g;
    col.b = texture(uScene, uv - dir * ca).b;
    if (uZoomBlur > 0.001) {
        // radial motion blur towards the centre: the frame "punches" on kicks
        vec2 dz = uv - uZbCenter;
        vec3 acc = vec3(0.0);
        float wsum = 0.0;
        for (int i = 0; i < 10; i++) {
            float k = float(i) / 9.0;
            float w = 1.0 - k * 0.55;
            acc += texture(uScene, uv - dz * k * uZoomBlur * 0.14).rgb * w;
            wsum += w;
        }
        col = mix(col, acc / wsum, min(1.0, uZoomBlur * 4.0));
    }
    vec3 bl;
    bl.r = texture(uBloom, uv + dir * ca * 1.5).r;
    bl.g = texture(uBloom, uv).g;
    bl.b = texture(uBloom, uv - dir * ca * 1.5).b;
    col += bl * uBloomAmt;
    if (uFlareAmt > 0.001) col += texture(uFlare, uv).rgb * uFlareTint * uFlareAmt;
    col += uFlashColor * uFlash;

    col *= uExposure;
    col = tonemap(col);
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, uSaturation);
    col = (col - 0.5) * uContrast + 0.5;

    vec2 vq = vUv - 0.5;
    vq.x *= mix(1.0, s.x / s.y, 0.5);
    float vig = smoothstep(0.95, 0.25, length(vq) * 1.25);
    col *= mix(1.0, vig, min(1.0, uVignette * (1.0 + 0.35 * uKick)));

    if (uScan > 0.001) col *= 1.0 - uScan * 0.3 * (0.5 + 0.5 * sin(vUv.y * 540.0 * PI));
    if (uGrain > 0.001) col += (hash21(vUv * uRes + fract(uFrame * 0.6180339) * 917.0) - 0.5) * uGrain * 0.16;

    float lb = uLetterbox * 0.12;
    if (abs(vUv.y - 0.5) > 0.5 - lb) col = vec3(0.0);

    col *= uFade;
    outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
