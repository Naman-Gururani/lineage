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
  // The main quest, and the reason the fair exists. It runs from the moment you
  // step off the road, so the journal always opens on the thing you are
  // actually doing; its steps are `STORY_ORDER` (see `data/story.ts`), and every
  // one of them is credited by `GameState.unlockFacet` rather than by any stall
  // in particular. The order is a suggestion: the steps fill in whatever order
  // you find them.
  {
    id: 'story',
    title: 'Naman’s Story',
    giver: 'dockmaster',
    desc: 'Bo has the whole story to tell, a chapter at a time. Follow him from the gate to the guestbook.',
    steps: [
      { id: 'ticket', text: 'Get a ticket from Bo', target: 1 },
      { id: 'ride', text: 'Ride the Career Coaster', target: 1 },
      { id: 'prizes', text: 'Win all three prizes', target: 3 },
      { id: 'toolkit', text: 'Spell out the toolkit', target: 1 },
      { id: 'guestbook', text: 'Sign the guestbook', target: 1 },
    ],
    reward: { xp: 200, flag: 'story_done', text: 'You’ve seen the whole fair.' },
    auto: true,
  },
  {
    id: 'explore',
    title: 'Every Attraction',
    desc: 'See all eight attractions. Every one of them is a chapter of Naman’s story, or a game.',
    steps: [{ id: 'discover', text: 'Find attractions', target: 8 }],
    reward: { xp: 150, text: 'The fair remembers you.' },
    auto: true,
  },
  {
    // No giver: nobody hands this one out. It starts itself the first time you
    // pick a stub up, and the Ferris wheel is the only thing waiting on it.
    id: 'tickets',
    title: 'Lost Tickets',
    desc: 'Stubs blow all over a fairground. Gather every lost ticket and the fair will owe you a favour.',
    steps: [{ id: 'collect', text: 'Recover lost tickets', target: 20 }],
    reward: { xp: 150, flag: 'vip', text: 'A VIP stub — worth something one day.' },
    auto: true,
  },
  {
    id: 'balloons',
    title: 'Stray Balloons',
    giver: 'pip',
    desc: 'Pip minds the balloon cart, and five of her stock have got away over the lawns.',
    steps: [
      { id: 'find', text: 'Find stray balloons', target: 5 },
      { id: 'return', text: 'Bring them to Pip', target: 1 },
    ],
    reward: { xp: 60, hat: 'seashell', text: 'A party crown!' },
  },
  {
    id: 'ducks',
    title: 'Hook-a-Duck',
    giver: 'tomas',
    desc: 'Tomas will lend you the pole. Hook three ducks off the pond.',
    steps: [
      { id: 'hook', text: 'Hook ducks', target: 3 },
      { id: 'return', text: 'Show Tomas', target: 1 },
    ],
    reward: { xp: 80, text: 'The fair’s cat follows you now.' },
  },
  {
    id: 'lights',
    title: 'Lights On',
    giver: 'ilse',
    desc: 'The fair’s string lights have not been switched on all season. The switch is on the ticket booth.',
    steps: [{ id: 'switch', text: 'Throw the switch', target: 1 }],
    reward: { xp: 100, text: 'The fair lights are on.' },
  },
  // The one errand that hangs off a game. It gates no chapter — the story is
  // already spoken for — so it is handed out at the cabinet rather than started
  // for you, and `GameState.minigameWon` closes it on the winning round.
  {
    id: 'crew',
    title: 'Mira’s Dare',
    giver: 'mira',
    desc: 'Mira keeps the arcade tent at the end of the midway. Nobody has out-lasted her on the dropping floor yet.',
    steps: [{ id: 'win', text: 'Be the last bean standing', target: 1 }],
    reward: { xp: 100, hat: 'captain', text: 'A captain’s cap, and the run of the arcade.' },
  },
]
