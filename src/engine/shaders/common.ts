// Shared GLSL: uniforms every pass receives plus noise / colour helpers.

export const HEADER = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform float uMove;
uniform float uSpin;
uniform float uKick;
uniform float uBass;
uniform float uSub;
uniform float uLowMid;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uIntensity;
uniform float uDrop;
uniform float uBuild;
uniform float uBeat;
uniform float uBar;
uniform float uBeatN;
uniform float uBeatPulse;
uniform vec4 uKickAge;
uniform vec4 uKickStr;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;

#define PI 3.14159265359
#define TAU 6.28318530718

vec2 halfSize() { return 0.5 * uRes / min(uRes.x, uRes.y); }
vec2 centered(vec2 uv) { return (uv - 0.5) * uRes / min(uRes.x, uRes.y); }
float px() { return 1.0 / min(uRes.x, uRes.y); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) {
        v += a * vnoise(p);
        p = m * p;
        a *= 0.5;
    }
    return v;
}

float fbm3(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 3; i++) {
        v += a * vnoise(p);
        p = m * p;
        a *= 0.5;
    }
    return v;
}

vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

// Smooth cyclic blend through the three palette colours.
vec3 pal(float t) {
    t = fract(t) * 3.0;
    if (t < 1.0) return mix(uColA, uColB, smoothstep(0.0, 1.0, t));
    if (t < 2.0) return mix(uColB, uColC, smoothstep(1.0, 2.0, t));
    return mix(uColC, uColA, smoothstep(2.0, 3.0, t));
}

// Linear gradient A -> B -> C for t in 0..1.
vec3 grad(float t) {
    t = clamp(t, 0.0, 1.0);
    return t < 0.5 ? mix(uColA, uColB, t * 2.0) : mix(uColB, uColC, t * 2.0 - 1.0);
}

float glowLine(float d, float w) { return w / (abs(d) + w); }
`;
