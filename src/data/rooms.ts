// Interior floor plans. Letters mark the top-left tile of a prop's footprint.
//
// v3 rule: an interior holds a *card* and, where there is one, a *cabinet*.
// Everything else is dressing — the talking bookshelves, kettles and whiteboards
// are gone, and the props that replaced them do one of four things:
//
//   minigame:<id>     open a cabinet (wordle · claw · flappy · forge · crew)
//   panel:zone:<id>   re-read a chapter card (locked until you have won it)
//   panel:<id>        a purpose-built panel: the lift, a tool wall, the prizes
//   tree:<id>         the four objects that still have a line (only `bed` here)
import type { RoomDef, RoomPropDef } from '../world/rooms'

const rug: RoomPropDef = { sprite: 'rug_mid', flat: true }
const plant: RoomPropDef = { sprite: 'plant' }
const chairL: RoomPropDef = { sprite: 'chair_l' }
const chairR: RoomPropDef = { sprite: 'chair_r' }

export const ROOMS: Record<string, RoomDef> = {
  about: {
    id: 'about',
    name: 'The Cottage',
    floor: 'wood',
    rows: [
      'F.B...S..HD..P',
      '..........N...',
      '......t.c.....',
      '..............',
      '..............',
      '....rrr.......',
      '....rrr.......',
      '..............',
    ],
    legend: {
      // Dressing, all of it — the desk carries the chapter and the bed the one
      // joke worth keeping.
      F: { sprite: 'fireplace', w: 2, frames: 2, fps: 5, light: true },
      B: { sprite: 'bed', w: 2, h: 2, interact: 'tree:bed', prompt: 'Rest' },
      S: { sprite: 'bookshelf', w: 2 },
      H: { sprite: 'frame_photo', wall: true },
      D: { sprite: 'desk_pc', w: 2, frames: 2, fps: 2, interact: 'panel:zone:about', prompt: "Read Naman's notes" },
      N: { sprite: '', npc: 'naman', facing: 'up' },
      P: plant,
      t: { sprite: 'table', w: 2 },
      c: chairR,
      r: rug,
    },
    windows: [4, 12],
    exit: 7,
    spawn: { x: 7, y: 6 },
    music: 'interior',
  },
  experience: {
    id: 'experience',
    name: 'Barclays Tower — Lobby',
    floor: 'tile',
    rows: [
      '..E..T..a.A.b.',
      '.........R....',
      'P............P',
      '..............',
      '.....rrr......',
      '.....rrr......',
      'O.............',
      '..............',
    ],
    legend: {
      E: { sprite: 'elevator', w: 2, frames: 3, fps: 3, interact: 'panel:elevator', prompt: 'Call the elevator' },
      // The service stair is scenery now: the lift is the chapter, and the
      // chapter is won at the pier.
      T: { sprite: 'stairs', w: 2, h: 2 },
      R: { sprite: 'reception', w: 3 },
      A: { sprite: '', npc: 'ada', facing: 'down' },
      a: { sprite: 'poster_a', wall: true },
      b: { sprite: 'poster_b', wall: true },
      P: plant,
      O: { sprite: 'sofa', w: 3 },
      r: rug,
    },
    windows: [5, 7],
    windowKind: 'sky',
    exit: 6,
    spawn: { x: 6, y: 6 },
    music: 'tower',
  },
  skills: {
    id: 'skills',
    name: 'The Workshop',
    floor: 'wood',
    rows: [
      '1....2....3...',
      '..............',
      '....W.........',
      '..............',
      '..........V...',
      '..............',
      '.C..........K.',
      '..............',
    ],
    legend: {
      '1': { sprite: 'toolwall', w: 4, interact: 'panel:toolwall', data: { group: 0 }, prompt: 'Languages & frameworks' },
      '2': { sprite: 'toolwall', w: 4, interact: 'panel:toolwall', data: { group: 1 }, prompt: 'Streaming & messaging' },
      '3': { sprite: 'toolwall', w: 4, interact: 'panel:toolwall', data: { group: 2 }, prompt: 'State & tooling' },
      W: { sprite: 'workbench', w: 3, interact: 'minigame:forge', prompt: 'Spell a tool at the bench' },
      V: { sprite: '', npc: 'ravi', facing: 'down' },
      C: { sprite: 'cabinet', w: 2 },
      K: { sprite: 'whiteboard', w: 3 },
    },
    exit: 7,
    spawn: { x: 7, y: 6 },
    music: 'interior',
  },
  fair: {
    id: 'fair',
    name: "Sol's Prize Tent",
    floor: 'wood',
    rows: [
      'b..S...b...L..',
      '..............',
      '....C.........',
      '..............',
      '..............',
      '.........N....',
      '..rrr.........',
      '..rrr.........',
    ],
    legend: {
      C: { sprite: 'int_claw', w: 2, h: 3, frames: 2, fps: 2, light: true, interact: 'minigame:claw', prompt: 'Play the claw machine' },
      S: { sprite: 'int_prizeshelf', w: 3, wall: true, interact: 'panel:prizes', prompt: 'Look at the prizes' },
      b: { sprite: 'int_bunting', w: 3, wall: true },
      L: { sprite: 'int_balloons' },
      N: { sprite: '', npc: 'sol', facing: 'down' },
      r: rug,
    },
    exit: 7,
    spawn: { x: 7, y: 6 },
    music: 'interior',
  },
  stealth: {
    id: 'stealth',
    name: 'The Vault',
    floor: 'stone',
    rows: ['....X.....', '..........', '.L......L.', '..........', '..........', '..........'],
    legend: {
      X: { sprite: 'crate_covered', w: 3, h: 2, interact: 'panel:zone:stealth', prompt: 'Peek under the cloth' },
      L: { sprite: 'lamp_table', light: true },
    },
    exit: 5,
    spawn: { x: 5, y: 4 },
    music: 'interior',
  },
  safestride: {
    id: 'safestride',
    name: 'Safe Stride',
    floor: 'tile',
    rows: [
      '.M....O....a..',
      '..............',
      '....C.........',
      '..............',
      '.c......d.....',
      '..P........P..',
      '..............',
      '..............',
    ],
    legend: {
      M: { sprite: 'mapscreen', w: 2, frames: 2, fps: 2, interact: 'panel:zone:safestride', prompt: 'Check the live map' },
      // The drill button is a fitting now, not a conversation.
      O: { sprite: 'sos_button' },
      a: { sprite: 'poster_a', wall: true },
      C: { sprite: 'counter', w: 3 },
      c: chairL,
      d: chairR,
      P: plant,
    },
    windows: [3, 10],
    exit: 7,
    spawn: { x: 7, y: 6 },
    music: 'interior',
  },
  campus: {
    id: 'campus',
    name: 'SRM Campus — Lecture Hall',
    floor: 'wood',
    rows: [
      '..K..L..B.....',
      '....N.........',
      '..............',
      '..D..D..D..S..',
      '..............',
      '..D..D..D.....',
      '..............',
      '..D..D..D..S..',
      '..............',
      '..............',
    ],
    legend: {
      K: { sprite: 'prop_chalkboard', w: 2, interact: 'minigame:flappy', prompt: 'Fly the chalkboard course' },
      L: { sprite: 'int_lectern' },
      B: { sprite: 'prop_noticeboard', w: 2, interact: 'panel:zone:education', prompt: 'Read the notice board' },
      N: { sprite: '', npc: 'professor', facing: 'down' },
      D: { sprite: 'int_desk', w: 2 },
      S: { sprite: 'int_bookrow', w: 3, h: 2 },
    },
    windows: [1, 12],
    exit: 6,
    spawn: { x: 6, y: 8 },
    music: 'interior',
  },
  warehouse: {
    id: 'warehouse',
    name: 'Harbor Arcade',
    floor: 'wood',
    rows: [
      '.C..A....C..',
      '............',
      '.......M....',
      '............',
      '...P........',
      '............',
      '.........R..',
      '............',
      '............',
    ],
    legend: {
      C: { sprite: 'int_cratestack', w: 2 },
      // Taller than it is wide, like the claw: a two-by-three footprint keeps
      // the cabinet's shadow honest and leaves room to stand at it.
      A: { sprite: 'int_cabinet', w: 2, h: 3, frames: 2, fps: 2, light: true, interact: 'minigame:crew', prompt: 'Play Crew Drop' },
      P: { sprite: 'int_pallet', w: 2 },
      R: { sprite: 'int_ropecoil' },
      M: { sprite: '', npc: 'mira', facing: 'down' },
    },
    exit: 5,
    spawn: { x: 5, y: 7 },
    music: 'interior',
  },
  contact: {
    id: 'contact',
    name: 'The Lighthouse — Lamp Room',
    floor: 'stone',
    rows: ['...L....', '........', '........', 'S.......', '........', '........'],
    legend: {
      L: { sprite: 'lens', w: 2, h: 2, frames: 2, fps: 2, interact: 'tree:lens', prompt: 'The lens', light: true },
      S: { sprite: 'stairs', w: 2, h: 2 },
    },
    windows: [1, 6],
    exit: 4,
    spawn: { x: 4, y: 4 },
    music: 'interior',
  },
}
