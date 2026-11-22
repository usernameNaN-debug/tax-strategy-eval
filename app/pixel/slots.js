// Assigns every resource in a household's world to a place in the building.
// Rooms encode the kind of source; depth inside a room encodes distance.
//
// Each slot has two addresses: where it is in the cross-section overview
// (floor, x, obj) and where it is in the room's own close-up (sc: scene,
// agent x, pose, object rect). The overview is for travel and the postmortem
// map; the close-up is where the work happens.
import {
  STATION, IRS_BOOKS, LAW_LOW, LAW_HIGH, CATALOG, BOOTHS, CAB_DRAWERS, VAULT_BOXES, VAULT_LOOSE,
  HOME_SPOTS, TRAY, ROOM,
} from './layout.js';
import { SCENES } from './rooms.js';

const at = (floor, x, face, extra = {}) => ({ floor, x, face, ...extra });
const sc = (scene, ax, face, pose, obj, extra = {}) => ({ scene, ax, face, pose, obj, ...extra });

// Room-local anchors. Agent x is the left edge of a 24px sprite.
const LIB_BOOKS = [[12, 70], [26, 70], [40, 70], [54, 70], [8, 54], [22, 54], [36, 54], [50, 54], [64, 70], [62, 54], [18, 86], [44, 86]];
const LIB_LAW = [[176, 70], [182, 54], [186, 70], [178, 86], [184, 86]];
const LIB_LAW_HI = [[176, 22], [182, 38], [186, 22], [178, 38]];
const ARCH_BOXES = SCENES.archive.ctx.boxes;
const ARCH_LOOSE = SCENES.archive.ctx.loose;
const BOOTH_X = { benefits: 2, brokerage: 50, bank: 98, hsa: 146 };
const OFFICE_DRAWERS = [41, 61, 81];

export const SCENE_ROOM = {
  office: ROOM.office, library: ROOM.library, portals: ROOM.portals, news: ROOM.news,
  archive: ROOM.archive, lobby: ROOM.lobby, home: ROOM.home,
};
export const ROOM_SCENE = Object.fromEntries(Object.entries(SCENE_ROOM).map(([k, v]) => [v, k]));

// Fixed places the agent goes for non-document work.
export const PLACES = {
  desk: { ov: at('g', STATION.desk.x, 1), sc: sc('office', 72, 1, 'read', null) },
  monitor: { ov: at('g', STATION.monitor.x, 1), sc: sc('office', 92, 1, 'type', { kind: 'monitor', x: 100, y: 44, w: 22, h: 16 }) },
  phone: { ov: at('g', STATION.phone.x, 1), sc: sc('office', 104, 1, 'phone', { kind: 'phone', x: 118, y: 60, w: 14, h: 8 }) },
  engine: { ov: at('g', STATION.engine.x, 1), sc: sc('office', 148, 1, 'crank', { kind: 'engine', x: 169, y: 46, w: 22, h: 28 }) },
  cork: { ov: at('g', STATION.cork.x, -1), sc: sc('office', 44, -1, 'point', { kind: 'cork', x: 6, y: 14, w: 46, h: 38 }) },
  catalog: { ov: at('f1', STATION.catalog.x, 1), sc: sc('library', 132, 1, 'reach', null) },
  lawdesk: { ov: at('f1', 250, 1), sc: sc('library', 152, 1, 'reach', null) },
  radio: { ov: at('f2', STATION.radio.x, 1), sc: sc('news', 106, 1, 'type', { kind: 'radio', x: 120, y: 44, w: 40, h: 22 }) },
  tv: { ov: at('f2', STATION.tv.x, -1), sc: sc('news', 62, -1, 'point', { kind: 'tv', x: 12, y: 10, w: 76, h: 46 }) },
  shelves: { ov: at('b', 120, 1), sc: sc('archive', 40, 1, 'reach', null) },
  mailbox: { ov: at('g', STATION.mailbox.x, 1), sc: null },
};

function boothFor(doc, i) {
  const t = `${doc.title} ${doc.text || ''}`.toLowerCase();
  if (/hsa|health savings/.test(t)) return BOOTHS[3];
  if (/bank|checking|savings account|interest/.test(t)) return BOOTHS[2];
  if (/brokerage|1099-b|espp|rsu|stock|fund|lot|supplemental|ira/.test(t)) return BOOTHS[1];
  if (/benefit|enrollment|fsa|401|payroll|hr|plan|paystub|earnings/.test(t)) return BOOTHS[0];
  return BOOTHS[i % 4];
}

function decoyStation(lure) {
  const t = (lure || '').toLowerCase();
  if (/truck|vehicle|179|car|suv/.test(t)) return 'truck';
  if (/cash|safe|savings|cd |deed|house|gift/.test(t)) return 'safe';
  if (/mortgage|coworker|everyone|refinanc|itemiz/.test(t)) return 'cooler';
  return 'flyers';
}

const DECOY_PLACE = {
  truck: { ov: at('g', STATION.truck.x, -1, { room: ROOM.outside }), obj: { kind: 'truck', x: 9, y: 171 }, sc: sc('lobby', 34, -1, 'point', { kind: 'truck', x: 5, y: 60, w: 26, h: 20 }) },
  safe: { ov: at('b', STATION.safe.x, 1, { room: ROOM.archive }), obj: { kind: 'safe', x: 200, y: 222 }, sc: sc('archive', 82, 1, 'reach', { kind: 'safe', x: 104, y: 60, w: 26, h: 41 }) },
  cooler: { ov: at('g', STATION.cooler.x, 1, { room: ROOM.lobby }), obj: { kind: 'cooler', x: 108, y: 158 }, sc: sc('lobby', 118, 1, 'stand', { kind: 'cooler', x: 141, y: 22, w: 20, h: 79 }) },
  flyers: { ov: at('g', STATION.flyers.x, 1, { room: ROOM.lobby }), obj: { kind: 'flyer', x: 99, y: 160 }, sc: sc('lobby', 94, 1, 'read', { kind: 'flyer', x: 112, y: 22, w: 22, h: 42 }) },
};

export function assignSlots(world) {
  const slots = {};
  const counters = {};
  const take = (k) => (counters[k] = (counters[k] ?? -1) + 1);
  const homeKeys = ['drawer', 'desk', 'attic'];

  for (const doc of world.documents) {
    const layer = doc.layer ?? 1;
    let s;
    switch (doc.facility) {
      case 'folder': {
        const i = take('folder');
        s = at('g', STATION.desk.x, 1, { room: ROOM.office, obj: { kind: 'tray', x: TRAY.x, y: TRAY.y, i } });
        s.sc = sc('office', 72, 1, 'read', { kind: 'tray', x: 76, y: 58 - Math.min(5, i), w: 18, h: 3, i });
        break;
      }
      case 'inbox':
        s = at('g', STATION.monitor.x, 1, { room: ROOM.office, obj: { kind: 'monitor', x: 211, y: 159 } });
        s.sc = { ...PLACES.monitor.sc };
        break;
      case 'cabinet': {
        const i = layer >= 2 ? 2 : Math.min(1, take('cab'));
        const [x, y] = CAB_DRAWERS[i];
        s = at('g', STATION.cabinet.x, 1, { room: ROOM.office, obj: { kind: 'drawer', x, y }, deep: layer >= 2 });
        s.sc = sc('office', 124, 1, i === 2 ? 'read' : 'reach', { kind: 'drawer', x: 148, y: OFFICE_DRAWERS[i], w: 16, h: 19 }, { deep: layer >= 2 });
        break;
      }
      case 'library': {
        if (layer >= 2) {
          const k = take('catalog');
          const [x, y] = CATALOG[k % CATALOG.length];
          s = at('f1', STATION.catalog.x, 1, { room: ROOM.library, obj: { kind: 'catalog', x, y }, deep: true });
          const [cx, cy] = SCENES.library.ctx.catalog[(k * 4 + 2) % SCENES.library.ctx.catalog.length];
          s.sc = sc('library', 132, 1, 'reach', { kind: 'catalog', x: cx, y: cy, w: 6, h: 6 }, { deep: true });
        } else {
          const k = take('irs');
          const [x, b] = IRS_BOOKS[k % IRS_BOOKS.length];
          s = at('f1', x - 13, 1, { room: ROOM.library, obj: { kind: 'book', x, y: b - 8 } });
          const [bx, by] = LIB_BOOKS[k % LIB_BOOKS.length];
          s.sc = sc('library', Math.max(-4, bx - 16), 1, 'reach', { kind: 'book', x: bx, y: by - 11, w: 4, h: 11 });
        }
        break;
      }
      case 'law': {
        if (layer >= 2) {
          const k = take('lawhi');
          const [x, b] = LAW_HIGH[k % LAW_HIGH.length];
          s = at('f1', x - 13, 1, { room: ROOM.library, obj: { kind: 'book', x, y: b - 8, leather: true }, deep: true, ladder: true });
          const [bx, by] = LIB_LAW_HI[k % LIB_LAW_HI.length];
          s.sc = sc('library', 156, 1, 'reach', { kind: 'book', x: bx, y: by - 11, w: 4, h: 11, leather: true }, { deep: true, ladder: true, lift: 30 });
        } else {
          const k = take('lawlo');
          const [x, b] = LAW_LOW[k % LAW_LOW.length];
          s = at('f1', x - 13, 1, { room: ROOM.library, obj: { kind: 'book', x, y: b - 8, leather: true } });
          const [bx, by] = LIB_LAW[k % LIB_LAW.length];
          s.sc = sc('library', 156, 1, 'reach', { kind: 'book', x: bx, y: by - 11, w: 4, h: 11, leather: true });
        }
        break;
      }
      case 'portal': {
        const b = boothFor(doc, take('portal'));
        const bx = BOOTH_X[b.kind];
        s = at('f2', b.x + 11, 1, {
          room: ROOM.portals, booth: b.kind,
          obj: layer >= 2 ? { kind: 'boothDrawer', x: b.x + 13, y: 85 } : { kind: 'screen', x: b.x + 10, y: 60 },
          deep: layer >= 2,
        });
        s.sc = layer >= 2
          ? sc('portals', bx + 6, 1, 'reach', { kind: 'boothDrawer', x: bx + 12, y: 80, w: 20, h: 10 }, { deep: true, booth: b.kind })
          : sc('portals', bx + 8, 1, 'type', { kind: 'screen', x: bx + 8, y: 24, w: 28, h: 21 }, { booth: b.kind });
        break;
      }
      case 'screen':
        s = layer >= 2
          ? at('f2', STATION.radio.x, 1, { room: ROOM.news, obj: { kind: 'box', x: 270, y: 85 }, deep: true })
          : at('f2', STATION.tv.x, -1, { room: ROOM.news, obj: { kind: 'tv', x: 226, y: 56 } });
        s.sc = layer >= 2
          ? sc('news', 116, 1, 'reach', { kind: 'box', x: 126, y: 82, w: 38, h: 16 }, { deep: true })
          : { ...PLACES.tv.sc };
        break;
      case 'vault': {
        if (layer >= 2) {
          const k = take('box');
          const [x, b] = VAULT_BOXES[k % VAULT_BOXES.length];
          s = at('b', x - 13, 1, { room: ROOM.archive, obj: { kind: 'box', x, y: b - 9 }, deep: true });
          const [ax, ab] = ARCH_BOXES[k % ARCH_BOXES.length];
          s.sc = sc('archive', Math.max(-4, ax - 14), 1, 'reach', { kind: 'box', x: ax, y: ab - 14, w: 18, h: 14 }, { deep: true });
        } else {
          const k = take('loose');
          const [x, b] = VAULT_LOOSE[k % VAULT_LOOSE.length];
          s = at('b', x - 13, 1, { room: ROOM.archive, obj: { kind: 'folder', x, y: b - 4 } });
          const [lx, lb] = ARCH_LOOSE[k % ARCH_LOOSE.length];
          s.sc = sc('archive', Math.max(-4, lx - 12), 1, 'reach', { kind: 'folder', x: lx, y: lb - 5, w: 16, h: 5 });
        }
        break;
      }
      case 'phone': {
        const t = `${doc.title} ${doc.text || ''}`.toLowerCase();
        const key = /attic|shoebox|old|box/.test(t) ? 'attic' : /desk|notebook|log/.test(t) ? 'desk' : homeKeys[take('home') % 3];
        const spot = HOME_SPOTS[key];
        s = at('g', STATION.phone.x, 1, { room: ROOM.home, obj: { kind: 'home', x: spot.objX, y: spot.objY }, home: key });
        s.sc = { ...PLACES.phone.sc, home: key };
        break;
      }
      case 'flyers':
      default: {
        const k = decoyStation(`${doc.title} ${doc.text || ''}`);
        const st = STATION[k] || STATION.flyers;
        s = at(st.floor, st.x, st.face, { room: st.floor === 'b' ? ROOM.archive : st.x < 50 ? ROOM.outside : ROOM.lobby, obj: { kind: 'flyer', x: 99, y: 160 } });
        s.sc = { ...DECOY_PLACE.flyers.sc };
      }
    }
    slots[doc.id] = s;
  }

  // Decoys stand where their lure lives.
  for (const d of world.decoys || []) {
    const P = DECOY_PLACE[decoyStation(`${d.lure} ${d.id}`)];
    slots[`decoy:${d.id}`] = { ...P.ov, obj: P.obj, decoy: true, sc: { ...P.sc } };
  }
  // Dry wells sit in the room of their facility. The archive's literal well
  // takes the ones with nowhere better to be.
  const wellPlace = {
    cabinet: () => ({ ov: at('g', STATION.cabinet.x, 1, { room: ROOM.office, obj: { kind: 'drawer', x: CAB_DRAWERS[2][0], y: CAB_DRAWERS[2][1] } }), sc: sc('office', 124, 1, 'read', { kind: 'drawer', x: 148, y: 81, w: 16, h: 19 }) }),
    portal: () => ({ ov: at('f2', BOOTHS[3].x + 11, 1, { room: ROOM.portals, obj: { kind: 'boothDrawer', x: BOOTHS[3].x + 13, y: 85 } }), sc: sc('portals', 152, 1, 'reach', { kind: 'boothDrawer', x: 158, y: 66, w: 20, h: 10 }) }),
    screen: () => ({ ov: at('f2', STATION.tv.x, -1, { room: ROOM.news, obj: { kind: 'tv', x: 226, y: 56 } }), sc: { ...PLACES.tv.sc } }),
    vault: () => ({ ov: at('b', STATION.chest.x, 1, { room: ROOM.archive, obj: { kind: 'chest', x: 220, y: 220 } }), sc: sc('archive', 112, 1, 'reach', { kind: 'chest', x: 134, y: 64, w: 20, h: 37 }) }),
    well: () => ({ ov: at('b', STATION.well.x, 1, { room: ROOM.archive, obj: { kind: 'well', x: 250, y: 206 } }), sc: sc('archive', 136, 1, 'crank', { kind: 'well', x: 156, y: 24, w: 36, h: 77 }) }),
  };
  (world.dry_wells || []).forEach((w) => {
    const P = (wellPlace[w.facility] || wellPlace.well)();
    slots[`well:${w.id}`] = { ...P.ov, dry: true, sc: P.sc };
  });
  return slots;
}

// Where a search happens, per facility.
export function searchPlace(facility) {
  return {
    library: PLACES.catalog, law: PLACES.lawdesk, portal: { ov: at('f2', BOOTHS[0].x + 11, 1), sc: sc('portals', 10, 1, 'type', { kind: 'keypad', x: 32, y: 50, w: 9, h: 4 }) },
    vault: PLACES.shelves, screen: PLACES.radio, cabinet: { ov: at('g', STATION.cabinet.x, 1), sc: sc('office', 124, 1, 'reach', null) },
    inbox: PLACES.monitor,
  }[facility] || PLACES.desk;
}
