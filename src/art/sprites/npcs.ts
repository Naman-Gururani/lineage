// Villagers, portraits, Byte the cat and ambient critters.
// Built exactly like hero.ts: 16×24 frames composed from head/torso/legs with
// anchor [8,22] and the auto outline; right-facing frames are mirrored from the
// left ones with mirrorDef. Portraits are 32×32 framed bust cards.
import { mirrorDef, type Legend, type SpriteDef } from '../pixel'

/* ================= shared construction (hero-identical) ================= */

const ANCHOR: [number, number] = [8, 22]
const E16 = '................'

// legs: 7 rows (frame rows 15..21), feet on the last two rows — the exact
// structure hero.ts uses, so every character animates consistently.
const LEGS_IDLE = [
  '....pppppppp....',
  '....ppp..ppp....',
  '....ppp..ppp....',
  '....ppq..qpp....',
  '....bbb..bbb....',
  '....bbb..bbb....',
  '....BBB..BBB....',
]
const LEGS_STEP_A = [
  '....pppppppp....',
  '....ppp..ppp....',
  '....ppp..ppp....',
  '....ppq..bbb....',
  '....bbb..BBB....',
  '....bbb.........',
  '....BBB.........',
]
const LEGS_STEP_B = [
  '....pppppppp....',
  '....ppp..ppp....',
  '....ppp..ppp....',
  '....bbb..qpp....',
  '....BBB..bbb....',
  '.........bbb....',
  '.........BBB....',
]
const LEGS_LEFT_IDLE = [
  '.....pppppp.....',
  '.....ppp.pp.....',
  '.....ppp.pp.....',
  '.....ppq.qp.....',
  '.....bbb.bb.....',
  '.....bbb.bb.....',
  '.....BBB.BB.....',
]
const LEGS_LEFT_A = [
  '.....pppppp.....',
  '....ppp..ppp....',
  '....ppp..ppp....',
  '...bbb....pqp...',
  '...bbb....bbb...',
  '...BBB....BBB...',
  '................',
]
const LEGS_LEFT_B = [
  '.....pppppp.....',
  '.....ppp.pp.....',
  '.....ppp.pp.....',
  '......pq.qp.....',
  '.....bbbbbb.....',
  '.....bbb.bb.....',
  '.....BBB.BB.....',
]

const pad = (rows: string[], total = 24): string[] => {
  const out = [...rows]
  while (out.length < total) out.push(E16)
  return out
}
const blankTop = (n: number): string[] => Array.from({ length: n }, () => E16)
const compose = (head: string[], torso: string[], legs: string[], top = 0): string[] =>
  pad([...blankTop(top), ...head, ...torso, ...legs])

const setChar = (rows: string[], x: number, y: number, ch: string): void => {
  rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1)
}
/** Devi's wooden cane: knob at the hand row, shaft down to the ground. */
const addCane = (rows: string[], x: number, knob: boolean): string[] => {
  const out = [...rows]
  if (knob) setChar(out, x, 12, 'O')
  for (let y = 13; y <= 21; y++) setChar(out, x, y, 'o')
  return out
}

type Pose = { down: string[]; up: string[]; left: string[] }
type NpcSpec = {
  id: string
  legend: Legend
  head: Pose
  torso: Pose
  /** blank rows above the head (pip is 2px shorter; his torso is 4 rows) */
  top?: number
  /** cane columns per facing (down/up get the knob; left has it in the torso art) */
  cane?: { down: number; up: number; left: number }
}

function buildNpc(spec: NpcSpec): SpriteDef[] {
  const defs: SpriteDef[] = []
  const top = spec.top ?? 0
  const mk = (name: string, rows: string[]): SpriteDef => ({
    name,
    rows,
    legend: spec.legend,
    outline: 'outline',
    anchor: ANCHOR,
  })
  const frame = (head: string[], torso: string[], legs: string[], cane?: number, knob = true): string[] => {
    const rows = compose(head, torso, legs, top)
    return cane === undefined ? rows : addCane(rows, cane, knob)
  }
  const id = spec.id
  defs.push(mk(`npc_${id}_idle_down`, frame(spec.head.down, spec.torso.down, LEGS_IDLE, spec.cane?.down)))
  defs.push(mk(`npc_${id}_walk_down_0`, frame(spec.head.down, spec.torso.down, LEGS_STEP_A, spec.cane?.down)))
  defs.push(mk(`npc_${id}_walk_down_1`, frame(spec.head.down, spec.torso.down, LEGS_STEP_B, spec.cane?.down)))
  defs.push(mk(`npc_${id}_idle_up`, frame(spec.head.up, spec.torso.up, LEGS_IDLE, spec.cane?.up)))
  defs.push(mk(`npc_${id}_walk_up_0`, frame(spec.head.up, spec.torso.up, LEGS_STEP_A, spec.cane?.up)))
  defs.push(mk(`npc_${id}_walk_up_1`, frame(spec.head.up, spec.torso.up, LEGS_STEP_B, spec.cane?.up)))
  const left: SpriteDef[] = [
    mk(`npc_${id}_idle_left`, frame(spec.head.left, spec.torso.left, LEGS_LEFT_IDLE, spec.cane?.left, false)),
    mk(`npc_${id}_walk_left_0`, frame(spec.head.left, spec.torso.left, LEGS_LEFT_A, spec.cane?.left, false)),
    mk(`npc_${id}_walk_left_1`, frame(spec.head.left, spec.torso.left, LEGS_LEFT_B, spec.cane?.left, false)),
  ]
  for (const d of left) defs.push(d)
  for (const d of left) defs.push(mirrorDef(d, d.name.replace('_left', '_right')))
  return defs
}

/* ============================ the villagers ============================= */

const skinLight: Legend = { s: 'skin', S: 'skinShade', e: 'ink' }
const skinMed: Legend = { s: 'skinShade', S: 'skinDark', e: 'ink' }

// -- mira: harbor master. Navy captain coat, white peaked cap, grey-blonde hair.
const MIRA: NpcSpec = {
  id: 'mira',
  legend: {
    ...skinLight,
    h: 'hairGrey',
    H: 'hairBlond',
    w: 'white',
    k: 'stoneDeep',
    y: 'yellow',
    n: 'navy',
    N: 'blueDark',
    p: 'white',
    q: 'creamDark',
    b: 'hairDark',
    B: 'ink',
  },
  head: {
    down: [
      '.....wwwwww.....',
      '....wwwwwwww....',
      '....wwwyywww....',
      '...kkkkkkkkkk...',
      '....hHhhhhHh....',
      '....hssssssh....',
      '....sesssses....',
      '....ssssssss....',
      '.....ssssss.....',
    ],
    up: [
      '.....wwwwww.....',
      '....wwwwwwww....',
      '....wwwwwwww....',
      '...kkkkkkkkkk...',
      '....hHhhhhHh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '.....hhhhhh.....',
      '.....ssssss.....',
    ],
    left: [
      '.....wwwwww.....',
      '....wwwwwwww....',
      '....ywwwwwww....',
      '..kkkkkkkkkk....',
      '....hHhhhhhh....',
      '....ssshhhhh....',
      '....sesshhhh....',
      '....ssshhhhh....',
      '.....ssssh......',
    ],
  },
  torso: {
    down: [
      '....nnnwwnnn....',
      '...nnnnwwnnnn...',
      '...nnynnnnynn...',
      '..snnynnnnynns..',
      '...NnnnnnnnnN...',
      '....NNNNNNNN....',
    ],
    up: [
      '....nnnnnnnn....',
      '...nnnnnnnnnn...',
      '...nNNNNNNNNn...',
      '..snnNNNNNNnns..',
      '...NnnnnnnnnN...',
      '....NNNNNNNN....',
    ],
    left: [
      '.....nnnnnn.....',
      '....nnwnnnnn....',
      '....nnynnnnn....',
      '....snnnnnns....',
      '....NnnnnnnnN...',
      '.....NNNNNN.....',
    ],
  },
}

// -- tomas: old fisherman. Olive bucket hat, grey beard, teal vest, waders.
const TOMAS: NpcSpec = {
  id: 'tomas',
  legend: {
    ...skinLight,
    o: 'moss',
    O: 'pineDark',
    g: 'hairGrey',
    c: 'cream',
    C: 'creamDark',
    t: 'teal',
    T: 'tealDark',
    p: 'dirtDark',
    q: 'dirt',
    b: 'stoneDeep',
    B: 'ink',
  },
  head: {
    down: [
      '.....oooooo.....',
      '....oooooooo....',
      '....oooooooo....',
      '..OOOOOOOOOOOO..',
      '....ssssssss....',
      '....sesssses....',
      '....sgssssgs....',
      '....gggssggg....',
      '.....gggggg.....',
    ],
    up: [
      '.....oooooo.....',
      '....oooooooo....',
      '....oooooooo....',
      '..OOOOOOOOOOOO..',
      '....gggggggg....',
      '....gggggggg....',
      '....gggggggg....',
      '....gssssssg....',
      '.....ssssss.....',
    ],
    left: [
      '.....oooooo.....',
      '....oooooooo....',
      '....oooooooo....',
      '..OOOOOOOOOOOO..',
      '....ssssgggg....',
      '....sessgggg....',
      '....ssssgggg....',
      '...ggggggggg....',
      '....ggggg.......',
    ],
  },
  torso: {
    down: [
      '....cttccttc....',
      '...ccttccttcc...',
      '...ccttccttcc...',
      '..sccttccttccs..',
      '...CttttttttC...',
      '....TTTccTTT....',
    ],
    up: [
      '....cttttttc....',
      '...ccttttttcc...',
      '...ccTTTTTTcc...',
      '..sccTTTTTTccs..',
      '...CttttttttC...',
      '....TTTTTTTT....',
    ],
    left: [
      '.....cttttc.....',
      '....ccttttcc....',
      '....ccttttcc....',
      '....scttttcs....',
      '....CttttttC....',
      '.....TTTTTT.....',
    ],
  },
}

// -- pip: kid, 2px shorter (head lower, legs unchanged). Backwards red cap,
// striped yellow shirt, jeans, white sneakers.
const PIP: NpcSpec = {
  id: 'pip',
  top: 2,
  legend: {
    ...skinLight,
    r: 'red',
    R: 'redDark',
    h: 'hairBrown',
    y: 'yellow',
    w: 'white',
    p: 'blue',
    q: 'blueDark',
    b: 'white',
    B: 'grey',
  },
  head: {
    down: [
      '......rrrr......',
      '.....rrrrrr.....',
      '....rrrrrrrr....',
      '....RRRRRRRR....',
      '....hhhhhhhh....',
      '....ssssssss....',
      '....sesssses....',
      '....ssssssss....',
      '.....ssssss.....',
    ],
    up: [
      '......rrrr......',
      '.....rrrrrr.....',
      '....rrrrrrrr....',
      '....rrrrrrrr....',
      '...RRRRRRRRRR...',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '.....hhhhhh.....',
      '.....ssssss.....',
    ],
    left: [
      '......rrrr......',
      '.....rrrrrr.....',
      '....rrrrrrrr....',
      '....RRRRRRRRRR..',
      '....hshhhhhh....',
      '....ssshhhhh....',
      '....sesshhhh....',
      '....ssshhhhh....',
      '.....ssssh......',
    ],
  },
  torso: {
    down: [
      '....yyyyyyyy....',
      '...wwwwwwwwww...',
      '..syyyyyyyyyys..',
      '....wwwwwwww....',
    ],
    up: [
      '....yyyyyyyy....',
      '...wwwwwwwwww...',
      '..syyyyyyyyyys..',
      '....wwwwwwww....',
    ],
    left: [
      '.....yyyyyy.....',
      '....wwwwwwww....',
      '....syyyyyys....',
      '.....wwwwww.....',
    ],
  },
}

// -- lou: baker. White toque and apron over pink, rosy cheeks.
const LOU: NpcSpec = {
  id: 'lou',
  legend: {
    ...skinLight,
    w: 'white',
    W: 'creamDark',
    h: 'hairBrown',
    d: 'pink',
    D: 'brick',
    p: 'pink',
    q: 'brick',
    b: 'wood',
    B: 'woodDark',
  },
  head: {
    down: [
      '....wwwwwwww....',
      '...wwwwwwwwww...',
      '....wwwwwwww....',
      '....WWWWWWWW....',
      '....hhhhhhhh....',
      '....ssssssss....',
      '....sesssses....',
      '....sdssssds....',
      '.....ssssss.....',
    ],
    up: [
      '....wwwwwwww....',
      '...wwwwwwwwww...',
      '....wwwwwwww....',
      '....WWWWWWWW....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '.....hhhhhh.....',
      '.....ssssss.....',
    ],
    left: [
      '....wwwwwwww....',
      '...wwwwwwwwww...',
      '....wwwwwwww....',
      '....WWWWWWWW....',
      '....hhhhhhhh....',
      '....ssshhhhh....',
      '....sesshhhh....',
      '....sdshhhhh....',
      '.....ssssh......',
    ],
  },
  torso: {
    down: [
      '....dddwwddd....',
      '...ddwwwwwwdd...',
      '...ddwwwwwwdd...',
      '..sddwwwwwwdds..',
      '...DdwwwwwwdD...',
      '....DwwwwwwD....',
    ],
    up: [
      '....dddddddd....',
      '...dddddddddd...',
      '...dddDwwDddd...',
      '..sdddwwwwddds..',
      '...DddddddddD...',
      '....DDDDDDDD....',
    ],
    left: [
      '.....dddddd.....',
      '....wwwwdddd....',
      '....wwwwdddd....',
      '....swwwddds....',
      '....wwwwdddD....',
      '.....wwwDDD.....',
    ],
  },
}

// -- ada: receptionist. Navy blazer, glasses (two dark pixels + a bridge),
// dark hair in a bun, grey slacks.
const ADA: NpcSpec = {
  id: 'ada',
  legend: {
    ...skinLight,
    h: 'hairDark',
    G: 'inkSoft',
    w: 'white',
    n: 'navy',
    N: 'blueDark',
    p: 'stoneDark',
    q: 'stoneDeep',
    b: 'hairDark',
    B: 'ink',
  },
  head: {
    down: [
      '.......hh.......',
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hssssssh....',
      '....ssssssss....',
      '....sseGGess....',
      '....ssssssss....',
      '.....ssssss.....',
    ],
    up: [
      '.......hh.......',
      '......hhhh......',
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '.....hhhhhh.....',
      '.....ssssss.....',
    ],
    left: [
      '......hhhh......',
      '.....hhhhhh.....',
      '....hhhhhhhhh...',
      '....hhhhhhhhhh..',
      '....hshhhhhhhh..',
      '....ssshhhhhh...',
      '....seGGhhhh....',
      '....ssshhhhh....',
      '.....ssssh......',
    ],
  },
  torso: {
    down: [
      '....nnwwwwnn....',
      '...nnnwwwwnnn...',
      '...nnnnwwnnnn...',
      '..snnnnwwnnnns..',
      '...NnnnwwnnnN...',
      '....NNNNNNNN....',
    ],
    up: [
      '....nnnnnnnn....',
      '...nnnnnnnnnn...',
      '...nnNNNNNNnn...',
      '..snnNNNNNNnns..',
      '...NnnnnnnnnN...',
      '....NNNNNNNN....',
    ],
    left: [
      '.....wwnnnn.....',
      '....nwwnnnnn....',
      '....nnwnnnnn....',
      '....snnnnnns....',
      '....NnnnnnnnN...',
      '.....NNNNNN.....',
    ],
  },
}

// -- ravi: tinkerer. Brown overalls over a cream shirt, goggles pushed up,
// messy dark hair.
const RAVI: NpcSpec = {
  id: 'ravi',
  legend: {
    ...skinMed,
    h: 'hairDark',
    m: 'metalDark',
    y: 'yellow',
    c: 'cream',
    C: 'creamDark',
    o: 'wood',
    O: 'woodDark',
    p: 'wood',
    q: 'woodDark',
    b: 'stoneDark',
    B: 'stoneDeep',
  },
  head: {
    down: [
      '.....h.hh.h.....',
      '....hhhhhhhh....',
      '...hhhhhhhhhh...',
      '....myymmyym....',
      '....hssssssh....',
      '....ssssssss....',
      '....sesssses....',
      '....ssssssss....',
      '.....ssssss.....',
    ],
    up: [
      '.....h.hh.h.....',
      '....hhhhhhhh....',
      '...hhhhhhhhhh...',
      '....mmmmmmmm....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '.....hhhhhh.....',
      '.....ssssss.....',
    ],
    left: [
      '.....h.hh.h.....',
      '....hhhhhhhh....',
      '...hhhhhhhhhh...',
      '....yymmmmmm....',
      '....hshhhhhh....',
      '....ssshhhhh....',
      '....sesshhhh....',
      '....ssshhhhh....',
      '.....ssssh......',
    ],
  },
  torso: {
    down: [
      '....cOccccOc....',
      '...ccOccccOcc...',
      '...ccOooooOcc...',
      '..sccOooooOccs..',
      '...CooooooooC...',
      '....OOOOOOOO....',
    ],
    up: [
      '....cOccccOc....',
      '...ccOccccOcc...',
      '...cccOccOccc...',
      '..sccccOOccccs..',
      '...CooooooooC...',
      '....OOOOOOOO....',
    ],
    left: [
      '.....ccOccc.....',
      '....cccOcccc....',
      '....oooOcccc....',
      '....sooOcccs....',
      '....CoooooooO...',
      '.....OOOOOO.....',
    ],
  },
}

// -- sol: engine operator. Yellow hard hat, orange hi-vis vest with a
// reflective stripe over a dark shirt, work boots.
const SOL: NpcSpec = {
  id: 'sol',
  legend: {
    ...skinMed,
    y: 'yellow',
    Y: 'yellowDark',
    h: 'hairDark',
    v: 'orange',
    V: 'orangeDark',
    d: 'stoneDeep',
    w: 'white',
    p: 'stoneDeep',
    q: 'metalDark',
    b: 'wood',
    B: 'woodDark',
  },
  head: {
    down: [
      '.....yyyyyy.....',
      '....yyyyyyyy....',
      '....yyyyyyyy....',
      '...YYYYYYYYYY...',
      '....hssssssh....',
      '....ssssssss....',
      '....sesssses....',
      '....ssssssss....',
      '.....ssssss.....',
    ],
    up: [
      '.....yyyyyy.....',
      '....yyyyyyyy....',
      '....yyyyyyyy....',
      '...YYYYYYYYYY...',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '.....hhhhhh.....',
      '.....ssssss.....',
    ],
    left: [
      '.....yyyyyy.....',
      '....yyyyyyyy....',
      '....yyyyyyyy....',
      '..YYYYYYYYYY....',
      '....sshhhhhh....',
      '....ssshhhhh....',
      '....sesshhhh....',
      '....ssshhhhh....',
      '.....ssssh......',
    ],
  },
  torso: {
    down: [
      '....dvvvvvvd....',
      '...ddvvvvvvdd...',
      '...ddwwwwwwdd...',
      '..sddvvvvvvdds..',
      '...dVvvvvvvVd...',
      '....VVVVVVVV....',
    ],
    up: [
      '....dvvvvvvd....',
      '...ddvvvvvvdd...',
      '...ddwwwwwwdd...',
      '..sddvvvvvvdds..',
      '...dVvvvvvvVd...',
      '....VVVVVVVV....',
    ],
    left: [
      '.....vvvvvv.....',
      '....dvvvvvvv....',
      '....wwwwwwww....',
      '....svvvvvvs....',
      '....VvvvvvvV....',
      '.....VVVVVV.....',
    ],
  },
}

// -- devi: elderly lady. Grey bun, purple shawl over a cream blouse, and a
// wooden cane (visible in every facing, held on her right).
const DEVI: NpcSpec = {
  id: 'devi',
  cane: { down: 1, up: 14, left: 2 },
  legend: {
    ...skinMed,
    g: 'hairGrey',
    u: 'purple',
    U: 'purpleDark',
    c: 'cream',
    C: 'creamDark',
    o: 'wood',
    O: 'woodDark',
    p: 'navy',
    q: 'blueDark',
    b: 'hairDark',
    B: 'ink',
  },
  head: {
    down: [
      '.....gggggg.....',
      '....gggggggg....',
      '....gggggggg....',
      '....gggggggg....',
      '....gssssssg....',
      '....ssssssss....',
      '....sesssses....',
      '....sSssssSs....',
      '.....ssssss.....',
    ],
    up: [
      '.....gggggg.....',
      '....gggggggg....',
      '....gggggggg....',
      '....gggggggg....',
      '....gggggggg....',
      '....gggggggg....',
      '.....gggggg.....',
      '.....sggggs.....',
      '.....ssssss.....',
    ],
    left: [
      '.....gggggg.....',
      '....gggggggg....',
      '....gggggggg....',
      '....gggggggg....',
      '....gsgggggg....',
      '....sssggggg....',
      '....sessgggggg..',
      '....ssssgggggg..',
      '.....sssggg.....',
    ],
  },
  torso: {
    down: [
      '....uuuuuuuu....',
      '...uuuccccuuu...',
      '...uuuccccuuu...',
      '..suuuccccuuus..',
      '...UuuccccuuU...',
      '....UUCCCCUU....',
    ],
    up: [
      '....uuuuuuuu....',
      '...uuuuuuuuuu...',
      '...uUUUUUUUUu...',
      '..suuUUUUUUuus..',
      '...UuuuuuuuuU...',
      '....UUUUUUUU....',
    ],
    left: [
      '.....uuuuuu.....',
      '....uuuuuuuu....',
      '....uuuuuuuu....',
      '..Osuuuuuuus....',
      '....UuuuuuuU....',
      '.....UUUUUU.....',
    ],
  },
}

// -- arjun: teenager. Grey hoodie (hood down on the back), swept dark hair,
// blue jeans, white sneakers.
const ARJUN: NpcSpec = {
  id: 'arjun',
  legend: {
    ...skinMed,
    h: 'hairDark',
    g: 'grey',
    G: 'stoneDark',
    w: 'white',
    p: 'blue',
    q: 'blueDark',
    b: 'white',
    B: 'grey',
  },
  head: {
    down: [
      '......hhhh......',
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhsss....',
      '....hsssssss....',
      '....sesssses....',
      '....ssssssss....',
      '.....ssssss.....',
    ],
    up: [
      '......hhhh......',
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '.....hhhhhh.....',
      '....gggggggg....',
    ],
    left: [
      '......hhhh......',
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....sshhhhhh....',
      '....sesshhhh....',
      '....ssshhhhh....',
      '.....ssshgg.....',
    ],
  },
  torso: {
    down: [
      '....gggGGggg....',
      '...gggwggwggg...',
      '...gggwggwggg...',
      '..sggggggggggs..',
      '...GggGGGGggG...',
      '....GGGGGGGG....',
    ],
    up: [
      '....GGGGGGGG....',
      '...gGGGGGGGGg...',
      '...ggGGGGGGgg...',
      '..sggggggggggs..',
      '...GggggggggG...',
      '....GGGGGGGG....',
    ],
    left: [
      '.....ggggGG.....',
      '....ggggggGG....',
      '....gwgggggg....',
      '....sggggggs....',
      '....GgggggGG....',
      '.....GGGGGG.....',
    ],
  },
}

// -- ilse: lighthouse keeper. Yellow raincoat (hood down), long red hair,
// rubber boots.
const ILSE: NpcSpec = {
  id: 'ilse',
  legend: {
    ...skinLight,
    h: 'hairRed',
    y: 'yellow',
    Y: 'yellowDark',
    p: 'blueDark',
    q: 'navy',
    b: 'stoneDeep',
    B: 'ink',
  },
  head: {
    down: [
      '......hhhh......',
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hssssssh....',
      '....hesssseh....',
      '....hssssssh....',
      '....hssssssh....',
    ],
    up: [
      '......hhhh......',
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
    ],
    left: [
      '......hhhh......',
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hshhhhhh....',
      '....ssshhhhh....',
      '....sesshhhhh...',
      '....ssshhhhhh...',
      '.....ssshhh.....',
    ],
  },
  torso: {
    down: [
      '....yyyYYyyy....',
      '...yyyyyyyyyy...',
      '...yyyyYYyyyy...',
      '..syyyyYYyyyys..',
      '...YyyyYYyyyY...',
      '....YYYYYYYY....',
    ],
    up: [
      '....YYYYYYYY....',
      '...yYYYYYYYYy...',
      '...yyYYYYYYyy...',
      '..syyyyyyyyyys..',
      '...YyyyyyyyyY...',
      '....YYYYYYYY....',
    ],
    left: [
      '.....yyyyYY.....',
      '....yyyyyyYY....',
      '....yYyyyyyy....',
      '....syYyyyys....',
      '....YyyyyyYY....',
      '.....YYYYYY.....',
    ],
  },
}

// -- naman: Naman himself. Hero palette family (teal jacket over a white tee,
// dark jeans, orange sneakers) with a short fringed haircut.
const NAMAN: NpcSpec = {
  id: 'naman',
  legend: {
    ...skinLight,
    h: 'hairDark',
    t: 'teal',
    T: 'tealDark',
    w: 'white',
    p: 'navy',
    q: 'blueDark',
    b: 'orange',
    B: 'orangeDark',
  },
  head: {
    down: [
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhssssss....',
      '....sesssses....',
      '....ssssssss....',
      '.....ssssss.....',
    ],
    up: [
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '.....hhhhhh.....',
      '.....ssssss.....',
    ],
    left: [
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hhhhhhhh....',
      '....hsshhhhh....',
      '....sesshhhh....',
      '....ssshhhhh....',
      '.....ssssh......',
    ],
  },
  torso: {
    down: [
      '....tttwwttt....',
      '...ttttwwtttt...',
      '...ttttwwtttt...',
      '..sttttwwtttts..',
      '...TtttwwtttT...',
      '....TTTwwTTT....',
    ],
    up: [
      '....tttttttt....',
      '...tttttttttt...',
      '...tttttttttt...',
      '..stttttttttts..',
      '...TttttttttT...',
      '....TTTTTTTT....',
    ],
    left: [
      '.....tttttt.....',
      '....wttttttt....',
      '....wttttttt....',
      '....stttttts....',
      '....TtttttttT...',
      '.....TTTTTT.....',
    ],
  },
}

const NPC_SPECS: NpcSpec[] = [MIRA, TOMAS, PIP, LOU, ADA, RAVI, SOL, DEVI, ARJUN, ILSE, NAMAN]

/* ====================== portraits (32×32 bust cards) ===================== */
// A shared bust template (body, neck, head, features) plus per-character
// stamps (hair, hats, glasses…). The bust is auto-outlined, the ground filled
// and a 1px dark border drawn around the square.

const FACE = 32

// shoulders/chest rows 24..31; 'c' coat, 'i' the inner shirt/zip column
const FACE_BODY = [
  '..........cccccccccccc..........',
  '........cccccciiiicccccc........',
  '......cccccccciiiicccccccc......',
  '.....ccccccccciiiiccccccccc.....',
  '....cccccccccciiiicccccccccc....',
  '....cccccccccciiiicccccccccc....',
  '....cccccccccciiiicccccccccc....',
  '....cccccccccciiiicccccccccc....',
]
const FACE_NECK = ['ssssss', 'SSSSSS', 'ssssss', 'ssssss', 'ssssss']
const FACE_HEAD = [
  '.....ssssss.....',
  '...ssssssssss...',
  '..ssssssssssss..',
  '.ssssssssssssss.',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  '.ssssssssssssss.',
  '..ssssssssssss..',
  '...ssssssssss...',
  '.....ssssss.....',
]
const EAR_L = ['ss', 'sS', 'sS']
const EAR_R = ['ss', 'Ss', 'Ss']
const EYE = ['ew', 'ee']

type Stamp = [number, number, string[]]
type FaceOpts = { ears?: boolean; mouth?: 'flat' | 'smile' | 'none' }

function face(name: string, legend: Legend, stamps: Stamp[], opts: FaceOpts = {}): SpriteDef {
  const g: string[][] = Array.from({ length: FACE }, () => Array<string>(FACE).fill('.'))
  const put = (x: number, y: number, rows: string[]): void => {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] === '.') continue
        const yy = y + j
        const xx = x + i
        if (yy >= 0 && yy < FACE && xx >= 0 && xx < FACE) g[yy][xx] = row[i]
      }
    })
  }
  put(0, 24, FACE_BODY)
  put(13, 20, FACE_NECK)
  put(8, 4, FACE_HEAD)
  if (opts.ears !== false) {
    put(6, 12, EAR_L)
    put(24, 12, EAR_R)
  }
  put(10, 11, ['hhh'])
  put(19, 11, ['hhh'])
  put(11, 13, EYE)
  put(19, 13, EYE)
  put(15, 16, ['SS'])
  const mouth = opts.mouth ?? 'flat'
  if (mouth === 'flat') put(14, 18, ['MMMM'])
  if (mouth === 'smile') put(13, 17, ['M....M', '.MMMM.'])
  for (const [x, y, rows] of stamps) put(x, y, rows)
  // outline the bust into the empty ground, fill the ground, frame the card
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < FACE && y < FACE && g[y][x] !== '.'
  const o = g.map((r) => [...r])
  for (let y = 0; y < FACE; y++)
    for (let x = 0; x < FACE; x++)
      if (g[y][x] === '.' && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) o[y][x] = '#'
  for (let y = 0; y < FACE; y++) for (let x = 0; x < FACE; x++) if (o[y][x] === '.') o[y][x] = '_'
  for (let i = 0; i < FACE; i++) {
    o[0][i] = '#'
    o[FACE - 1][i] = '#'
    o[i][0] = '#'
    o[i][FACE - 1] = '#'
  }
  return { name, rows: o.map((r) => r.join('')), legend, anchor: [16, 32] }
}

const faceBase = (skin: 'light' | 'med'): Legend => ({
  s: skin === 'light' ? 'skin' : 'skinShade',
  S: skin === 'light' ? 'skinShade' : 'skinDark',
  e: 'ink',
  w: 'white',
  M: skin === 'light' ? 'skinDark' : 'hairDark',
  '#': 'outline',
  _: 'wallShade',
})

// hair/hat stamps (drawn over the head; x,y is the top-left in card pixels)
const HAIR_HERO: Stamp = [6, 2, [
  '......hhhhhhhh......',
  '....hhhhhhhhhhhh....',
  '...hhhhhhhhhhhhhh...',
  '..hhhhhhhhhhhhhhhh..',
  '..hhhhhhhhhhhhhhhh..',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhh..hhhh..hhhhhhh.',
  '.hh....hh......hhhh.',
  '.hh..............hh.',
  '.hh..............hh.',
]]
const HAIR_NAMAN: Stamp = [6, 2, [
  '.....hhhhhhhhhh.....',
  '...hhhhhhhhhhhhhh...',
  '..hhhhhhhhhhhhhhhh..',
  '..hhhhhhhhhhhhhhhh..',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhhh...',
  '.hhhhhhhhh..........',
  '.hh..............hh.',
  '.hh..............hh.',
]]
const CAP_MIRA: Stamp = [5, 2, [
  '......wwwwwwwwww......',
  '....wwwwwwwwwwwwww....',
  '...wwwwwwwwwwwwwwww...',
  '...wwwwwwwyywwwwwww...',
  '..kkkkkkkkkkkkkkkkkk..',
  '.kkkkkkkkkkkkkkkkkkkk.',
]]
const HAIRLINE_MIRA: Stamp = [7, 8, ['hhHhhhhhhhhhhhHhh.', 'hh..............hh', 'hh..............hh']]
const HAT_TOMAS: Stamp = [5, 2, [
  '.......oooooooo.......',
  '.....oooooooooooo.....',
  '.....oooooooooooo.....',
  '....oooooooooooooo....',
  '..OOOOOOOOOOOOOOOOOO..',
  '.OOOOOOOOOOOOOOOOOOOO.',
]]
const BEARD_TOMAS: Stamp = [8, 13, [
  'gg............gg',
  'ggg..........ggg',
  'ggg..........ggg',
  'gggg........gggg',
  'gggggggggggggggg',
  'gggggMMMMMMggggg',
  'gggggggggggggggg',
  '.gggggggggggggg.',
  '..gggggggggggg..',
  '....gggggggg....',
]]
const CAP_PIP: Stamp = [5, 2, [
  '.......rrrrrrrr.......',
  '.....rrrrrrrrrrrr.....',
  '....rrrrrrrrrrrrrr....',
  '....rrrrrrrrrrrrrr....',
  '...RRRRRRRRRRRRRRRR...',
  '..RRR............RRR..',
]]
const HAIRLINE_PIP: Stamp = [8, 7, ['hhhhhhhhhhhhhhhh', 'hh............hh']]
const TOQUE_LOU: Stamp = [5, 1, [
  '.....wwwwwwwwwwww.....',
  '...wwwwwwwwwwwwwwww...',
  '..wwwwwwwwwwwwwwwwww..',
  '..wwwwwwwwwwwwwwwwww..',
  '...wwwwwwwwwwwwwwww...',
  '...WWWWWWWWWWWWWWWW...',
  '...WWWWWWWWWWWWWWWW...',
]]
const HAIRLINE_LOU: Stamp = [8, 8, ['hhhhhhhhhhhhhhhh', 'hh............hh']]
const HAIR_ADA: Stamp = [6, 2, [
  '.......hhhhhh.......',
  '......hhhhhhhh......',
  '....hhhhhhhhhhhh....',
  '...hhhhhhhhhhhhhh...',
  '..hhhhhhhhhhhhhhhh..',
  '..hhhhhhhhhhhhhhhh..',
  '.hhhh..........hhhh.',
  '.hhh............hhh.',
  '.hh..............hh.',
  '.hh..............hh.',
  '.hh..............hh.',
]]
const GLASSES_ADA: Stamp = [7, 12, [
  '..kkkkk....kkkkk..',
  'kkk...kkkkkk...kkk',
  '..k...k....k...k..',
  '..kkkkk....kkkkk..',
]]
const HAIR_RAVI: Stamp = [6, 2, [
  '...h..hh...hh..h....',
  '..hhhhhhhhhhhhhhh...',
  '..hhhhhhhhhhhhhhhh..',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hh..............hh.',
  '.hh..............hh.',
  '.hh..............hh.',
  '.hh..............hh.',
]]
const GOGGLES_RAVI: Stamp = [7, 8, [
  '.mmmmmmmmmmmmmmmm.',
  '..myyyym..myyyym..',
  '..mmmmmm..mmmmmm..',
]]
const HAT_SOL: Stamp = [5, 2, [
  '.......yyyyyyyy.......',
  '.....yyyyyyyyyyyy.....',
  '....yyyyyyyyyyyyyy....',
  '....yyyyyyyyyyyyyy....',
  '...yyyyyyyyyyyyyyyy...',
  '.YYYYYYYYYYYYYYYYYYYY.',
]]
const HAIRLINE_SOL: Stamp = [8, 8, ['hhhhhhhhhhhhhhhh', 'hh............hh']]
const HAIR_DEVI: Stamp = [6, 3, [
  '.....gggggggggg.....',
  '...gggggggggggggg...',
  '..gggggggggggggggg..',
  '..ggggggg..ggggggg..',
  '.gggggg......gggggg.',
  '.ggggg........ggggg.',
  '.gggg..........gggg.',
  '.ggg............ggg.',
  '.ggg............ggg.',
  '..gg............gg..',
]]
const HAIR_ARJUN: Stamp = [6, 2, [
  '......hhhhhhhhh.....',
  '....hhhhhhhhhhhh....',
  '...hhhhhhhhhhhhhh...',
  '..hhhhhhhhhhhhhhhh..',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhhhh..',
  '.hhhhhhhhhhhh.......',
  '.hhhhhhhh...........',
  '.hh..............hh.',
  '.hh..............hh.',
]]
const HAIR_ILSE: Stamp = [5, 2, [
  '........hhhhhh........',
  '.....hhhhhhhhhhhh.....',
  '....hhhhhhhhhhhhhh....',
  '...hhhhhhhhhhhhhhhh...',
  '...hhhhhhhhhhhhhhhh...',
  '..hhhhhhhhhhhhhhhhhh..',
  '..hhhh..........hhhh..',
  '..hhh............hhh..',
  '..hhh............hhh..',
  '..hh..............hh..',
  '..hh..............hh..',
  '..hh..............hh..',
  '..hh..............hh..',
  '..hh..............hh..',
  '..hhh............hhh..',
  '..hhh............hhh..',
  '..hhh............hhh..',
  '..hhh............hhh..',
  '..hhhh..........hhhh..',
  '..hhhh..........hhhh..',
  '..hhhh..........hhhh..',
]]

// the hero wears a hoodie: a tealDark hood collar and white drawstrings keep
// his portrait distinct from Naman's open jacket + tee
const HOOD_HERO: Stamp[] = [
  [8, 24, ['TTTTT......TTTTT', '.TTT........TTT.']],
  [12, 26, ['w', 'w']],
  [19, 26, ['w', 'w']],
]
const HERO_FACE_LEGEND: Legend = { ...faceBase('light'), h: 'hairDark', c: 'teal', T: 'tealDark', i: 'white' }

const FACE_DEFS: SpriteDef[] = [
  face('face_hero', HERO_FACE_LEGEND, [HAIR_HERO, ...HOOD_HERO]),
  face('face_hero_happy', HERO_FACE_LEGEND, [HAIR_HERO, ...HOOD_HERO], { mouth: 'smile' }),
  face('face_naman', { ...faceBase('light'), h: 'hairDark', c: 'teal', i: 'white' }, [HAIR_NAMAN]),
  face('face_naman_happy', { ...faceBase('light'), h: 'hairDark', c: 'teal', i: 'white' }, [HAIR_NAMAN], { mouth: 'smile' }),
  face(
    'face_mira',
    { ...faceBase('light'), h: 'hairGrey', H: 'hairBlond', k: 'stoneDeep', y: 'yellow', c: 'navy', i: 'white' },
    [HAIRLINE_MIRA, CAP_MIRA, [12, 26, ['y']], [19, 26, ['y']], [12, 28, ['y']], [19, 28, ['y']]],
  ),
  face(
    'face_tomas',
    { ...faceBase('light'), h: 'hairGrey', g: 'hairGrey', o: 'moss', O: 'pineDark', c: 'teal', i: 'cream', M: 'dirtDark' },
    [BEARD_TOMAS, HAT_TOMAS],
    { mouth: 'none' },
  ),
  face(
    'face_pip',
    { ...faceBase('light'), h: 'hairBrown', r: 'red', R: 'redDark', c: 'yellow', i: 'white' },
    [
      HAIRLINE_PIP,
      CAP_PIP,
      [11, 16, ['S']],
      [20, 16, ['S']],
      [6, 26, ['iiiiiiiiiiiiiiiiiiii']],
      [4, 29, ['iiiiiiiiiiiiiiiiiiiiiiii']],
    ],
  ),
  face(
    'face_lou',
    { ...faceBase('light'), h: 'hairBrown', W: 'creamDark', d: 'pink', c: 'pink', i: 'white', M: 'redDark' },
    [
      HAIRLINE_LOU,
      TOQUE_LOU,
      [9, 16, ['dd']],
      [21, 16, ['dd']],
      [12, 26, ['iiiiiiii', 'iiiiiiii', 'iiiiiiii', 'iiiiiiii', 'iiiiiiii', 'iiiiiiii']],
    ],
    { mouth: 'smile' },
  ),
  face('face_ada', { ...faceBase('light'), h: 'hairDark', k: 'ink', c: 'navy', i: 'white' }, [HAIR_ADA, GLASSES_ADA]),
  face(
    'face_ravi',
    { ...faceBase('med'), h: 'hairDark', m: 'metalDark', y: 'yellow', c: 'cream', i: 'cream', o: 'wood' },
    [
      HAIR_RAVI,
      GOGGLES_RAVI,
      [10, 24, ['oo', 'oo']],
      [20, 24, ['oo', 'oo']],
      [12, 27, ['oooooooo', 'oooooooo', 'oooooooo', 'oooooooo', 'oooooooo']],
    ],
  ),
  face(
    'face_sol',
    { ...faceBase('med'), h: 'hairDark', y: 'yellow', Y: 'yellowDark', c: 'orange', i: 'stoneDeep' },
    [HAIRLINE_SOL, HAT_SOL, [4, 28, ['wwwwwwwwwwwwwwwwwwwwwwww']]],
  ),
  face(
    'face_devi',
    { ...faceBase('med'), h: 'hairGrey', g: 'hairGrey', y: 'yellow', c: 'purple', i: 'cream' },
    [HAIR_DEVI, [10, 15, ['SS']], [20, 15, ['SS']], [15, 26, ['yy']]],
  ),
  face(
    'face_arjun',
    { ...faceBase('med'), h: 'hairDark', G: 'stoneDark', c: 'grey', i: 'stoneDark' },
    [HAIR_ARJUN, [8, 24, ['GGGGG......GGGGG', '.GGG........GGG.']], [13, 26, ['w', 'w']], [18, 26, ['w', 'w']]],
  ),
  face(
    'face_ilse',
    { ...faceBase('light'), h: 'hairRed', Y: 'yellowDark', c: 'yellow', i: 'yellowDark' },
    [HAIR_ILSE, [8, 24, ['YYYYY......YYYYY', '.YYY........YYY.']]],
    { ears: false },
  ),
]

/* ===================== Byte the cat (16×14, feet row 13) ================= */

const CAT_LEGEND: Legend = { c: 'stone', C: 'stoneDark', w: 'white', t: 'teal', y: 'yellow', p: 'pink' }
const CAT_ANCHOR: [number, number] = [8, 13]
const cat = (name: string, rows: string[]): SpriteDef => ({
  name,
  rows,
  legend: CAT_LEGEND,
  outline: 'outline',
  anchor: CAT_ANCHOR,
})

const CAT_DOWN_TOP = [
  E16,
  E16,
  '....cc....cc....',
  '....cpc..cpc....',
  '....cccccccc....',
  '...cccccccccc...',
  '...ccyccccycc...',
  '...ccccppcccc...',
  '...ccttttttcc...',
  '...ccwwwwwwcc...',
  '...ccwwwwwwcc.c.',
  '...ccwwwwwwcc.c.',
  '....cwwccwwccc..',
]
const CAT_UP_TOP = [
  E16,
  E16,
  '....cc....cc....',
  '....ccc..ccc....',
  '....cccccccc....',
  '...cccccccccc.c.',
  '...cccccccccc.c.',
  '...cccccccccc.c.',
  '...cCCCCCCCCccc.',
  '...cccccccccc...',
  '...cCCCCCCCCcc..',
  '...cccccccccc...',
  '....cccccccc....',
]
const CAT_LEFT_TOP = [
  E16,
  E16,
  '..c..c..........',
  '..cpcc........c.',
  '..cccccc......c.',
  '..yccccc......c.',
  '..pcccccccccccc.',
  '..wwtccccccccc..',
  '...wwccccccccc..',
  '...cccccccccc...',
  '...cccccccccc...',
]

const CAT_DEFS: SpriteDef[] = (() => {
  const defs: SpriteDef[] = []
  defs.push(cat('cat_idle_down', [...CAT_DOWN_TOP, '....ww....ww....']))
  defs.push(cat('cat_walk_down_0', [...CAT_DOWN_TOP, '...ww.....ww....']))
  defs.push(cat('cat_walk_down_1', [...CAT_DOWN_TOP, '.....ww....ww...']))
  defs.push(cat('cat_idle_up', [...CAT_UP_TOP, '....cc....cc....']))
  defs.push(cat('cat_walk_up_0', [...CAT_UP_TOP, '...cc.....cc....']))
  defs.push(cat('cat_walk_up_1', [...CAT_UP_TOP, '.....cc....cc...']))
  const left: SpriteDef[] = [
    cat('cat_idle_left', [...CAT_LEFT_TOP, '...ccc....ccc...', '...ccc....ccc...', '...www....www...']),
    cat('cat_walk_left_0', [...CAT_LEFT_TOP, '..ccc....ccc....', '..ccc......ccc..', '..www......www..']),
    cat('cat_walk_left_1', [...CAT_LEFT_TOP, '....ccc..ccc....', '....ccc..ccc....', '....www..www....']),
  ]
  for (const d of left) defs.push(d)
  for (const d of left) defs.push(mirrorDef(d, d.name.replace('_left', '_right')))
  defs.push(
    cat('cat_sit', [
      E16,
      '....cc....cc....',
      '....cpc..cpc....',
      '....cccccccc....',
      '...cccccccccc...',
      '...ccyccccycc...',
      '...ccccppcccc...',
      '....cttttttc....',
      '....cwwwwwwc....',
      '.....cwwwwc.....',
      '.....cwwwwc..c..',
      '....ccwwwwcc.c..',
      '....cwwccwwcc...',
      '....ww....ww....',
    ]),
  )
  return defs
})()

/* ==================== ambient critters (frame strips) ==================== */
// Rows hold `frames` frames side by side; art keeps a 1px margin per frame so
// the auto outline never bleeds across frame boundaries.

const CRITTER_DEFS: SpriteDef[] = [
  // butterflies: frame 0 wings open, frame 1 folded
  {
    name: 'butterfly',
    frames: 2,
    anchor: [4, 4],
    legend: { o: 'orange', O: 'orangeDark', k: 'ink' },
    rows: [
      '................',
      '.oo..oo....oo...',
      '.oOkkOo...okko..',
      '.ookkoo...okko..',
      '..o..o.....kk...',
      '................',
      '................',
      '................',
    ],
  },
  {
    name: 'butterfly_blue',
    frames: 2,
    anchor: [4, 4],
    legend: { o: 'blue', O: 'blueDark', k: 'ink' },
    rows: [
      '................',
      '.oo..oo....oo...',
      '.oOkkOo...okko..',
      '.ookkoo...okko..',
      '..o..o.....kk...',
      '................',
      '................',
      '................',
    ],
  },
  // gull flying left; frame 0 wings up, frame 1 wings down
  {
    name: 'gull',
    frames: 2,
    anchor: [8, 5],
    outline: 'outline',
    legend: { w: 'white', g: 'grey', k: 'ink', b: 'orange' },
    rows: [
      '................................',
      '.........gg.....................',
      '........www.....................',
      '.......wwww.....................',
      '..wk...wwww.......wk............',
      '.bwwwwwwwwwww....bwwwwwwwwwww...',
      '..wwwwwwwwwwgg....wwwwwwwwwwgg..',
      '...wwwwwwwwg.........wwwwwww....',
      '......................wwww......',
      '.......................gg.......',
    ],
  },
  // crab scuttling; legs alternate between frames
  {
    name: 'crab',
    frames: 2,
    anchor: [6, 4],
    outline: 'outline',
    legend: { r: 'roofRed', R: 'roofRedDark', k: 'ink' },
    rows: [
      '........................',
      '..k......k....k......k..',
      '.rrk....krr..rrk....krr.',
      '.rrrrrrrrrr..rrrrrrrrrr.',
      '.rRRrrrrRRr..rRRrrrrRRr.',
      '..rrrrrrrr....rrrrrrrr..',
      '.r.r....r.r...r.r..r.r..',
      '.r.r....r.r...r.r..r.r..',
    ],
  },
  // small blue fish arcing out of the water: rising, top, falling
  {
    name: 'fish_jump',
    frames: 3,
    anchor: [6, 6],
    outline: 'outline',
    legend: { b: 'blue', B: 'blueDark', w: 'white', k: 'ink' },
    rows: [
      '....................................',
      '............................B.......',
      '........bb..................BBB.....',
      '.......bbk...B...............Bbb....',
      '......bbbb...BB.bbbbbb........bbbb..',
      '.....bbbbb....BBbbbbbkb.......wbbbk.',
      '....bbbbw.....BBbwwwwbb........wwbb.',
      '.B.wbbbw.....B..................ww..',
      '.BBbww..............................',
      '.BBB................................',
      '....................................',
      '....................................',
    ],
  },
]

/* ============================== the pack ================================ */

export const NPC_DEFS: SpriteDef[] = [
  ...NPC_SPECS.flatMap(buildNpc),
  ...FACE_DEFS,
  ...CAT_DEFS,
  ...CRITTER_DEFS,
]
