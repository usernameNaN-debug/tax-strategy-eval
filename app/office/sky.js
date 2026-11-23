// The film behind the office. One fragment shader draws a sky, a clock face
// you can almost read, and worksheets of figures drifting through it, with a
// slow rack focus between the three. It renders at a fraction of the screen
// and is scaled up, so the blur is close to free.

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;

const FRAG = `
precision highp float;
uniform vec2 R;
uniform float T, CLK, FOCUS;
uniform vec3 cTop, cMid, cLow, cCloud, cGlow, cGround, cInk;
uniform float uHorizon, uSheets, uClouds, uDial, uDark, uHy;
uniform vec3 uDialP;  // x, y, radius

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= .5; }
  return v;
}
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
float blurAt(float z){ return 0.003 + 0.085 * pow(abs(z - FOCUS), 1.15); }
float soft(float d, float b){ return 1. - smoothstep(-b, b, d); }

void main(){
  vec2 uv = gl_FragCoord.xy / R;
  float asp = R.x / R.y;
  vec2 p = vec2((uv.x - .5) * asp, uv.y - .5);

  // sky
  vec3 col = mix(cLow, cMid, smoothstep(0.0, 0.55, uv.y));
  col = mix(col, cTop, smoothstep(0.45, 1.05, uv.y));

  // clouds, far away; their edges sharpen when the focus comes back to them
  float bc = 0.06 + 0.32 * abs(0.08 - FOCUS);
  vec2 q = p * 1.35 + vec2(T * 0.010, 0.0);
  float w = fbm(q * 0.8 + vec2(0., T * 0.003));
  float n1 = fbm(q * 1.1 + w * 1.4);
  float c1 = smoothstep(0.33 - bc, 0.60 + bc, n1);
  vec2 q2 = p * 2.4 + vec2(T * 0.018, 3.0);
  float c2 = smoothstep(0.50 - bc, 0.72 + bc, fbm(q2 + fbm(q2 * 0.7)));
  float clouds = clamp(c1 * 0.95 + c2 * 0.45, 0., 1.) * uClouds;
  vec3 cc = mix(cCloud * .9, cCloud, smoothstep(.35, .8, n1));
  col = mix(col, cc, clouds * 0.88);

  // the clock face: a pale disc low in the sky, ticks, two hands
  vec2 dp = p - uDialP.xy; float r = length(dp); float Rd = uDialP.z;
  float bd = blurAt(0.45) + 0.007;
  float disc = soft(r - Rd, bd + 0.01);
  col = mix(col, mix(cCloud, cGlow, 0.35), disc * 0.13 * uDial);
  col += cGlow * exp(-max(r - Rd, 0.) * 5.) * 0.10 * uDial;
  float ring = soft(abs(r - Rd) - 0.0035, bd + 0.0015);
  float seg = (atan(dp.x, dp.y) / 6.28318 + 1.) * 60.;
  float idx = floor(seg + .5);
  float hour = step(mod(idx, 5.), .5);
  float dAng = abs(seg - idx) / 60. * 6.28318 * r;
  float r0 = Rd * mix(.88, .78, hour), r1 = Rd * .94;
  float dr = max(max(r0 - r, r - r1), 0.);
  float tick = soft(length(vec2(max(dAng - mix(.0022, .0048, hour), 0.), dr)), bd + 0.0015);
  float mA = CLK * 6.28318, hA = mA / 12.;
  vec2 md = vec2(sin(mA), cos(mA)), hd = vec2(sin(hA), cos(hA));
  float hands = min(sdSeg(dp, -md * Rd * .1, md * Rd * .8) - .0035, sdSeg(dp, -hd * Rd * .08, hd * Rd * .52) - .0065);
  float ink = max(max(ring, tick), soft(hands, bd + 0.0015));
  ink = max(ink, soft(r - .008, bd + .002));
  col = mix(col, cInk, ink * .3 * uDial);

  // the horizon: a long arc of ground with light along its rim
  float Rb = 1.9;
  vec2 hc = vec2(0., uHy - Rb);
  float d = length(p - hc) - Rb;
  col += cGlow * exp(-max(d, 0.) * 7.) * .75 * uHorizon;
  col += cGlow * exp(-abs(d) * 70.) * .35 * uHorizon;
  col = mix(col, cGround, smoothstep(.012, -.05, d) * uHorizon);

  // worksheets drifting past, nearest last
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float z = .55 + .45 * fract(sin(fi * 12.9898 + 4.1) * 43758.5);
    float sp = .005 + .009 * z;
    float x0 = fract(fi * .618 + T * sp);
    vec2 c = vec2((x0 * 1.5 - .75) * asp * 1.05, (fract(fi * .381 + .2) - .5) * .74 + .05 * sin(T * .17 + fi * 2.1));
    float size = .06 + .10 * (z - .55) / .45;
    float ang = .42 * sin(T * (.045 + .011 * fi) + fi * 1.9);
    float flip = cos(T * (.06 + .017 * fi) + fi * 1.7);
    vec2 hs = vec2(size * .77, size);
    float b = blurAt(z) * (.6 + .8 * size) + .004;
    float fade = smoothstep(0., .08, x0) * smoothstep(1., .92, x0) * uSheets;
    mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    float tilt = mix(.5, 1., abs(flip));
    vec2 lp = rot * (p - c); lp.x /= tilt;
    vec2 sp2 = rot * (p - c - vec2(.012, -.024) * (.5 + z)); sp2.x /= tilt;
    col *= 1. - soft(sdBox(sp2, hs), b * 2.2 + .02) * .16 * fade * z;
    float a = soft(sdBox(lp, hs), b) * fade;
    vec2 u = lp / hs;
    float back = step(flip, 0.);
    vec3 pc = mix(vec3(.96, .94, .89), vec3(.84, .82, .77), back);
    pc *= .9 + .1 * (u.y * .5 + .5) - .05 * u.x * sign(flip);
    float sharp = smoothstep(.034, .008, b) * (1. - back);
    float rule = soft(abs(fract(u.y * 6.5 + .5) - .5) - .03, .04) * step(abs(u.x), .92) * step(abs(u.y), .92);
    float margin = soft(abs(u.x + .62) - .012, .02) * step(abs(u.y), .92);
    float row = floor((.72 - u.y) / .16);
    float ry = fract((.72 - u.y) / .16);
    float inRow = step(0., row) * step(row, 8.) * soft(abs(ry - .55) - .13, .05);
    float w1 = .18 + .30 * hash(vec2(row, 1. + fi)), w2 = .22 + .34 * hash(vec2(row, 2. + fi));
    float fig = inRow * (step(.12 - w1, u.x) * step(u.x, .12) + step(.86 - w2, u.x) * step(u.x, .86));
    float total = soft(abs(u.y + .80) - .012, .02) * step(.30, u.x) * step(u.x, .86);
    float head = soft(abs(u.y - .84) - .035, .02) * step(-.5, u.x) * step(u.x, .25);
    pc = mix(pc, vec3(.62, .70, .78), sharp * rule * .35);
    pc -= sharp * (fig * .34 + total * .45 + head * .3);
    pc = mix(pc, vec3(.75, .36, .34), sharp * margin * .4);
    col = mix(col, pc * (.84 + .16 * dot(col, vec3(.333))), a * (.38 + .52 * z));
  }

  col *= mix(1., .80, smoothstep(.45, 1.25, length(p * vec2(.85, 1.25))));
  col *= 1. - uDark;
  col += (hash(gl_FragCoord.xy + fract(T * 7.13) * 91.7) - .5) * .045;
  gl_FragColor = vec4(col, 1.);
}`;

const C = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// Moods are target uniforms; the film eases toward whichever one is set.
export const MOODS = {
  reel: { top: '#5e8aa6', mid: '#86a7b6', low: '#c9cbbb', cloud: '#efe7cf', glow: '#ffdca0', ground: '#1b1917', ink: '#f6f0de',
    horizon: 0, hy: -0.9, sheets: 1, clouds: 1, dial: 1, dial_p: [0.40, 0.08, 0.36], dark: 0, rack: 1 },
  files: { top: '#2f4659', mid: '#4f6676', low: '#8a8f8c', cloud: '#c9c6b6', glow: '#f2cf96', ground: '#151413', ink: '#e9e3d0',
    horizon: 0, hy: -0.9, sheets: 0.35, clouds: 0.75, dial: 0.3, dial_p: [0.42, 0.16, 0.30], dark: 0.06, rack: 0, focus: 0.12 },
  explore: { top: '#0d1730', mid: '#22406a', low: '#7fb4c9', cloud: '#a9c3cc', glow: '#9fdcf2', ground: '#06080c', ink: '#d9eef5',
    horizon: 1, hy: 0.0, sheets: 0.18, clouds: 0.3, dial: 0.75, dial_p: [0, 0.0, 0.20], dark: 0, rack: 0, focus: 0.45 },
  result: { top: '#11101f', mid: '#3a2b4c', low: '#df7a4b', cloud: '#c79a8a', glow: '#ff9a5c', ground: '#070505', ink: '#ffe1cc',
    horizon: 1, hy: 0.0, sheets: 0.18, clouds: 0.3, dial: 0.75, dial_p: [0, 0.0, 0.20], dark: 0, rack: 0, focus: 0.45 },
};

// Rooms of the office tint the film while the agent is in them.
const ROOMS = {
  desk: ['#2f4659', '#4f6676', '#8a8f8c'],
  library: ['#2e2a2c', '#5c4c40', '#c79a5c'],
  law: ['#26191c', '#4c2e30', '#9a5a50'],
  portals: ['#132a3a', '#2c5468', '#7cc0cc'],
  news: ['#1a1a36', '#3a3a6a', '#9a90d0'],
  archive: ['#151210', '#2e2620', '#6a5644'],
  client: ['#1c2a28', '#3c5a50', '#a8c4a0'],
  engine: ['#18202c', '#3c4c60', '#b4c4d4'],
};
export function roomMood(room) {
  const [top, mid, low] = ROOMS[room] || ROOMS.desk;
  return { ...MOODS.files, top, mid, low, dark: 0.12, dial: 0.55, dial_p: [0.48, 0.18, 0.28], sheets: 0.5 };
}

export class Sky {
  constructor(canvas, { scale = 0.5 } = {}) {
    this.canvas = canvas;
    this.scale = scale;
    this.t = 7;
    this.clk = 1.62;
    this.clockSpeed = 1 / 240;
    this.running = true;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    this.gl = gl;
    if (!gl) { canvas.classList.add('nogl'); return; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr);
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ['R', 'T', 'CLK', 'FOCUS', 'cTop', 'cMid', 'cLow', 'cCloud', 'cGlow', 'cGround', 'cInk', 'uHorizon', 'uSheets', 'uClouds', 'uDial', 'uDark', 'uHy', 'uDialP']) this.u[n] = gl.getUniformLocation(pr, n);
    this.cur = this.toVec(MOODS.reel);
    this.target = this.toVec(MOODS.reel);
    this.ease = 1.6;
    new ResizeObserver(() => this.resize()).observe(canvas);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.last = performance.now(); });
    this.resize();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  toVec(m) {
    return {
      top: C(m.top), mid: C(m.mid), low: C(m.low), cloud: C(m.cloud), glow: C(m.glow), ground: C(m.ground), ink: C(m.ink),
      horizon: m.horizon, hy: m.hy, sheets: m.sheets, clouds: m.clouds, dial: m.dial, dial_p: [...m.dial_p], dark: m.dark,
      rack: m.rack, focus: m.focus ?? 0.45,
    };
  }

  // Ease toward a mood over roughly `seconds`.
  set(mood, { seconds = 1.6, instant = false } = {}) {
    this.target = this.toVec(typeof mood === 'string' ? MOODS[mood] : mood);
    this.ease = seconds;
    if (instant) this.cur = this.toVec(typeof mood === 'string' ? MOODS[mood] : mood);
  }

  resize() {
    const c = this.canvas;
    const w = Math.max(2, Math.round(c.clientWidth * this.scale * Math.min(devicePixelRatio, 2)));
    const h = Math.max(2, Math.round(c.clientHeight * this.scale * Math.min(devicePixelRatio, 2)));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    if (!this.gl || document.hidden || !this.canvas.isConnected || this.canvas.clientWidth === 0) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const k = 1 - Math.exp(-dt / Math.max(0.05, this.ease / 3));
    const lerp = (a, b) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * k) : a + (b - a) * k);
    for (const key of Object.keys(this.cur)) this.cur[key] = lerp(this.cur[key], this.target[key]);
    const slow = this.reduced ? 0.12 : 1;
    if (this.running) { this.t += dt * slow; this.clk += dt * this.clockSpeed * slow; }
    const c = this.cur;
    const rackF = 0.5 - 0.5 * Math.cos((this.t / 26) * Math.PI * 2);   // 0 far .. 1 near
    const focus = c.rack * rackF + (1 - c.rack) * c.focus;
    const gl = this.gl, u = this.u;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.R, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.T, this.t);
    gl.uniform1f(u.CLK, this.clk);
    gl.uniform1f(u.FOCUS, focus);
    gl.uniform3fv(u.cTop, c.top); gl.uniform3fv(u.cMid, c.mid); gl.uniform3fv(u.cLow, c.low);
    gl.uniform3fv(u.cCloud, c.cloud); gl.uniform3fv(u.cGlow, c.glow); gl.uniform3fv(u.cGround, c.ground); gl.uniform3fv(u.cInk, c.ink);
    gl.uniform1f(u.uHorizon, c.horizon); gl.uniform1f(u.uSheets, c.sheets); gl.uniform1f(u.uClouds, c.clouds);
    gl.uniform1f(u.uDial, c.dial); gl.uniform1f(u.uDark, c.dark); gl.uniform1f(u.uHy, c.hy);
    gl.uniform3fv(u.uDialP, c.dial_p);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
