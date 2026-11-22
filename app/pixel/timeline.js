// Turns a rollout trace into shots. A shot is either the overview (the agent
// walking through the building between rooms) or one room's close-up (the
// agent working). Everything downstream, playback, scrubbing, the postmortem,
// is a pure function of time over this structure.
import { FEET, STAIR_NODE, FLOOR_ORDER, ROOM, ROOM_RECTS, STATION, roomOf, HOME_LADDER, HOME_FEET, CLIENT_SEAT, CLIENT_PHONE, HOME_SPOTS, SECRETARY_SEAT } from './layout.js';
import { PLACES, SCENE_ROOM, searchPlace } from './slots.js';

const RSPEED = 58;        // room px per second
const OSPEED = 150;       // overview px per second (travel is brisk)
const STAIR_T = 0.32;     // overview seconds per flight
export const FADE = 0.2;

// ------------------------------------------------------------ overview paths

function officePath(from, to) {
  const pts = [{ floor: from.floor, x: from.x, y: FEET[from.floor] }];
  if (from.floor !== to.floor) {
    const a = FLOOR_ORDER.indexOf(from.floor), b = FLOOR_ORDER.indexOf(to.floor);
    const dir = Math.sign(b - a);
    pts.push({ floor: from.floor, x: STAIR_NODE[from.floor], y: FEET[from.floor] });
    for (let k = a + dir; dir > 0 ? k <= b : k >= b; k += dir) {
      const f = FLOOR_ORDER[k];
      pts.push({ floor: f, x: STAIR_NODE[f], y: FEET[f], stair: true });
    }
  }
  pts.push({ floor: to.floor, x: to.x, y: FEET[to.floor] });
  return pts;
}

function homePath(from, to) {
  const order = ['g', 'f1', 'f2'];
  const pts = [{ floor: from.floor, x: from.x, y: HOME_FEET[from.floor] }];
  let f = from.floor;
  while (f !== to.floor) {
    const up = order.indexOf(to.floor) > order.indexOf(f);
    const nf = order[order.indexOf(f) + (up ? 1 : -1)];
    const lx = (f === 'g' || nf === 'g') ? HOME_LADDER.gToUp - 5 : HOME_LADDER.upToAttic - 5;
    pts.push({ floor: f, x: lx, y: HOME_FEET[f] });
    pts.push({ floor: nf, x: lx, y: HOME_FEET[nf], stair: true });
    f = nf;
  }
  pts.push({ floor: to.floor, x: to.x, y: HOME_FEET[to.floor] });
  return pts;
}

function timing(pts, speed) {
  const t = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    t.push(t[i - 1] + (b.stair ? STAIR_T : Math.abs(b.x - a.x) / speed));
  }
  return t;
}

export function posOnPath(seg, t) {
  const { pts, tt } = seg;
  const local = Math.max(0, Math.min(tt[tt.length - 1], t - seg.t0));
  let i = 1;
  while (i < tt.length - 1 && tt[i] < local) i++;
  const a = pts[i - 1], b = pts[i];
  const span = Math.max(1e-6, tt[i] - tt[i - 1]);
  const f = Math.max(0, Math.min(1, (local - tt[i - 1]) / span));
  return {
    x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f,
    floor: f > 0.5 ? b.floor : a.floor,
    face: b.x > a.x ? 1 : b.x < a.x ? -1 : (seg.face || 1),
    dist: local * (seg.speed || OSPEED),
  };
}

// ------------------------------------------------------------- the builder

const HOME_X = { drawer: 112, desk: 136, attic: 196 };

export function buildTimeline(trace, slots) {
  const shots = [];
  const fx = [];
  const marks = [];
  const visits = new Map();
  let t = 0;
  let shot = null;
  const A = { scene: 'office', x: PLACES.desk.sc.ax, face: 1, ov: { ...PLACES.desk.ov } };
  let secFree = 0;

  const cut = (view) => {
    if (shot) shot.t1 = t;
    shot = { t0: t, t1: t, view, agent: [], sec: [], client: [] };
    shots.push(shot);
  };
  const actA = (pose, dur, extra = {}) => {
    shot.agent.push({ type: 'act', t0: t, t1: t + dur, x: A.x, face: extra.face ?? A.face, pose, ...extra });
    const key = `${A.scene}:${Math.round(A.x / 16)}`;
    visits.set(key, (visits.get(key) || 0) + dur);
    t += dur;
  };
  const walkA = (x1, face) => {
    if (Math.abs(x1 - A.x) < 1) { if (face) A.face = face; return; }
    const dur = Math.abs(x1 - A.x) / RSPEED;
    shot.agent.push({ type: 'walk', t0: t, t1: t + dur, x0: A.x, x1 });
    t += dur;
    const dir = x1 > A.x ? 1 : -1;
    A.x = x1; A.face = face ?? dir;
  };
  const travel = (ov) => {
    cut('overview');
    t += FADE;
    const pts = officePath(A.ov, ov);
    const tt = timing(pts, OSPEED);
    shot.agent.push({ type: 'walk', t0: t, t1: t + tt[tt.length - 1], pts, tt, speed: OSPEED });
    t += tt[tt.length - 1] + 0.1;
  };
  const goTo = (place) => {
    const p = place.sc;
    if (!p) return;
    if (p.scene !== A.scene) {
      const fromX = A.ov.x;
      travel(place.ov);
      fx.push({ t, kind: 'enter', room: SCENE_ROOM[p.scene] });
      cut(p.scene);
      const rect = ROOM_RECTS.find((r) => r.id === SCENE_ROOM[p.scene]);
      A.scene = p.scene;
      A.x = rect && fromX < rect.x ? -26 : 194;
      t += FADE;
    }
    A.ov = { floor: place.ov.floor, x: place.ov.x };
    walkA(p.ax, p.face);
    A.face = p.face;
  };
  const secVisit = (stackIn, flags, onDrop) => {
    // The secretary walks in from the lobby side, hands over, walks out.
    const s0 = Math.max(t, secFree);
    const inT = (50 + 26) / RSPEED;
    shot.sec.push({ type: 'walk', t0: s0, t1: s0 + inT, x0: -26, x1: 50, carry: stackIn, flags });
    shot.sec.push({ type: 'act', t0: s0 + inT, t1: s0 + inT + 0.6, x: 50, face: 1, pose: stackIn ? 'carry' : 'reach', stack: stackIn, flags });
    onDrop(s0 + inT + 0.45);
    const outStack = stackIn ? 0 : 3;
    shot.sec.push({ type: 'walk', t0: s0 + inT + 0.6, t1: s0 + 2 * inT + 0.6, x0: 50, x1: -26, carry: outStack });
    secFree = s0 + 2 * inT + 0.6;
    return s0 + inT + 0.6;
  };

  cut('office');
  const nextPin = (i) => {
    for (let k = i + 1; k < Math.min(trace.length, i + 3); k++) if (trace[k].kind === 'pin') return trace[k].claimed;
    return null;
  };

  trace.forEach((e, i) => {
    const start = t;
    switch (e.kind) {
      case 'deliver': {
        A.face = -1;
        const until = secVisit(Math.max(3, Math.min(8, e.docs?.length || 5)), false, (td) => fx.push({ t: td, kind: 'tray', n: e.docs?.length || 5 }));
        actA('stand', Math.max(0.6, until - t), { face: -1 });
        break;
      }
      case 'read': {
        const s = slots[e.doc];
        if (!s?.sc) { actA('read', 0.8); break; }
        if (s.home) { // a phone document: the call already happened, write it down
          goTo(PLACES.phone);
          fx.push({ t, kind: 'open', doc: e.doc });
          actA('read', 0.9);
          break;
        }
        goTo({ ov: s, sc: s.sc });
        if (s.sc.deep) { fx.push({ t, kind: 'bulb', until: t + 0.6 }); actA('stand', 0.45); }
        const dur = e.again ? 0.9 : 1.6;
        if (s.sc.ladder) fx.push({ t, kind: 'ladder', until: t + dur + 0.2 });
        fx.push({ t, kind: 'active', doc: e.doc, sc: s.sc, until: t + dur });
        actA(s.sc.pose, dur, { lift: s.sc.lift || 0 });
        fx.push({ t, kind: 'open', doc: e.doc });
        break;
      }
      case 'search': {
        const p = searchPlace(e.facility);
        goTo(p);
        fx.push({ t, kind: 'search', facility: e.facility, scene: p.sc.scene, until: t + 1.1 });
        actA(p.sc.pose, 1.1);
        break;
      }
      case 'ask': {
        goTo(PLACES.phone);
        fx.push({ t, kind: 'ring', until: t + 1.4 });
        actA('phone', 0.8);
        // Cut to the client's living room.
        cut('home');
        t += FADE;
        const home = slots[e.docs?.[0]]?.home || 'drawer';
        const C = shot.client;
        let ct = t;
        const cw = (x0, x1, extra = {}) => { const d = Math.abs(x1 - x0) / RSPEED; C.push({ type: 'walk', t0: ct, t1: ct + d, x0, x1, ...extra }); ct += d; };
        C.push({ type: 'act', t0: ct, t1: ct + 0.5, x: 22, face: 1, pose: 'sit' }); ct += 0.5;
        cw(22, 62);
        C.push({ type: 'act', t0: ct, t1: ct + 1.1, x: 62, face: 1, pose: 'phone' }); ct += 1.1;
        if (e.docs?.length) {
          if (home === 'attic') {
            cw(62, 150); cw(150, 200, { climb: true });
            ct += 0.5;
            cw(200, 150, { climb: true, carry: 2 }); cw(150, 62, { carry: 2 });
          } else {
            cw(62, HOME_X[home]);
            C.push({ type: 'act', t0: ct, t1: ct + 0.8, x: HOME_X[home], face: 1, pose: 'reach' });
            fx.push({ t: ct, kind: 'homeActive', spot: home, until: ct + 0.8 });
            ct += 0.8;
            cw(HOME_X[home], 62, { carry: 1 });
          }
          C.push({ type: 'act', t0: ct, t1: ct + 1.0, x: 62, face: 1, pose: 'phone' }); ct += 1.0;
        } else {
          C.push({ type: 'act', t0: ct, t1: ct + 0.9, x: 62, face: 1, pose: 'shrug' }); ct += 0.9;
        }
        t = ct + 0.2;
        fx.push({ t, kind: 'enter', room: ROOM.home });
        cut('office');
        t += FADE;
        actA('phone', 0.6);
        break;
      }
      case 'compute': {
        goTo(PLACES.engine);
        fx.push({ t, kind: 'tape', value: nextPin(i), until: t + 1.5 });
        actA('crank', 1.5);
        break;
      }
      case 'pin': {
        if (A.scene === 'office') {
          goTo(PLACES.cork);
          fx.push({ t: t + 0.35, kind: 'pin', section: e.section, claimed: e.claimed || 0, pass: e.pass || 1, opp: e.opp });
          actA('point', 0.8);
        } else {
          fx.push({ t, kind: 'bulb', until: t + 0.7 });
          fx.push({ t: t + 0.3, kind: 'pin', section: e.section, claimed: e.claimed || 0, pass: e.pass || 1, opp: e.opp });
          actA('stand', 0.7);
        }
        break;
      }
      case 'decoy': {
        const s = slots[`decoy:${e.decoy}`];
        if (s?.sc) goTo({ ov: s, sc: s.sc });
        fx.push({ t, kind: 'active', decoy: e.decoy, sc: s?.sc, until: t + 1.4 });
        actA(s?.sc?.pose || 'stand', 1.0);
        if (e.fell) {
          fx.push({ t, kind: 'pin', section: 'file', claimed: e.claimed || 0, decoy: true, pass: e.pass || 1 });
          fx.push({ t, kind: 'fool', decoy: e.decoy });
          actA('stand', 0.6);
        } else actA('shrug', 0.7);
        break;
      }
      case 'well': {
        const s = slots[`well:${e.well}`];
        if (s?.sc) goTo({ ov: s, sc: s.sc });
        fx.push({ t, kind: 'dust', scene: A.scene, sc: s?.sc, until: t + 1.8 });
        actA(s?.sc?.pose || 'reach', 1.8);
        actA('shrug', 0.5);
        break;
      }
      case 'submit': {
        goTo(PLACES.desk);
        actA('read', 0.9);
        fx.push({ t, kind: 'binder', state: e.pass === 2 ? 'v2' : 'v1' });
        const until = secVisit(0, false, (td) => fx.push({ t: td, kind: 'binder', state: 'taken' }));
        actA('stand', Math.max(0.3, until - t), { face: -1 });
        break;
      }
      case 'grill': {
        goTo(PLACES.desk);
        const until = secVisit(3, true, (td) => fx.push({ t: td, kind: 'binder', state: 'flagged' }));
        actA('stand', Math.max(0.3, until - t), { face: -1 });
        fx.push({ t, kind: 'pass2' });
        actA('read', 1.3);
        break;
      }
      case 'quota': {
        fx.push({ t, kind: 'lightsOut' });
        actA('slump', 2.4);
        break;
      }
      case 'mail': {
        travel(PLACES.mailbox.ov);
        A.ov = { ...PLACES.mailbox.ov };
        shot.agent.push({ type: 'act', t0: t, t1: t + 0.6, x: A.ov.x, floor: 'g', face: 1, pose: 'reach' });
        t += 0.6;
        fx.push({ t, kind: 'envelope', until: t + 1.4 });
        shot.client.push({ type: 'walk', t0: t, t1: t + 1.2, pts: homePath({ floor: 'g', x: CLIENT_SEAT.x }, { floor: 'g', x: 386 }), tt: timing(homePath({ floor: 'g', x: CLIENT_SEAT.x }, { floor: 'g', x: 386 }), 20), speed: 20 });
        shot.client.push({ type: 'act', t0: t + 1.4, t1: t + 3.2, x: 386, floor: 'g', face: 1, pose: 'read' });
        t += 3.2;
        break;
      }
      default:
        actA('stand', 0.4);
    }
    marks.push({ i, t: start, end: t, kind: e.kind, pass: e.pass || 1, cum: e.cum || 0, scene: A.scene });
  });
  shot.t1 = t + 0.5;

  let best = null;
  for (const [k, v] of visits) if (!best || v > best[1]) best = [k, v];
  const [hs, hx] = best ? best[0].split(':') : ['office', 4];
  return { shots, fx: fx.sort((a, b) => a.t - b.t), marks, duration: t + 0.5, hot: { scene: hs, x: +hx * 16 } };
}

export function shotAt(shots, t) {
  let lo = 0, hi = shots.length - 1, found = shots[0];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (shots[mid].t0 <= t) { found = shots[mid]; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

export function segAt(segs, t) {
  let found = null;
  for (const s of segs) { if (s.t0 <= t) found = s; else break; }
  return found;
}

export { officePath, homePath, timing, RSPEED, OSPEED };
