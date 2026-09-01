export type QuestDef = {
  id: string
  title: string
  giver?: string
  desc: string
  steps: { id: string; text: string; target: number }[]
  reward: { xp: number; hat?: string; item?: [string, number]; text: string }
  auto?: boolean
}

export const QUESTS: QuestDef[] = [
  {
    id: 'explore',
    title: 'Explore Lineage Isle',
    desc: 'Seven landmarks hold seven parts of Naman’s story. Find them all.',
    steps: [{ id: 'discover', text: 'Discover landmarks', target: 7 }],
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
]
