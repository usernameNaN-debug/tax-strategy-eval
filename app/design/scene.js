// The view out of the window, painted in a fragment shader: a wet sky wash,
// clouds, three hills and a lone tree, with rain, fog and snow on top and
// paper grain under everything. `day` runs 0 (night) → 0.13 (dawn) → 0.5
// (noon) → 1.0 (sunset) → 1.2 (night). Every value eases toward its target.

const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const FS = `
precision highp float;
uniform vec2 R; uniform float T, SEED;
uniform vec3 cTop, cHor, cSun, cFar, cMid, cNear, cTree, cCl, cCd, cFog;
uniform vec2 SUN; uniform float SUNV, CLOUD, RAIN, FOG, SNOW, NIGHT, GLOW, WIND;

float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
const mat2 M = mat2(1.6,1.2,-1.2,1.6);
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*noise(p); p=M*p+3.1; a*=.5; } return s; }
float fbm3(vec2 p){ float s=0., a=.5; for(int i=0;i<3;i++){ s+=a*noise(p); p=M*p+3.1; a*=.5; } return s; }
vec2 paint(float d, float soft){
  float m = smoothstep(-soft, soft, d);
  float ring = smoothstep(-soft, soft*.5, d) * (1.-smoothstep(soft*.5, soft*6., d));
  return vec2(m, ring);
}
float ridge(float x, float base, float amp, float fr, float off){ return base + amp*(fbm3(vec2(x*fr+off, off*.37))-.5)*2.; }

void main(){
  vec2 uv = gl_FragCoord.xy / R;
  float asp = R.x / R.y;
  vec2 p = vec2(uv.x*asp, uv.y);
  vec2 wob = vec2(fbm3(p*2.4+SEED), fbm3(p*2.4+SEED+9.1)) - .5;
  vec2 q = p + wob*.018;

  // sky: an uneven wet wash
  float g = smoothstep(.2, 1.05, uv.y + (fbm3(q*vec2(1.4,3.)+SEED*1.7)-.5)*.14);
  vec3 col = mix(cHor, cTop, g);

  // sun glow and disc
  vec2 sp = vec2(SUN.x*asp, SUN.y);
  float d = length(q - sp);
  col += cSun * (exp(-d*2.2)*.42 + exp(-d*7.)*.3) * SUNV * (1.-.7*CLOUD) * (1.+GLOW) * (1.-NIGHT*.85);
  float disc = smoothstep(.05, .04, d + (noise(q*38.)-.5)*.005) * SUNV;

  // stars
  vec2 sg = floor(q*170.);
  float star = step(.9965, hash(sg+SEED)) * NIGHT * smoothstep(.4,.9,uv.y) * (.55+.45*sin(T*1.1+hash(sg)*40.));
  col += star*.75*(1.-CLOUD);

  // a crescent moon at night
  vec2 mp = vec2(asp*.8, .8);
  float md = length(q - mp);
  float moon = smoothstep(.033,.027, md) * smoothstep(.022,.03, length(q - mp - vec2(.013,.007)));
  col += vec3(.95,.9,.8)*exp(-md*8.)*.14*NIGHT;
  col = mix(col, vec3(.97,.94,.86), moon*NIGHT);

  // clouds, wet on wet
  vec2 cq = q*vec2(1.2,2.5) + vec2(T*(.005+WIND*.028), 0.) + SEED;
  float c = fbm(cq + .9*fbm(cq*.8 - T*.0015));
  float band = smoothstep(.32, .78, uv.y);
  float th = 1.04 - mix(.12, 1., CLOUD)*.56;
  float cv = c*(.74+.46*band);
  float cm = smoothstep(th-.1, th+.07, cv);
  float ce = smoothstep(th-.1, th-.03, cv) * (1.-smoothstep(th, th+.11, cv));
  float sh = smoothstep(.35, .8, fbm3(cq*2.1+4.));
  vec3 cc = mix(cCl, cCd, clamp(sh*.6 + RAIN*.5 + CLOUD*.15, 0., 1.));
  disc *= 1.-cm*.92;
  col = mix(col, cSun*1.04+.06, disc*(1.-NIGHT));
  col = mix(col, cc, cm*.9);
  col = mix(col, cc*.86, ce*.32);

  // hills
  float en = (fbm3(q*vec2(9.,15.))-.5)*.016;
  float yF = ridge(q.x, .43, .085, 1.05, SEED*3.+1.);
  vec2 hF = paint(yF+en-q.y, .004);
  vec3 farC = cFar*(.94+.1*fbm3(q*vec2(5.,9.)+1.));
  col = mix(col, farC, hF.x*.92);
  col = mix(col, farC*.86, hF.y*.25);

  float fogN = fbm3(vec2(q.x*1.2 - T*.01, q.y*5.+2.));
  col = mix(col, cFog, FOG*smoothstep(.55,.22,uv.y)*(.35+.65*fogN));

  float yM = ridge(q.x, .315, .085, 1.55, SEED*5.+4.);
  vec2 hM = paint(yM+en*1.2-q.y, .004);
  vec3 midC = cMid*(.92+.14*fbm3(q*vec2(6.,10.)+2.));
  col = mix(col, midC, hM.x);
  col = mix(col, midC*.84, hM.y*.28);

  // a lone tree on the middle hill
  float tx = asp*.71;
  float tb = ridge(tx, .315, .085, 1.55, SEED*5.+4.) - .004;
  float sway = sin(T*.7)*.0035*(1.+WIND*3.);
  vec2 tp = q - vec2(tx, tb);
  tp.x -= sway*max(tp.y,0.)*9.;
  float trunk = smoothstep(.006,.003,abs(tp.x + tp.y*.04)) * step(0.,tp.y) * step(tp.y,.07);
  float crown = length((tp-vec2(0.,.088))*vec2(1.,1.12)) - (.046+(fbm3(tp*26.+SEED)-.5)*.024);
  vec2 hT = paint(-crown, .003);
  vec3 treeC = cTree*(.88+.24*fbm3(tp*30.));
  col = mix(col, cTree*.8, trunk*.95);
  col = mix(col, treeC, hT.x);
  col = mix(col, treeC*.78, hT.y*.3);

  float yN = ridge(q.x, .16, .065, 2.3, SEED*7.+8.);
  vec2 hN = paint(yN+en*1.4-q.y, .004);
  vec3 nearC = cNear*(.9+.18*fbm3(q*vec2(7.,12.)+3.));
  col = mix(col, nearC, hN.x);
  col = mix(col, nearC*.82, hN.y*.3);

  col = mix(col, cFog, FOG*.5*smoothstep(.35,0.,uv.y)*(.4+.6*fogN));

  // rain
  vec2 rq = vec2(q.x + q.y*.22, q.y);
  float rn = noise(vec2(rq.x*150., rq.y*5. + T*9.));
  float rn2 = noise(vec2(rq.x*85.+7., rq.y*3.4 + T*6.3));
  float streak = max(smoothstep(.955,1.,rn), smoothstep(.965,1.,rn2)*.7);
  col = mix(col, col*vec3(.86,.9,.97)+.015, RAIN*.4);
  col = mix(col, vec3(.92,.94,.97), streak*RAIN*.55);

  // snow
  for (int i=0;i<3;i++){
    float fi = float(i);
    vec2 s = q*(6.+fi*5.) + vec2(sin(T*.35+fi*2.)*.6 + T*WIND*.4, T*(.22+.1*fi));
    vec2 id = floor(s); vec2 f = fract(s)-.5;
    vec2 o = vec2(hash(id+3.1), hash(id+5.7))-.5;
    float fl = smoothstep(.09,.035,length(f-o*.6)) * step(.55, hash(id+fi*7.));
    col = mix(col, vec3(.98,.98,1.), fl*SNOW*(.9-fi*.2));
  }

  // lamplight from the room, caught on the glass after dark
  float lamp = exp(-length(uv*vec2(asp*.55,1.))*2.);
  col += vec3(1.,.7,.4)*lamp*.24*NIGHT;

  // paper: fibers and pigment granulation
  float fib = fbm3(gl_FragCoord.xy/R.y*vec2(110.,30.));
  float gran = noise(gl_FragCoord.xy*.9);
  float lum = dot(col, vec3(.3,.59,.11));
  col *= .95 + .07*fib;
  col -= (gran-.5)*.05*(1.-lum*.5);
  float v = length((uv-.5)*vec2(asp*.7,1.));
  col *= mix(1., .9, smoothstep(.45, 1.1, v));
  gl_FragColor = vec4(col, 1.);
}`;

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const mul = (a, k) => a.map((v, i) => v * (Array.isArray(k) ? k[i] : k));
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Sky colors through the day: [phase, top, horizon, sun]
const KEYS = [
  [0.00, '#2c335f', '#4c4b74', '#000000'],
  [0.07, '#3a4170', '#916f90', '#c98a7a'],
  [0.13, '#6078ab', '#efb497', '#ffcf9e'],
  [0.24, '#86acd6', '#f2dcc2', '#fff0d2'],
  [0.50, '#7aaad8', '#e4ecee', '#fff8ea'],
  [0.80, '#83a8d0', '#efe0c4', '#fff1d8'],
  [0.93, '#7e90bf', '#f2bf8a', '#ffc070'],
  [1.00, '#57639a', '#e5967a', '#ff9466'],
  [1.07, '#414c7e', '#a6728d', '#c96a5a'],
  [1.18, '#2c335f', '#4c4b74', '#000000'],
].map(([t, a, b, c]) => [t, hex(a), hex(b), hex(c)]);

export function skyAt(day) {
  const t = clamp(day, 0, 1.18);
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] < t) i++;
  const [t0, a0, b0, c0] = KEYS[i], [t1, a1, b1, c1] = KEYS[i + 1];
  const k = clamp((t - t0) / (t1 - t0));
  return { top: mix(a0, a1, k), hor: mix(b0, b1, k), sun: mix(c0, c1, k) };
}
export const nightAt = (day) => clamp(1 - sstep(0.05, 0.16, day) + sstep(1.02, 1.14, day));
export const rgb = (c) => `rgb(${c.map((v) => Math.round(clamp(v) * 255)).join(',')})`;

export const WEATHER = {
  clear: { cloud: 0.1, rain: 0, fog: 0, snow: 0, wind: 0.1 },
  fair: { cloud: 0.42, rain: 0, fog: 0, snow: 0, wind: 0.2 },
  overcast: { cloud: 0.8, rain: 0, fog: 0.1, snow: 0, wind: 0.25 },
  showers: { cloud: 0.66, rain: 0.6, fog: 0.05, snow: 0, wind: 0.4 },
  fog: { cloud: 0.35, rain: 0, fog: 0.85, snow: 0, wind: 0.05 },
  snow: { cloud: 0.62, rain: 0, fog: 0.1, snow: 0.85, wind: 0.15 },
};

const BASE = { far: hex('#a7b9bb'), mid: hex('#90a886'), near: hex('#5e7b57'), tree: hex('#3f5a3c') };
const NIGHTC = hex('#363d61');

export class Scene {
  constructor(canvas, { scale = 0.6, seed = Math.random() * 50 } = {}) {
    this.canvas = canvas;
    this.scale = scale;
    this.seed = seed;
    this.cur = { day: 0.3, cloud: 0.3, rain: 0, fog: 0, snow: 0, wind: 0.2, glow: 0 };
    this.tgt = { ...this.cur };
    this.tau = { ...Object.fromEntries(Object.keys(this.cur).map((k) => [k, 2])) };
    this.t = 0;
    this.running = true;
    this.visible = true;
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) { this.gl = null; canvas.parentElement.classList.add('nogl'); return; }
    this.gl = gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    gl.useProgram(pr);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ['R', 'T', 'SEED', 'cTop', 'cHor', 'cSun', 'cFar', 'cMid', 'cNear', 'cTree', 'cCl', 'cCd', 'cFog', 'SUN', 'SUNV', 'CLOUD', 'RAIN', 'FOG', 'SNOW', 'NIGHT', 'GLOW', 'WIND']) this.u[n] = gl.getUniformLocation(pr, n);
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(canvas);
    this.last = performance.now();
    const loop = (now) => { this.frame(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  set(target, { seconds = 2, instant = false } = {}) {
    for (const [k, v] of Object.entries(target)) {
      if (!(k in this.tgt)) continue;
      this.tgt[k] = v;
      this.tau[k] = Math.max(0.05, seconds / 3);
      if (instant) this.cur[k] = v;
    }
  }

  weather(name, opts) { this.set(WEATHER[name] || WEATHER.fair, opts); }

  resize() {
    if (!this.gl) return;
    const r = this.canvas.getBoundingClientRect();
    const k = Math.min(devicePixelRatio || 1, 2) * this.scale;
    this.canvas.width = Math.max(2, Math.round(r.width * k));
    this.canvas.height = Math.max(2, Math.round(r.height * k));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.dirty = true;
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.gl || !this.visible) return;
    if (!this.running && !this.dirty) return;
    if (this.running) this.t += dt;
    for (const k of Object.keys(this.cur)) this.cur[k] += (this.tgt[k] - this.cur[k]) * (1 - Math.exp(-dt / this.tau[k]));
    this.dirty = false;
    const s = this.cur, gl = this.gl, u = this.u;
    const sky = skyAt(s.day), night = nightAt(s.day);
    const oc = clamp(s.cloud * 0.7 + s.rain * 0.6);
    const grey = mul(hex('#b2b7bd'), 1 - night * 0.7);
    const top = mix(sky.top, grey, oc * 0.5), hor = mix(sky.hor, mul(grey, 1.05), oc * 0.45);
    const tint = mix([1, 1, 1], mul(sky.hor, 1.12), 0.28);
    const hill = (c, k) => mix(mul(c, tint), mul(NIGHTC, k), night * 0.72);
    const sd = clamp((s.day - 0.09) / 0.92);
    gl.uniform2f(u.R, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.T, this.t);
    gl.uniform1f(u.SEED, this.seed);
    gl.uniform3fv(u.cTop, top);
    gl.uniform3fv(u.cHor, hor);
    gl.uniform3fv(u.cSun, sky.sun);
    gl.uniform3fv(u.cFar, hill(mix(BASE.far, hor, 0.42), 1.25));
    gl.uniform3fv(u.cMid, hill(BASE.mid, 1));
    gl.uniform3fv(u.cNear, hill(BASE.near, 0.8));
    gl.uniform3fv(u.cTree, hill(BASE.tree, 0.6));
    gl.uniform3fv(u.cCl, mul(mix(hex('#fbf7f0'), hor, 0.3), 1 - night * 0.65));
    gl.uniform3fv(u.cCd, mul(mix(top, hex('#8e96a3'), 0.5), 1 - night * 0.45));
    gl.uniform3fv(u.cFog, mul(mix(hor, hex('#eeebe4'), 0.5), 1 - night * 0.6));
    gl.uniform2f(u.SUN, 0.1 + 0.8 * sd, 0.2 + 0.62 * Math.sin(Math.PI * sd));
    gl.uniform1f(u.SUNV, sstep(0.06, 0.12, s.day) * (1 - sstep(1.0, 1.06, s.day)));
    gl.uniform1f(u.CLOUD, s.cloud);
    gl.uniform1f(u.RAIN, s.rain);
    gl.uniform1f(u.FOG, s.fog);
    gl.uniform1f(u.SNOW, s.snow);
    gl.uniform1f(u.NIGHT, night);
    gl.uniform1f(u.GLOW, s.glow);
    gl.uniform1f(u.WIND, s.wind);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
