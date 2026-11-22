// 24x40 characters for room scenes (shown at 5x). Faces are hand-pixeled per
// hairstyle; bodies are assembled from parts so every pose shares one look.
// Light from the top left. Facing right; mirrored for left.
import { C } from './palette.js';

const HEADS = {
  glasses: [
    '....KKKKKK....',
    '..KKhHHHHhKK..',
    '.KhHHHHHHHHhK.',
    'KhHHhhhhhHHHhK',
    'KjhhhhhhhhhhjK',
    'KjjhhSSSSSShjK',
    'KjjSSSSSSSSSSK',
    'KjjSbbbSSbbbSK',
    'KjsGGGGGGGGGGK',
    'KjsGWeGSGWeGSK',
    'KjsSGGSSSGGSnK',
    '.KjSSSSSSSSzK.',
    '..KzSSSmmSzK..',
    '...KKzzzzKK...',
  ],
  bun: [
    'KKKK..........',
    'KhHhKKKKKK....',
    'KjhHKhHHHhKK..',
    '.KKhHHHHHHHhK.',
    '.KhHHhhhhhHHhK',
    'KjhhhhSSSSShjK',
    'KjjhSSSSSSSSSK',
    'KjjSSbbSSSbbSK',
    'KjsSSSSSSSSSSK',
    'KjsSWeSSSWeSSK',
    'KjsSSSSSSSSnSK',
    '.KjSSSzSSSSzK.',
    '..KzSSSmmSzK..',
    '...KKzzzzKK...',
  ],
  curly: [
    '..KKKKKKKKK...',
    '.KhHhHHhHHhK..',
    'KhHHhHHhHHHhK.',
    'KHhHHhHHhHHHhK',
    'KjhHhhhhhhHhjK',
    'KjjhhSSSSSShjK',
    'KjjSSSSSSSSSSK',
    'KjjSbbSSSbbSSK',
    'KjsSSSSSSSSSSK',
    'KjsSWeSSSWeSSK',
    'KjsSSSSSSSSnSK',
    '.KjSSSSSSSSzK.',
    '..KzSSSmmSzK..',
    '...KKzzzzKK...',
  ],
  long: [
    '....KKKKKK....',
    '..KKhHHHHhKK..',
    '.KhHHHHHHHHhK.',
    'KhHHhhhhhHHHhK',
    'KjhhhhhhhhhhjK',
    'KjjhhSSSSSShjK',
    'KjjSSSSSSSSSSK',
    'KjjSbbSSSbbSSK',
    'KjjSSSSSSSSSSK',
    'KjjSWeSSSWeSSK',
    'KjjSSSSSSSSnSK',
    'KjjjSSSSSSSzK.',
    'KjjjKzSmmSzK..',
    'KjjjjKzzzzK...',
  ],
  bald: [
    '....KKKKKK....',
    '..KKSSSSSSKK..',
    '.KSSSSSSSSSSK.',
    'KSSSSSSSSSSSSK',
    'KhSSSSSSSSSSSK',
    'KhhSSSSSSSSSSK',
    'KjhSSSSSSSSSSK',
    'KjhSbbbSSbbbSK',
    'KjsSSSSSSSSSSK',
    'KjsSWeSSSWeSSK',
    'KjsSSSSSSSSnSK',
    '.KjSSShhhhhzK.',
    '..KzShmmhhzK..',
    '...KKhhhhKK...',
  ],
  short: [
    '....KKKKKK....',
    '..KKhHHHHhKK..',
    '.KhHHHHHHHHhK.',
    'KhHHhhhhhHHHhK',
    'KjhhhhhhhhhhjK',
    'KjjhhSSSSSShjK',
    'KjjSSSSSSSSSSK',
    'KjjSbbSSSbbSSK',
    'KjsSSSSSSSSSSK',
    'KjsSWeSSSWeSSK',
    'KjsSSSSSSSSnSK',
    '.KjSSSSSSSSzK.',
    '..KzSSSmmSzK..',
    '...KKzzzzKK...',
  ],
};

// pose: stand | walk | read | type | phone | reach | crank | carry | shrug | slump | sit | point
export function drawBig(r, L, x, y, face = 1, pose = 'stand', frame = 0, opts = {}) {
  const flip = face < 0;
  const P = (i, j, c) => r.px(flip ? x + 23 - i : x + i, y + j, c);
  const K = C.ink;
  const [tL, tM, tD] = L.top;
  const [bL, bM, bD] = L.bottom;
  const [sL, sM, sD] = L.skin;
  const sh = L.shirt;
  const slump = pose === 'slump' ? 2 : 0;

  // Head (14 wide at cols 5..18).
  const head = HEADS[L.bigHead || L.head] || HEADS.short;
  const map = {
    K, H: L.hair[0], h: L.hair[1], j: L.hair[2], S: sL, s: sM, z: sD,
    W: C.paper, e: C.ink, b: L.hair[2], n: sD, m: 0xff6a6ab0 >>> 0, G: C.mDD,
  };
  map.m = (255 << 24 | (0x5a << 16) | (0x5a << 8) | 0xa0) >>> 0;
  for (let j = 0; j < head.length; j++) {
    const row = head[j];
    for (let i = 0; i < row.length; i++) {
      let ch = row[i];
      if (ch === '.') continue;
      if (opts.blink && (ch === 'W' || ch === 'e')) ch = 'z';
      P(i + 5, j + slump, map[ch]);
    }
  }

  // Neck.
  for (let j = 14; j <= 15; j++) { P(9, j + slump, K); P(10, j + slump, sD); P(11, j + slump, sD); P(12, j + slump, sM); P(13, j + slump, K); }

  // Torso rows 16..28, cols 6..17.
  const yo = slump;
  for (let j = 16; j <= 28; j++) {
    const inset = j === 16 ? 1 : 0;
    for (let i = 6 + inset; i <= 17 - inset; i++) {
      let c = i <= 7 ? tL : i >= 16 ? tD : tM;
      if (j >= 27) c = tD;
      P(i, j + yo, c);
    }
    P(5 + inset, j + yo, K); P(18 - inset, j + yo, K);
  }
  // Shoulder line.
  for (let i = 7; i <= 16; i++) P(i, 16 + yo, K);
  if (sh) {
    // Lapels open over a shirt and tie.
    for (let j = 17; j <= 22; j++) {
      const w = Math.max(0, 3 - Math.floor((j - 17) / 2));
      for (let i = 12 - w; i <= 12 + w; i++) P(i, j + yo, j === 17 ? sh[1] : sh[0]);
      P(12 - w - 1, j + yo, tD); P(12 + w + 1, j + yo, tL);
    }
    if (L.tie) {
      P(12, 17 + yo, L.tie);
      for (let j = 18; j <= 25; j++) P(12, j + yo, L.tie);
      for (let j = 21; j <= 24; j++) P(13, j + yo, L.tie);
      P(11, 23 + yo, L.tie); P(11, 24 + yo, L.tie);
      P(12, 26 + yo, tD);
    }
    P(10, 24 + yo, K); P(10, 26 + yo, K);
  } else {
    // A crew neck and a seam.
    for (let i = 10; i <= 14; i++) P(i, 17 + yo, tD);
    P(9, 17 + yo, tD); P(15, 17 + yo, tD);
  }
  // Belt.
  for (let i = 6; i <= 17; i++) P(i, 28 + yo, L.skirt ? tD : (i === 12 ? C.bz : bD));

  // Back arm.
  const backHidden = pose === 'carry' || pose === 'shrug';
  if (!backHidden) {
    for (let j = 17; j <= 27; j++) { P(3, j + yo, K); P(4, j + yo, tD); P(5, j + yo, tD); }
    P(3, 28 + yo, K); P(4, 28 + yo, sD); P(5, 28 + yo, sD); P(4, 29 + yo, K); P(5, 29 + yo, K);
  }

  // Front arm by pose.
  const sleeve = (cells) => { for (const [i, j] of cells) P(i, j + yo, tM); };
  const outlineCells = (cells) => { for (const [i, j] of cells) P(i, j + yo, K); };
  const hand = (i, j) => { P(i, j + yo, sL); P(i + 1, j + yo, sM); P(i, j + 1 + yo, sM); P(i + 1, j + 1 + yo, sD); };
  switch (pose) {
    case 'read':
    case 'type': {
      for (let j = 17; j <= 22; j++) { P(18, j + yo, tM); P(19, j + yo, tD); P(20, j + yo, K); }
      for (let i = 17; i <= 20; i++) { P(i, 23 + yo, tM); P(i, 24 + yo, tD); P(i, 25 + yo, K); }
      hand(21, 23);
      if (pose === 'read') {
        for (let j = 15; j <= 25; j++) for (let i = 19; i <= 23; i++) P(i, j + yo, j === 15 ? C.paper3 : (i === 23 ? C.paper3 : C.paper));
        for (let j = 17; j <= 23; j += 2) for (let i = 20; i <= 22; i++) P(i, j + yo, C.paper4);
        hand(19, 23);
      }
      break;
    }
    case 'phone': {
      for (let j = 13; j <= 22; j++) { P(18, j + yo, tM); P(19, j + yo, tD); P(20, j + yo, K); }
      hand(18, 11);
      for (let j = 6; j <= 12; j++) P(19, j + yo, C.ink);
      P(18, 6 + yo, C.ink); P(18, 12 + yo, C.ink);
      break;
    }
    case 'reach': {
      for (let j = 4; j <= 20; j++) { P(18, j + yo, tM); P(19, j + yo, tD); P(20, j + yo, K); }
      hand(18, 2); P(18, 1 + yo, K); P(19, 1 + yo, K);
      break;
    }
    case 'point': {
      for (let j = 17; j <= 20; j++) { P(18, j + yo, tM); P(19, j + yo, K); }
      for (let i = 18; i <= 21; i++) { P(i, 18 + yo, tM); P(i, 19 + yo, tD); P(i, 20 + yo, K); }
      hand(22, 18);
      break;
    }
    case 'crank': {
      for (let j = 17; j <= 22; j++) { P(18, j + yo, tM); P(19, j + yo, K); }
      const up = frame % 2 === 0;
      const yy = up ? 21 : 24;
      for (let i = 18; i <= 21; i++) { P(i, yy + yo, tM); P(i, yy + 1 + yo, K); }
      hand(22, yy - 1);
      break;
    }
    case 'carry': {
      for (let i = 13; i <= 21; i++) { P(i, 25 + yo, tM); P(i, 26 + yo, K); }
      hand(22, 24);
      const h = Math.min(14, (opts.stack || 6) + 4);
      for (let j = 0; j < h; j++) for (let i = 14; i <= 23; i++) P(i, 24 - j + yo, i === 23 ? C.paper4 : j % 2 ? C.paper2 : C.paper);
      for (let i = 14; i <= 23; i++) P(i, 24 - h + yo, C.paper4);
      if (opts.flags) { P(16, 22 - h + yo, C.rose); P(16, 23 - h + yo, C.rose); P(19, 21 - h + yo, C.rose); P(19, 22 - h + yo, C.rose); P(19, 23 - h + yo, C.rose); }
      break;
    }
    case 'shrug': {
      P(1, 14 + yo, sM); P(2, 14 + yo, sL); P(2, 15 + yo, tD); P(3, 16 + yo, tD); P(4, 17 + yo, tD); P(1, 15 + yo, K);
      P(22, 14 + yo, sM); P(21, 14 + yo, sL); P(21, 15 + yo, tM); P(20, 16 + yo, tM); P(19, 17 + yo, tM); P(22, 15 + yo, K);
      break;
    }
    default: {
      const sw = pose === 'walk' ? [0, 1, 0, -1][frame % 4] : 0;
      for (let j = 17; j <= 27; j++) { P(18, j + yo, tM); P(19, j + yo, tD); P(20, j + yo, K); }
      hand(18 + Math.max(0, sw), 28);
      if (L.mug && pose !== 'walk') { for (let j = 24; j <= 28; j++) for (let i = 20; i <= 22; i++) P(i, j + yo, j === 24 ? C.paper3 : C.paper); P(23, 25 + yo, C.paper3); P(23, 26 + yo, C.paper3); }
    }
  }

  // Legs rows 29..37, shoes 38..39.
  const [shL, shD] = L.shoes;
  const stride = pose === 'walk' ? [0, 3, 0, -3][frame % 4] : 0;
  if (L.skirt) {
    for (let j = 29; j <= 33; j++) {
      const ext = Math.floor((j - 29) / 2);
      for (let i = 6 - ext; i <= 17 + ext; i++) P(i, j + yo, i === 6 - ext || i === 17 + ext ? K : i < 9 ? bL : i > 15 ? bD : bM);
    }
    for (let i = 4; i <= 19; i++) P(i, 34 + yo, K);
  } else {
    for (let i = 6; i <= 17; i++) P(i, 29 + yo, i < 9 ? bL : i > 15 ? bD : bM);
    P(5, 29 + yo, K); P(18, 29 + yo, K);
  }
  if (pose === 'sit') {
    for (let i = 8; i <= 20; i++) { P(i, 30, bM); P(i, 31, bD); P(i, 32, K); }
    for (let j = 33; j <= 37; j++) { P(17, j, K); P(18, j, bM); P(19, j, bD); P(20, j, K); }
    for (let i = 17; i <= 22; i++) { P(i, 38, i < 19 ? shD : shL); P(i, 39, K); }
    return;
  }
  const leg = (i0, tone, light, shift) => {
    const start = L.skirt ? 35 : 30;
    for (let j = start; j <= 37; j++) {
      const off = Math.round(shift * (j - 29) / 8);
      const c = L.skirt ? sM : tone;
      P(i0 - 1 + off, j, K); P(i0 + off, j, L.skirt ? sL : light); P(i0 + 1 + off, j, c); P(i0 + 2 + off, j, c); P(i0 + 3 + off, j, K);
    }
    const off = shift;
    P(i0 - 1 + off, 38, K); for (let i = 0; i < 5; i++) P(i0 + i + off, 38, i < 2 ? shD : shL); P(i0 + 5 + off, 38, K);
    for (let i = -1; i <= 5; i++) P(i0 + i + off, 39, K);
  };
  leg(7, bD, bM, -stride);
  leg(12, bM, bL, stride);
}
