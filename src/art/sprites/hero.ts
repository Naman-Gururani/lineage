// The hero: a small explorer in a teal hoodie. 16×24 frames, feet at row 21.
import { mirrorDef, type Legend, type SpriteDef } from '../pixel'

const L: Legend = {
  h: 'hairDark',
  s: 'skin',
  S: 'skinShade',
  e: 'ink',
  t: 'teal',
  T: 'tealDark',
  w: 'white',
  p: 'navy',
  q: 'blueDark',
  b: 'orange',
  B: 'orangeDark',
  m: 'metal',
  M: 'metalLight',
}

const ANCHOR: [number, number] = [8, 22]

const HEAD_DOWN = [
  '......hhhh......',
  '.....hhhhhh.....',
  '....hhhhhhhh....',
  '....hhhhhhhh....',
  '....hhsshhsh....',
  '....ssssssss....',
  '....sesssses....',
  '....ssssssss....',
  '.....ssssss.....',
]
const HEAD_UP = [
  '......hhhh......',
  '.....hhhhhh.....',
  '....hhhhhhhh....',
  '....hhhhhhhh....',
  '....hhhhhhhh....',
  '....hhhhhhhh....',
  '....hhhhhhhh....',
  '.....hhhhhh.....',
  '.....ssssss.....',
]
const HEAD_LEFT = [
  '......hhhh......',
  '.....hhhhhh.....',
  '....hhhhhhhh....',
  '....hhhhhhhh....',
  '....hshhhhhh....',
  '....ssshhhhh....',
  '....sesshhhh....',
  '....ssshhhhh....',
  '.....ssssh......',
]

const TORSO_DOWN = [
  '....tttttttt....',
  '...tttttttttt...',
  '...ttttwwtttt...',
  '..sttttttttts...',
  '...TttttttttT...',
  '....TTTTTTTT....',
]
const TORSO_UP = [
  '....tttttttt....',
  '...tttttttttt...',
  '...tTTTTTTTTt...',
  '..sttTTTTTTtts..',
  '...TttttttttT...',
  '....TTTTTTTT....',
]
const TORSO_LEFT = [
  '.....tttttt.....',
  '....tttttttt....',
  '....ttwttttt....',
  '....stttttts....',
  '....TtttttttT...',
  '.....TTTTTT.....',
]

// legs: 7 rows (rows 15..21), feet on the last two rows
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

const pad = (rows: string[], total = 24) => {
  const out = [...rows]
  while (out.length < total) out.push('................')
  return out
}

const compose = (head: string[], torso: string[], legs: string[]) => pad([...head, ...torso, ...legs])

// swing poses: the wrench arm extends
const TORSO_DOWN_SWING = [
  '....tttttttt....',
  '...tttttttttt...',
  '...ttttwwtttt...',
  '...ttttttttts...',
  '...TttttttttTsmM',
  '....TTTTTTTT..mM',
]
const TORSO_DOWN_SWING2 = [
  '....tttttttt....',
  '...tttttttttt...',
  '...ttttwwtttt...',
  '.sMmtttttttt....',
  '.mMTttttttttT...',
  '....TTTTTTTT....',
]
const TORSO_UP_SWING = [
  '....tttttttt....',
  '...tttttttttt...',
  'Mm.tTTTTTTTTt...',
  'Mms.tTTTTTTtt...',
  '...TttttttttT...',
  '....TTTTTTTT....',
]
const TORSO_LEFT_SWING = [
  '.....tttttt.....',
  '....tttttttt....',
  '....ttwttttt....',
  'MMmmstttttts....',
  '....TtttttttT...',
  '.....TTTTTT.....',
]

export const HERO_DEFS: SpriteDef[] = (() => {
  const defs: SpriteDef[] = []
  const add = (name: string, rows: string[]) => defs.push({ name, rows, legend: L, outline: 'outline', anchor: ANCHOR })

  add('hero_idle_down', compose(HEAD_DOWN, TORSO_DOWN, LEGS_IDLE))
  add('hero_walk_down_0', compose(HEAD_DOWN, TORSO_DOWN, LEGS_STEP_A))
  add('hero_walk_down_1', compose(HEAD_DOWN, TORSO_DOWN, LEGS_IDLE))
  add('hero_walk_down_2', compose(HEAD_DOWN, TORSO_DOWN, LEGS_STEP_B))
  add('hero_walk_down_3', compose(HEAD_DOWN, TORSO_DOWN, LEGS_IDLE))
  add('hero_swing_down_0', compose(HEAD_DOWN, TORSO_DOWN_SWING, LEGS_IDLE))
  add('hero_swing_down_1', compose(HEAD_DOWN, TORSO_DOWN_SWING2, LEGS_IDLE))

  add('hero_idle_up', compose(HEAD_UP, TORSO_UP, LEGS_IDLE))
  add('hero_walk_up_0', compose(HEAD_UP, TORSO_UP, LEGS_STEP_A))
  add('hero_walk_up_1', compose(HEAD_UP, TORSO_UP, LEGS_IDLE))
  add('hero_walk_up_2', compose(HEAD_UP, TORSO_UP, LEGS_STEP_B))
  add('hero_walk_up_3', compose(HEAD_UP, TORSO_UP, LEGS_IDLE))
  add('hero_swing_up_0', compose(HEAD_UP, TORSO_UP_SWING, LEGS_IDLE))
  add('hero_swing_up_1', compose(HEAD_UP, TORSO_UP, LEGS_IDLE))

  const left: SpriteDef[] = []
  const addLeft = (name: string, rows: string[]) => {
    const d: SpriteDef = { name, rows, legend: L, outline: 'outline', anchor: ANCHOR }
    left.push(d)
    defs.push(d)
  }
  addLeft('hero_idle_left', compose(HEAD_LEFT, TORSO_LEFT, LEGS_LEFT_IDLE))
  addLeft('hero_walk_left_0', compose(HEAD_LEFT, TORSO_LEFT, LEGS_LEFT_A))
  addLeft('hero_walk_left_1', compose(HEAD_LEFT, TORSO_LEFT, LEGS_LEFT_IDLE))
  addLeft('hero_walk_left_2', compose(HEAD_LEFT, TORSO_LEFT, LEGS_LEFT_B))
  addLeft('hero_walk_left_3', compose(HEAD_LEFT, TORSO_LEFT, LEGS_LEFT_IDLE))
  addLeft('hero_swing_left_0', compose(HEAD_LEFT, TORSO_LEFT_SWING, LEGS_LEFT_IDLE))
  addLeft('hero_swing_left_1', compose(HEAD_LEFT, TORSO_LEFT, LEGS_LEFT_IDLE))
  for (const d of left) defs.push(mirrorDef(d, d.name.replace('_left', '_right')))

  // hats (12×8, anchored so the brim sits on the hair line)
  const hat = (name: string, rows: string[], legend: Legend) => defs.push({ name, rows, legend, outline: 'outline', anchor: [6, 8] })
  hat('hat_hardhat', ['...yyyyyy...', '..yyyyyyyy..', '.yyyYyyyyyy.', '.yyyyyyyyyy.', 'YYYYYYYYYYYY', '............', '............', '............'], {
    y: 'yellow',
    Y: 'yellowDark',
  })
  hat('hat_seashell', ['....pppp....', '..ppcpcpcp..', '.pcpcpcpcpc.', '.ppppppppppp', '............', '............', '............', '............'], {
    p: 'pink',
    c: 'cream',
  })
  hat('hat_catears', ['.kk......kk.', '.kpk....kpk.', '.kppk..kppk.', '.kkkk..kkkk.', '............', '............', '............', '............'], {
    k: 'hairDark',
    p: 'pink',
  })
  hat('hat_crown', ['.g..g..g..g.', '.gg.gg.gg.g.', '.gggggggggg.', '.grggrggrgg.', '.gggggggggg.', '............', '............', '............'], {
    g: 'yellow',
    r: 'red',
  })

  add('shadow', ['....ssssssss....', '..ssssssssssss..', '....ssssssss....'])
  defs[defs.length - 1].legend = { s: 'rgba(20,30,40,0.28)' }
  defs[defs.length - 1].outline = undefined
  defs[defs.length - 1].anchor = [8, 2]

  return defs
})()
