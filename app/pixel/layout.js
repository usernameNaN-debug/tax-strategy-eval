// Geometry of the world in base pixels (480 x 270, shown at 2x).
// The office is a cross-section: basement archive, ground floor (lobby and the
// agent's office), the library, and the portal floor with a news nook. The
// client's house stands across the alley. The skyline behind both is the
// market path for the year under review.

export const W = 480;
export const H = 270;

export const FEET = { f2: 93, f1: 143, g: 193, b: 243 };
export const FLOOR_ORDER = ['b', 'g', 'f1', 'f2'];
export const STAIR_NODE = { b: 309, g: 339, f1: 309, f2: 339 };

export const ROOM = {
  outside: 0, lobby: 1, office: 2, library: 3, portals: 4, news: 5, archive: 6, stairs: 7, home: 8,
};
export const ROOM_NAMES = ['outside', 'lobby', 'office', 'library', 'portals', 'news', 'archive', 'stairs', 'home'];

export const ROOM_RECTS = [
  { id: ROOM.lobby, x: 52, y: 148, w: 80, h: 46 },
  { id: ROOM.office, x: 136, y: 148, w: 164, h: 46 },
  { id: ROOM.library, x: 52, y: 98, w: 248, h: 46 },
  { id: ROOM.portals, x: 52, y: 48, w: 162, h: 46 },
  { id: ROOM.news, x: 218, y: 48, w: 82, h: 46 },
  { id: ROOM.archive, x: 52, y: 198, w: 248, h: 46 },
  { id: ROOM.stairs, x: 304, y: 48, w: 40, h: 196 },
  { id: ROOM.home, x: 380, y: 148, w: 92, h: 46 },
  { id: ROOM.home, x: 380, y: 98, w: 92, h: 46 },
  { id: ROOM.home, x: 390, y: 62, w: 72, h: 32 },
];

export function roomOf(floor, x) {
  if (floor === 'g') {
    if (x < 50 || (x > 345 && x < 378)) return ROOM.outside;
    if (x < 134) return ROOM.lobby;
    if (x < 302) return ROOM.office;
    if (x < 346) return ROOM.stairs;
    return ROOM.home;
  }
  if (x >= 302) return ROOM.stairs;
  if (floor === 'f1') return ROOM.library;
  if (floor === 'f2') return x < 216 ? ROOM.portals : ROOM.news;
  if (floor === 'b') return ROOM.archive;
  return ROOM.outside;
}

// Where the agent stands for each station (sprite left x; feet on the floor).
export const STATION = {
  desk: { floor: 'g', x: 189, face: 1 },
  monitor: { floor: 'g', x: 196, face: 1 },
  phone: { floor: 'g', x: 208, face: 1 },
  cork: { floor: 'g', x: 150, face: -1 },
  cabinet: { floor: 'g', x: 237, face: 1 },
  engine: { floor: 'g', x: 256, face: 1 },
  cooler: { floor: 'g', x: 96, face: 1 },
  flyers: { floor: 'g', x: 86, face: 1 },
  truck: { floor: 'g', x: 30, face: -1 },
  catalog: { floor: 'f1', x: 200, face: 1 },
  tv: { floor: 'f2', x: 236, face: -1 },
  radio: { floor: 'f2', x: 258, face: 1 },
  well: { floor: 'b', x: 238, face: 1 },
  safe: { floor: 'b', x: 186, face: 1 },
  chest: { floor: 'b', x: 210, face: 1 },
  mailbox: { floor: 'g', x: 342, face: 1 },
};

export const SECRETARY_SEAT = { floor: 'g', x: 70 };
export const COWORKER_SPOT = { floor: 'g', x: 116 };

// Slots. Distance lives in depth: an open shelf is one query away, a closed
// drawer or box needs a hunch, the client's house only the client can open.
export const IRS_BOOKS = [
  [60, 110], [78, 110], [98, 110], [122, 110],
  [66, 120], [88, 120], [110, 120], [132, 120],
  [58, 130], [82, 130], [104, 130], [126, 130],
];
export const LAW_LOW = [[240, 130], [256, 130], [272, 130], [288, 130], [246, 140], [264, 140], [282, 140]];
export const LAW_HIGH = [[242, 110], [258, 110], [276, 110], [292, 110], [248, 120], [268, 120], [286, 120]];
export const CATALOG = [
  [216, 117], [222, 117], [228, 117],
  [216, 123], [222, 123], [228, 123],
  [216, 129], [222, 129], [228, 129],
  [216, 135], [222, 135], [228, 135],
];
export const BOOTHS = [
  { kind: 'benefits', x: 54 },
  { kind: 'brokerage', x: 94 },
  { kind: 'bank', x: 134 },
  { kind: 'hsa', x: 174 },
];
export const CAB_DRAWERS = [[254, 154], [254, 167], [254, 180]];
export const VAULT_BOXES = [[58, 214], [72, 214], [104, 214], [118, 214], [144, 214], [174, 214], [62, 228], [92, 228], [150, 228], [180, 228]];
export const VAULT_LOOSE = [[86, 214], [158, 214], [76, 228], [106, 228], [164, 228]];
export const HOME_SPOTS = {
  drawer: { floor: 'g', x: 440, objX: 446, objY: 175 },
  desk: { floor: 'f1', x: 424, objX: 428, objY: 130 },
  attic: { floor: 'f2', x: 410, objX: 420, objY: 86 },
};
export const CORK_SLOTS = (() => {
  const out = [];
  for (let col = 0; col < 4; col++) for (let row = 0; row < 3; row++) out.push([143 + col * 9, 157 + row * 6]);
  return out;
})();

export const DESK = { x: 178, w: 63, top: 176 };
export const JAR = { x: 235, y: 161, w: 7, h: 15 };
export const TAPE = { x: 285, y: 178 };
export const TRAY = { x: 193, y: 175 };

export const HOME_LADDER = { gToUp: 383, upToAttic: 457 };
export const HOME_FEET = { g: 193, f1: 143, f2: 93 };
export const CLIENT_SEAT = { floor: 'g', x: 404 };
export const CLIENT_PHONE = { floor: 'g', x: 424 };
