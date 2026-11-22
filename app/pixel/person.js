// Procedural 16x24 characters. Heads are hand-pixeled templates per hairstyle;
// bodies, arms and legs are drawn from parts so every pose and walk frame
// shares one look. Light comes from the top left.
import { C, SKIN, HAIR, CLOTH, SHOES, ramp } from './palette.js';

const HEADS = {
  short: [
    '..KKKKK...',
    '.KhHHHhKK.',
    'KhHHHHHHhK',
    'KjhhhhhhhK',
    'KjjhSSSSSK',
    'KjjSSSSeSK',
    'KjsSSSSSSs',
    '.KjsSSSSzK',
    '..KsSSzzK.',
    '...KKKKK..',
  ],
  glasses: [
    '..KKKKK...',
    '.KhHHHhKK.',
    'KhHHHHHHhK',
    'KjhhhhhhhK',
    'KjjhSSSSSK',
    'KjjSSGGeGK',
    'KjsSSSSSSs',
    '.KjsSSSSzK',
    '..KsSSzzK.',
    '...KKKKK..',
  ],
  bun: [
    'KKK.......',
    'KhHKKKKK..',
    'KjhHHHHhK.',
    '.KhHHHHHhK',
    'KjjhhSSSSK',
    'KjjSSSSeSK',
    'KjsSSSSSSs',
    '.KjSSSSSzK',
    '..KsSSzzK.',
    '...KKKKK..',
  ],
  long: [
    '..KKKKK...',
    '.KhHHHhKK.',
    'KhHHHHHHhK',
    'KjhhhhhhhK',
    'KjjhSSSSSK',
    'KjjSSSSeSK',
    'KjjSSSSSSs',
    'KjjsSSSSzK',
    'KjjKSSzzK.',
    'KjjKKKKK..',
  ],
  bald: [
    '..KKKKK...',
    '.KSSSSSKK.',
    'KSSSSSSSSK',
    'KhSSSSSSSK',
    'KhhSSSSSSK',
    'KjhSSSSeSK',
    'KjsSSSSSSs',
    '.KjsSSShzK',
    '..KsShhhK.',
    '...KKKKK..',
  ],
  curly: [
    '.KKKKKKK..',
    'KhHhHHhHK.',
    'KHhHHhHHhK',
    'KjhhHhhhhK',
    'KjjhSSSSSK',
    'KjjSSSSeSK',
    'KjsSSSSSSs',
    '.KjsSSSSzK',
    '..KsSSzzK.',
    '...KKKKK..',
  ],
  cap: [
    '..KKKKK...',
    '.KcCCCcKK.',
    'KcCCCCCCcK',
    'KkkkkkkkkKKK',
    'KjjhSSSSSK',
    'KjjSSSSeSK',
    'KjsSSSSSSs',
    '.KjsSSSSzK',
    '..KsSSzzK.',
    '...KKKKK..',
  ],
};

export function look(spec) {
  const skin = ramp(SKIN[spec.skin || 'light']);
  const hair = ramp(HAIR[spec.hair || 'brown']);
  const top = ramp(CLOTH[spec.top || 'charcoal']);
  const bottom = ramp(CLOTH[spec.bottom || spec.top || 'charcoal']);
  const shoes = ramp(SHOES[spec.shoes || 'brown']);
  const shirt = spec.shirt ? ramp(CLOTH[spec.shirt]) : null;
  const cap = spec.capColor ? ramp(CLOTH[spec.capColor]) : top;
  return {
    head: spec.head || 'short',
    skirt: !!spec.skirt,
    tie: spec.tie ? C[spec.tie] : null,
    map: {
      K: C.ink, H: hair[0], h: hair[1], j: hair[2],
      S: skin[0], s: skin[1], z: skin[2], e: C.ink, G: C.mDD,
      C: cap[0], c: cap[1], k: cap[2],
    },
    skin, hair, top, bottom, shoes, shirt,
    mug: !!spec.mug,
  };
}

// Draw a person whose sprite box top-left is (x, y). face: 1 right, -1 left.
// pose: stand | walk | read | phone | reach | crank | carry | shrug | slump | type | sit
export function drawPerson(r, L, x, y, face = 1, pose = 'stand', frame = 0, opts = {}) {
  const flip = face < 0;
  const P = (i, j, c) => r.px(flip ? x + 15 - i : x + i, y + j, c);
  const K = C.ink;
  const dy = pose === 'slump' ? 1 : 0;
  const bob = 0;

  // Head
  const head = HEADS[L.head] || HEADS.short;
  const blink = opts.blink;
  for (let j = 0; j < head.length; j++) {
    const row = head[j];
    for (let i = 0; i < row.length; i++) {
      let ch = row[i];
      if (ch === '.') continue;
      if (blink && ch === 'e') ch = 'z';
      const c = L.map[ch];
      if (c !== undefined) P(i + 3, j + dy + bob + (pose === 'slump' ? 1 : 0), c);
    }
  }

  const [tL, tM, tD] = L.top;
  const [bL, bM, bD] = L.bottom;
  const [sL, sM, sD] = L.skin;
  const yo = dy + bob;

  // Neck
  P(6, 10 + yo, K); P(7, 10 + yo, sD); P(8, 10 + yo, sD); P(9, 10 + yo, K);

  // Torso
  for (let j = 11; j <= 17; j++) {
    for (let i = 5; i <= 10; i++) {
      let c = i === 5 ? tL : i === 10 ? tD : tM;
      if (j === 17) c = tD;
      P(i, j + yo, c);
    }
    P(4, j + yo, K); P(11, j + yo, K);
  }
  for (let i = 5; i <= 10; i++) P(i, 11 + yo, i === 5 || i === 10 ? K : P === null ? 0 : tL);
  P(5, 11 + yo, K); P(10, 11 + yo, K);
  // Collar and tie
  if (L.shirt) {
    P(8, 11 + yo, L.shirt[0]); P(9, 11 + yo, L.shirt[1]);
    P(8, 12 + yo, L.shirt[0]);
    if (L.tie) { P(9, 12 + yo, L.tie); P(9, 13 + yo, L.tie); P(9, 14 + yo, L.tie); P(8, 13 + yo, L.shirt[1]); }
    else P(9, 12 + yo, L.shirt[1]);
  }
  // Belt line
  P(5, 17 + yo, K); for (let i = 6; i <= 9; i++) P(i, 17 + yo, L.skirt ? tD : bD); P(10, 17 + yo, K);

  // Back arm (always)
  const backArm = (pose === 'carry' || pose === 'shrug') ? null : true;
  if (backArm) {
    for (let j = 12; j <= 16; j++) { P(3, j + yo, K); P(4, j + yo, tD); }
    P(3, 17 + yo, K); P(4, 17 + yo, sD); P(4, 18 + yo, K);
  }

  // Front arm by pose
  const arm = (j0, j1, i = 11) => { for (let j = j0; j <= j1; j++) { P(i, j + yo, tM); P(i + 1, j + yo, K); } };
  switch (pose) {
    case 'read':
    case 'type': {
      arm(12, 13);
      // Forearm forward
      for (let i = 11; i <= 13; i++) { P(i, 14 + yo, tM); P(i, 15 + yo, K); }
      P(14, 14 + yo, sM); P(14, 15 + yo, K);
      if (pose === 'read') {
        for (let j = 10; j <= 15; j++) for (let i = 13; i <= 15; i++) P(i, j + yo, j === 10 ? C.paper3 : C.paper);
        P(14, 12 + yo, C.paper4); P(14, 14 + yo, C.paper4);
        P(13, 14 + yo, sM);
      }
      break;
    }
    case 'phone': {
      for (let j = 8; j <= 13; j++) { P(11, j + yo, tM); P(12, j + yo, K); }
      P(11, 7 + yo, sM); P(12, 7 + yo, K);
      P(12, 4 + yo, C.ink); P(12, 5 + yo, C.mDD); P(12, 6 + yo, C.mDD); P(12, 8 + yo, C.ink);
      break;
    }
    case 'reach': {
      for (let j = 3; j <= 12; j++) { P(11, j + yo, tM); P(12, j + yo, K); }
      P(11, 2 + yo, sM); P(12, 2 + yo, sM); P(11, 1 + yo, K); P(12, 1 + yo, K);
      break;
    }
    case 'crank': {
      arm(12, 13);
      const up = frame % 2 === 0;
      for (let i = 11; i <= 13; i++) P(i, (up ? 13 : 15) + yo, tM);
      P(14, (up ? 13 : 15) + yo, sM);
      break;
    }
    case 'carry': {
      // Both forearms forward under a stack of paper.
      for (let i = 9; i <= 13; i++) { P(i, 15 + yo, tM); P(i, 16 + yo, K); }
      P(14, 15 + yo, sM);
      const h = opts.stack || 6;
      for (let j = 0; j < h; j++) for (let i = 10; i <= 15; i++) {
        const c = i === 15 ? C.paper4 : (j % 2 ? C.paper2 : C.paper);
        P(i, 14 - j + yo, c);
      }
      for (let i = 10; i <= 15; i++) P(i, 14 - h + yo, C.paper4);
      break;
    }
    case 'shrug': {
      P(2, 10 + yo, sM); P(3, 11 + yo, tD); P(2, 11 + yo, K);
      P(13, 10 + yo, sM); P(12, 11 + yo, tM); P(13, 11 + yo, K);
      break;
    }
    default: {
      // Swing a little while walking.
      const sw = pose === 'walk' ? [0, 1, 0, -1][frame % 4] : 0;
      for (let j = 12; j <= 16; j++) { P(11, j + yo, tM); P(12, j + yo, K); }
      P(11 + Math.max(0, sw), 17 + yo, sM); P(12, 17 + yo, K);
      if (L.mug && pose !== 'walk') { P(12, 15 + yo, C.paper); P(13, 15 + yo, C.paper); P(12, 16 + yo, C.paper3); P(13, 16 + yo, C.paper3); P(14, 15 + yo, C.paper3); }
    }
  }

  // Hips and legs
  const [shL, shD] = L.shoes;
  if (L.skirt) {
    for (let j = 18; j <= 20; j++) {
      const ext = j - 18;
      for (let i = 5 - ext; i <= 10 + ext; i++) P(i, j + yo, i === 5 - ext || i === 10 + ext ? K : (i < 7 ? bL : i > 9 ? bD : bM));
    }
    for (let i = 4; i <= 11; i++) P(i, 21 + yo, K);
  } else {
    P(4, 18 + yo, K); for (let i = 5; i <= 10; i++) P(i, 18 + yo, i < 7 ? bL : i > 9 ? bD : bM); P(11, 18 + yo, K);
  }
  const legRows = L.skirt ? [22] : [19, 20, 21, 22];
  const stride = pose === 'walk' ? [0, 2, 0, -2][frame % 4] : 0;
  const drawLeg = (i0, tone, shift) => {
    for (const j of legRows) {
      const t = (j - 18) / 4;
      const off = Math.round(shift * t);
      const c = L.skirt ? sD : tone;
      P(i0 - 1 + off, j + yo, K); P(i0 + off, j + yo, c); P(i0 + 1 + off, j + yo, c); P(i0 + 2 + off, j + yo, K);
    }
    const off = shift;
    P(i0 - 1 + off, 23, K); P(i0 + off, 23, shD); P(i0 + 1 + off, 23, shL); P(i0 + 2 + off, 23, shL); P(i0 + 3 + off, 23, K);
  };
  if (pose === 'sit') {
    // Thighs forward, shins down: mostly hidden behind desks.
    for (let i = 6; i <= 13; i++) { P(i, 19 + yo, bM); P(i, 20 + yo, K); }
    for (let j = 21; j <= 22; j++) { P(12, j, bM); P(13, j, bD); P(14, j, K); }
    P(12, 23, shD); P(13, 23, shL); P(14, 23, shL);
  } else {
    drawLeg(5, bD, -stride);
    drawLeg(8, bM, stride);
  }
}

export const LOOKS = {
  agent: look({ head: 'glasses', hair: 'black', skin: 'light', top: 'charcoal', bottom: 'charcoal', shirt: 'shirt', tie: 'blue', shoes: 'brown' }),
  secretary: look({ head: 'bun', hair: 'auburn', skin: 'light', top: 'teal', bottom: 'greyskirt', skirt: true, shoes: 'black' }),
  coworker: look({ head: 'curly', hair: 'brown', skin: 'medium', top: 'cream', bottom: 'khaki', shirt: 'shirt', shoes: 'brown', mug: true }),
  partner: look({ head: 'bald', hair: 'grey', skin: 'light', top: 'navy', bottom: 'navy', shirt: 'shirt', tie: 'rose', shoes: 'black' }),
};
