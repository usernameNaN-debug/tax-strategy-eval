// The stage plays a rollout. Two views share one canvas:
//   overview  the building in cross-section, 480x270 shown at 2x, for travel
//             and for the postmortem map
//   room      one room's close-up, 192x108 shown at 5x, where the work happens
// Everything drawn is a function of (timeline, t), so scrubbing is free.
import { W, H, FEET, ROOM, ROOM_RECTS, STATION, CORK_SLOTS, JAR, TAPE, TRAY, HOME_FEET, CLIENT_SEAT, HOME_SPOTS, SECRETARY_SEAT, COWORKER_SPOT } from './layout.js';
import { Raster } from './gfx.js';
import { C, BAYER, u32 } from './palette.js';
import { buildWorld, postProcess, pageColor } from './render.js';
import { drawFront, digits, hillY } from './scene.js';
import { drawPerson, LOOKS, look } from './person.js';
import { drawBig } from './big.js';
import { RW, RH, RFEET, SCENES, buildScene, buildFront } from './rooms.js';
import { assignSlots, SCENE_ROOM, ROOM_SCENE, PLACES } from './slots.js';
import { buildTimeline, shotAt, segAt, posOnPath, FADE } from './timeline.js';

const ROOMS_N = 9;
const OUT_W = 960, OUT_H = 540;

const CLIENT_LOOKS = {
  morenos_oh: { head: 'short', hair: 'black', skin: 'medium', top: 'olive', bottom: 'denim', shoes: 'white' },
  haines_fl: { head: 'bun', hair: 'grey', skin: 'light', top: 'plum', bottom: 'greyskirt', shoes: 'brown', skirt: true },
  raghavan_becker_ca: { head: 'long', hair: 'black', skin: 'deep', top: 'navy', bottom: 'khaki', shoes: 'white' },
  haddad_co: { head: 'curly', hair: 'black', skin: 'medium', top: 'rust', bottom: 'denim', shoes: 'black' },
  vega_nv: { head: 'long', hair: 'brown', skin: 'medium', top: 'teal', bottom: 'charcoal', shoes: 'black' },
};

const ditherAt = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

export class Stage {
  constructor(canvas, { marketX, macro }) {
    this.canvas = canvas;
    canvas.width = OUT_W; canvas.height = OUT_H;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.marketX = marketX;
    this.macro = macro;
    this.world = buildWorld(marketX);
    this.ovFrame = new Raster(W, H);
    this.rmFrame = new Raster(RW, RH);
    this.ovCanvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    this.rmCanvas = Object.assign(document.createElement('canvas'), { width: RW, height: RH });
    this.scenes = {};
    this.fronts = {};
    for (const name of Object.keys(SCENES)) { this.scenes[name] = buildScene(name, marketX, Raster); this.fronts[name] = buildFront(name, Raster); }
    this.page = pageColor();
    this.t = 0;
    this.speed = 2;
    this.playing = false;
    this.mode = 'idle';
    this.pmView = 'overview';
    this.xray = false;
    this.dim = new Float32Array(ROOMS_N);
    this.dimTarget = new Float32Array(ROOMS_N);
    this.listeners = {};
    this.clock = 0;
    this.hover = null;
    this.clientLook = look(CLIENT_LOOKS.morenos_oh);
    this.timeline = null;
    this.slots = {};
    this.status = {};
    this.lastEvent = -1;
    this.lastView = null;
    this.visible = true;
    this._loop = this._loop.bind(this);
    this._prev = performance.now();
    requestAnimationFrame(this._loop);
    const io = new IntersectionObserver(([en]) => { this.visible = en.intersectionRatio > 0.1; }, { threshold: [0, 0.1, 0.5] });
    io.observe(canvas);
    canvas.addEventListener('mousemove', (e) => this._onMove(e));
    canvas.addEventListener('mouseleave', () => { this.hover = null; this.emit('hover', null); });
    canvas.addEventListener('click', (e) => this._onClick(e));
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { this.page = pageColor(); });
  }

  on(k, fn) { (this.listeners[k] ||= []).push(fn); }
  emit(k, v) { for (const fn of this.listeners[k] || []) fn(v); }

  setHousehold(world) {
    this.household = world;
    this.slots = assignSlots(world);
    this.clientLook = look(CLIENT_LOOKS[world.id] || CLIENT_LOOKS.morenos_oh);
  }

  load(rollout, grade) {
    this.rollout = rollout;
    this.grade = grade;
    this.quota = rollout.quota || 1;
    this.timeline = buildTimeline(rollout.trace, this.slots);
    this.status = grade?.docStatus || {};
    this.t = 0;
    this.lastEvent = -1;
    this.mode = 'replay';
    this.pmView = 'overview';
    this.emit('loaded', this.timeline);
  }

  idle() { this.mode = 'idle'; this.timeline = null; this.playing = false; }
  play() { if (!this.timeline) return; if (this.t >= this.timeline.duration) this.t = 0; this.mode = 'replay'; this.playing = true; this.emit('play', true); }
  pause() { this.playing = false; this.emit('play', false); }
  toggle() { this.playing ? this.pause() : this.play(); }
  setSpeed(s) { this.speed = s; }
  seek(t) { if (!this.timeline) return; if (this.mode === 'postmortem') this.mode = 'replay'; this.t = Math.max(0, Math.min(this.timeline.duration, t)); this._emitEvent(); }
  seekEvent(i) { const m = this.timeline?.marks[i]; if (m) this.seek(m.t + 0.01); }
  setMode(m) {
    this.mode = m;
    if (m === 'postmortem' && this.timeline) { this.t = this.timeline.duration; this.playing = false; this.pmView = 'overview'; }
  }
  openRoom(scene) { this.pmView = scene || 'overview'; this.emit('view', this.pmView); }
  setXray(v) { this.xray = v; }
  spotlight(rooms) {
    for (let r = 0; r < ROOMS_N; r++) this.dimTarget[r] = rooms && !rooms.includes(r) && r !== 0 ? 0.82 : 0;
    if (rooms) this.dimTarget[0] = 0.5;
  }
  get view() {
    if (this.mode === 'idle' || !this.timeline) return 'overview';
    if (this.mode === 'postmortem') return this.pmView;
    return shotAt(this.timeline.shots, this.t).view;
  }

  _emitEvent() {
    const m = this.timeline?.marks;
    if (!m) return;
    let idx = -1;
    for (let i = 0; i < m.length; i++) if (m[i].t <= this.t) idx = i; else break;
    if (idx !== this.lastEvent) { this.lastEvent = idx; this.emit('event', idx); }
    this.emit('tick', this.t);
  }

  _loop(now) {
    const dt = Math.min(0.1, (now - this._prev) / 1000);
    this._prev = now;
    if (!this.visible || document.hidden) { requestAnimationFrame(this._loop); return; }
    this.clock += dt;
    if (this.playing && this.timeline) {
      this.t += dt * this.speed;
      if (this.t >= this.timeline.duration) { this.t = this.timeline.duration; this.playing = false; this.emit('end'); }
      this._emitEvent();
    }
    for (let r = 0; r < ROOMS_N; r++) {
      const d = this.dimTarget[r] - this.dim[r];
      this.dim[r] += Math.sign(d) * Math.min(Math.abs(d), dt * 4);
    }
    this.render();
    requestAnimationFrame(this._loop);
  }

  // ---------------------------------------------------------- world state

  stateAt(t) {
    const S = {
      inkStart: new Float32Array(ROOMS_N).fill(Infinity), opened: new Map(), active: [], pins: [], jar: 0, fool: 0,
      tape: 0, tapeValue: null, tapeActive: false, tray: 0, binder: 'none', lightsOut: null, bulbs: [], ladder: false, ring: false,
      homeActive: null, dust: [], envelope: null, pass: 1, search: null,
    };
    for (const r of [ROOM.outside, ROOM.lobby, ROOM.office, ROOM.stairs]) S.inkStart[r] = -10;
    if (!this.timeline) return S;
    for (const e of this.timeline.fx) {
      if (e.t > t) break;
      switch (e.kind) {
        case 'enter': if (S.inkStart[e.room] === Infinity) S.inkStart[e.room] = e.t; break;
        case 'open': if (!S.opened.has(e.doc)) S.opened.set(e.doc, e.t); break;
        case 'active': if (t < e.until) S.active.push(e); break;
        case 'pin': S.pins.push(e); if (e.decoy) S.fool += Math.abs(e.claimed); else S.jar += Math.max(0, e.claimed); break;
        case 'tape': S.tape++; if (e.value != null) S.tapeValue = e.value; S.tapeActive = t < e.until; break;
        case 'tray': S.tray = e.n; break;
        case 'binder': S.binder = e.state; break;
        case 'lightsOut': S.lightsOut = e.t; break;
        case 'bulb': if (t < e.until) S.bulbs.push(e); break;
        case 'ladder': S.ladder = t < e.until; break;
        case 'ring': if (t < e.until) S.ring = true; break;
        case 'homeActive': if (t < e.until) S.homeActive = e.spot; break;
        case 'dust': if (t < e.until) S.dust.push(e); break;
        case 'search': if (t < e.until) S.search = e; break;
        case 'envelope': if (t < e.until) S.envelope = e; break;
        case 'pass2': S.pass = 2; break;
      }
    }
    return S;
  }

  tokensAt(t) {
    const m = this.timeline?.marks;
    if (!m || !m.length) return 0;
    let prev = 0;
    for (const k of m) { if (k.t > t) break; prev = k.cum; }
    return prev;
  }

  budgetFrac(t) {
    if (!this.rollout) return 0.3;
    return this.tokensAt(t) / (this.quota || 1);
  }

  // -------------------------------------------------------------- drawing

  render() {
    const view = this.view;
    if (view !== this.lastView) { this.lastView = view; this.emit('view', view); }
    const post = this.mode === 'postmortem';
    const t = this.mode === 'idle' ? 0 : this.t;
    const S = this.stateAt(post ? Infinity : t);
    let fade = 1;
    if (this.mode === 'replay' && this.timeline) {
      const sh = shotAt(this.timeline.shots, t);
      if (sh !== this.timeline.shots[0]) fade = Math.min(1, (t - sh.t0) / FADE);
    }
    if (view === 'overview') {
      this._renderOverview(S, t, post, fade);
      this.ovCanvas.getContext('2d').putImageData(this.ovFrame.img, 0, 0);
      this.ctx.drawImage(this.ovCanvas, 0, 0, OUT_W, OUT_H);
    } else {
      this._renderRoom(view, S, t, post, fade);
      this.rmCanvas.getContext('2d').putImageData(this.rmFrame.img, 0, 0);
      this.ctx.drawImage(this.rmCanvas, 0, 0, OUT_W, OUT_H);
    }
  }

  _fadeIn(f, k) {
    if (k >= 1) return;
    const page = this.page;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (ditherAt(x, y) > k) f.u32[y * f.w + x] = page;
  }

  _lightsOut(f, S, t, post) {
    if (S.lightsOut == null || post) return;
    const k = Math.min(0.72, (t - S.lightsOut) / 1.6);
    const dark = u32('#2f2a33');
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (ditherAt(x, y) < k) f.u32[y * f.w + x] = dark;
  }

  _blink(seed) { return (this.clock + seed * 1.7) % 4.6 < 0.12; }

  // Actor position for room shots (1-D) or overview shots (paths).
  _actor(segs, t, rest) {
    const s = segs && segAt(segs, t);
    if (!s) return { ...rest, frame: Math.floor(this.clock * 3) };
    if (t <= s.t1) {
      if (s.type === 'walk' && s.pts) {
        const p = posOnPath(s, t);
        return { x: p.x, y: p.y, floor: p.floor, face: p.face, pose: s.carry ? 'carry' : 'walk', frame: Math.floor(p.dist / 5) % 4, stack: s.carry };
      }
      if (s.type === 'walk') {
        const f = Math.max(0, Math.min(1, (t - s.t0) / Math.max(1e-6, s.t1 - s.t0)));
        const x = s.x0 + (s.x1 - s.x0) * f;
        return { x, face: s.x1 > s.x0 ? 1 : -1, pose: s.carry ? 'carry' : 'walk', frame: Math.floor(Math.abs(x - s.x0) / 6) % 4, stack: s.carry, flags: s.flags, climb: s.climb };
      }
      return { x: s.x, floor: s.floor, face: s.face, pose: s.pose, frame: Math.floor((t - s.t0) * 6), lift: s.lift, stack: s.stack, flags: s.flags };
    }
    // After the last segment: hold the end position.
    if (s.type === 'walk' && s.pts) { const p = s.pts[s.pts.length - 1]; return { x: p.x, y: p.y, floor: p.floor, face: 1, pose: 'stand', frame: 0 }; }
    if (s.type === 'walk') return { x: s.x1, face: s.x1 > s.x0 ? 1 : -1, pose: 'stand', frame: 0, gone: s.x1 < -20 || s.x1 > RW + 2 };
    return { x: s.x, floor: s.floor, face: s.face, pose: s.pose === 'slump' ? 'slump' : 'stand', frame: 0 };
  }

  // ===================================================== the room close-up

  _renderRoom(scene, S, t, post, fade) {
    const f = this.rmFrame;
    f.copyFrom(this.scenes[scene]);
    const shot = this.mode === 'replay' && this.timeline ? shotAt(this.timeline.shots, t) : null;
    const inShot = shot && shot.view === scene;
    this._roomObjects(f, scene, S, t, post);

    // People behind the furniture.
    if (scene === 'lobby') drawBig(f, LOOKS.secretary, 80, RFEET - 47, -1, 'type', Math.floor(this.clock * 4), { blink: this._blink(1) });
    if (this.fronts[scene]) { const fr = this.fronts[scene].u32; for (let i = 0; i < fr.length; i++) if (fr[i] >>> 24) f.u32[i] = fr[i]; }
    if (scene === 'lobby') drawBig(f, LOOKS.coworker, 164, RFEET - 40, -1, 'stand', 0, { blink: this._blink(2) });
    if (scene === 'home') {
      const c = inShot ? this._actor(shot.client, t, { x: 22, face: 1, pose: 'sit' }) : { x: 22, face: 1, pose: 'sit', frame: 0 };
      const lift = c.climb ? Math.max(0, Math.round((c.x - 150) * 1.1)) : 0;
      if (!(c.climb && c.x > 186)) drawBig(f, this.clientLook, Math.round(c.x), RFEET - 40 - lift, c.face, c.pose, c.frame, { stack: c.stack, blink: this._blink(3) });
    }
    if (inShot && scene === 'office') {
      const s = this._actor(shot.sec, t, { x: -40, face: 1, pose: 'stand' });
      if (!s.gone && s.x > -30) drawBig(f, LOOKS.secretary, Math.round(s.x), RFEET - 40, s.face, s.pose, s.frame, { stack: s.stack, flags: s.flags, blink: this._blink(1) });
    }
    // Ladder in the law stacks.
    if (scene === 'library') this._ladder(f, S.ladder && inShot);

    // The agent.
    let ag = null;
    if (inShot && shot.agent.length) {
      ag = this._actor(shot.agent, t, { x: 72, face: 1, pose: 'stand' });
      if (ag.x > -30 && ag.x < RW + 6) drawBig(f, LOOKS.agent, Math.round(ag.x), RFEET - 40 - (ag.lift || 0), ag.face, ag.pose, ag.frame, { stack: ag.stack, blink: this._blink(0) });
    } else if (this.mode === 'idle' && scene === 'office') {
      drawBig(f, LOOKS.agent, 72, RFEET - 40, 1, 'read', 0, { blink: this._blink(0) });
    }
    if (post) this._roomCat(f, scene);

    // Over everything: the light bulb, dust, marks.
    if (ag) for (const b of S.bulbs) this._bulb(f, Math.round(ag.x) + 8, RFEET - 52 - (ag.lift || 0));
    for (const d of S.dust) if (d.scene === scene && d.sc?.obj) this._dust(f, d.sc.obj, t - d.t);
    if (post) this._roomMarks(f, scene);
    this._lightsOut(f, S, t, post);
    this._fadeIn(f, fade);
  }

  _roomObjects(f, scene, S, t, post) {
    const active = (kind) => S.active.find((a) => a.sc?.scene === scene && a.sc?.obj?.kind === kind);
    if (scene === 'office') {
      // Clock: the hand is the budget.
      const used = Math.min(1, this.budgetFrac(post ? Infinity : t));
      const a = -Math.PI / 2 + used * Math.PI * 2;
      f.line(104, 18, Math.round(104 + Math.cos(a) * 5), Math.round(18 + Math.sin(a) * 5), C.ink);
      f.line(104, 18, 104, 14, C.mDD);
      f.px(104, 18, C.rose);
      // Tray stack.
      const n = this.mode === 'idle' ? 4 : S.tray;
      for (let k = 0; k < Math.min(n, 9); k++) { f.hl(77, 63 - k, 16, k % 2 ? C.paper2 : C.paper); f.px(92, 63 - k, C.paper4); }
      const tr = active('tray');
      if (tr) { const k = Math.min(8, tr.sc.obj.i || 0); f.r(78, 61 - k - 4, 14, 3, C.paper); f.outline(78, 61 - k - 4, 14, 3, C.blueL); }
      // Binder on the cabinet.
      if (['v1', 'v2', 'flagged'].includes(S.binder)) {
        f.r(150, 28, 12, 10, C.dw); f.hl(150, 28, 12, C.dwL); f.vl(150, 28, 10, C.dwDD); f.r(153, 31, 6, 3, C.paper);
        if (S.binder === 'flagged') { f.r(152, 25, 2, 3, C.rose); f.r(156, 24, 2, 4, C.rose); f.r(159, 26, 2, 2, C.rose); }
        if (S.binder === 'v2') f.r(160, 29, 1, 3, C.blue);
      }
      // Jar: green bills, then fool's gold on top.
      const bks = this.grade?.bks || 1;
      const jh = 16;
      const g = Math.min(jh, Math.round((S.jar / bks) * jh));
      const o = Math.min(jh - g, Math.ceil((S.fool / bks) * jh));
      for (let k = 0; k < g; k++) { const y = 66 - k; f.hl(133, y, 8, k % 3 === 0 ? C.moneyM : C.money); if (k % 2) f.px(134 + (k * 3) % 6, y, C.moneyL); }
      for (let k = 0; k < o; k++) { const y = 66 - g - k; f.hl(133, y, 8, k % 2 ? C.ochreM : C.ochre); f.px(135 + (k * 2) % 4, y, C.glint); }
      f.vl(134, 51, 14, C.glass);
      // Corkboard notes by section.
      const cols = { file: 0, open: 1, missed: 2, next: 3 };
      const used4 = [0, 0, 0, 0];
      for (const p of S.pins) {
        const c = cols[p.section] ?? 0;
        const k = used4[c]++;
        if (k > 3) continue;
        const x = 7 + c * 11 + (k % 2), y = 16 + k * 9;
        f.r(x, y, 9, 7, p.decoy ? C.ochreL : C.paper);
        f.hl(x + 1, y + 3, 7, p.decoy ? C.ochre : C.paper4); f.hl(x + 1, y + 5, 5, p.decoy ? C.ochre : C.paper4);
        f.r(x + 4, y, 2, 2, p.decoy ? C.ochre : p.pass === 2 ? C.rose : C.blue);
      }
      // Monitor.
      const mon = active('monitor') || (S.search?.scene === 'office' && S.search.facility === 'inbox');
      if (mon) { f.r(100, 44, 22, 16, C.scrOn); f.hl(101, 46, 20, C.blue); for (let j = 0; j < 5; j++) f.hl(102, 49 + j * 2, 10 + ((j * 7) % 8), C.blueL); }
      // Cabinet drawer pulled.
      const dr = active('drawer') || (S.search?.facility === 'cabinet' ? { sc: { obj: { y: 61 } } } : null);
      if (dr) { const y = dr.sc.obj.y; f.r(142, y + 1, 6, 17, C.mL); f.hl(142, y + 1, 6, C.paper); f.r(143, y - 2, 4, 3, C.paper); f.vl(142, y + 1, 17, C.mD); }
      // Engine: display shows the latest number; tape spills to the floor.
      if (S.tape) {
        const len = Math.min(40, 6 + S.tape * 5);
        for (let k = 0; k < len; k++) { const y = 59 + k; if (y > 100) break; f.px(188, y, C.paper); f.px(189, y, k % 4 === 0 ? C.paper4 : C.paper3); }
        const v = S.tapeValue != null ? String(Math.round(Math.abs(S.tapeValue))).slice(-4) : '0';
        digits(f, v.padStart(4, ' '), 173, 52, S.tapeActive && Math.floor(this.clock * 8) % 2 ? C.blue : C.ink);
      }
      if (S.ring && Math.floor(this.clock * 10) % 2) { f.px(116, 58, C.ink); f.px(115, 57, C.ink); f.px(133, 58, C.ink); f.px(134, 57, C.ink); }
      if (S.lightsOut == null && !post) f.r(63, 62, 7, 1, C.glint);
    }
    if (scene === 'library') {
      const bk = active('book');
      for (const [doc] of S.opened) {
        const s = this.slots[doc]?.sc;
        if (s?.scene === 'library' && s.obj?.kind === 'book') f.px(s.obj.x + 1, s.obj.y, C.blue);
      }
      if (bk) { const o = bk.sc.obj; f.r(o.x, o.y - 3, o.w, o.h, o.leather ? C.wdDD : C.paper); f.outline(o.x - 1, o.y - 4, o.w + 2, o.h + 2, C.blue); f.hl(o.x, o.y - 1, o.w, C.bzL); }
      const cat = active('catalog');
      const flick = S.search?.scene === 'library' && S.search.facility === 'library';
      const drawers = SCENES.library.ctx.catalog;
      const pull = (x, y) => { f.r(x - 3, y, 6, 6, C.wdL); f.hl(x - 3, y + 5, 6, C.wdD); f.r(x - 2, y - 2, 4, 3, C.paper); f.px(x - 1, y - 2, C.blue); };
      if (cat) pull(cat.sc.obj.x, cat.sc.obj.y);
      else if (flick) { const [x, y] = drawers[Math.floor(this.clock * 6) % drawers.length]; pull(x, y); }
    }
    if (scene === 'portals') {
      const scr = active('screen');
      const kp = S.search?.scene === 'portals';
      if (scr) {
        const o = scr.sc.obj;
        f.r(o.x, o.y, o.w, o.h, C.scrOn); f.hl(o.x + 1, o.y + 2, o.w - 2, C.blue);
        for (let j = 0; j < 6; j++) f.hl(o.x + 2, o.y + 6 + j * 2, 8 + ((j * 5) % 14), j === 2 ? C.blueM : C.blueL);
      }
      if (kp) { const x = 2 + 30; if (Math.floor(this.clock * 8) % 2) f.px(x + 2 + (Math.floor(this.clock * 5) % 3) * 2, 51, C.glint); f.r(10, 24, 28, 21, C.scrOn); f.hl(12, 28, 18, C.blueM); }
      const dr = active('boothDrawer');
      if (dr) { const o = dr.sc.obj; f.r(o.x - 2, o.y + 2, o.w + 4, o.h, C.wdL); f.hl(o.x - 2, o.y + 2, o.w + 4, C.paper); f.r(o.x + 3, o.y - 1, 10, 3, C.paper); }
    }
    if (scene === 'news') {
      // The screen is always on: the year's market, with CPI and the fed rate.
      f.r(12, 10, 76, 46, C.scrOn);
      const v = this.marketX;
      for (let x = 0; x < 72; x++) {
        const y = Math.round(50 - (v[Math.floor((x / 71) * (v.length - 1))] - 80) * 0.95);
        f.px(14 + x, y, C.blue); f.px(14 + x, y + 1, C.blueL);
      }
      const scan = Math.floor((this.clock * 9) % 72);
      f.vl(14 + scan, 20, 34, C.blueLL ?? C.blueL);
      digits(f, `${this.macro.cpi[11].toFixed(1)}%`, 15, 13, C.ink);
      digits(f, `${this.macro.fed[11].toFixed(2)}`, 62, 13, C.rose);
      if (this.grade?.harvestMissed && this.xray && post) {
        const d0 = this.macro.drawdown.peakDay + 20, d1 = this.macro.drawdown.troughDay + 12;
        for (let d = d0; d <= d1; d++) { const x = Math.round(d / 364 * 71); f.vl(14 + x, 48, 6, C.moneyL); f.px(14 + x, 54, C.money); }
      }
      const box = active('box');
      if (box) { f.r(126, 78, 38, 4, BOX_LID); f.hl(126, 78, 38, C.paper); f.r(132, 74, 10, 6, C.paper); }
      if (S.search?.scene === 'news') { f.disc(149, 58, 2, C.glint); f.r(147, 48, 10, 6, C.ochreL); }
    }
    if (scene === 'archive') {
      const box = active('box');
      if (box) { const o = box.sc.obj; f.r(o.x - 1, o.y - 4, o.w + 2, 3, C.paper2); f.hl(o.x - 1, o.y - 4, o.w + 2, C.paper); f.r(o.x + 4, o.y - 7, 8, 4, C.paper); }
      const fo = active('folder');
      if (fo) { const o = fo.sc.obj; f.r(o.x, o.y - 3, o.w, 3, C.paper); f.outline(o.x - 1, o.y - 4, o.w + 2, 5, C.blueL); }
      const safe = S.active.find((a) => a.sc?.obj?.kind === 'safe');
      if (safe) { f.r(126, 62, 6, 37, C.mD); f.r(108, 66, 18, 28, u32('#3a3a40')); f.r(110, 84, 14, 8, C.ochre); f.hl(110, 84, 14, C.ochreL); f.px(114, 86, C.glint); }
      // Bucket on the well: drops below the rim when cranked.
      const well = S.dust.find((d) => d.sc?.obj?.kind === 'well');
      const drop = well ? Math.round(Math.sin(Math.min(1, (t - well.t) / 1.8) * Math.PI) * 26) : 0;
      const by = 52 + drop;
      f.vl(175, 31, by - 31, C.wdDD);
      for (let y = by; y < by + 9; y++) if (y < 72) { f.hl(171, y, 9, y === by ? C.wdL : C.wd); f.px(171, y, C.wdDD); f.px(179, y, C.wdDD); }
      if (S.search?.scene === 'archive' && Math.floor(this.clock * 4) % 2) { f.px(50, 22, C.glint); f.px(140, 22, C.glint); }
    }
    if (scene === 'lobby') {
      if (!post && Math.floor(this.clock * 1.5) % 4 === 0) { f.px(122, 28, C.glint); f.px(121, 27, C.ochreL); f.px(14, 63, C.glint); }
      const fl = S.active.find((a) => a.sc?.obj?.kind === 'flyer');
      if (fl) f.outline(111, 21, 24, 44, C.ochre);
    }
    if (scene === 'home') {
      if (S.ring && Math.floor(this.clock * 10) % 2) { f.px(79, 60, C.ink); f.px(78, 59, C.ink); f.px(96, 60, C.ink); f.px(97, 59, C.ink); }
      if (S.homeActive === 'drawer' || S.homeActive === 'desk') {
        const [x, y] = SCENES.home.ctx.kitchen[S.homeActive === 'drawer' ? 0 : 1];
        f.r(x - 1, y + 2, 26, 9, C.plL); f.outline(x - 1, y + 2, 26, 9, C.blueL); f.r(x + 6, y, 10, 3, C.paper);
      }
    }
  }

  _ladder(f, active) {
    const x0 = active ? 177 : 181;
    for (let y = 8; y < 101; y++) {
      const dx = Math.round((y - 8) * 0.07);
      f.px(x0 - dx, y, C.wdD); f.px(x0 + 7 - dx, y, C.wdD);
      if ((y - 8) % 8 === 6) f.hl(x0 - dx, y, 8, C.wd);
    }
    f.hl(x0 - 1, 7, 10, C.bzD);
  }

  _bulb(f, x, y) {
    f.sprite(['..kkk..', '.kwwwk.', 'kwwwlwk', 'kwwwlwk', '.kwwwk.', '..kmk..', '..mmm..'], x, y, { k: C.ink, w: C.glint, l: C.ochreL, m: C.mD });
  }

  _dust(f, o, dt) {
    for (let k = 0; k < 9; k++) {
      const p = (dt * 0.7 + k * 0.13) % 1;
      const x = Math.round(o.x + (o.w || 10) / 2 + Math.sin(k * 2.1 + dt * 2) * 6 + (k - 4) * 2);
      const y = Math.round(o.y + 2 - p * 16);
      f.px(x, y, k % 2 ? C.plD : C.plM);
    }
  }

  _roomCat(f, scene) {
    const hot = this.timeline?.hot;
    if (!hot || hot.scene !== scene) return;
    const x = Math.max(4, Math.min(RW - 18, hot.x + 6)), y = RFEET;
    f.sprite(['......kk..kk.', '.....kmmkkmmk', '..kkkkmmmmmmk', '.kmmmmmmmlmmk', 'kmmmmmmmmmmk.', 'kmmlmmmmmmk..', '.kkkkkkkkkk..'], x, y - 7, { k: C.catD, m: C.cat, l: C.catL });
    if (Math.floor(this.clock) % 3 === 0) { f.px(x + 12, y - 10, C.plD); f.px(x + 13, y - 12, C.plD); }
  }

  _roomMarks(f, scene) {
    const H = this.household;
    if (!H) return;
    const flag = (x, y, c) => { f.vl(x, y, 9, C.ink); f.r(x + 1, y, 5, 3, c); f.px(x + 1, y + 3, c); };
    const bill = (x, y, ghost) => { f.r(x, y, 9, 5, ghost ? C.moneyL : C.money); f.outline(x, y, 9, 5, ghost ? C.moneyM : u32('#1f4a35')); f.r(x + 3, y + 1, 3, 3, ghost ? C.moneyM : C.moneyL); };
    const dotted = (o) => {
      const { x, y, w, h } = o;
      for (let i = -1; i <= w; i += 2) { f.px(x + i, y - 1, C.mD); f.px(x + i, y + h, C.mD); }
      for (let j = -1; j <= h; j += 2) { f.px(x - 1, y + j, C.mD); f.px(x + w, y + j, C.mD); }
    };
    const seenDocs = new Map();
    for (const doc of H.documents) {
      const s = this.slots[doc.id]?.sc;
      if (!s || s.scene !== scene || !s.obj) continue;
      const key = `${s.obj.kind}:${s.obj.x}:${s.obj.y}`;
      const k = seenDocs.get(key) || 0;
      seenDocs.set(key, k + 1);
      const st = this.status[doc.id] || 'unread';
      const o = s.obj;
      const mx = o.x + k * 7, my = o.y - 10;
      if (st === 'used') flag(mx, my, C.blue);
      else if (st === 'forgot') { flag(mx, my, C.rose); bill(mx + 6, my + 3, false); }
      else if (st === 'never-money') { dotted(o); if (this.xray) bill(o.x + (o.w >> 1) - 4 + k * 10, o.y + (o.h >> 1) - 2, true); }
      else if (st === 'seen') f.r(mx, my + 6, 2, 2, C.mD);
    }
    for (const d of this.grade?.decoys || []) {
      const s = this.slots[`decoy:${d.id}`]?.sc;
      if (!s || s.scene !== scene || !d.fell) continue;
      const { x, y, w, h } = s.obj;
      const cx = x + (w >> 1) - 6, cy = y + (h >> 1) - 5;
      f.r(cx, cy, 12, 10, C.ochre); f.r(cx + 1, cy + 1, 10, 8, C.ochreL); f.r(cx + 4, cy + 3, 4, 4, C.ochre);
    }
    for (const w of this.grade?.wells || []) {
      const s = this.slots[`well:${w.id}`]?.sc;
      if (!s || s.scene !== scene || !w.visited) continue;
      const o = s.obj;
      for (let k = 0; k < 12; k++) f.px(o.x + 2 + ((k * 7) % Math.max(4, o.w - 4)), o.y - 2 - (k % 3), k % 2 ? C.plD : C.plM);
    }
  }

  // ========================================================= the overview

  _renderOverview(S, t, post, fade) {
    const f = this.ovFrame;
    f.copyFrom(this.world.base);
    this._sky(f, t, post);
    this._ovObjects(f, S, t, post);
    const shot = this.mode === 'replay' && this.timeline ? shotAt(this.timeline.shots, t) : null;
    const inShot = shot && shot.view === 'overview';

    const cl = inShot ? this._actor(shot.client, t, { x: CLIENT_SEAT.x, y: HOME_FEET.g, face: 1, pose: 'stand' }) : { x: CLIENT_SEAT.x, y: HOME_FEET.g, face: 1, pose: 'stand', frame: 0 };
    drawPerson(f, this.clientLook, Math.round(cl.x), Math.round(cl.y ?? HOME_FEET.g) - 23, cl.face, cl.pose, cl.frame, { blink: this._blink(3) });

    const ink = new Float32Array(ROOMS_N);
    for (let r = 0; r < ROOMS_N; r++) {
      if (this.mode === 'idle' || post) ink[r] = 1;
      else ink[r] = Math.max(0, Math.min(1, (t - S.inkStart[r]) / 0.35));
    }
    postProcess(f, this.world.rooms, ink, this.dim, this.page);

    drawPerson(f, LOOKS.secretary, SECRETARY_SEAT.x, FEET.g - 23, 1, 'type', Math.floor(this.clock * 4), { blink: this._blink(1) });
    drawPerson(f, LOOKS.coworker, COWORKER_SPOT.x, FEET.g - 23, -1, 'stand', 0, { blink: this._blink(2) });
    if (post && this.timeline) this._route(f);
    let ag;
    if (inShot) ag = this._actor(shot.agent, t, { x: STATION.desk.x, y: FEET.g, face: 1, pose: 'stand' });
    else ag = { x: STATION.desk.x, y: FEET.g, face: 1, pose: post && S.lightsOut != null ? 'slump' : 'read', frame: 0 };
    drawPerson(f, LOOKS.agent, Math.round(ag.x), Math.round(ag.y ?? FEET[ag.floor] ?? FEET.g) - 23, ag.face, ag.pose, ag.frame, { blink: this._blink(0) });
    if (post) this._ovCat(f);
    drawFront(f);
    if (S.envelope) {
      const p = Math.min(1, (t - S.envelope.t) / 1.4);
      const x = Math.round(350 + p * 36), y = Math.round(170 - Math.sin(p * Math.PI) * 18);
      f.r(x, y, 7, 5, C.paper); f.outline(x, y, 7, 5, C.paper4); f.px(x + 3, y + 2, C.paper4);
    }
    if (post) this._ovMarks(f);
    this._lightsOut(f, S, t, post);
    this._fadeIn(f, fade);
  }

  _sky(f, t, post) {
    // Daylight is the budget: the sun crosses as tokens are spent.
    const frac = this.mode === 'idle' || !this.rollout ? 0.32 : this.budgetFrac(post ? Infinity : t);
    const p = Math.min(1, frac);
    const x = Math.round(20 + p * 440), y = Math.round(30 - Math.sin(Math.PI * p) * 22);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const d = dx * dx + dy * dy;
      if (d <= 10 && !(f.get(x + dx, y + dy) >>> 24)) f.px(x + dx, y + dy, d >= 7 ? C.hillLine : C.glint);
    }
    if (frac > 0.82) for (const lx of [4, 372]) { f.r(lx - 2, 153, 5, 2, C.glint); f.px(lx - 4, 152, C.ochreL); f.px(lx + 4, 152, C.ochreL); }
  }

  _ovObjects(f, S, t, post) {
    const used = Math.min(1, this.budgetFrac(post ? Infinity : t));
    const ang = -Math.PI / 2 + used * Math.PI * 2;
    f.line(189, 158, Math.round(189 + Math.cos(ang) * 4), Math.round(158 + Math.sin(ang) * 4), C.ink);
    const n = this.mode === 'idle' ? 4 : S.tray;
    for (let k = 0; k < Math.min(n, 9); k++) { f.hl(TRAY.x, TRAY.y - 2 - k, 13, k % 2 ? C.paper2 : C.paper); f.px(TRAY.x + 12, TRAY.y - 2 - k, C.paper4); }
    const bks = this.grade?.bks || 1;
    const jh = JAR.h - 2;
    const g = Math.min(jh, Math.round((S.jar / bks) * jh));
    const o = Math.min(jh - g, Math.ceil((S.fool / bks) * jh));
    for (let k = 0; k < g; k++) { f.hl(JAR.x + 1, JAR.y + JAR.h - 2 - k, 5, k % 3 === 0 ? C.moneyM : C.money); f.px(JAR.x + 2, JAR.y + JAR.h - 2 - k, C.moneyL); }
    for (let k = 0; k < o; k++) { f.hl(JAR.x + 1, JAR.y + JAR.h - 2 - g - k, 5, k % 2 ? C.ochreM : C.ochre); f.px(JAR.x + 3, JAR.y + JAR.h - 2 - g - k, C.glint); }
    const cols = { file: 0, open: 1, missed: 2, next: 3 };
    const used4 = [0, 0, 0, 0];
    for (const p of S.pins) {
      const c = cols[p.section] ?? 0;
      const k = used4[c]++;
      if (k > 2) continue;
      const [x, y] = [143 + c * 9, 157 + k * 6];
      f.r(x, y, 7, 5, p.decoy ? C.ochreL : C.paper);
      f.hl(x + 1, y + 2, 5, C.paper4);
      f.px(x + 3, y, p.decoy ? C.ochre : p.pass === 2 ? C.rose : C.blue);
    }
    if (S.tape) { f.vl(285, 160, Math.min(17, 4 + S.tape * 3), C.paper); f.vl(286, 160, Math.min(17, 4 + S.tape * 3), C.paper3); }
    // News screen.
    f.r(226, 57, 36, 20, C.scrOn);
    for (let x = 0; x < 34; x++) {
      const v = this.marketX[Math.floor((x / 34) * (this.marketX.length - 1))];
      f.px(227 + x, Math.round(72 - (v - 82) * 0.36), C.blueM);
    }
    // Opened sources keep a blue tick.
    for (const [doc] of S.opened) {
      const s = this.slots[doc];
      if (!s?.obj) continue;
      const { kind, x, y } = s.obj;
      if (kind === 'book') { f.vl(x, y, 8, C.blueM); f.px(x + 1, y, C.blue); }
      else if (kind === 'folder') f.hl(x, y + 1, 10, C.blueL);
      else if (kind === 'box') f.r(x + 3, y + 3, 6, 3, C.blueL);
      else if (kind === 'catalog') f.px(x + 2, y + 2, C.blue);
      else if (kind === 'boothDrawer' || kind === 'screen') f.px(x + 5, y + 2, C.blue);
      else if (kind === 'drawer') f.r(x + 3, y + 3, 5, 2, C.blueL);
    }
    if (!post && Math.floor(this.clock * 2) % 5 === 0) { f.px(46, 183, C.glint); f.px(45, 182, C.ochreL); f.px(105, 161, C.glint); f.px(209, 230, C.glint); }
    if (S.lightsOut == null) f.r(182, 169, 5, 1, C.glint);
  }

  _ovCat(f) {
    const hot = this.timeline?.hot;
    const room = hot ? SCENE_ROOM[hot.scene] : ROOM.office;
    const rect = ROOM_RECTS.find((r) => r.id === room) || ROOM_RECTS[1];
    const x = Math.round(rect.x + (hot ? (hot.x / RW) * (rect.w - 12) : 20));
    const y = rect.y + rect.h - 1;
    f.sprite(['....mm.....', '..mmlmmm.m.', '.mlllmmmmmk', 'kmmmmmmmmk.', '.kkkkkkkk..'], x, y - 4, { k: C.catD, m: C.cat, l: C.catL });
  }

  _route(f) {
    let pass2 = false;
    const p2t = this.timeline.fx.find((e) => e.kind === 'pass2')?.t ?? Infinity;
    for (const sh of this.timeline.shots) {
      if (sh.view !== 'overview') continue;
      for (const s of sh.agent) {
        if (s.type !== 'walk' || !s.pts) continue;
        pass2 = s.t0 >= p2t;
        for (let i = 1; i < s.pts.length; i++) {
          const a = s.pts[i - 1], b = s.pts[i];
          const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
          for (let k = 0; k <= steps; k += 2) {
            const x = Math.round(a.x + 8 + (b.x - a.x) * (k / Math.max(1, steps)));
            const y = Math.round(a.y + 1 + (b.y - a.y) * (k / Math.max(1, steps)));
            f.px(x, y, pass2 ? C.roseM : C.blueM);
          }
        }
      }
    }
  }

  _ovMarks(f) {
    const H = this.household;
    if (!H) return;
    const flag = (x, y, c) => { f.vl(x, y, 6, C.ink); f.r(x + 1, y, 3, 2, c); };
    const bill = (x, y, ghost) => { f.r(x, y, 6, 4, ghost ? C.moneyL : C.money); f.px(x + 2, y + 1, ghost ? C.moneyM : C.moneyL); f.px(x + 3, y + 2, ghost ? C.moneyM : C.moneyL); };
    const dotted = (x, y, w, h) => {
      for (let i = 0; i < w; i += 2) { f.px(x + i, y, C.mD); f.px(x + i, y + h - 1, C.mD); }
      for (let j = 0; j < h; j += 2) { f.px(x, y + j, C.mD); f.px(x + w - 1, y + j, C.mD); }
    };
    for (const doc of H.documents) {
      const s = this.slots[doc.id];
      if (!s?.obj) continue;
      const st = this.status[doc.id] || 'unread';
      const { x, y, kind } = s.obj;
      const mx = x + (kind === 'book' ? 0 : 2), my = y - 4;
      if (st === 'used') flag(mx, my, C.blue);
      else if (st === 'forgot') { flag(mx, my, C.rose); bill(mx + 3, my + 1, false); }
      else if (st === 'never-money') { dotted(mx - 1, my + 3, kind === 'book' ? 5 : 12, kind === 'book' ? 10 : 8); if (this.xray) bill(mx + 1, my - 2, true); }
      else if (st === 'seen') f.px(mx, my + 2, C.mD);
    }
    for (const d of this.grade?.decoys || []) {
      const s = this.slots[`decoy:${d.id}`];
      if (!s || !d.fell) continue;
      const { x, y } = s.obj;
      f.r(x + 2, y - 5, 7, 5, C.ochre); f.r(x + 3, y - 4, 5, 3, C.ochreL); f.px(x + 5, y - 3, C.ochre);
    }
    for (const w of this.grade?.wells || []) {
      const s = this.slots[`well:${w.id}`];
      if (s && w.visited) { const { x, y } = s.obj; for (let k = 0; k < 5; k++) f.px(x + 10 + k * 3, y - 2 - (k % 2), C.plD); }
    }
    if (this.grade?.harvestMissed && this.xray) {
      const d0 = this.macro.drawdown.peakDay + 20, d1 = this.macro.drawdown.troughDay + 12;
      for (let d = d0; d <= d1; d += 2) {
        const x = Math.round((d / 364) * (W - 1));
        const y = hillY(this.marketX, x);
        f.px(x, y + 2, C.money); f.px(x, y + 3, C.moneyL);
      }
    }
  }

  // ---------------------------------------------------------- pointing

  _point(e) {
    const rect = this.canvas.getBoundingClientRect();
    const view = this.view;
    const sw = view === 'overview' ? W : RW, sh = view === 'overview' ? H : RH;
    return { view, x: Math.floor((e.clientX - rect.left) / rect.width * sw), y: Math.floor((e.clientY - rect.top) / rect.height * sh) };
  }

  _hit(p) {
    if (!this.household) return null;
    for (const doc of this.household.documents) {
      const s = this.slots[doc.id];
      if (!s) continue;
      if (p.view === 'overview') {
        if (!s.obj) continue;
        const { x: ox, y: oy, kind } = s.obj;
        const w = kind === 'book' ? 4 : 14, h = kind === 'book' ? 9 : 10;
        if (p.x >= ox - 2 && p.x <= ox + w && p.y >= oy - 5 && p.y <= oy + h) return doc;
      } else if (s.sc?.scene === p.view && s.sc.obj) {
        const o = s.sc.obj;
        if (p.x >= o.x - 3 && p.x <= o.x + o.w + 3 && p.y >= o.y - 11 && p.y <= o.y + o.h + 1) return doc;
      }
    }
    return null;
  }

  _onMove(e) {
    const p = this._point(e);
    const hit = this._hit(p);
    if ((hit?.id) !== (this.hover?.id)) { this.hover = hit; this.emit('hover', hit ? { doc: hit, status: this.status[hit.id] } : null); }
    let pointer = Boolean(hit);
    if (this.mode === 'postmortem' && p.view === 'overview') pointer ||= Boolean(this._roomAt(p));
    this.canvas.style.cursor = pointer ? 'pointer' : 'default';
  }

  _roomAt(p) {
    const r = ROOM_RECTS.find((q) => p.x >= q.x && p.x < q.x + q.w && p.y >= q.y && p.y < q.y + q.h);
    return r ? ROOM_SCENE[r.id] : null;
  }

  _onClick(e) {
    if (this.mode !== 'postmortem') return;
    const p = this._point(e);
    if (p.view === 'overview') { const sc = this._roomAt(p); if (sc) this.openRoom(sc); }
    else this.openRoom('overview');
  }
}

const BOX_LID = u32('#bea073');
