export type QuestDef = {
  id: string
  title: string
  giver?: string
  desc: string
  steps: { id: string; text: string; target: number }[]
  /** `flag` is a save flag the reward switches on — a route, a door, a shortcut. */
  reward: { xp: number; hat?: string; item?: [string, number]; flag?: string; text: string }
  auto?: boolean
}

export const QUESTS: QuestDef[] = [
  {
    id: 'explore',
    title: 'Explore Lineage Isle',
    desc: 'Eight landmarks hold eight parts of Naman’s story. Find them all.',
    steps: [{ id: 'discover', text: 'Discover landmarks', target: 8 }],
    reward: { xp: 150, text: 'The island remembers you.' },
    auto: true,
  },
  {
    id: 'packets',
    title: 'Lost Packets',
    giver: 'sol',
    desc: 'Motes have fallen out of the Stream. Return every lost packet to the Engine.',
    steps: [{ id: 'collect', text: 'Recover packets', target: 20 }],
    reward: { xp: 120, text: 'The Vault unseals.' },
    auto: true,
  },
  {
    id: 'shells',
    title: 'Shell Seeker',
    giver: 'pip',
    desc: 'Pip wants five perfect shells from the harbor beach.',
    steps: [
      { id: 'find', text: 'Find shells', target: 5 },
      { id: 'return', text: 'Bring them to Pip', target: 1 },
    ],
    reward: { xp: 60, hat: 'seashell', text: 'A seashell hat!' },
  },
  {
    id: 'fishing',
    title: 'Gone Fishing',
    giver: 'tomas',
    desc: 'Tomas will lend you his rod. Catch three fish off the pier.',
    steps: [
      { id: 'catch', text: 'Catch fish', target: 3 },
      { id: 'return', text: 'Show Tomas', target: 1 },
    ],
    reward: { xp: 80, text: 'Byte the cat follows you now.' },
  },
  {
    id: 'gear',
    title: 'Spare Parts',
    giver: 'ravi',
    desc: 'Ravi needs a spare gear. Sol at the Engine Works might have one.',
    steps: [
      { id: 'gear', text: 'Find a spare gear', target: 1 },
      { id: 'return', text: 'Bring it to Ravi', target: 1 },
    ],
    reward: { xp: 70, hat: 'hardhat', text: 'A hard hat, for safety.' },
  },
  {
    id: 'beacon',
    title: 'Light the Beacon',
    giver: 'ilse',
    desc: 'The lighthouse has been dark for a while. Climb up and light the lens.',
    steps: [{ id: 'light', text: 'Light the lens', target: 1 }],
    reward: { xp: 100, text: 'The beam sweeps the sea again.' },
  },
  // The four arcade errands. Each shares its id with the mini-game it belongs to
  // — that is the whole hook-up: `GameState.minigamePlayed` looks a quest up by
  // the game's own id and moves its single step to the score the round reached.
  // None of them is `auto`: the cabinet hands the errand out the first time you
  // sit down at it, so the journal never opens on four games you have not found.
  {
    id: 'studyhall',
    title: 'Lights Out',
    giver: 'professor',
    desc: 'Prof. Iyer left the chalkboard lit. Five boards, and every light off by the end of office hours.',
    steps: [{ id: 'boards', text: 'Clear boards', target: 5 }],
    reward: { xp: 90, hat: 'grad', text: 'A graduation cap, at a hard-earned angle.' },
  },
  {
    id: 'cargo',
    title: 'Dock Work',
    giver: 'dockmaster',
    desc: 'Dockmaster Bo has six pallets in the wrong places. Push every crate onto its mark.',
    steps: [{ id: 'levels', text: 'Clear pallets', target: 6 }],
    reward: { xp: 100, hat: 'captain', text: "A captain's cap, and the run of the warehouse." },
  },
  {
    id: 'packetrush',
    title: 'Packet Rush',
    giver: 'sol',
    desc: 'Sol will run the Stream hot and let you catch what falls out of it. Score thirty.',
    steps: [{ id: 'score', text: 'Score', target: 30 }],
    reward: { xp: 110, hat: 'goggles', text: 'Engine goggles — and 5 packets recovered from the run.' },
  },
  {
    id: 'climb',
    title: 'The Long Way Up',
    giver: 'ada',
    desc: 'Ada says nobody has taken the tower scaffold to the roof. The lift is out. Prove her wrong.',
    steps: [{ id: 'roof', text: 'Reach the roof', target: 1 }],
    // The flag is what puts the Tower Express on the map (see `ui/map.ts`). The
    // line promises only the route: Ravi's errand may already have paid the hard
    // hat, and the wardrobe announces that one itself when it is genuinely new.
    reward: { xp: 120, hat: 'hardhat', flag: 'tower_express', text: 'Tower Express unlocked — the roof is one hop away.' },
  },
]
