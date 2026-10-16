// WebGL2 renderer: agents in RGBA32F textures, trail in RGBA16F (or RGBA8), fullscreen passes.
import * as SH from './shaders.js';
import { mulberry32, gauss, clamp } from './rng.js';

export const TIERS = [1024, 768, 512, 384, 256];
// Tuning knobs (overridable from the query string for experiments).
const Q = new URLSearchParams(location.search);
export const TUNE = {
  wfood: +(Q.get('wfood') || 0.5), wrep: +(Q.get('wrep') || 4), fsig: +(Q.get('fsig') || 40), samp: +(Q.get('samp') || 15),
  dep: +(Q.get('dep') || 0.035), sat: +(Q.get('sat') || 0.5), churn: +(Q.get('churn') || 0.001),
};

function fbTest(gl, internal, type) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, 4, 4, 0, gl.RGBA, type, null);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fb); gl.deleteTexture(t);
  return ok;
}

export function probeWebGL2(canvas) {
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false,
      powerPreference: 'high-performance', depth: false, stencil: false,
    });
  } catch (e) { gl = null; }
  if (!gl) return null;
  return capabilities(gl);
}

export function capabilities(gl) {
  if (!gl.getExtension('EXT_color_buffer_float')) return null;
  if (!fbTest(gl, gl.RGBA32F, gl.FLOAT)) return null;
  const trail16 = fbTest(gl, gl.RGBA16F, gl.HALF_FLOAT);
  return { gl, trail16 };
}

function compile(gl, type, src, name) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(s);
    const numbered = src.split('\n').map((l, i) => String(i + 1).padStart(3) + '| ' + l).join('\n');
    console.error(`[physarum] shader compile failed (${name}):\n${log}\n${numbered}`);
    throw new Error('shader compile failed: ' + name);
  }
  return s;
}

function program(gl, vs, fs, name) {
  const p = gl.createProgram();
  const a = compile(gl, gl.VERTEX_SHADER, vs, name + '.vs');
  const b = compile(gl, gl.FRAGMENT_SHADER, fs, name + '.fs');
  gl.attachShader(p, a); gl.attachShader(p, b);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
    console.error(`[physarum] program link failed (${name}):\n${gl.getProgramInfoLog(p)}`);
    throw new Error('link failed: ' + name);
  }
  gl.deleteShader(a); gl.deleteShader(b);
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const nm = info.name.replace(/\[0\]$/, '');
    u[nm] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

export class GPURenderer {
  constructor(canvas, gl, trail16) {
    this.kind = 'gpu';
    this.canvas = canvas; this.gl = gl; this.trail16 = trail16;
    this.frame = 0;
    this.expo = 3;
    this.bloom = true;
    this.grainFrame = 0;
    this.pal = null;
    this.probeData = new Uint8Array(128 * 128 * 4);
    this.seedCounter = 0;
  }

  init(cssW, cssH, opts) {
    const gl = this.gl;
    this.seed = opts.seed >>> 0;
    this.stationsRef = opts.stations;
    this.progs = {
      agent: program(gl, SH.FULLSCREEN_VS, SH.AGENT_FS, 'agent'),
      deposit: program(gl, SH.DEPOSIT_VS, SH.DEPOSIT_FS, 'deposit'),
      diffuse: program(gl, SH.FULLSCREEN_VS, SH.DIFFUSE_FS, 'diffuse'),
      field: program(gl, SH.FULLSCREEN_VS, SH.FIELD_FS, 'field'),
      display: program(gl, SH.FULLSCREEN_VS, SH.DISPLAY_FS, 'display'),
      bloom1: program(gl, SH.FULLSCREEN_VS, SH.BLOOM1_FS, 'bloom1'),
      bloom2: program(gl, SH.FULLSCREEN_VS, SH.BLOOM2_FS, 'bloom2'),
      probe: program(gl, SH.FULLSCREEN_VS, SH.PROBE_FS, 'probe'),
      copy: program(gl, SH.FULLSCREEN_VS, SH.COPY_FS, 'copy'),
      ascale: program(gl, SH.FULLSCREEN_VS, SH.AGENT_SCALE_FS, 'agentScale'),
    };
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    this.probeT = this.tex(128, 128, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
    this.resize(cssW, cssH, opts.dpr, opts.simScale);
    this.tier = -1;
    this.setAgentTier(opts.tier, true);
    this.reseed('random');
  }

  tex(w, h, internal, format, type, filter) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, fb, w, h };
  }
  free(x) { if (!x) return; this.gl.deleteTexture(x.t); this.gl.deleteFramebuffer(x.fb); }
  trailTex(w, h) {
    const gl = this.gl;
    return this.trail16 ? this.tex(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR)
      : this.tex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  }
  bindTex(unit, t) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); }
  target(x) { const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, x ? x.fb : null); if (x) gl.viewport(0, 0, x.w, x.h); }
  draw() { this.gl.drawArrays(this.gl.TRIANGLES, 0, 3); }

  static simSize(cssW, cssH, simScale) {
    let TW = Math.max(16, Math.round(cssW * simScale)), TH = Math.max(16, Math.round(cssH * simScale));
    let f = Math.min(1, 2048 / Math.max(TW, TH), Math.sqrt(2.2e6 / (TW * TH)));
    return [Math.max(16, Math.floor(TW * f)), Math.max(16, Math.floor(TH * f))];
  }

  resize(cssW, cssH, dpr, simScale) {
    const gl = this.gl;
    this.cssW = cssW; this.cssH = cssH; this.dpr = dpr; this.simScale = simScale;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    const [TW, TH] = GPURenderer.simSize(cssW, cssH, simScale);
    const oldTW = this.TW, oldTH = this.TH;
    this.k = clamp(TH / 720, 0.6, 2.0);
    if (TW !== oldTW || TH !== oldTH) {
      const nA = this.trailTex(TW, TH), nB = this.trailTex(TW, TH);
      if (this.trailA) {
        // Blit old trail scaled into the new one so the network survives.
        this.target(nA);
        gl.useProgram(this.progs.copy.p);
        this.bindTex(0, this.trailA.t);
        gl.uniform1i(this.progs.copy.u.uSrc, 0);
        gl.uniform2f(this.progs.copy.u.uRes, TW, TH);
        this.draw();
        this.free(this.trailA); this.free(this.trailB);
      }
      this.trailA = nA; this.trailB = nB;
      this.free(this.fieldA); this.free(this.fieldB);
      const FW = Math.ceil(TW / 2), FH = Math.ceil(TH / 2);
      this.fieldA = this.tex(FW, FH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
      this.fieldB = this.tex(FW, FH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
      this.TW = TW; this.TH = TH;
      if (this.agA && oldTW) this.scaleAgents(TW / oldTW, TH / oldTH);
    }
    this.free(this.bloom1); this.free(this.bloom2);
    const W = this.canvas.width, H = this.canvas.height;
    this.bloom1 = this.tex(Math.max(1, Math.ceil(W / 4)), Math.max(1, Math.ceil(H / 4)), gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    this.bloom2 = this.tex(Math.max(1, Math.ceil(W / 8)), Math.max(1, Math.ceil(H / 8)), gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  }

  scaleAgents(sx, sy) {
    const gl = this.gl, P = this.progs.ascale;
    this.target(this.agB);
    gl.useProgram(P.p);
    this.bindTex(0, this.agA.t);
    gl.uniform1i(P.u.uAgents, 0);
    gl.uniform2f(P.u.uScale, sx, sy);
    this.draw();
    [this.agA, this.agB] = [this.agB, this.agA];
  }

  agentTex(S) { const gl = this.gl; return this.tex(S, S, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST); }

  setAgentTier(i, fresh = false) {
    i = clamp(i | 0, 0, TIERS.length - 1);
    if (i === this.tier) return;
    const gl = this.gl, S = TIERS[i];
    const nA = this.agentTex(S), nB = this.agentTex(S);
    gl.bindTexture(gl.TEXTURE_2D, nA.t);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, S, S, gl.RGBA, gl.FLOAT, this.seedData(S, 'random', 0, S * S));
    if (this.agA && !fresh) {
      const m = Math.min(S, this.S);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.agA.fb);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, nA.fb);
      gl.blitFramebuffer(0, 0, m, m, 0, 0, m, m, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }
    this.free(this.agA); this.free(this.agB);
    this.agA = nA; this.agB = nB; this.S = S; this.tier = i;
    this.active = S * S;
  }
  get agentCount() { return this.active; }

  // Generate agent state for `count` agents starting at linear index `start`.
  seedData(S, mode, start, count, center) {
    const rand = mulberry32((this.seed + 7919 * ++this.seedCounter) >>> 0);
    const TW = this.TW, TH = this.TH, mn = Math.min(TW, TH), k = this.k;
    const out = new Float32Array(count * 4);
    const st = this.stationsRef || [];
    if (mode === 'nodes' && !st.length) mode = 'disc';
    for (let i = 0; i < count; i++) {
      let x, y, th;
      if (center) {
        const a = rand() * Math.PI * 2, r = (24 + rand() * 30) * k;
        x = center[0] + Math.cos(a) * r; y = center[1] + Math.sin(a) * r; th = a + (rand() - 0.5);
      } else if (mode === 'disc') {
        const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.35 * mn;
        x = TW / 2 + Math.cos(a) * r; y = TH / 2 + Math.sin(a) * r; th = a;
      } else if (mode === 'ring') {
        const a = rand() * Math.PI * 2, r = 0.4 * mn * (1 + (rand() - 0.5) * 0.04);
        x = TW / 2 + Math.cos(a) * r; y = TH / 2 + Math.sin(a) * r; th = a + Math.PI;
      } else if (mode === 'nodes') {
        const s = st[(start + i) % st.length];
        x = s.u * TW + gauss(rand) * 30 * k; y = s.v * TH + gauss(rand) * 30 * k; th = rand() * Math.PI * 2;
      } else {
        x = rand() * TW; y = rand() * TH; th = rand() * Math.PI * 2;
      }
      out[i * 4] = clamp(x, 1, TW - 1); out[i * 4 + 1] = clamp(y, 1, TH - 1);
      out[i * 4 + 2] = th; out[i * 4 + 3] = 0.5;
    }
    return out;
  }

  reseed(mode) {
    const gl = this.gl, S = this.S;
    gl.bindTexture(gl.TEXTURE_2D, this.agA.t);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, S, S, gl.RGBA, gl.FLOAT, this.seedData(S, mode, 0, S * S));
  }

  // Convergence aid: respawn a fraction of agents in a ring around (u, v).
  respawnRing(u, v, frac) {
    const gl = this.gl, S = this.S;
    const rows = Math.max(1, Math.ceil((frac * S * S) / S));
    const r0 = Math.floor(Math.random() * (S - rows));
    gl.bindTexture(gl.TEXTURE_2D, this.agA.t);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, r0, S, rows, gl.RGBA, gl.FLOAT, this.seedData(S, 'ring', 0, rows * S, [u * this.TW, v * this.TH]));
  }

  clearTrail() {
    const gl = this.gl;
    for (const t of [this.trailA, this.trailB]) { this.target(t); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  }
  clearField() {
    const gl = this.gl;
    for (const t of [this.fieldA, this.fieldB]) { this.target(t); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  }

  setPalette(c0, c1, c2) { this.pal = { c0: new Float32Array(c0.flat()), c1: new Float32Array(c1.flat()), c2: new Float32Array(c2.flat()) }; }

  // One simulation frame: field update, then `substeps` x (agents, deposit, diffuse).
  step(p, world, substeps) {
    const gl = this.gl, k = this.k, TW = this.TW, TH = this.TH;
    const FW = this.fieldA.w, FH = this.fieldA.h;
    const st = world.stations, L = world.level;
    const n = Math.min(24, st.length);
    const stF = new Float32Array(96), stT = new Float32Array(96);
    for (let i = 0; i < n; i++) {
      stF.set([st[i].u * FW, st[i].v * FH, 1, TUNE.fsig * k / 2], i * 4);
      stT.set([st[i].u * TW, st[i].v * TH, TUNE.samp * L * (1 - p.decay) * (st[i].boost || 1) / p.species, 6 * k], i * 4);
    }
    const lakes = world.lakes, seeds = world.seeds;
    const lk = new Float32Array(64), sd = new Float32Array(64);
    lakes.forEach((l, i) => lk.set([l.u * FW, l.v * FH, l.amp, 28 * k * 0.55 / 2], i * 4));
    seeds.forEach((s, i) => sd.set([s.u * TW, s.v * TH, 0.5 * L, 14 * k * 0.5], i * 4));

    // D. field
    let P = this.progs.field;
    this.target(this.fieldB);
    gl.useProgram(P.p);
    this.bindTex(0, this.fieldA.t);
    gl.uniform1i(P.u.uField, 0);
    gl.uniform1f(P.u.uRepDecay, 0.992);
    gl.uniform1f(P.u.uBias, 0.6 / 255);
    gl.uniform1i(P.u.uN, n);
    gl.uniform4fv(P.u.uSt, stF);
    gl.uniform1i(P.u.uNB, lakes.length);
    gl.uniform4fv(P.u.uBrush, lk);
    this.draw();
    [this.fieldA, this.fieldB] = [this.fieldB, this.fieldA];

    // Churn: a trickle of agents respawns uniformly so the network keeps foraging instead of collapsing.
    this.churnAcc = (this.churnAcc || 0) + this.active * TUNE.churn * substeps;
    if (this.churnAcc >= this.S) {
      const rows = Math.min(8, Math.floor(this.churnAcc / this.S));
      this.churnAcc -= rows * this.S;
      const r0 = Math.floor(Math.random() * (this.S - rows));
      gl.bindTexture(gl.TEXTURE_2D, this.agA.t);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, r0, this.S, rows, gl.RGBA, gl.FLOAT, this.seedData(this.S, 'random', 0, rows * this.S));
    }
    const mask = p.species === 1 ? [1, 0, 0] : p.species === 2 ? [1, 1, 0] : [1, 1, 1];
    for (let s = 0; s < substeps; s++) {
      // A. agents
      P = this.progs.agent;
      this.target(this.agB);
      gl.useProgram(P.p);
      this.bindTex(0, this.agA.t); this.bindTex(1, this.trailA.t); this.bindTex(2, this.fieldA.t);
      gl.uniform1i(P.u.uAgents, 0); gl.uniform1i(P.u.uTrail, 1); gl.uniform1i(P.u.uField, 2);
      gl.uniform2f(P.u.uSim, TW, TH);
      gl.uniform1f(P.u.uSA, p.SA); gl.uniform1f(P.u.uRA, p.RA);
      gl.uniform1f(P.u.uSO, p.SO * k); gl.uniform1f(P.u.uSS, p.SS * k);
      gl.uniform1f(P.u.uRival, p.rivalry); gl.uniform1f(P.u.uJitter, 0.05);
      gl.uniform1f(P.u.uSat, TUNE.sat / L); gl.uniform1f(P.u.uWfood, TUNE.wfood * L); gl.uniform1f(P.u.uWrep, TUNE.wrep * L);
      gl.uniform1i(P.u.uSpecies, p.species); gl.uniform1i(P.u.uS, this.S); gl.uniform1i(P.u.uActive, this.active);
      gl.uniform1ui(P.u.uFrame, this.frame++ >>> 0);
      this.draw();
      [this.agA, this.agB] = [this.agB, this.agA];

      // B. deposit
      P = this.progs.deposit;
      this.target(this.trailA);
      gl.useProgram(P.p);
      this.bindTex(0, this.agA.t);
      gl.uniform1i(P.u.uAgents, 0); gl.uniform1i(P.u.uS, this.S); gl.uniform1i(P.u.uSpecies, p.species);
      gl.uniform2f(P.u.uSim, TW, TH);
      gl.uniform1f(P.u.uDeposit, this.trail16 ? TUNE.dep : TUNE.dep * 8);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, this.active);
      gl.disable(gl.BLEND);

      // C. diffuse + decay + station injection
      P = this.progs.diffuse;
      this.target(this.trailB);
      gl.useProgram(P.p);
      this.bindTex(0, this.trailA.t);
      gl.uniform1i(P.u.uTrail, 0);
      gl.uniform2f(P.u.uSim, TW, TH);
      gl.uniform1f(P.u.uDecay, p.decay); gl.uniform1f(P.u.uDiffuse, p.diffuse);
      gl.uniform1f(P.u.uMax, this.trail16 ? 50 : 1); gl.uniform1f(P.u.uBias, this.trail16 ? 0 : 1 / 255);
      gl.uniform3f(P.u.uMask, mask[0], mask[1], mask[2]);
      gl.uniform1i(P.u.uN, n); gl.uniform4fv(P.u.uSt, stT);
      gl.uniform1i(P.u.uNB, s === 0 ? seeds.length : 0); gl.uniform4fv(P.u.uBrush, sd);
      this.draw();
      [this.trailA, this.trailB] = [this.trailB, this.trailA];
    }
  }

  setColorUniforms(P) {
    const gl = this.gl;
    gl.uniform1f(P.u.uExpo, this.expo);
    gl.uniform3fv(P.u.uC0, this.pal.c0); gl.uniform3fv(P.u.uC1, this.pal.c1); gl.uniform3fv(P.u.uC2, this.pal.c2);
  }

  render(target = null, w = this.canvas.width, h = this.canvas.height, grain = true) {
    const gl = this.gl;
    if (this.bloom) {
      let P = this.progs.bloom1;
      this.target(this.bloom1);
      gl.useProgram(P.p);
      this.bindTex(0, this.trailA.t);
      gl.uniform1i(P.u.uTrail, 0);
      gl.uniform2f(P.u.uRes, this.bloom1.w, this.bloom1.h);
      this.setColorUniforms(P);
      this.draw();
      P = this.progs.bloom2;
      this.target(this.bloom2);
      gl.useProgram(P.p);
      this.bindTex(0, this.bloom1.t);
      gl.uniform1i(P.u.uSrc, 0);
      gl.uniform2f(P.u.uRes, this.bloom2.w, this.bloom2.h);
      this.draw();
    }
    const P = this.progs.display;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(P.p);
    this.bindTex(0, this.trailA.t); this.bindTex(1, this.bloom1.t); this.bindTex(2, this.bloom2.t);
    gl.uniform1i(P.u.uTrail, 0); gl.uniform1i(P.u.uB1, 1); gl.uniform1i(P.u.uB2, 2);
    gl.uniform2f(P.u.uRes, w, h);
    gl.uniform1f(P.u.uBloom, this.bloom ? 1 : 0);
    gl.uniform1f(P.u.uGrainFrame, grain && !this.staticGrain ? (this.grainFrame++ % 8) : 0);
    this.setColorUniforms(P);
    this.draw();
  }

  // Analysis: render the 128x128 probe and read it back (64 KB, about once per second).
  // A PIXEL_PACK_BUFFER + fence path was tried, but Chrome discards its readback shadow copy
  // for this usage pattern and logs a performance warning on every read, so a plain
  // synchronous read is used; the spec allows it at this size and rate.
  requestProbe() {
    const gl = this.gl, P = this.progs.probe;
    this.target(this.probeT);
    gl.useProgram(P.p);
    this.bindTex(0, this.trailA.t);
    gl.uniform1i(P.u.uTrail, 0);
    gl.uniform1f(P.u.uExpo, this.expo);
    this.draw();
    gl.readPixels(0, 0, 128, 128, gl.RGBA, gl.UNSIGNED_BYTE, this.probeData);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.probeReady = true;
  }
  pollProbe() {
    if (!this.probeReady) return null;
    this.probeReady = false;
    return this.probeData;
  }
  analyze() { this.requestProbe(); return this.pollProbe(); }

  // Poster: display pass at 2x backing size (long side <= 4096). Returns an ImageData-like object.
  posterPixels() {
    const gl = this.gl;
    let W = this.canvas.width * 2, H = this.canvas.height * 2;
    const f = Math.min(1, 4096 / Math.max(W, H)); W = Math.round(W * f); H = Math.round(H * f);
    const t = this.tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    this.render(t, W, H, false);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.free(t);
    const out = new Uint8ClampedArray(W * H * 4), row = W * 4;
    for (let y = 0; y < H; y++) out.set(px.subarray((H - 1 - y) * row, (H - y) * row), y * row);
    return new ImageData(out, W, H);
  }

  destroy() {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    for (const k of ['agA', 'agB', 'trailA', 'trailB', 'fieldA', 'fieldB', 'bloom1', 'bloom2', 'probeT']) this.free(this[k]);
    if (this.progs) for (const k in this.progs) gl.deleteProgram(this.progs[k].p);
    gl.deleteVertexArray(this.vao);
  }
}
