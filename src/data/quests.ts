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
  // The main quest, and the reason the island exists. It runs from the moment
  // you land, so the journal always opens on the thing you are actually doing;
  // its steps are `STORY_ORDER` (see `data/story.ts`), and every one of them is
  // credited by `GameState.unlockFacet` rather than by any venue in particular.
  // The order is a suggestion: the steps fill in whatever order you find them.
  {
    id: 'story',
    title: 'Naman’s Story',
    giver: 'dockmaster',
    desc: 'Bo has the whole story to tell, a chapter at a time. Follow him from the pier to the lighthouse.',
    steps: [
      { id: 'meet', text: 'Meet Bo at the pier', target: 1 },
      { id: 'experience', text: 'Hear where Naman works', target: 1 },
      { id: 'projects', text: 'Win all three prizes', target: 3 },
      { id: 'education', text: 'Fly the chalkboard course', target: 1 },
      { id: 'skills', text: 'Spell out the toolkit', target: 1 },
      { id: 'contact', text: 'Send a signal from the lighthouse', target: 1 },
    ],
    reward: { xp: 200, flag: 'story_done', text: 'You’ve heard the whole story.' },
    auto: true,
  },
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
    // No giver: nobody hands this one out. It starts itself the first time you
    // pick a packet up, and the Vault door is the only thing waiting on it.
    desc: 'Motes have fallen out of the Stream. Gather every lost packet and the Vault will open.',
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
    id: 'beacon',
    title: 'Light the Beacon',
    giver: 'ilse',
    desc: 'The lighthouse has been dark for a while. Climb up and light the lens.',
    steps: [{ id: 'light', text: 'Light the lens', target: 1 }],
    reward: { xp: 100, text: 'The beam sweeps the sea again.' },
  },
  // The one errand that hangs off a game. It gates no chapter — the story is
  // already spoken for — so it is handed out at the cabinet rather than started
  // for you, and `GameState.minigameWon` closes it on the winning round.
  {
    id: 'crew',
    title: 'Mira’s Dare',
    giver: 'mira',
    desc: 'Mira keeps the arcade in the old warehouse. Nobody has out-lasted her on the dropping floor yet.',
    steps: [{ id: 'win', text: 'Be the last bean standing', target: 1 }],
    reward: { xp: 100, hat: 'captain', text: 'A captain’s cap, and the run of the arcade.' },
  },
]
