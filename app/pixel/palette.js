// Muted, warm palette with a shading ramp per material. The world is drawn in
// these colours. Four semantic hues are reserved for state and only appear
// when the thing they mean happens:
//   blue   used, and "this agent"
//   rose   opened, then forgotten
//   ochre  decoy, folk wisdom, fool's gold
//   green  money

export const HEX = {
  ink: '#2b2521',
  // Walls
  plL: '#f6f0e6', pl: '#ece3d3', plD: '#dacdb7', plM: '#e4d8c3',
  // Woods
  wdL: '#d9b78d', wd: '#bb9165', wdD: '#946a40', wdDD: '#6b4b2d',
  dwL: '#9a6a4b', dw: '#7d5138', dwD: '#5c3825', dwDD: '#3e2418',
  // Brick and slab
  brL: '#a7806a', br: '#8c6651', brD: '#6d4c3b', mortar: '#b9a091',
  slab: '#a59b90', slabD: '#857a6f',
  // Floors
  tileL: '#ece7dd', tileD: '#d3cbbd',
  carpet: '#8c9c90', carpetD: '#77877b', carpetL: '#a1b0a4',
  lino: '#d8d3c9', linoD: '#c4beb2',
  conc: '#ccc6bb', concD: '#b3ab9e', concL: '#dcd7ce',
  // Metal and brass
  mL: '#eef0ef', m: '#c6c9c7', mD: '#909593', mDD: '#5e6361',
  bzL: '#eed392', bz: '#d0a659', bzD: '#9c7231', bzDD: '#6e4f22',
  // Paper
  paper: '#ffffff', paper2: '#f4f0e7', paper3: '#ddd5c6', paper4: '#c4baa8',
  // Cork
  corkL: '#d3ad7d', cork: '#bf9666', corkD: '#9d7449',
  // Glass
  glass: '#fbfdfd', glassT: '#e4eef0', glassD: '#c9dade',
  // Screens
  scrOff: '#40474b', scrOffD: '#2c3236', scrOn: '#eaf0f8', scrOnD: '#c9d6ea',
  // Plants
  lfL: '#b2c393', lf: '#8aa06f', lfD: '#647a50', lfDD: '#4a5b3b',
  // Fabrics
  sageL: '#b3bea5', sage: '#96a28a', sageD: '#78846e',
  lavL: '#cbc1db', lav: '#aea3c2', lavD: '#8f84a5',
  // Water
  water: '#dde9ee', waterD: '#bdd3da',
  // Truck
  trkL: '#9fbfc4', trk: '#7c9fa6', trkD: '#5c7e85', trkDD: '#41595e', chrome: '#eef3f4',
  // Hills (the market path)
  hill: '#f8f4ee', hillLine: '#cfc3b0', hillD: '#f1ebe2',
  // Cat
  catL: '#d3ad86', cat: '#ad8560', catD: '#7f5f43',
  // Semantic
  blue: '#0F4D92', blueM: '#3775BA', blueL: '#B4C0E4', blueLL: '#e3e8f5',
  rose: '#B64342', roseM: '#d27a78', roseL: '#F0C0CC',
  ochre: '#A87A22', ochreM: '#cfa548', ochreL: '#EAD9A8', glint: '#fff3cf',
  money: '#2E6E4E', moneyM: '#5f9b78', moneyL: '#C2D9C8',
};

// Character ramps: [light, mid, shadow]
export const SKIN = {
  light: ['#f6d5b8', '#e6b48e', '#c08b67'],
  medium: ['#dba277', '#bb8157', '#8f5c3c'],
  deep: ['#a06a47', '#7f4f33', '#5b3623'],
};
export const HAIR = {
  black: ['#4a3f39', '#2e2622', '#1c1714'],
  brown: ['#8d5e3e', '#6e4730', '#4f3221'],
  grey: ['#e0dbd3', '#bdb6ac', '#958e84'],
  auburn: ['#ad653f', '#874a2e', '#643420'],
  blonde: ['#e7cc93', '#c9a768', '#a3834a'],
};
export const CLOTH = {
  charcoal: ['#62666f', '#4a4e56', '#34373d'],
  shirt: ['#fbfbf8', '#e2e3e6', '#c5c7cc'],
  teal: ['#94b4b0', '#759894', '#587672'],
  greyskirt: ['#a39e97', '#86817a', '#67635d'],
  navy: ['#5a6884', '#45516a', '#323b4f'],
  olive: ['#a3aa83', '#858c66', '#666c4d'],
  plum: ['#957390', '#785b73', '#5b4457'],
  denim: ['#8399b2', '#687f98', '#50637a'],
  khaki: ['#d2bf97', '#b4a07a', '#927f5c'],
  scrubs: ['#a3cbc6', '#84ada8', '#678f8e'],
  cream: ['#f1e9d8', '#d9cdb6', '#b9ab92'],
  rust: ['#c08a6a', '#9f6c4f', '#7a5039'],
};
export const SHOES = {
  brown: ['#7a5238', '#553926'],
  black: ['#45403c', '#262220'],
  white: ['#f2f1ec', '#c9c6be'],
};

export function u32(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

// Pre-converted palette for the rasterizer.
export const C = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, u32(v)]));
export const ramp = arr => arr.map(u32);

export function rgbOf(c) {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255];
}

// 4x4 Bayer matrix, used for every fade in the world.
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
