// GLSL ES 3.00 sources.
const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

export const FULLSCREEN_VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const PCG = `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float rnd(inout uint s) { s = pcg(s); return float(s >> 8) / 16777216.0; }
`;

// A. Agent update: reads agents, trail, field; writes new agent state.
export const AGENT_FS = HEAD + `
uniform sampler2D uAgents;
uniform sampler2D uTrail;
uniform sampler2D uField;
uniform vec2 uSim;
uniform float uSA, uRA, uSO, uSS, uRival, uJitter, uWfood, uWrep, uSat;
uniform int uSpecies, uS, uActive;
uniform uint uFrame;
out vec4 o;
${PCG}
vec3 M;
float sense(vec2 p) {
  vec2 uv = p / uSim;
  vec3 t = texture(uTrail, uv).rgb;
  t = t / (1.0 + t * uSat); // saturating response keeps fat tubes from swallowing everything
  vec2 f = texture(uField, uv).rg;
  return dot(t, M) + uWfood * f.r - uWrep * f.g;
}
vec2 dir(float a) { return vec2(cos(a), sin(a)); }
void main() {
  ivec2 ic = ivec2(gl_FragCoord.xy);
  vec4 a = texelFetch(uAgents, ic, 0);
  int idx = ic.y * uS + ic.x;
  if (idx >= uActive) { o = a; return; }
  int sp = idx % uSpecies;
  vec3 oh = vec3(sp == 0, sp == 1, sp == 2);
  M = uSpecies == 1 ? vec3(1.0, 0.0, 0.0) : oh - (1.0 - oh) * uRival;
  uint seed = pcg(uint(idx) ^ (uFrame * 2654435761u));
  float r1 = rnd(seed), r2 = rnd(seed), r3 = rnd(seed);
  vec2 pos = a.xy;
  float th = a.z;
  float F  = sense(pos + uSO * dir(th));
  float FL = sense(pos + uSO * dir(th + uSA));
  float FR = sense(pos + uSO * dir(th - uSA));
  if (F > FL && F > FR) {}
  else if (F < FL && F < FR) th += (r1 < 0.5 ? uRA : -uRA);
  else if (FL > FR) th += uRA;
  else if (FR > FL) th -= uRA;
  th += (r2 - 0.5) * uJitter;
  pos += uSS * dir(th);
  vec2 lo = vec2(1.0), hi = uSim - 1.0;
  bool bad = !(pos.x > -1e6 && pos.x < 1e6 && pos.y > -1e6 && pos.y < 1e6 && th > -1e6 && th < 1e6);
  if (bad) {
    pos = vec2(r1, r2) * uSim; th = r3 * 6.2831853;
  } else if (pos.x < lo.x || pos.y < lo.y || pos.x > hi.x || pos.y > hi.y) {
    pos = clamp(pos, lo, hi); th = r3 * 6.2831853;
  }
  th = mod(th, 6.2831853);
  o = vec4(pos, th, float(sp) + 0.5);
}`;

// B. Deposit: one point per agent, additive.
export const DEPOSIT_VS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uAgents;
uniform int uS, uSpecies;
uniform vec2 uSim;
flat out vec3 vCol;
void main() {
  ivec2 c = ivec2(gl_VertexID % uS, gl_VertexID / uS);
  vec4 a = texelFetch(uAgents, c, 0);
  gl_Position = vec4(a.xy / uSim * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  int sp = gl_VertexID % uSpecies;
  vCol = vec3(sp == 0, sp == 1, sp == 2);
}`;
export const DEPOSIT_FS = HEAD + `
uniform float uDeposit;
flat in vec3 vCol;
out vec4 o;
void main() { o = vec4(vCol * uDeposit, 0.0); }`;

// C. Diffuse + decay, plus station injection and seed brush (Gaussian splats).
export const DIFFUSE_FS = HEAD + `
uniform sampler2D uTrail;
uniform vec2 uSim;
uniform float uDecay, uDiffuse, uMax, uBias;
uniform vec3 uMask;
uniform int uN, uNB;
uniform vec4 uSt[24];    // x, y (sim px), amplitude, sigma
uniform vec4 uBrush[16]; // x, y, amplitude, sigma
out vec4 o;
void main() {
  ivec2 ic = ivec2(gl_FragCoord.xy);
  ivec2 mx = ivec2(uSim) - 1;
  vec3 c = texelFetch(uTrail, ic, 0).rgb;
  vec3 s = vec3(0.0);
  for (int dy = -1; dy <= 1; dy++)
    for (int dx = -1; dx <= 1; dx++)
      s += texelFetch(uTrail, clamp(ic + ivec2(dx, dy), ivec2(0), mx), 0).rgb;
  vec3 v = mix(c, s / 9.0, uDiffuse) * uDecay;
  vec2 p = gl_FragCoord.xy;
  float add = 0.0;
  for (int i = 0; i < 24; i++) {
    if (i >= uN) break;
    vec2 d = p - uSt[i].xy; float r2 = dot(d, d); float s2 = uSt[i].w * uSt[i].w;
    if (r2 < 9.0 * s2) add += uSt[i].z * exp(-r2 / (2.0 * s2));
  }
  for (int i = 0; i < 16; i++) {
    if (i >= uNB) break;
    vec2 d = p - uBrush[i].xy; float r2 = dot(d, d); float s2 = uBrush[i].w * uBrush[i].w;
    if (r2 < 9.0 * s2) add += uBrush[i].z * exp(-r2 / (2.0 * s2));
  }
  v += add * uMask;
  v = clamp(v - uBias, 0.0, uMax);
  o = vec4(v, 1.0);
}`;

// D. Field: R = food (max of station Gaussians), G = repellent (decays, brushed).
export const FIELD_FS = HEAD + `
uniform sampler2D uField;
uniform float uRepDecay, uBias;
uniform int uN, uNB;
uniform vec4 uSt[24];    // x, y (field px), strength, sigma
uniform vec4 uBrush[16]; // x, y (field px), amplitude, sigma
out vec4 o;
void main() {
  vec2 p = gl_FragCoord.xy;
  float rep = texelFetch(uField, ivec2(p), 0).g;
  rep = max(rep * uRepDecay - uBias, 0.0);
  float food = 0.0;
  for (int i = 0; i < 24; i++) {
    if (i >= uN) break;
    vec2 d = p - uSt[i].xy;
    food = max(food, uSt[i].z * exp(-dot(d, d) / (2.0 * uSt[i].w * uSt[i].w)));
  }
  for (int i = 0; i < 16; i++) {
    if (i >= uNB) break;
    vec2 d = p - uBrush[i].xy;
    rep += uBrush[i].z * exp(-dot(d, d) / (2.0 * uBrush[i].w * uBrush[i].w));
  }
  o = vec4(food, min(rep, 1.0), 0.0, 1.0);
}`;

const COLORIZE = `
uniform float uExpo;
uniform vec3 uC0[3];
uniform vec3 uC1[3];
uniform vec3 uC2[3];
const vec3 BG = vec3(0.027, 0.031, 0.043);
vec3 ramp(float t, vec3 a, vec3 b, vec3 c) {
  return t < 0.55 ? mix(a, b, smoothstep(0.0, 0.55, t)) : mix(b, c, smoothstep(0.55, 1.0, t));
}
vec3 colorize(vec3 raw) {
  vec3 v = 1.0 - exp(-uExpo * max(raw, 0.0));
  vec3 rgb = BG + ramp(v.r, uC0[0], uC1[0], uC2[0]) * v.r
                + ramp(v.g, uC0[1], uC1[1], uC2[1]) * v.g
                + ramp(v.b, uC0[2], uC1[2], uC2[2]) * v.b;
  return 1.0 - exp(-rgb * 1.35);
}
`;

// E. Display.
export const DISPLAY_FS = HEAD + `
uniform sampler2D uTrail;
uniform sampler2D uB1;
uniform sampler2D uB2;
uniform vec2 uRes;
uniform float uBloom, uGrainFrame;
out vec4 o;
${COLORIZE}
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 rgb = colorize(texture(uTrail, vec2(uv.x, 1.0 - uv.y)).rgb);
  if (uBloom > 0.5) rgb += 0.35 * texture(uB1, uv).rgb + 0.25 * texture(uB2, uv).rgb;
  rgb += (h12(gl_FragCoord.xy + uGrainFrame * 17.0) - 0.5) * 0.018;
  rgb *= mix(1.0, 0.72, smoothstep(0.35, 1.1, length(uv - 0.5) * 1.4));
  o = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}`;

// Bloom mip 1: bright pass of the colorized trail, 4 taps.
export const BLOOM1_FS = HEAD + `
uniform sampler2D uTrail;
uniform vec2 uRes;
out vec4 o;
${COLORIZE}
vec3 bright(vec2 uv) { return max(colorize(texture(uTrail, vec2(uv.x, 1.0 - uv.y)).rgb) - 0.6, 0.0); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes, t = 0.5 / uRes;
  vec3 c = bright(uv + vec2(-t.x, -t.y)) + bright(uv + vec2(t.x, -t.y)) + bright(uv + vec2(-t.x, t.y)) + bright(uv + vec2(t.x, t.y));
  o = vec4(c * 0.25 * 2.2, 1.0);
}`;

// Bloom mip 2: wider 4-tap box of mip 1.
export const BLOOM2_FS = HEAD + `
uniform sampler2D uSrc;
uniform vec2 uRes;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes, t = 0.75 / uRes;
  vec3 c = texture(uSrc, uv + vec2(-t.x, -t.y)).rgb + texture(uSrc, uv + vec2(t.x, -t.y)).rgb
         + texture(uSrc, uv + vec2(-t.x, t.y)).rgb + texture(uSrc, uv + vec2(t.x, t.y)).rgb;
  o = vec4(c * 0.25, 1.0);
}`;

// Analysis probe: 128x128, max over a 5x5 tap grid per cell. Row 0 = world top (v = 0).
export const PROBE_FS = HEAD + `
uniform sampler2D uTrail;
uniform float uExpo;
out vec4 o;
void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec3 m = vec3(0.0);
  for (int j = 0; j < 5; j++)
    for (int i = 0; i < 5; i++) {
      vec2 uv = (cell + (vec2(i, j) + 0.5) / 5.0) / 128.0;
      m = max(m, texture(uTrail, uv).rgb);
    }
  float raw = max(m.r, max(m.g, m.b));
  float arg = m.r >= raw ? 0.0 : (m.g >= raw ? 0.5 : 1.0);
  o = vec4(1.0 - exp(-uExpo * raw), arg, sqrt(min(raw / 16.0, 1.0)), 1.0);
}`;

// Scaled copy (trail resize).
export const COPY_FS = HEAD + `
uniform sampler2D uSrc;
uniform vec2 uRes;
out vec4 o;
void main() { o = texture(uSrc, gl_FragCoord.xy / uRes); }`;

// Agent rescale on resize.
export const AGENT_SCALE_FS = HEAD + `
uniform sampler2D uAgents;
uniform vec2 uScale;
out vec4 o;
void main() { vec4 a = texelFetch(uAgents, ivec2(gl_FragCoord.xy), 0); o = vec4(a.xy * uScale, a.zw); }`;
