// Interior tileset + furniture for room scenes (cottage, tower lobby, workshop,
// engine room, vault, clinic, lighthouse). Tiles are 16×16, drawn with no
// outline and a top-left anchor so the room builder can lay them with
// setOrigin(0). Furniture gets the standard 1px outline and a bottom-centre
// anchor (except gear_big and the tool icons, which anchor at their centre).
// Light comes from the top-left, matching env.ts / hero.ts.
import { mirrorDef, type Legend, type SpriteDef } from '../pixel'

const D: SpriteDef[] = []

/** 16×16 room tile: no outline, anchored top-left. */
const tile = (name: string, rows: string[], legend: Legend, frames?: number): void => {
  D.push({ name, rows, legend, anchor: [0, 0], ...(frames ? { frames } : {}) })
}

/** Outlined furniture, anchored bottom-centre of one frame (override via opts). */
const furn = (name: string, rows: string[], legend: Legend, opts: Partial<SpriteDef> = {}): void => {
  const frames = opts.frames ?? 1
  const fw = rows[0].length / frames
  D.push({ name, rows, legend, outline: 'outline', anchor: [fw / 2, rows.length], ...opts })
}

/** Side-by-side frame strips → one row set. */
const join = (...frames: string[][]): string[] => frames[0].map((_, i) => frames.map((f) => f[i]).join(''))

/** Overlay `block` rows into `base` at (x, y) — for per-frame screen/flame variants. */
const splice = (base: string[], x: number, y: number, block: string[]): string[] =>
  base.map((row, i) => {
    const b = block[i - y]
    return b === undefined ? row : row.slice(0, x) + b + row.slice(x + b.length)
  })

/* ================================ floors ================================ */

const PLANKS: Legend = { p: 'plank', d: 'plankDark', L: 'woodLight', k: 'woodDark' }

tile(
  'floor_wood',
  [
    'pppppdpppppppppp',
    'pLLppdpppLLpppLp',
    'pppppdpkpppppppp',
    'dddddddddddddddd',
    'pppppppppppdpppp',
    'ppLLLppppppdpLLp',
    'pppppppkpppdpppp',
    'dddddddddddddddd',
    'ppdppppppppppppp',
    'ppdppLLppppLLLpp',
    'ppdppppppppkpppp',
    'dddddddddddddddd',
    'ppppppppdppppppp',
    'pLLpppppdppLLppp',
    'pppppkppdppppppp',
    'dddddddddddddddd',
  ],
  PLANKS,
)

tile(
  'floor_wood_alt',
  [
    'pppppppppdpppppp',
    'ppLLpppppdppLLpp',
    'pppppppppdpkpppp',
    'dddddddddddddddd',
    'pppdpppppppppppp',
    'pppdppLLpppppLLp',
    'pppdppppkkpppppp',
    'dddddddddddddddd',
    'pppppppppppppdpp',
    'pLLppppLLppppdpp',
    'ppppkppppppppdpp',
    'dddddddddddddddd',
    'ppppppdppppppppp',
    'ppppppdppLLppppp',
    'ppkpppdppppppLpp',
    'dddddddddddddddd',
  ],
  PLANKS,
)

const FLAGS: Legend = { s: 'stone', l: 'stoneLight', d: 'stoneDark', D: 'stoneDeep' }

tile(
  'floor_stone',
  [
    'lllllllDllllllll',
    'lsssssdDlssssssd',
    'lsssssdDlssssssd',
    'lssdssdDlsslsssd',
    'lsssssdDlssssssd',
    'lsssssdDlsdssssd',
    'dddddddDdddddddd',
    'DDDDDDDDDDDDDDDD',
    'lllDlllllllDllll',
    'ssdDlsssssdDlsss',
    'ssdDlsssssdDlsss',
    'ssdDlsdsssdDlsss',
    'ssdDlssslsdDlsss',
    'ssdDlsssssdDlsss',
    'dddDdddddddDdddd',
    'DDDDDDDDDDDDDDDD',
  ],
  FLAGS,
)

tile(
  'floor_tile',
  [
    'wccccccCLttttttT',
    'cccccccCtttttttT',
    'cccccccCtttttttT',
    'cccccccCtttttttT',
    'cccccccCtttttttT',
    'cccccccCtttttttT',
    'cccccccCtttttttT',
    'CCCCCCCCTTTTTTTT',
    'LttttttTwccccccC',
    'tttttttTcccccccC',
    'tttttttTcccccccC',
    'tttttttTcccccccC',
    'tttttttTcccccccC',
    'tttttttTcccccccC',
    'tttttttTcccccccC',
    'TTTTTTTTCCCCCCCC',
  ],
  { c: 'cream', C: 'creamDark', t: 'teal', T: 'tealDark', L: 'tealLight', w: 'white' },
)

tile(
  'floor_metal',
  [
    'MMMMMMMMMMMkMMMM',
    'mRmmmmmmmRmkmRmm',
    'mmmmmmmmmmmkmmmm',
    'mmmssmmmmmmkmmmm',
    'mmmmmmmmmmmkmmmm',
    'mmmmmmsmmmmkmmmm',
    'mRmmmmmmmRmkmRmm',
    'kkkkkkkkkkkkkkkk',
    'MMMMkMMMMMMMMMMM',
    'mRmmkmRmmmmmmRmm',
    'mmmmkmmmmmmmmmmm',
    'mmmmkmmmmmssmmmm',
    'mmmmkmmmmmmmmmmm',
    'mmmmkmsmmmmmmmmm',
    'mRmmkmRmmmmmmRmm',
    'kkkkkkkkkkkkkkkk',
  ],
  { m: 'metalDark', M: 'metal', R: 'metalLight', k: 'ink', s: 'stoneDeep' },
)

tile(
  'floor_carpet',
  [
    'oRRRrRRRoRRRrRRR',
    'RRRRRRRRRRRRRRRR',
    'RRRRRRRRRRRRRRRR',
    'RRRRRRRRRRRRRRRR',
    'rRRRoRRRrRRRoRRR',
    'RRRRRRRRRRRRRRRR',
    'RRRRRRRRRRRRRRRR',
    'RRRRRRRRRRRRRRRR',
    'oRRRrRRRoRRRrRRR',
    'RRRRRRRRRRRRRRRR',
    'RRRRRRRRRRRRRRRR',
    'RRRRRRRRRRRRRRRR',
    'rRRRoRRRrRRRoRRR',
    'RRRRRRRRRRRRRRRR',
    'RRRRRRRRRRRRRRRR',
    'RRRRRRRRRRRRRRRR',
  ],
  { R: 'redDark', r: 'red', o: 'roofRed' },
)

/* ================================= rugs ================================= */

const RUG: Legend = { b: 'roofRed', P: 'creamDark', y: 'yellowDark', B: 'redDark', c: 'cream' }

tile(
  'rug_mid',
  [
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbPbbbbbbbbbbb',
    'bbbPyPbbbbbbybbb',
    'bbbbPbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbPbbb',
    'bbbbybbbbbbPyPbb',
    'bbbbbbbbbbbbPbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
  ],
  RUG,
)

tile(
  'rug_edge',
  [
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbPbbbbbbbbbbb',
    'bbbPyPbbbbbbybbb',
    'bbbbPbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbb',
    'BBBBBBBBBBBBBBBB',
    'PPPPPPPPPPPPPPPP',
    'BBBBBBBBBBBBBBBB',
    'c.c.c.c.c.c.c.c.',
    'c.c.c.c.c.c.c.c.',
  ],
  RUG,
)

tile(
  'rug_corner',
  [
    'bbbbbbbbbbbBPB..',
    'bbbbbbbbbbbBPB..',
    'bbbbbbbbbbbBPB..',
    'bbbbPbbbbbbBPB..',
    'bbbPyPbbbbbBPB..',
    'bbbbPbbbbbbBPB..',
    'bbbbbbbbbbbBPB..',
    'bbbbbbbbbbbBPB..',
    'bbbbybbbbbbBPB..',
    'bbbbbbbbbbbBPB..',
    'bbbbbbbbbbbBPB..',
    'BBBBBBBBBBBBPB..',
    'PPPPPPPPPPPPPB..',
    'BBBBBBBBBBBBBB..',
    'c.c.c.c.c.c.c...',
    'c.c.c.c.c.c.c...',
  ],
  RUG,
)

/* ============================ walls & door ============================== */

tile(
  'wall_top',
  [
    'DDDDsDDDDDDDsDDD',
    'DDDDDDDDkDDDDDDD',
    'DsDDDDDDDDDDDDsD',
    'DDDDDDsDDDDkDDDD',
    'DDkDDDDDDDDDDDDD',
    'DDDDDDDDDsDDDDDD',
    'DsDDDDkDDDDDDsDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDsDDDDDDDkDDD',
    'DDDDDDDDDDDDDDsD',
    'DkDDDDDDsDDDDDDD',
    'DDDDDsDDDDDDDDDD',
    'DDDDDDDDDDDkDDDD',
    'DsDDDDDDDDDDDDDD',
    'DDDDkDDDDsDDDDDD',
    'DDDDDDDDDDDDDDDD',
  ],
  { D: 'stoneDeep', s: 'stoneDark', k: 'ink' },
)

tile(
  'wall_face',
  [
    'ssssssssssssssss',
    'wwwwwwwwwwwwwwww',
    'wwwwswwwwwwwwwww',
    'wwwwwwwwwwswwwww',
    'wwwwwwwwwwwwwwww',
    'wswwwwwwwwwwwwsw',
    'wwwwwwwswwwwwwww',
    'wwwwwwwwwwwwwwww',
    'wwwswwwwwwwwswww',
    'wwwwwwwwwwwwwwww',
    'wwwwwwwwwswwwwww',
    'ssssssssssssssss',
    'WWWWWWWWWWWWWWWW',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'DDDDDDDDDDDDDDDD',
  ],
  { w: 'wall', s: 'wallShade', W: 'woodLight', o: 'wood', D: 'woodDark' },
)

tile(
  'wall_face_stone',
  [
    'dddddddddddddddd',
    'lllllllDllllllll',
    'lssssssDlsssssss',
    'lssssssDlsssssss',
    'lssdsssDlssslsss',
    'dddddddDdddddddd',
    'DDDDDDDDDDDDDDDD',
    'lllDlllllllllDll',
    'ssdDlsssssssdDls',
    'ssdDlsssssssdDls',
    'ssdDlssslsssdDls',
    'dddDdddddddddDdd',
    'DDDDDDDDDDDDDDDD',
    'llllllllDlllllll',
    'ddddddddDddddddd',
    'DDDDDDDDDDDDDDDD',
  ],
  { s: 'stone', l: 'stoneLight', d: 'stoneDark', D: 'stoneDeep' },
)

tile(
  'wall_face_metal',
  [
    'mmmmmmmmmmmmmmmm',
    'MMMMMMMMMMMMMMMM',
    'mmmmmmmkmmmmmmmm',
    'mRmmmmmkmmmmmmRm',
    'mmmmmmmkmmmmmmmm',
    'mmmmmmmkmmmttmmm',
    'mmMMmmmkmmMMmmmm',
    'mmmmmmmkmmmmmmmm',
    'mmmmmmmkmmmmmmmm',
    'mRmmmmmkmmmmmmRm',
    'mmmmmmmkmmmmmmmm',
    'kkkkkkkkkkkkkkkk',
    'mmmmmmmmmmmmmmmm',
    'MMMMMMMMMMMMMMMM',
    'mmmmmmmmmmmmmmmm',
    'kkkkkkkkkkkkkkkk',
  ],
  { m: 'metalDark', M: 'metal', R: 'metalLight', k: 'ink', t: 'teal' },
)

tile(
  'door_mat',
  [
    'BBBBBBBBBBBBBBBB',
    'BbbbbbbbbbbbbbbB',
    'BbLLbbLLbbLLbbbB',
    'BbbbbbbbbbbbbbbB',
    'BbbLLbbLLbbLLbbB',
    'BbbbbbbbbbbbbbbB',
    'BbLLbbLLbbLLbbbB',
    'BbbbbbbbbbbbbbbB',
    'BbbLLbbLLbbLLbbB',
    'BbbbbbbbbbbbbbbB',
    'BbLLbbLLbbLLbbbB',
    'BbbbbbbbbbbbbbbB',
    'BbbLLbbLLbbLLbbB',
    'BbbbbbbbbbbbbbbB',
    'BbbbbbbbbbbbbbbB',
    'BBBBBBBBBBBBBBBB',
  ],
  { B: 'dirtDark', b: 'dirt', L: 'pathLight' },
)

tile(
  'exit_door',
  [
    'SSkkkkkkkkkkkkSS',
    'SSkkkkkkkkkkkkSS',
    'SSkkkkdkkkkkkkSS',
    'SSkkkkkkkkkkkkSS',
    'SSkkkkkkkkdkkkSS',
    'SSkkkkkkkkkkkkSS',
    'SSkdkkkkkkkkkkSS',
    'SSkkkkkkkkkkkkSS',
    'SSkkkkkkkdkkkkSS',
    'SSkkkkkkkkkkkkSS',
    'SSkkdkkkkkkkkkSS',
    'SSkkkkkkkkkkkkSS',
    'SSkkkkkkkkkkkkSS',
    'SSyyyyyyyyyyyySS',
    'SSNNNNNNNNNNNNSS',
    'SSGGGGGGGGGGGGSS',
  ],
  { S: 'stoneDeep', k: 'ink', d: 'inkSoft', y: 'yellowDark', N: 'windowNight', G: 'glowWarm' },
)

/* =============================== windows ================================ */

tile(
  'window_day',
  [
    'DDDDDDDDDDDDDDDD',
    'DooooooooooooooD',
    'DoSSSSSooSSSSSoD',
    'DoSwwSSooSSSSSoD',
    'DowwwwSooSwwSSoD',
    'DoSSSSSoowwwwSoD',
    'DoSSSSSooSSSSSoD',
    'DooooooooooooooD',
    'DoLLLLLooLLLLLoD',
    'DoLLLLLooLLLLLoD',
    'DoLLLLLooLLLLLoD',
    'DoLLLLLooLLLLLoD',
    'DoLLLLLooLLLLLoD',
    'WWWWWWWWWWWWWWWW',
    'oooooooooooooooo',
    'DDDDDDDDDDDDDDDD',
  ],
  { D: 'woodDark', o: 'wood', W: 'woodLight', S: 'waterLight', L: 'glassLight', w: 'white' },
)

tile(
  'window_night',
  [
    'DDDDDDDDDDDDDDDD',
    'DooooooooooooooD',
    'DoggggggggggggoD',
    'DognnnwnnnnnngoD',
    'DognnnnnnyynngoD',
    'DognwnnnnyynngoD',
    'DognnnnnnnnwngoD',
    'DooooooooooooooD',
    'DognnnnwnnnnngoD',
    'DognnnnnnnnnngoD',
    'DogwnnnnnnwnngoD',
    'DognnnnnnnnnngoD',
    'DoggggggggggggoD',
    'gggggggggggggggg',
    'oooooooooooooooo',
    'DDDDDDDDDDDDDDDD',
  ],
  { D: 'woodDark', o: 'wood', g: 'windowNight', n: 'navy', w: 'white', y: 'yellow' },
)

// Elevator shaft views: ground, rooftops, clouds, rooftop sun.
const skyFrame = (view: string[]): string[] => [
  'mmmmmmmmmmmmmmmm',
  ...view.map((v) => 'm' + v + 'm'),
  'mMMMMMMMMMMMMMMm',
  'mmmmmmmmmmmmmmmm',
]

const SKY_GROUND = [
  'SSSSSSSSSSSSSS',
  'SSwwSSSSSSSSSS',
  'SSSSSSSSSwwSSS',
  'LLSSSSSSSSSSLL',
  'LLLLLLLLLLLLLL',
  'ggggTggggTgggg',
  'gggTTTggTTTggg',
  'ggggdggggdgggg',
  'GgggggGGggggGg',
  'gggGggggggGggg',
  'ggggggGGgggggg',
  'gGgggggggggGgg',
  'gggggggggggggg',
]
const SKY_MID = [
  'SSSSSSSSSSSSSS',
  'SSSSSwwSSSSSSS',
  'SSSSSSSSSSSSSS',
  'SSRRRRSSSSSSSS',
  'SRRRRRRSSBBBBS',
  'RRRRRRRRSBBBBB',
  'rrrrrrrrSbbbbb',
  'ccccccccSccccc',
  'cnnccnncScnncc',
  'ccccccccSccccc',
  'cnnccnncScnncc',
  'ccccccccSccccc',
  'ccccccccSccccc',
]
const SKY_HIGH = [
  'SSSSSSSSSSSSSS',
  'SSwwwwSSSSSSSS',
  'SwwwwwwSSSwwSS',
  'SSwwwwSSSwwwwS',
  'SSSSSSSSSSwwSS',
  'SSSSSSSSSSSSSS',
  'wwSSSSSSSSSSww',
  'wwwwSSSSSSwwww',
  'SwwwwwSSwwwwwS',
  'SSwwwwwwwwwwSS',
  'SSSSwwwwwwSSSS',
  'SSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSS',
]
const SKY_TOP = [
  'SSGGGGGSSSSSSS',
  'SSGYYYGSSSSSSS',
  'SSGYYYGSSSkSkS',
  'SSGYYYGSSSSkSS',
  'SSGGGGGSSSSSSS',
  'SSSSSSSkSkSSSS',
  'SSSSSSSSkSSSSS',
  'SSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSS',
  'SSSSSSSSSSSSSS',
  'LSSSSSSSSSSSSL',
  'LLLLLLLLLLLLLL',
  'LLLLLLLLLLLLLL',
]

tile(
  'window_sky',
  join(skyFrame(SKY_GROUND), skyFrame(SKY_MID), skyFrame(SKY_HIGH), skyFrame(SKY_TOP)),
  {
    m: 'metalDark',
    M: 'metal',
    S: 'waterLight',
    L: 'glassLight',
    w: 'white',
    g: 'grass',
    G: 'grassLight',
    T: 'leafDark',
    d: 'woodDark',
    R: 'roofRed',
    r: 'roofRedDark',
    B: 'roofBlue',
    b: 'roofBlueDark',
    c: 'wall',
    n: 'navy',
    Y: 'yellow',
    k: 'ink',
  },
  4,
)

/* ============================== furniture =============================== */

furn(
  'bed',
  [
    '................................',
    '.WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.',
    '.WooooooooooooooooooooooooooooD.',
    '.WooooooooooooooooooooooooooooD.',
    '.WooooooooooooooooooooooooooooD.',
    '.WoccccccccccccccccccccccccccoD.',
    '.WoccwwwwwwwwwwwwwwwwwwwwwwccoD.',
    '.WocwwwwwwwwwwwwwwwwwwwwwwwwcoD.',
    '.WocwwwwwwwwwwwwwwwwwwwwwwwwcoD.',
    '.WoceeeeeeeeeeeeeeeeeeeeeeeecoD.',
    '.WoccccccccccccccccccccccccccoD.',
    '.WoLLLLLLLLLLLLLLLLLLLLLLLLLLoD.',
    '.WoLLtttttttttttttttttttttttToD.',
    '.WoLttttttttttttttttttttttttToD.',
    '.WotttttttttttttttttttttttttToD.',
    '.WotttttttttttttttttttttttttToD.',
    '.WotttttttttttttttttttttttttToD.',
    '.WotttttttttttttttttttttttttToD.',
    '.WotttttttttttttttttttttttttToD.',
    '.WotttttttttttttttttttttttttToD.',
    '.WotttttttttttttttttttttttttToD.',
    '.WotttttttttttttttttttttttttToD.',
    '.WotttttttttttttttttttttttttToD.',
    '.WotttttttttttttttttttttttttToD.',
    '.WoTTTTTTTTTTTTTTTTTTTTTTTTTToD.',
    '.WoccccccccccccccccccccccccccoD.',
    '.WoccccccccccccccccccccccccccoD.',
    '.WoTTTTTTTTTTTTTTTTTTTTTTTTTToD.',
    '.WotttttttttttttttttttttttttToD.',
    '.WotttttttttttttttttttttttttToD.',
    '.WotttttttttttttttttttttttttToD.',
    '.WotttttttttttttttttttttttttToD.',
    '.WoTTTTTTTTTTTTTTTTTTTTTTTTTToD.',
    '.WoccccccccccccccccccccccccccoD.',
    '.WoccccccccccccccccccccccccccoD.',
    '.WoeeeeeeeeeeeeeeeeeeeeeeeeeeoD.',
    '.WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.',
    '.WooooooooooooooooooooooooooooD.',
    '.DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD.',
    '................................',
  ],
  { W: 'woodLight', o: 'wood', D: 'woodDark', c: 'cream', e: 'creamDark', w: 'white', t: 'teal', T: 'tealDark', L: 'tealLight' },
)

const deskBase = [
  '................................',
  '.........mmmmmmmmmmmmmm.........',
  '.........mkkkkkkkkkkkkm.........',
  '.........mkkkkkkkkkkkkm.........',
  '.........mkkkkkkkkkkkkm.........',
  '.........mkkkkkkkkkkkkm.........',
  '.........mkkkkkkkkkkkkm.........',
  '.........mkkkkkkkkkkkkm.........',
  '.........mkkkkkkkkkkkkm.........',
  '.........mmmmmmmmmmmmmm.........',
  '...............mm...............',
  '.WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.',
  '.ooooooooooMMMMMMMMoooooooooooo.',
  '.oooooooooooooooooooooooooooooo.',
  '.oooooooooooooooooooooooooooooD.',
  '.ooooDDDDDDDDDooooDDDDDDDDDoooD.',
  '.ooooDoooooooDooooDoooooooDoooD.',
  '.ooooDoooyoooDooooDoooyoooDoooD.',
  '.ooooDoooooooDooooDoooooooDoooD.',
  '.ooooDDDDDDDDDooooDDDDDDDDDoooD.',
  '.oooooooooooooooooooooooooooooD.',
  '.DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD.',
  '................................',
  '................................',
]
const DESK_SCR_A = [
  'gggggkkkkkkk',
  'kkgggggggkkk',
  'ggggkkkkkkkk',
  'kkggggggkkkk',
  'gggggggkkkkk',
  'kkkkkkkkkGGk',
  'kkkkkkkkkkkk',
]
const DESK_SCR_B = [
  'kkgggggggkkk',
  'ggggkkkkkkkk',
  'kkggggggkkkk',
  'gggggggkkkkk',
  'kkgggkkkkkkk',
  'kkkkkkkkkGkk',
  'kkkkkkkkkkkk',
]
furn(
  'desk_pc',
  join(splice(deskBase, 10, 2, DESK_SCR_A), splice(deskBase, 10, 2, DESK_SCR_B)),
  { m: 'metalDark', M: 'metal', k: 'ink', g: 'teal', G: 'tealLight', W: 'woodLight', o: 'wood', D: 'woodDark', y: 'yellow' },
  { frames: 2 },
)

const shelfComp = (books: string[]): string[] => {
  const dark = 'D'.repeat(26)
  const full = books[books.length - 1]
  return [dark, dark, ...books, full, full, full, full].map((r) => '.oo' + r + 'oo.')
}
furn(
  'bookshelf',
  [
    '................................',
    '.WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.',
    '.oooooooooooooooooooooooooooooo.',
    ...shelfComp(['rrDDDDttDDDDDDDDrrDDDDppDD', 'rrDDyyttDDnnDDDDrrbbDDppDD', 'rrbbyyttDDnnDDttrrbbDDppgg', 'rrbbyyttppnnDDttrrbbyyppgg']),
    '.oWWWWWWWWWWWWWWWWWWWWWWWWWWWWo.',
    '.oDDDDDDDDDDDDDDDDDDDDDDDDDDDDo.',
    ...shelfComp(['DDyyDDbbDDDDggDDDDttDDDDpp', 'ttyyDDbbDDppggDDDDttrrDDpp', 'ttyyrrbbDDppggDDbbttrryypp', 'ttyyrrbbnnppggDDbbttrryypp']),
    '.oWWWWWWWWWWWWWWWWWWWWWWWWWWWWo.',
    '.oDDDDDDDDDDDDDDDDDDDDDDDDDDDDo.',
    ...shelfComp(['bbDDDDrrDDDDnnDDDDDDttDDpp', 'bbDDttrrDDDDnnbbDDDDttyypp', 'bbppttrrDDDDnnbbggDDttyypp', 'bbppttrryyDDnnbbggrrttyypp']),
    '.oooooooooooooooooooooooooooooo.',
    '.DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD.',
    '................................',
  ],
  { W: 'woodLight', o: 'wood', D: 'woodDark', r: 'red', b: 'blue', y: 'yellow', t: 'teal', p: 'purple', n: 'orange', g: 'leaf' },
)

furn(
  'table',
  [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '............WWWWWWWW............',
    '.........WWWWWWWWWWWWWW.........',
    '.......WWWWWWWWWWWWWWWWWW.......',
    '......WWWWWWWccccccWWWWWWW......',
    '.....WWWWWWccccccccccWWWWWW.....',
    '....WWWWWWccccccccccccWWWWWW....',
    '...WWWWWWccccccccccccccWWWWWW...',
    '...WWWWWWccccccccccccccWWWWWW...',
    '...WWWWWWccccccccccccccWWWWWW...',
    '....WWWWWWeeeeeeeeeeeeWWWWWW....',
    '.....WWWWWWeeeeeeeeeeWWWWWW.....',
    '......WWWWWWWeeeeeeWWWWWWW......',
    '.......oooooooooooooooooo.......',
    '.........oooooooooooooo.........',
    '............oooooooo............',
    '.........oo.DDDDDDDD.oo.........',
    '.........oo..........oo.........',
    '.........DD..........DD.........',
    '................................',
  ],
  { W: 'woodLight', o: 'wood', D: 'woodDark', c: 'cream', e: 'creamDark' },
)

const chairL: SpriteDef = {
  name: 'chair_l',
  rows: [
    '................',
    '................',
    '................',
    '..WWW...........',
    '..WoD...........',
    '..WoD...........',
    '..WoD...........',
    '..WoD...........',
    '..WoD...........',
    '..WoD...........',
    '..WoD...........',
    '..WWWWWWWWWWW...',
    '..ooooooooooD...',
    '..DDDDDDDDDDD...',
    '...oo.....oo....',
    '...oo.....oo....',
    '...oo.....oo....',
    '...DD.....DD....',
    '................',
    '................',
  ],
  legend: { W: 'woodLight', o: 'wood', D: 'woodDark' },
  outline: 'outline',
  anchor: [8, 20],
}
D.push(chairL)
D.push(mirrorDef(chairL, 'chair_r'))

furn(
  'plant',
  [
    '................',
    '................',
    '................',
    '......GGGg......',
    '..GG.GGGggg.gg..',
    '.GGggGGggggggdd.',
    '.Ggggggggggdggd.',
    '..GgggGgggggdd..',
    '..ggdggggdggd...',
    '...gdgGggdgd....',
    '....ggdggdg.....',
    '.....ggdgd......',
    '......ggd.......',
    '......ggd.......',
    '.......gd.......',
    '.......gd.......',
    '.......gd.......',
    '...BBBBBBBBBB...',
    '...RRRRRRRRRR...',
    '....BBBBBBRR....',
    '....BBBBBBRR....',
    '....BBBBBBRR....',
    '....BBBBBBRR....',
    '....BBBBBBRR....',
    '.....BBBBRR.....',
    '.....RRRRRR.....',
    '................',
    '................',
  ],
  { G: 'leafLight', g: 'leaf', d: 'leafDark', B: 'brick', R: 'roofRedDark' },
)

// Fireplace: procedural stone body + spliced flame frames.
const stoneRow = (y: number, w: number): string => {
  let s = ''
  for (let x = 0; x < w; x++) {
    const h = (x * 7 + y * 13) % 29
    s += h === 0 ? 'l' : h === 11 ? 'd' : 's'
  }
  return s
}
const fpBase: string[] = []
for (let y = 0; y < 32; y++) {
  if (y === 0 || y === 31) fpBase.push('.'.repeat(32))
  else if (y === 1) fpBase.push('.' + 'W'.repeat(30) + '.')
  else if (y === 2) fpBase.push('.' + 'o'.repeat(30) + '.')
  else if (y === 3) fpBase.push('.' + 'D'.repeat(30) + '.')
  else if (y === 29) fpBase.push('.' + 'l'.repeat(30) + '.')
  else if (y === 30) fpBase.push('.' + 'd'.repeat(30) + '.')
  else {
    let row = stoneRow(y, 30)
    if (y >= 8) {
      const [a, b] = y === 8 ? [10, 19] : y === 9 ? [8, 21] : [7, 22]
      row = row.slice(0, a) + 'k'.repeat(b - a + 1) + row.slice(b + 1)
    }
    fpBase.push('.' + row + '.')
  }
}
const fpLogs = splice(fpBase, 11, 26, ['oDooDDooDo'])
const FLAME_A = [
  'kkkkkkkkkk',
  'kkkkyykkkk',
  'kkkyyyykkk',
  'kkkyynykkk',
  'kkyynnyykk',
  'kkynnnnykk',
  'kynnnnnnyk',
  'krnnnnnnrk',
]
const FLAME_B = [
  'kkkyykkkkk',
  'kkyyyykkkk',
  'kkyyynykkk',
  'kyynnnyykk',
  'kynnnnnyyk',
  'kynnnnnnyk',
  'krnnnnnnrk',
  'krrnnnnrrk',
]
furn(
  'fireplace',
  join(splice(fpLogs, 11, 18, FLAME_A), splice(fpLogs, 11, 18, FLAME_B)),
  { W: 'woodLight', o: 'wood', D: 'woodDark', l: 'stoneLight', s: 'stone', d: 'stoneDark', S: 'stoneDeep', k: 'ink', y: 'yellow', n: 'orange', r: 'red' },
  { frames: 2 },
)

furn(
  'sofa',
  [
    '.'.repeat(40),
    '.'.repeat(40),
    '.'.repeat(40),
    '.'.repeat(40),
    '.'.repeat(40),
    '.'.repeat(40),
    '...' + 'L'.repeat(34) + '...',
    '...' + 't'.repeat(34) + '...',
    '.LLL' + 't'.repeat(32) + 'TTT.',
    '.Ltt' + 't'.repeat(32) + 'tTT.',
    '.Ltt' + 'T'.repeat(32) + 'tTT.',
    '.Ltt' + 'L'.repeat(15) + 'TT' + 'L'.repeat(15) + 'tTT.',
    '.Ltt' + 't'.repeat(15) + 'TT' + 't'.repeat(15) + 'tTT.',
    '.Ltt' + 't'.repeat(15) + 'TT' + 't'.repeat(15) + 'tTT.',
    '.Ltt' + 't'.repeat(15) + 'TT' + 't'.repeat(15) + 'tTT.',
    '.Ltt' + 'T'.repeat(32) + 'tTT.',
    '.' + 't'.repeat(38) + '.',
    '.' + 't'.repeat(38) + '.',
    '.' + 'T'.repeat(38) + '.',
    '...DD' + '.'.repeat(30) + 'DD...',
    '...DD' + '.'.repeat(30) + 'DD...',
    '.'.repeat(40),
    '.'.repeat(40),
    '.'.repeat(40),
  ],
  { L: 'tealLight', t: 'teal', T: 'tealDark', D: 'woodDark' },
)

const counterPanel = 'pppppP'.repeat(7) + 'pppp'
furn(
  'counter',
  [
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '................................................',
    '.' + 'W'.repeat(46) + '.',
    '.' + 'W'.repeat(46) + '.',
    '.' + 'D'.repeat(46) + '.',
    '.' + counterPanel + '.',
    '.' + counterPanel + '.',
    '.' + counterPanel + '.',
    '.' + counterPanel + '.',
    '.' + counterPanel + '.',
    '.' + counterPanel + '.',
    '.' + counterPanel + '.',
    '.' + counterPanel + '.',
    '.' + counterPanel + '.',
    '.' + counterPanel + '.',
    '.' + 'P'.repeat(46) + '.',
    '.' + 'D'.repeat(46) + '.',
    '.' + 'D'.repeat(46) + '.',
    '................................................',
    '................................................',
  ],
  { W: 'woodLight', D: 'woodDark', p: 'plank', P: 'plankDark' },
)

const recBase = [
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '....................................yyy.........',
  '....' + 'W'.repeat(32) + 'yyy' + 'WWWWW' + '....',
  '..' + 'W'.repeat(33) + 'DDDDD' + 'WWWWWW' + '..',
  '.' + 'W'.repeat(46) + '.',
  '.' + 'W'.repeat(46) + '.',
  '.' + 'o'.repeat(46) + '.',
  '.' + 'b'.repeat(45) + 'B.',
  '.' + 'b'.repeat(45) + 'B.',
  '.' + 'b'.repeat(45) + 'B.',
  '.' + 'b'.repeat(45) + 'B.',
  '.' + 'b'.repeat(45) + 'B.',
  '.' + 'b'.repeat(45) + 'B.',
  '.' + 'b'.repeat(45) + 'B.',
  '.' + 'b'.repeat(45) + 'B.',
  '.' + 'b'.repeat(45) + 'B.',
  '.' + 'b'.repeat(45) + 'B.',
  '.' + 'b'.repeat(45) + 'B.',
  '.' + 'b'.repeat(45) + 'B.',
  '.' + 'B'.repeat(46) + '.',
  '..' + 'B'.repeat(44) + '..',
  '....' + 'B'.repeat(40) + '....',
  '......' + 'B'.repeat(36) + '......',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
]
const REC_SIGN = ['wwwwwwww', 'wkkwkkww', 'wwwwwwww', 'wkwkkwkw', 'wwwwwwww']
furn('reception', splice(recBase, 20, 13, REC_SIGN), {
  W: 'woodLight',
  o: 'wood',
  D: 'woodDark',
  y: 'yellow',
  b: 'roofBlue',
  B: 'roofBlueDark',
  w: 'white',
  k: 'ink',
})

// Elevator: metal doors closed / half-open / open onto a lit cabin.
const elevatorFrame = (doorW: number): string[] => {
  const rows: string[] = []
  for (let y = 0; y < 48; y++) {
    let s = ''
    for (let x = 0; x < 32; x++) {
      let ch = '.'
      if (x >= 1 && x <= 30 && y >= 1 && y <= 46) {
        if (y >= 4 && y <= 43 && x >= 4 && x <= 27) {
          const dx = x - 4
          const inL = dx < doorW
          const inR = dx >= 24 - doorW
          if (inL || inR) {
            ch = 'm'
            if (dx === 0 || dx === 24 - doorW) ch = 'R'
            if (dx === doorW - 1 || dx === 23) ch = 'k'
            const lc = Math.floor(doorW / 2)
            if (doorW >= 6 && y >= 12 && y <= 16 && (dx === lc || dx === 23 - lc)) ch = 'g'
          } else if (y <= 6) ch = 'G'
          else if (y >= 40) ch = 'e'
          else if (y === 22) ch = 'M'
          else ch = 'c'
        } else {
          ch = 'M'
          if (y === 1 || y === 45) ch = 'R'
          if (y === 46) ch = 'k'
          if (y === 3 && x >= 4 && x <= 27) ch = 'm'
          if (x === 1 && y < 45) ch = 'R'
          if (x === 30 && y < 45) ch = 'm'
          if (y === 2 && (x === 15 || x === 16)) ch = 't'
        }
      }
      s += ch
    }
    rows.push(s)
  }
  return rows
}
furn(
  'elevator',
  join(elevatorFrame(12), elevatorFrame(7), elevatorFrame(2)),
  { M: 'metal', R: 'metalLight', m: 'metalDark', k: 'ink', t: 'teal', g: 'glass', G: 'glowWarm', c: 'cream', e: 'creamDark' },
  { frames: 3 },
)

// Console: screen bank + button deck; frames animate waveform, lights, sliders.
const conBase0: string[] = []
for (let y = 0; y < 32; y++) {
  if (y <= 1 || y >= 30) conBase0.push('.'.repeat(48))
  else if (y <= 14) conBase0.push('..' + 'm'.repeat(44) + '..')
  else if (y === 15) conBase0.push('..' + 'k'.repeat(44) + '..')
  else if (y === 16) conBase0.push('.' + 'R'.repeat(46) + '.')
  else if (y <= 22) conBase0.push('.' + 'M'.repeat(46) + '.')
  else if (y <= 28) conBase0.push('.' + 'm'.repeat(46) + '.')
  else conBase0.push('.' + 'k'.repeat(46) + '.')
}
const CON_BTNS = ['rrMMyyMMggMM', 'MMMMMMMMMMMM', 'ggMMrrMMyyMM', 'MMMMMMMMMMMM']
const CON_VENT = ['kkkkkkk', 'kkkkkkk']
const conBase = splice(splice(splice(conBase0, 5, 18, CON_BTNS), 6, 25, CON_VENT), 35, 25, CON_VENT)
const WAVE_A = [
  'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk',
  'kkGGkkkkGGkkkkGk',
  'kGggGGGGggGGGGgk',
  'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk',
  'kyykkyykkyykkyyk',
  'kkkkkkkkkkkkkkkk',
]
const WAVE_B = [
  'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk',
  'kkkkkGGkkkkGGkkk',
  'kGGGGggGGGGggGGk',
  'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk',
  'kkkyykkyykkyykkk',
  'kkkkkkkkkkkkkkkk',
]
const STATUS_A = [
  'kkkkkkkkkkkkkkkk',
  'kggkkrrkkggkkyyk',
  'kggkkrrkkggkkyyk',
  'kkkkkkkkkkkkkkkk',
  'kggkkggkkrrkkggk',
  'kggkkggkkrrkkggk',
  'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk',
]
const STATUS_B = [
  'kkkkkkkkkkkkkkkk',
  'kggkkkkkkggkkyyk',
  'kggkkkkkkggkkyyk',
  'kkkkkkkkkkkkkkkk',
  'kkkkkggkkrrkkkkk',
  'kkkkkggkkrrkkkkk',
  'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk',
]
const SLID_A = ['MkkMMkkMMkkM', 'MyyMMkkMMkkM', 'MkkMMkkMMyyM', 'MkkMMyyMMkkM', 'MkkMMkkMMkkM', 'MMMMMMMMMMMM']
const SLID_B = ['MkkMMkkMMkkM', 'MkkMMyyMMkkM', 'MyyMMkkMMkkM', 'MkkMMkkMMyyM', 'MkkMMkkMMkkM', 'MMMMMMMMMMMM']
const conFrame = (wave: string[], status: string[], slid: string[]): string[] =>
  splice(splice(splice(conBase, 4, 4, wave), 28, 4, status), 31, 17, slid)
furn(
  'console',
  join(conFrame(WAVE_A, STATUS_A, SLID_A), conFrame(WAVE_B, STATUS_B, SLID_B)),
  { m: 'metalDark', M: 'metal', R: 'metalLight', k: 'ink', g: 'teal', G: 'tealLight', r: 'red', y: 'yellow' },
  { frames: 2 },
)

const TANK_BODY = '..R' + 'M'.repeat(16) + 'mmm' + '..'
const TANK_BAND = '..mRmmmmRmmmmRmmmmRmmm..'
const tankBase = [
  '........................',
  '......RRRRRRRRRRRR......',
  '...RMMMMMMMMMMMMMMMmm...',
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BAND,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BAND,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  TANK_BODY,
  '...mmmmmmmmmmmmmmmmmm...',
  '.....RMm........RMm.....',
  '.....RMm........RMm.....',
  '.....RMm........RMm.....',
  '.....RMm........RMm.....',
  '....RMMMm.....RMMMm.....',
  '....kkkkk.....kkkkk.....',
  '........................',
]
const TANK_GAUGE = ['mmwwwwmm', 'mwwwwrwm', 'mwwwrwwm', 'mwwkwwwm', 'mwwwwwwm', 'mmwwwwmm']
furn('tank', splice(tankBase, 8, 12, TANK_GAUGE), {
  R: 'metalLight',
  M: 'metal',
  m: 'metalDark',
  k: 'ink',
  w: 'white',
  r: 'red',
})

furn(
  'pipe_h',
  [
    '................',
    '................',
    '................',
    '................',
    '...RR......RR...',
    'RRRMMRRRRRRMMRRR',
    'MMMMMMMMMMMMMMMM',
    'MMMMMMMMMMMMMMMM',
    'mmmmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmm',
    'kkkmmkkkkkkmmkkk',
    '...kk......kk...',
    '................',
    '................',
    '................',
    '................',
  ],
  { R: 'metalLight', M: 'metal', m: 'metalDark', k: 'ink' },
)

furn(
  'pipe_v',
  [
    '.....RMMmmk.....',
    '.....RMMmmk.....',
    '.....RMMmmk.....',
    '....RRMMmmkk....',
    '....RRMMmmkk....',
    '.....RMMmmk.....',
    '.....RMMmmk.....',
    '.....RMMmmk.....',
    '.....RMMmmk.....',
    '.....RMMmmk.....',
    '.....RMMmmk.....',
    '....RRMMmmkk....',
    '....RRMMmmkk....',
    '.....RMMmmk.....',
    '.....RMMmmk.....',
    '.....RMMmmk.....',
  ],
  { R: 'metalLight', M: 'metal', m: 'metalDark', k: 'ink' },
)

// Big cog: 8 teeth, bolts orbit 22.5 degrees per frame.
const gearFrames = (): string[] => {
  const frames: string[][] = []
  for (let f = 0; f < 4; f++) {
    const rot = (f * Math.PI) / 8
    const rows: string[] = []
    for (let y = 0; y < 24; y++) {
      let s = ''
      for (let x = 0; x < 24; x++) {
        const dx = x - 11.5
        const dy = y - 11.5
        const r = Math.hypot(dx, dy)
        const ang = Math.atan2(dy, dx) - rot
        const sector = ang / (Math.PI / 4)
        const frac = Math.abs(sector - Math.round(sector))
        const n = (-dx * 0.55 - dy * 0.83) / Math.max(r, 0.001)
        const shade = n > 0.45 ? 'R' : n < -0.45 ? 'm' : 'M'
        let ch = '.'
        if (r < 2.4) ch = 'k'
        else if (r < 3.4) ch = 'm'
        else if (r < 8.4) ch = shade
        else if (r < 11.3 && frac < 0.27) ch = shade
        s += ch
      }
      rows.push(s)
    }
    for (let j = 0; j < 4; j++) {
      const a = rot + (j * Math.PI) / 2
      const bx = Math.round(11.5 + Math.cos(a) * 5.6)
      const by = Math.round(11.5 + Math.sin(a) * 5.6)
      rows[by] = rows[by].slice(0, bx) + 'k' + rows[by].slice(bx + 1)
    }
    frames.push(rows)
  }
  return join(...frames)
}
furn('gear_big', gearFrames(), { k: 'ink', m: 'metalDark', M: 'metal', R: 'metalLight' }, { frames: 4, anchor: [12, 12] })

const wbFront = ('ppppppppppp' + 'P').repeat(3) + 'pppppppppp'
const wbLegs = '...oooo' + '.'.repeat(34) + 'oooo...'
const wbBase = [
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '....................................mMMMmm......',
  '....................................mMMMmmRR....',
  '.....................................mmmm.......',
  '.' + 'W'.repeat(46) + '.',
  '.' + 'W'.repeat(8) + 'mmmm' + 'W'.repeat(11) + 'RRRRRR' + 'W'.repeat(17) + '.',
  '.' + 'W'.repeat(9) + 'ooooooo' + 'W'.repeat(8) + 'RR' + 'W'.repeat(20) + '.',
  '.' + 'D'.repeat(46) + '.',
  '.' + wbFront + '.',
  '.' + wbFront + '.',
  '.' + wbFront + '.',
  '.' + wbFront + '.',
  '.' + wbFront + '.',
  '.' + wbFront + '.',
  '.' + wbFront + '.',
  '.' + 'P'.repeat(46) + '.',
  wbLegs,
  wbLegs,
  '...oooo' + 'D'.repeat(34) + 'oooo...',
  wbLegs,
  wbLegs,
  '...DDDD' + '.'.repeat(34) + 'DDDD...',
  '................................................',
  '................................................',
]
const WB_DRAWER = ['DDDDDDDDDDDD', 'DppppppppppD', 'DppppyyppppD', 'DppppppppppD', 'DDDDDDDDDDDD']
furn('workbench', splice(wbBase, 28, 13, WB_DRAWER), {
  W: 'woodLight',
  o: 'wood',
  D: 'woodDark',
  p: 'plank',
  P: 'plankDark',
  m: 'metalDark',
  M: 'metal',
  R: 'metalLight',
  y: 'yellow',
})

// Pegboard: dotted holes, two rails of empty hooks for the tool icons.
const toolwallRows = (): string[] => {
  const rows: string[] = []
  for (let y = 0; y < 40; y++) {
    if (y === 0 || y === 39) rows.push('.'.repeat(64))
    else if (y === 1 || y === 38) rows.push('.' + 'o'.repeat(62) + '.')
    else {
      let board = ''
      for (let x = 0; x < 60; x++) board += y > 2 && y < 37 && y % 4 === 2 && x % 4 === 1 ? 'P' : 'e'
      rows.push('.o' + board + 'o.')
    }
  }
  const hook = (x: number, y: number) => {
    rows[y] = rows[y].slice(0, x) + 'm' + rows[y].slice(x + 1)
    rows[y + 1] = rows[y + 1].slice(0, x) + 'mm' + rows[y + 1].slice(x + 2)
  }
  for (const x of [8, 20, 32, 44, 56]) {
    hook(x, 8)
    hook(x, 24)
  }
  return rows
}
furn('toolwall', toolwallRows(), { o: 'wood', e: 'creamDark', P: 'plankDark', m: 'metalDark' })

/* ------------------------- tool icons (12x12) -------------------------- */
// Small hangable badges: everyday objects, no real-world logos.
const icon = (name: string, rows: string[], legend: Legend): void => furn(name, rows, legend, { anchor: [6, 6] })

icon(
  'tool_java', // coffee cup with steam
  [
    '............',
    '....g.g.....',
    '.....g.g....',
    '..wwwwww....',
    '..wwwwww.w..',
    '..wwwwww..w.',
    '..ewwwww.w..',
    '..eewwww....',
    '...eeee.....',
    '..cccccc....',
    '............',
    '............',
  ],
  { g: 'grey', w: 'white', e: 'creamDark', c: 'cream' },
)

icon(
  'tool_spring', // fresh leaf
  [
    '............',
    '.......GGG..',
    '.....GGGgg..',
    '....Gggdgg..',
    '...Gggdggg..',
    '..Gggdggg...',
    '..ggdggg....',
    '..gdggg.....',
    '..dgg.......',
    '...d........',
    '............',
    '............',
  ],
  { G: 'leafLight', g: 'leaf', d: 'leafDark' },
)

icon(
  'tool_python', // little snake
  [
    '............',
    '..ggg.......',
    '.rgkgggggg..',
    '........gg..',
    '..gggggggg..',
    '..gg........',
    '..gggggggg..',
    '.........g..',
    '............',
    '............',
    '............',
    '............',
  ],
  { g: 'leaf', k: 'ink', r: 'red' },
)

icon(
  'tool_cpp', // shield with two plus marks
  [
    '............',
    '..bbbbbbbB..',
    '..bbwbbbbB..',
    '..bwwwbbbB..',
    '..bbwbbwbB..',
    '..bbbbwwwB..',
    '..bbbbbwbB..',
    '...bbbbbB...',
    '....bbbB....',
    '.....bb.....',
    '............',
    '............',
  ],
  { b: 'blue', B: 'blueDark', w: 'white' },
)

icon(
  'tool_sql', // database cylinder
  [
    '............',
    '...tttttt...',
    '..LttttttT..',
    '..tttttttT..',
    '..TTTTTTTT..',
    '..tttttttT..',
    '..TTTTTTTT..',
    '..tttttttT..',
    '...TTTTTT...',
    '............',
    '............',
    '............',
  ],
  { t: 'teal', L: 'tealLight', T: 'tealDark' },
)

icon(
  'tool_kafka', // writer's quill
  [
    '............',
    '........ww..',
    '.......www..',
    '......wwww..',
    '.....wwww...',
    '....wwww....',
    '...gwww.....',
    '..ggww......',
    '..gg........',
    '.k..........',
    '............',
    '............',
  ],
  { w: 'white', g: 'grey', k: 'ink' },
)

icon(
  'tool_flink', // fast-forward chevrons
  [
    '............',
    '..n...n.....',
    '..nn..nn....',
    '..nnn.nnn...',
    '..nnnn.nnnn.',
    '..nnn.nnn...',
    '..nn..nn....',
    '..n...n.....',
    '............',
    '............',
    '............',
    '............',
  ],
  { n: 'orange' },
)

icon(
  'tool_kstreams', // flowing stream lines
  [
    '............',
    '............',
    '.tt..tt..tt.',
    '...tt..tt...',
    '............',
    '.tt..tt..tt.',
    '...tt..tt...',
    '............',
    '.tt..tt..tt.',
    '...tt..tt...',
    '............',
    '............',
  ],
  { t: 'teal' },
)

icon(
  'tool_mq', // envelope
  [
    '............',
    '............',
    '..wwwwwwww..',
    '..wewwwwew..',
    '..wwewweww..',
    '..wwweewww..',
    '..wwwwwwww..',
    '..wwwwwwww..',
    '..eeeeeeee..',
    '............',
    '............',
    '............',
  ],
  { w: 'white', e: 'creamDark' },
)

icon(
  'tool_redis', // stacked red slabs
  [
    '............',
    '............',
    '..rrrrrrrr..',
    '..RRRRRRRR..',
    '............',
    '.rrrrrrrr...',
    '.RRRRRRRR...',
    '............',
    '..rrrrrrrr..',
    '..RRRRRRRR..',
    '............',
    '............',
  ],
  { r: 'red', R: 'redDark' },
)

icon(
  'tool_dynamo', // lightning bolt
  [
    '............',
    '....yyyy....',
    '...yyyy.....',
    '..yyyy......',
    '..yyyyyyy...',
    '.....yyyy...',
    '....yyyy....',
    '...yyy......',
    '..yy........',
    '............',
    '............',
    '............',
  ],
  { y: 'yellow' },
)

icon(
  'tool_docker', // ridged shipping container
  [
    '............',
    '............',
    '..bbbbbbbb..',
    '..bBbBbBbB..',
    '..bBbBbBbB..',
    '..bBbBbBbB..',
    '..bBbBbBbB..',
    '..bBbBbBbB..',
    '..BBBBBBBB..',
    '............',
    '............',
    '............',
  ],
  { b: 'roofBlue', B: 'roofBlueDark' },
)

icon(
  'tool_linux', // terminal with prompt
  [
    '............',
    '............',
    '..mmmmmmmm..',
    '..mkkkkkkm..',
    '..mGkkkkkm..',
    '..mkGkkkkm..',
    '..mGkkGGkm..',
    '..mkkkkkkm..',
    '..mmmmmmmm..',
    '............',
    '............',
    '............',
  ],
  { m: 'metalDark', k: 'ink', G: 'grassLight' },
)

icon(
  'tool_git', // commit graph
  [
    '............',
    '..nn........',
    '..nn..nn....',
    '..g...nn....',
    '..g..g......',
    '..g.g.......',
    '..gg........',
    '..nn........',
    '..nn........',
    '............',
    '............',
    '............',
  ],
  { n: 'orange', g: 'grey' },
)

// Lighthouse lens: dim lamp / blazing lamp with rays.
const lensBase = (() => {
  const widths: Record<number, [number, number]> = {
    4: [12, 19], 5: [10, 21], 6: [8, 23], 7: [7, 24], 8: [6, 25], 9: [6, 25],
    10: [5, 26], 11: [5, 26], 12: [4, 27], 13: [4, 27], 14: [4, 27], 15: [4, 27],
    16: [4, 27], 17: [4, 27], 18: [4, 27], 19: [5, 26], 20: [5, 26], 21: [6, 25],
    22: [6, 25], 23: [7, 24], 24: [8, 23], 25: [10, 21], 26: [12, 19],
  }
  const rows: string[] = []
  for (let y = 0; y < 32; y++) {
    let s = ''
    for (let x = 0; x < 32; x++) {
      let ch = '.'
      if (y === 1 && x >= 10 && x <= 21) ch = 'm'
      else if (y === 2 && x >= 8 && x <= 23) ch = x < 10 || x > 21 ? 'm' : 'M'
      else if (y === 3 && x >= 6 && x <= 25) ch = x < 8 || x > 23 ? 'm' : 'M'
      else if (y === 27 && x >= 6 && x <= 25) ch = 'm'
      else if (y === 28 && x >= 4 && x <= 27) ch = 'M'
      else if (y === 29 && x >= 3 && x <= 28) ch = 'm'
      else if (y === 30 && x >= 3 && x <= 28) ch = 'k'
      else if (widths[y] && x >= widths[y][0] && x <= widths[y][1]) {
        ch = 'a'
        if (y === 10 || y === 20) ch = 'L' // fresnel ridge lines
        if (x - widths[y][0] < 2 && y < 16) ch = 'L' // top-left sheen
      }
      s += ch
    }
    rows.push(s)
  }
  return rows
})()
const LENS_DIM = ['aaddddaa', 'adyyyyda', 'adyyyyda', 'aaddddaa']
const LENS_CORE = [
  'aaGGGGGGaa',
  'aGGyyyyGGa',
  'GGyywwyyGG',
  'GyywwwwyyG',
  'GyywwwwyyG',
  'GGyywwyyGG',
  'aGGyyyyGGa',
  'aaGGGGGGaa',
]
const lensBright = splice(splice(splice(lensBase, 5, 15, ['G'.repeat(22)]), 5, 16, ['G'.repeat(22)]), 11, 12, LENS_CORE)
furn(
  'lens',
  join(splice(lensBase, 12, 14, LENS_DIM), lensBright),
  { m: 'metalDark', M: 'metal', k: 'ink', a: 'glass', L: 'glassLight', y: 'yellow', d: 'yellowDark', w: 'white', G: 'glowWarm' },
  { frames: 2 },
)

// Spiral-ish stone stairs winding up to the right.
const stairsRows = (() => {
  const rows: string[] = Array.from({ length: 32 }, () => '.'.repeat(32))
  const put = (x: number, y: number, s: string) => {
    rows[y] = rows[y].slice(0, x) + s + rows[y].slice(x + s.length)
  }
  const steps: [number, number, number][] = [
    [1, 14, 24],
    [5, 14, 20],
    [10, 13, 16],
    [15, 12, 12],
    [19, 10, 8],
    [21, 9, 4],
  ]
  for (const [x, w, top] of steps) {
    put(x, top, 'l'.repeat(w))
    put(x, top + 1, 'd' + 's'.repeat(w - 1))
    put(x, top + 2, 'd' + 's'.repeat(w - 1))
    put(x, top + 3, 'S'.repeat(w))
  }
  return rows
})()
furn('stairs', stairsRows, { l: 'stoneLight', s: 'stone', d: 'stoneDark', S: 'stoneDeep' })

// Wall map screen with a blinking beacon dot.
const mapBase = (() => {
  const rows: string[] = []
  for (let y = 0; y < 24; y++) {
    if (y === 0 || y === 23) {
      rows.push('.'.repeat(32))
      continue
    }
    if (y <= 2 || y === 21) {
      rows.push('.' + 'm'.repeat(30) + '.')
      continue
    }
    if (y === 22) {
      rows.push('.' + 'k'.repeat(30) + '.')
      continue
    }
    let s = ''
    for (let x = 0; x < 26; x++) {
      const lx = x - 7.5
      const ly = y - 11
      const d = Math.hypot(lx / 6, ly / 4)
      let ch = 'n'
      if (x % 6 === 2 && (y - 3) % 5 === 2) ch = 'T'
      if (d < 1.25) ch = 's'
      if (d < 0.95) ch = 'g'
      s += ch
    }
    rows.push('.mm' + s + 'mm.')
  }
  return rows
})()
furn(
  'mapscreen',
  join(splice(mapBase, 22, 8, ['rr', 'rr']), splice(mapBase, 22, 8, ['nn', 'nn'])),
  { m: 'metalDark', k: 'ink', n: 'navy', T: 'tealDark', g: 'grass', s: 'sand', r: 'red' },
  { frames: 2 },
)

furn(
  'sos_button',
  [
    '................',
    '.MMMMMMMMMMMMMM.',
    '.MmmmmmmmmmmmmM.',
    '.MmmmmmmmmmmmmM.',
    '.MmmmmrrrrmmmmM.',
    '.MmmmwwrrrrmmmM.',
    '.MmmwrrrrrrrmmM.',
    '.MmmrrrrrrrrmmM.',
    '.MmmrrrrrrrrmmM.',
    '.MmmRrrrrrrRmmM.',
    '.MmmmRRRRRRmmmM.',
    '.MmmmmRRRRmmmmM.',
    '.MmmmmmmmmmmmmM.',
    '.MykykykykykykM.',
    '.kkkkkkkkkkkkkk.',
    '................',
  ],
  { M: 'metal', m: 'metalDark', k: 'ink', y: 'yellowDark', r: 'red', R: 'redDark', w: 'white' },
)

// Mystery crate under a purple cloth, with a "?" tag.
const crateBase = (() => {
  const rows: string[] = []
  const span: Record<number, [number, number]> = { 4: [10, 29], 5: [7, 32], 6: [5, 34], 7: [4, 35] }
  for (let y = 0; y < 32; y++) {
    let s = ''
    if (y >= 8 && y <= 26) {
      for (let x = 0; x < 40; x++) {
        if (x < 3 || x > 36) {
          s += '.'
          continue
        }
        const foldL = x === 12 - ((y - 8) >> 1)
        const foldR = x === 27 + ((y - 8) >> 1)
        s += foldL || foldR || y === 26 ? 'P' : 'p'
      }
    } else if (span[y]) {
      const [a, b] = span[y]
      for (let x = 0; x < 40; x++) s += x >= a && x <= b ? (y === 4 ? 'P' : 'p') : '.'
    } else if (y === 27) {
      s = '...' + 'pp.pppp.ppp.pp.pppp.ppp.pppp.pp.p.' + '...'
    } else s = '.'.repeat(40)
    rows.push(s.slice(0, 40))
  }
  return rows
})()
const CRATE_TAG = ['...e...', '.ccccc.', '.ckkkc.', '.ccckc.', '.cckkc.', '.ccccc.', '.cckcc.', '.ccccc.']
furn('crate_covered', splice(crateBase, 29, 15, CRATE_TAG), {
  p: 'purple',
  P: 'purpleDark',
  c: 'cream',
  k: 'ink',
  e: 'creamDark',
})

furn(
  'poster_a', // stream/graph diagram pinned to the wall
  [
    '................',
    '.mwwwwwwwwwwwwm.',
    '.wwwwwwwwwwwwww.',
    '.wwwwwwwwwwwwww.',
    '.wwkwwwwwwwwwww.',
    '.wwkwwwwwwwwtww.',
    '.wwkwwwwwwwtwww.',
    '.wwkwwwwwrtwwww.',
    '.wwkwwwwttwwwww.',
    '.wwkwwwtwwwwwww.',
    '.wwkwwrtwwwwwww.',
    '.wwkwtwwwwwwwww.',
    '.wwktwwwwwwwwww.',
    '.wwkkkkkkkkkkkw.',
    '.wwwwwwwwwwwwww.',
    '.wkkwwkkkwwkkww.',
    '.wwwwwwwwwwwwww.',
    '.wwwwwwwwwwwwww.',
    '.eeeeeeeeeeeeee.',
    '................',
  ],
  { m: 'metalDark', w: 'white', k: 'ink', t: 'teal', r: 'red', e: 'creamDark' },
)

furn(
  'poster_b', // little island map with a red X
  [
    '................',
    '.mwwwwwwwwwwwwm.',
    '.wwwwwwwwwwwwww.',
    '.wbbbbbbbbbbbbw.',
    '.wbbbbbbbbbbbbw.',
    '.wbbbsssbbbbbbw.',
    '.wbbssggsbbbbbw.',
    '.wbsggggssbbbbw.',
    '.wbsgggggsbbbbw.',
    '.wbssgggssbbbbw.',
    '.wbbssgssbbbbbw.',
    '.wbbbsssbwbbbbw.',
    '.wbbbbbbbbwbbbw.',
    '.wbbbbbbbbbrrbw.',
    '.wbbbbbbbbbrrbw.',
    '.wbbbbbbbbbbbbw.',
    '.wbbbbbbbbbbbbw.',
    '.wwwwwwwwwwwwww.',
    '.eeeeeeeeeeeeee.',
    '................',
  ],
  { m: 'metalDark', w: 'white', b: 'waterLight', s: 'sand', g: 'grass', r: 'red', e: 'creamDark' },
)

furn(
  'lamp_table',
  [
    '............',
    '............',
    '............',
    '............',
    '...yyyyyy...',
    '..yGGGGGGy..',
    '..yGGGGGGy..',
    '.yGGGGGGGGy.',
    '.yyyyyyyyyy.',
    '.....mm.....',
    '.....mm.....',
    '.....mm.....',
    '.....mm.....',
    '.....mm.....',
    '.....mm.....',
    '....mmmm....',
    '...mmmmmm...',
    '...kkkkkk...',
    '............',
    '............',
  ],
  { y: 'yellow', G: 'glowWarm', m: 'metalDark', k: 'ink' },
)

furn(
  'kettle',
  [
    '....mm......',
    '...mmmm.....',
    '..m....m....',
    '...RRRR.....',
    '..RMMMMMm...',
    'mMRMMMMMm...',
    'mmRMMMMMm...',
    '..RMMMMMm...',
    '..RMMMmmm...',
    '...mmmm.....',
    '............',
    '............',
  ],
  { m: 'metalDark', R: 'metalLight', M: 'metal' },
)

furn(
  'frame_photo',
  [
    '............',
    '.oooooooooo.',
    '.oSSSSSSSSo.',
    '.oSSwSSSSSo.',
    '.oSSSSSSSSo.',
    '.ogsggggsgo.',
    '.ogtggggpgo.',
    '.ogtggggpgo.',
    '.oggggggggo.',
    '.oooooooooo.',
    '............',
    '............',
  ],
  { o: 'wood', S: 'waterLight', w: 'white', g: 'grass', s: 'skin', t: 'teal', p: 'purple' },
)

furn(
  'whiteboard',
  [
    '........................................',
    '........................................',
    '.' + 'R'.repeat(38) + '.',
    '.R' + 'w'.repeat(36) + 'R.',
    '.R' + 'wttttttttwwwwwwwwwwwwttttttttwwwwwww' + 'R.',
    '.R' + 'wtwwwwwwtwwwwwwwwwwwwtwwwwwwtwwwwwww' + 'R.',
    '.R' + 'wtwwwwwwtkkkkkkkkkkkwtwwwwwwtwwwwwww' + 'R.',
    '.R' + 'wtwwwwwwtwwwwwwwwwwkwtwwwwwwtwwwwwww' + 'R.',
    '.R' + 'wttttttttwwwwwwwwwwwwttttttttwwwwwww' + 'R.',
    '.R' + 'w'.repeat(36) + 'R.',
    '.R' + 'w'.repeat(36) + 'R.',
    '.R' + 'w'.repeat(14) + 'rrrr' + 'w'.repeat(18) + 'R.',
    '.R' + 'w'.repeat(13) + 'rwwr' + 'w'.repeat(19) + 'R.',
    '.R' + 'w'.repeat(13) + 'rwwr' + 'w'.repeat(19) + 'R.',
    '.R' + 'w'.repeat(14) + 'rrrr' + 'w'.repeat(18) + 'R.',
    '.R' + 'wwwkkkwwkkkkwwkkwwwwwwwwwwwwwwwwwwww' + 'R.',
    '.R' + 'w'.repeat(36) + 'R.',
    '.R' + 'w'.repeat(36) + 'R.',
    '.R' + 'wwgggwwwgggwwwgggwwwgggwwwwwwwwwwwww' + 'R.',
    '.R' + 'w'.repeat(36) + 'R.',
    '.R' + 'w'.repeat(36) + 'R.',
    '.R' + 'w'.repeat(36) + 'R.',
    '.' + 'R'.repeat(38) + '.',
    '.R' + 'M'.repeat(10) + 'r' + 'MMM' + 't' + 'M'.repeat(21) + 'R.',
    '....mm' + '.'.repeat(28) + 'mm....',
    '....mm' + '.'.repeat(28) + 'mm....',
    '...mmm' + '.'.repeat(28) + 'mmm...',
    '........................................',
  ],
  { R: 'metalLight', M: 'metal', m: 'metalDark', w: 'white', t: 'teal', k: 'ink', r: 'red', g: 'leaf' },
)

// Server rack: six units, LED clusters blink between frames.
const rackBase = (() => {
  const rows: string[] = ['.'.repeat(24), '.' + 'm'.repeat(22) + '.']
  for (let u = 0; u < 6; u++) {
    rows.push('.m' + 'M'.repeat(20) + 'm.')
    rows.push('.m' + 'kkkkkk' + 'MMMMMMMM' + 'kkkkk' + 'M' + 'm.')
    rows.push('.m' + 'kkkkkk' + 'MMMMMMMM' + 'kkkkk' + 'M' + 'm.')
    rows.push('.m' + 'M'.repeat(20) + 'm.')
    rows.push('.m' + 'm'.repeat(20) + 'm.')
  }
  for (let y = 32; y <= 36; y++) rows.push('.m' + 'm'.repeat(20) + 'm.')
  rows.push('.' + 'k'.repeat(22) + '.')
  rows.push('..kk' + '.'.repeat(16) + 'kk..')
  rows.push('.'.repeat(24))
  return rows
})()
const rackWithLeds = (pats: [string, string][]): string[] =>
  pats.reduce((rows, [a, b], i) => splice(splice(rows, 16, 3 + i * 5, [a]), 16, 4 + i * 5, [b]), rackBase)
const RACK_A: [string, string][] = [
  ['gkrkg', 'gkgkk'],
  ['gkgkg', 'kkrkg'],
  ['rkgkg', 'gkgkr'],
  ['gkgkr', 'rkgkg'],
  ['kkgkg', 'gkrkk'],
  ['gkrkg', 'kkgkg'],
]
const RACK_B: [string, string][] = [
  ['gkgkk', 'gkrkg'],
  ['kkrkg', 'gkgkg'],
  ['gkgkr', 'rkgkg'],
  ['rkgkg', 'gkgkr'],
  ['gkrkk', 'kkgkg'],
  ['kkgkg', 'gkrkg'],
]
furn(
  'server_rack',
  join(rackWithLeds(RACK_A), rackWithLeds(RACK_B)),
  { m: 'metalDark', M: 'metal', k: 'ink', g: 'teal', r: 'red' },
  { frames: 2 },
)

const cabDoor = 'ooDoooDoo' + 'DD' + 'ooDoooDoo'
const cabPanelTop = 'ooDDDDDoo' + 'DD' + 'ooDDDDDoo'
furn(
  'cabinet',
  [
    '........................',
    '.WWWWWWWWWWWWWWWWWWWWWW.',
    '.' + 'o'.repeat(22) + '.',
    '.o' + 'D'.repeat(20) + 'o.',
    '.o' + 'ooooooooo' + 'DD' + 'ooooooooo' + 'o.',
    '.o' + 'ooooooooo' + 'DD' + 'ooooooooo' + 'o.',
    '.o' + cabPanelTop + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + 'ooDoooDyo' + 'DD' + 'oyDoooDoo' + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + cabDoor + 'o.',
    '.o' + cabPanelTop + 'o.',
    '.o' + 'ooooooooo' + 'DD' + 'ooooooooo' + 'o.',
    '.o' + 'ooooooooo' + 'DD' + 'ooooooooo' + 'o.',
    '.o' + 'ooooooooo' + 'DD' + 'ooooooooo' + 'o.',
    '.o' + 'D'.repeat(20) + 'o.',
    '.' + 'D'.repeat(22) + '.',
    '..DD' + '.'.repeat(16) + 'DD..',
    '........................',
    '........................',
  ],
  { W: 'woodLight', o: 'wood', D: 'woodDark', y: 'yellow' },
)

export const INTERIOR_DEFS: SpriteDef[] = D
