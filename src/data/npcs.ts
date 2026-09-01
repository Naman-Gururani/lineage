// Dialogue scripts for every villager and talkable object on Lineage Isle.
// Facts about Naman come ONLY from data/content.ts — nothing here invents any.
// The in-development product (the Vault) stays unnamed and abstract.
// Registered at startup via registerTrees(NPC_TREES, NPC_INFO).
import type { Emote, Line, Tree } from '../systems/Dialogue'

export const NPC_INFO: Record<string, { name: string; face: string }> = {
  mira: { name: 'Captain Mira', face: 'face_mira' },
  tomas: { name: 'Old Tomas', face: 'face_tomas' },
  pip: { name: 'Pip', face: 'face_pip' },
  lou: { name: 'Baker Lou', face: 'face_lou' },
  ada: { name: 'Ada', face: 'face_ada' },
  ravi: { name: 'Tinker Ravi', face: 'face_ravi' },
  sol: { name: 'Operator Sol', face: 'face_sol' },
  devi: { name: 'Nana Devi', face: 'face_devi' },
  arjun: { name: 'Arjun', face: 'face_arjun' },
  ilse: { name: 'Keeper Ilse', face: 'face_ilse' },
  naman: { name: 'Naman', face: 'face_naman' },
  cat: { name: 'Byte', face: 'face_cat' },
}

type Say = (text: string, emote?: Emote) => Line

/** Lines spoken by a cast member: their display name + portrait on every line. */
function voice(id: string): Say {
  const { name, face } = NPC_INFO[id]
  return (text, emote) => (emote ? { who: name, text, face, emote } : { who: name, text, face })
}

/** Lines "spoken" by an object: a plain nameplate, no portrait. */
function object(who: string): Say {
  return (text, emote) => (emote ? { who, text, emote } : { who, text })
}

/* ================================================================== */
/* The harbor                                                          */
/* ================================================================== */

const mira: Tree = (() => {
  const s = voice('mira')
  return {
    id: 'mira',
    entry: [
      { when: { notFlag: 'metMira' }, node: 'welcome' },
      { when: { questDone: 'beacon' }, node: 'beam' },
      { node: 'again' },
    ],
    nodes: {
      welcome: {
        lines: [
          s("Welcome to Lineage Isle! Captain Mira, harbor master. Only passenger today, so you're my favourite.", 'happy'),
          s("Naman's expecting you. Well — he's expecting someone. Let's make it you."),
        ],
        effects: [{ setFlag: 'metMira' }, { setFlag: 'met_mira' }, { xp: 10 }],
        next: 'tutorial',
      },
      tutorial: {
        lines: [
          s('Quick drill: WASD or the arrows to walk. Hold Shift to run — the island is bigger than it looks.'),
          s('E talks, opens, reads. With nothing about, it swings — good for tall grass, less good for signposts.'),
          s("Esc is the menu. M is the map — it can ferry you back to anywhere you've already found."),
        ],
        next: 'go',
      },
      go: {
        lines: [s("The road runs up to the village plaza. Naman's Cottage sits at the top of it. Off you go.", 'happy')],
      },
      beam: {
        lines: [
          s('The beam is back! Was that you? First light on the Point in an age.', 'happy'),
          s('Ships can find the harbor again. So can everyone else — that is rather the idea.'),
        ],
        next: 'again',
      },
      again: {
        lines: [s('Back on dry land? Where to?')],
        choices: [
          { text: "Where's Naman?", next: 'cottage' },
          { text: "What's out there?", next: 'around' },
          { text: 'Controls again?', next: 'tutorial' },
          { text: 'Just passing', next: 'bye' },
        ],
      },
      cottage: {
        lines: [
          s("Up the road, top of the plaza — the Cottage. He's usually at his desk. Knock; he likes visitors."),
          s('Mind Byte. The cat. It has opinions about strangers, and stronger ones about friends.', 'wink'),
        ],
        next: 'again',
      },
      around: {
        lines: [
          s('Barclays Tower is up on the Heights, north-west. The Workshop is in the Woods, north-east.'),
          s('The Engine sits south-west, where the Stream meets the sea. Safe Stride is in the Fields, south-east.'),
          s('The Vault is up on the Ridge, north. The Lighthouse is out on the Point. Signposts do the rest.'),
        ],
        next: 'again',
      },
      bye: {
        lines: [s("Fair winds. Shout if you get lost — I'll hear you from the Ridge.")],
      },
    },
  }
})()

const tomas: Tree = (() => {
  const s = voice('tomas')
  return {
    id: 'tomas',
    entry: [
      { when: { notFlag: 'met_tomas' }, node: 'hello' },
      { when: { questDone: 'fishing' }, node: 'done' },
      { when: { questActive: 'fishing', item: ['fish', 3] }, node: 'turnin' },
      { when: { questActive: 'fishing' }, node: 'reminder' },
      { node: 'offer' },
    ],
    nodes: {
      hello: {
        lines: [
          s('Mm. New face. Sit if you like — the sea does not mind.', 'think'),
          s('Tomas. Fished off this pier since before it was a pier.'),
        ],
        effects: [{ setFlag: 'met_tomas' }, { xp: 5 }],
        next: 'offer',
      },
      offer: {
        lines: [s("Tide's right and I've a spare rod. Three fish would make a supper. Fancy it?")],
        choices: [
          { text: 'Lend me the rod', next: 'accept' },
          { text: 'Another time', next: 'later' },
        ],
      },
      accept: {
        lines: [
          s('Good. End of the pier: press E and wait. The waiting is the point. Then the tug — that is the fish.', 'happy'),
          s('Byte will watch you. Byte always watches.'),
        ],
        effects: [{ startQuest: 'fishing' }],
      },
      later: {
        lines: [s('The sea is patient. So am I. Mostly.')],
      },
      reminder: {
        lines: [s('End of the pier. Press E, wait for the tug, press again. Three is the number.')],
      },
      turnin: {
        lines: [
          s('Three! Fat ones, too.', 'happy'),
          s("Byte has been circling your ankles since the second fish. You've been adopted, I'd say."),
          s('Go on, then. Cats know.'),
        ],
        effects: [{ take: ['fish', 3] }, { advanceQuest: ['fishing', 'return', 1] }, { companion: true }],
        effectsAtEnd: true,
      },
      done: {
        lines: [
          s('Byte still with you? Thought so. Cats know.'),
          s('Come sit some time. The sea tells its stories slow.'),
        ],
      },
    },
  }
})()

const pip: Tree = (() => {
  const s = voice('pip')
  return {
    id: 'pip',
    entry: [
      { when: { notFlag: 'met_pip' }, node: 'hello' },
      { when: { questDone: 'shells' }, node: 'done' },
      { when: { questActive: 'shells', item: ['shell', 5] }, node: 'turnin' },
      { when: { questActive: 'shells' }, node: 'reminder' },
      { node: 'offer' },
    ],
    nodes: {
      hello: {
        lines: [
          s('Hi! Hi! Are you the boat person? You ARE the boat person!', 'shout'),
          s("I'm Pip. I collect shells. I've got loads, but none of them are the good ones.", 'sad'),
        ],
        effects: [{ setFlag: 'met_pip' }, { xp: 5 }],
        next: 'offer',
      },
      offer: {
        lines: [s('Five good ones are down the beach — the shiny, sticky-out ones. Find them for me?')],
        choices: [
          { text: "I'll find them", next: 'accept' },
          { text: 'Not now', next: 'later' },
        ],
      },
      accept: {
        lines: [s('YES. Five! The beach runs both ways from the dock. The good ones sparkle!', 'happy')],
        effects: [{ startQuest: 'shells' }],
      },
      later: {
        lines: [s('Okay. But the tide might take them first. Just saying.', 'sad')],
      },
      reminder: {
        lines: [s('Five shells! The sparkly ones! Along the beach! I believe in you!', 'shout')],
      },
      turnin: {
        lines: [
          s('Five! FIVE! These are the best ones anyone has ever found!', 'shout'),
          s("I made you something. It's a hat. It's mostly shells. Wear it always.", 'happy'),
        ],
        effects: [{ take: ['shell', 5] }, { advanceQuest: ['shells', 'return', 1] }],
        effectsAtEnd: true,
      },
      done: {
        lines: [s("Still got the hat? You don't have to wear the hat. Please wear the hat.", 'wink')],
      },
    },
  }
})()

/* ================================================================== */
/* The plaza                                                           */
/* ================================================================== */

const lou: Tree = (() => {
  const s = voice('lou')
  return {
    id: 'lou',
    entry: [
      { when: { notFlag: 'met_lou' }, node: 'hello' },
      { node: 'again' },
    ],
    nodes: {
      hello: {
        lines: [s('Morning! Or whatever it is. Lou — baker, and the news, if you want it.', 'happy')],
        effects: [{ setFlag: 'met_lou' }, { xp: 5 }],
        next: 'hub',
      },
      again: {
        lines: [s('Back for a bun, or back for the news?')],
        next: 'hub',
      },
      hub: {
        lines: [s("What'll it be?")],
        choices: [
          { text: 'Any gossip?', next: 'gossip' },
          { text: 'Anything about the Vault?', next: 'vault', when: { discovered: 'stealth' } },
          { text: "What's fresh?", next: 'fresh' },
          { text: 'Just browsing', next: 'bye' },
        ],
      },
      gossip: {
        lines: [
          s("Pip wants shells, Tomas wants company, and the cat wants Tomas's fish. Everyone wants something."),
          s("Ravi has lost a gear again. Sol keeps a drawer of them at the Engine. Draw your own conclusions.", 'wink'),
          s("And there's a telescope on the Heights, out past the tower. You didn't hear that from me."),
        ],
        next: 'hub',
      },
      vault: {
        lines: [
          s('The sealed door on the Ridge? It counts packets — the little motes that fall out of the Stream.'),
          s('Twenty, all told. They turn up in tall grass and old chests. Swing at everything, that is my policy.'),
        ],
        next: 'hub',
      },
      fresh: {
        lines: [
          s("Buns. Loaves. And a 'stream cake' — it's a swiss roll, but don't tell Naman that.", 'wink'),
          s('Rumours come free with every bun. Sometimes without.'),
        ],
        next: 'hub',
      },
      bye: {
        lines: [s('Mind how you go. The Cottage is up the road, if you are after the man himself.')],
      },
    },
  }
})()

/* ================================================================== */
/* Barclays Tower                                                      */
/* ================================================================== */

const ada: Tree = (() => {
  const s = voice('ada')
  return {
    id: 'ada',
    entry: [
      { when: { notFlag: 'met_ada' }, node: 'hello' },
      { node: 'again' },
    ],
    nodes: {
      hello: {
        lines: [
          s('Good day. Barclays Tower reception — Ada. The lift is the only way up, and the floors tell the story.'),
          s('Please do not touch the plant.'),
        ],
        effects: [{ setFlag: 'met_ada' }, { xp: 5 }],
        next: 'hub',
      },
      again: {
        lines: [s('Back again. The lift is where you left it.')],
        next: 'hub',
      },
      hub: {
        lines: [s('How can I help?')],
        choices: [
          { text: "What's on each floor?", next: 'floors' },
          { text: 'What does he do here?', next: 'work' },
          { text: 'Thanks', next: 'bye' },
        ],
      },
      floors: {
        lines: [
          s('Floor one: the 2023 summer internship. DevOps — process exceptions into an analyst portal, in real time.'),
          s('Floor two: Software Development Engineer, August 2024 to now. The Stream starts on that floor.'),
          s('The roof: the stack. Flink, Kafka, Kafka Streams, Redis, DynamoDB, IBM MQ. Mind the wind.'),
        ],
        next: 'hub',
      },
      work: {
        lines: [
          s('He takes the raw streams — Kafka, IBM MQ — and makes events trustworthy. Tokenised, classified, mapped.'),
          s("Then the lineage engine: every payment's full path, stitched hop by hop. Around 750 million records a day."),
          s('The intern summer: Python and KornShell over Teradata, behind an OAuth 2.0 API. Eight hours to real time.'),
        ],
        next: 'hub',
      },
      bye: {
        lines: [s('The lift is to your left. Ground floor is where you are. It usually is.')],
      },
    },
  }
})()

/* ================================================================== */
/* The Workshop and the Engine                                         */
/* ================================================================== */

const ravi: Tree = (() => {
  const s = voice('ravi')
  return {
    id: 'ravi',
    entry: [
      { when: { notFlag: 'met_ravi' }, node: 'hello' },
      { when: { questDone: 'gear' }, node: 'done' },
      { when: { questActive: 'gear', item: ['gear', 1] }, node: 'turnin' },
      { when: { questActive: 'gear' }, node: 'reminder' },
      { node: 'offer' },
    ],
    nodes: {
      hello: {
        lines: [
          s('Careful — every tool on that wall has a place, and every place has a label. Ravi. I keep the Workshop.'),
          s("Languages on the left, streaming in the middle, state and tooling on the right. Naman's kit, sorted."),
        ],
        effects: [{ setFlag: 'met_ravi' }, { xp: 5 }],
        next: 'offer',
      },
      offer: {
        lines: [
          s("Now — the windmill has dropped a gear, and I've none spare. Sol at the Engine Works keeps a drawer of them."),
          s("Fetch me one? South-west, over the lower bridge. There's something for your head in it."),
        ],
        choices: [
          { text: "I'll find one", next: 'accept' },
          { text: 'Maybe later', next: 'later' },
        ],
      },
      accept: {
        lines: [s("Splendid. Tell Sol it's for the windmill, not the Engine. Sol is particular about the Engine.", 'happy')],
        effects: [{ startQuest: 'gear' }],
      },
      later: {
        lines: [s('The windmill can wait. It is very good at waiting. Round and round, except not.', 'think')],
      },
      reminder: {
        lines: [s("Sol, at the Engine Works. South-west, past the lower bridge. Say it's for the windmill.")],
      },
      turnin: {
        lines: [
          s("That's the one! Once it's in, you'll hear the windmill all the way from the plaza.", 'happy'),
          s('Hard hat, as promised. Safety first, spec second, code a distant third.'),
        ],
        effects: [{ take: ['gear', 1] }, { advanceQuest: ['gear', 'return', 1] }],
        effectsAtEnd: true,
      },
      done: {
        lines: [
          s('The windmill turns, the hat fits. All is well.', 'happy'),
          s('You know how he works? Spec first — a precise written spec is the contract.'),
          s('Then the AI turns that intent into correct, reviewable code. Tidy. Like a good bench.'),
        ],
      },
    },
  }
})()

const sol: Tree = (() => {
  const s = voice('sol')
  return {
    id: 'sol',
    entry: [
      { when: { notFlag: 'met_sol' }, node: 'hello' },
      { when: { questActive: 'gear', notFlag: 'gotGear' }, node: 'gear' },
      { when: { packets: 20 }, node: 'all' },
      { when: { packets: 10 }, node: 'half' },
      { node: 'some' },
    ],
    nodes: {
      hello: {
        lines: [
          s("Mind the pipes — they're warm. Sol. I keep the Engine fed, and the Engine keeps the Stream honest."),
          s('Every mote out there came from one place and goes to one place. The Engine stitches those links into a path.'),
        ],
        effects: [{ setFlag: 'met_sol' }, { xp: 5 }],
        next: 'hub',
      },
      gear: {
        lines: [
          s("Ravi's windmill again? Here — a spare gear. Cleaned it myself, so don't drop it in the Stream."),
          s("Tell Ravi the Engine's gears are the Engine's. This one is the last freebie.", 'wink'),
        ],
        effects: [{ give: ['gear', 1] }, { setFlag: 'gotGear' }, { advanceQuest: ['gear', 'gear', 1] }],
        next: 'hub',
      },
      all: {
        lines: [
          s('Twenty of twenty! Every lost mote home. The Stream runs clean, end to end.', 'happy'),
          s('Go and look at the Ridge. That door has been waiting for you.'),
        ],
        next: 'hub',
      },
      half: {
        lines: [s('Half the lost motes are back already. Fewer gaps in the path — the Stream looks healthier.', 'happy')],
        next: 'hub',
      },
      some: {
        lines: [s('Motes keep falling out of the Stream. They hide — tall grass, old chests, odd corners.', 'think')],
        next: 'hub',
      },
      hub: {
        lines: [s('Anything else?')],
        choices: [
          { text: 'Ravi sent me for a gear', next: 'gear', when: { questActive: 'gear', notFlag: 'gotGear' } },
          { text: 'What is the Stream?', next: 'stream' },
          { text: "What's a lost packet?", next: 'lost' },
          { text: "That's all", next: 'bye' },
        ],
      },
      stream: {
        lines: [
          s("Naman's real-time streams. Events come off Kafka and IBM MQ and get made trustworthy before they move on."),
          s('The Engine is his lineage engine: the full path of every payment across decoupled systems.'),
          s('Each hop: one upstream, one downstream. About 750 million records a day, stitched into paths.'),
        ],
        next: 'hub',
      },
      lost: {
        lines: [
          s("A packet is a mote that fell out of the Stream. A gap in a path. The Engine can't stitch what isn't there."),
          s("Twenty are out there. Bring them all home and the Ridge door unseals. Don't ask me how it knows. It knows."),
        ],
        next: 'hub',
      },
      bye: {
        lines: [s('Mind the pipes on the way out. Still warm.')],
      },
    },
  }
})()

/* ================================================================== */
/* Willow Fields                                                       */
/* ================================================================== */

const devi: Tree = (() => {
  const s = voice('devi')
  return {
    id: 'devi',
    entry: [
      { when: { notFlag: 'met_devi' }, node: 'hello' },
      { node: 'again' },
    ],
    nodes: {
      hello: {
        lines: [s("Oh, hello dear. Come in out of the wind. I'm Devi — everyone says Nana, so you may as well.", 'happy')],
        effects: [{ setFlag: 'met_devi' }, { xp: 5 }],
        next: 'hub',
      },
      again: {
        lines: [s('Hello again, dear. Arjun is about somewhere, worrying beautifully.')],
        next: 'hub',
      },
      hub: {
        lines: [s('Was there something?')],
        choices: [
          { text: "What's on your wrist?", next: 'tracker' },
          { text: 'Are you alright out here?', next: 'alright' },
          { text: 'Take care, Nana', next: 'bye' },
        ],
      },
      tracker: {
        lines: [
          s('This? Safe Stride. It knows where I am, and it knows if I fall — something about an accelerometer.'),
          s('If I go down, it sends the SOS itself and shows Arjun where to run. On a little live map.'),
          s("I've tested it once. On purpose. Don't tell him.", 'wink'),
        ],
        next: 'hub',
      },
      alright: {
        lines: [
          s('Quite alright. I have the garden, the pond, and a grandson who visits twice as often as he used to.'),
          s('Naman built it for people like me. Sensors, tracking, a button that shouts for you. Clever lad.', 'happy'),
        ],
        next: 'hub',
      },
      bye: {
        lines: [s("Go carefully, dear. And tell Arjun I haven't fallen over. Today.", 'wink')],
      },
    },
  }
})()

const arjun: Tree = (() => {
  const s = voice('arjun')
  return {
    id: 'arjun',
    entry: [
      { when: { notFlag: 'met_arjun' }, node: 'hello' },
      { node: 'again' },
    ],
    nodes: {
      hello: {
        lines: [
          s("You've met Nana? Good. Arjun. I didn't build any of it — I just worry less now."),
          s('Fall detection, live map, an SOS that sends itself. I used to ring her every hour. Now I just visit.'),
        ],
        effects: [{ setFlag: 'met_arjun' }, { xp: 5 }],
      },
      again: {
        lines: [
          s('She showed you the button, didn\'t she. She loves the button.', 'think'),
          s('The SOS goes to emergency services first, then to me. In that order. The right order.'),
        ],
      },
    },
  }
})()

/* ================================================================== */
/* The Point                                                           */
/* ================================================================== */

const ilse: Tree = (() => {
  const s = voice('ilse')
  return {
    id: 'ilse',
    entry: [
      { when: { notFlag: 'met_ilse' }, node: 'hello' },
      { when: { questDone: 'beacon' }, node: 'proud' },
      { when: { questActive: 'beacon' }, node: 'active' },
      { node: 'offer' },
    ],
    nodes: {
      hello: {
        lines: [s('Keeper Ilse. I keep the lighthouse. Technically I keep the stairs — the light has been out a while.')],
        effects: [{ setFlag: 'met_ilse' }, { xp: 5 }],
        next: 'offer',
      },
      offer: {
        lines: [
          s('The lens is up top, cold as a fish. Climb up and light it, and the whole sea can find this island again.'),
          s("Naman's out there somewhere too. A lit beacon says: come and say hello."),
        ],
        choices: [
          { text: "I'll light it", next: 'accept' },
          { text: 'Later', next: 'later' },
        ],
      },
      accept: {
        lines: [s("Good. Stairs inside, lens at the top — press E at the glass. Don't fall. The paperwork is unbearable.")],
        effects: [{ startQuest: 'beacon' }],
      },
      later: {
        lines: [s('Suit yourself. The dark is not going anywhere. That is rather the problem with it.', 'think')],
      },
      active: {
        lines: [s('Lens is up top. Stairs are inside. Press E at the glass. I counted the steps once: too many.')],
      },
      proud: {
        lines: [
          s('Look at it go. Round and round, all night. I had forgotten the sound of it.', 'happy'),
          s('Anyone who wants to reach Naman knows where to look now. That is the whole trick of a lighthouse.'),
          s("Keeper. That's what they'll call you. I'll allow it.", 'wink'),
        ],
      },
    },
  }
})()

/* ================================================================== */
/* Naman, at his desk in the Cottage                                   */
/* ================================================================== */

const naman: Tree = (() => {
  const s = voice('naman')
  return {
    id: 'naman',
    entry: [
      { when: { notFlag: 'metNaman' }, node: 'hello' },
      { node: 'again' },
    ],
    nodes: {
      hello: {
        lines: [
          s('Oh — hello! You made it. Mira said the boat had someone aboard.', 'happy'),
          s("I'm Naman. This is my desk, and that is Byte, pretending not to notice you."),
        ],
        effects: [{ setFlag: 'metNaman' }, { setFlag: 'met_naman' }, { xp: 20 }],
        next: 'menu',
      },
      again: {
        lines: [s("Welcome back. The kettle's on. In theory.", 'happy')],
        next: 'menu',
      },
      menu: {
        lines: [s('What would you like to know?')],
        choices: [
          { text: 'Who are you?', next: 'who' },
          { text: 'What do you work on?', next: 'work' },
          { text: 'How do you work?', next: 'how' },
          { text: 'Show me your notes', next: 'notes' },
          { text: 'Just saying hi', next: 'hi' },
          { text: 'See you around', next: 'bye' },
        ],
      },
      who: {
        lines: [
          s('Naman Gururani — Software Development Engineer at Barclays, since August 2024.'),
          s('Before that: B.Tech in Computer Science at SRM IST, 2020 to 2024. CGPA 9.57. I checked twice.', 'wink'),
          s('I like the unglamorous backbone — pipelines, guarantees, the lineage that lets a number be believed.'),
        ],
        next: 'menu',
      },
      work: {
        lines: [
          s('Real-time streams. Events arrive off Apache Kafka and IBM MQ, and I make them worth trusting.'),
          s('The big one is a payment lineage engine — the full path of every payment across decoupled systems.'),
          s('Each hop: one upstream, one downstream. Stitched into whole stories, 750 million records a day.'),
        ],
        next: 'menu',
      },
      how: {
        lines: [
          s('Spec first. A precise written spec is the contract.', 'think'),
          s('Then AI is the force-multiplier — it turns intent into correct, reviewable implementation.'),
          s('Ravi keeps the whole tool wall at the Workshop, if you want the inventory.'),
        ],
        next: 'menu',
      },
      notes: {
        lines: [s('Here — the short version. I keep it pinned above the desk.')],
        effects: [{ panel: 'zone:about' }],
        effectsAtEnd: true,
      },
      hi: {
        lines: [
          s("Hi! Thanks for coming all the way up. Most visitors get waylaid by Lou's buns.", 'happy'),
          s("Poke around. The island is small, but it hides things. Byte knows where. Byte won't say."),
        ],
        next: 'menu',
      },
      bye: {
        lines: [s('See you around. If you ever need me, the Lighthouse knows how to reach me.', 'wink')],
      },
    },
  }
})()

const cat: Tree = (() => {
  const s = voice('cat')
  return {
    id: 'cat',
    entry: [
      { when: { notFlag: 'met_cat' }, node: 'first' },
      { when: { night: true }, node: 'night' },
      { when: { questDone: 'fishing' }, node: 'friend' },
      { node: 'meow' },
    ],
    nodes: {
      first: {
        lines: [s('Mrow?'), s('(Byte looks at you. Byte looks away. You have been assessed.)')],
        effects: [{ setFlag: 'met_cat' }, { xp: 5 }],
      },
      night: {
        lines: [s('Mrrp... (Byte is a loaf. One eye opens, then shuts. Business hours are over.)')],
      },
      friend: {
        lines: [s("Prrrrp. (Byte winds round your ankles. You are the fish person now. It's official.)", 'happy')],
      },
      meow: {
        lines: [s('Meow. (Byte regards you. It could yet go either way.)')],
      },
    },
  }
})()

/* ================================================================== */
/* Objects — the Cottage                                               */
/* ================================================================== */

const bookshelf: Tree = (() => {
  const s = object('Bookshelf')
  return {
    id: 'bookshelf',
    entry: [{ node: 'read' }],
    nodes: {
      read: {
        lines: [
          s('Textbooks, mostly. A B.Tech in Computer Science — SRM IST, 2020 to 2024.'),
          s("One spine reads 'CGPA 9.57 / 10'. Somebody underlined it. Twice."),
          s("A row of notebooks, each one a spec. Not one of them says 'TODO'."),
        ],
      },
    },
  }
})()

const bed: Tree = (() => {
  const s = object('Bed')
  return {
    id: 'bed',
    entry: [{ node: 'ask' }],
    nodes: {
      ask: {
        lines: [s('The bed looks extremely sleepable. Sleep?')],
        choices: [
          { text: 'Sleep till morning', next: 'morning' },
          { text: 'Nap till night', next: 'night' },
          { text: 'Never mind', next: 'no' },
        ],
      },
      morning: {
        lines: [s('You sleep. Morning arrives, as it does. Gulls, mostly.')],
        effects: [{ sleep: 'morning' }],
        effectsAtEnd: true,
      },
      night: {
        lines: [s('You doze off. When you wake, the lamps are on and the fireflies are out.')],
        effects: [{ sleep: 'night' }],
        effectsAtEnd: true,
      },
      no: {
        lines: [s('Not tired. Fair. The island is not going anywhere.')],
      },
    },
  }
})()

const photo: Tree = (() => {
  const s = object('Photo')
  return {
    id: 'photo',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [s('A framed photo: the harbor at dusk, the beacon lit. Somebody was happy with this one.')],
      },
    },
  }
})()

const fireplace: Tree = (() => {
  const s = object('Fireplace')
  return {
    id: 'fireplace',
    entry: [{ node: 'warm' }],
    nodes: {
      warm: {
        lines: [s('The fire pops and settles. The warmth reaches exactly as far as the desk chair.')],
      },
    },
  }
})()

const kettle: Tree = (() => {
  const s = object('Kettle')
  return {
    id: 'kettle',
    entry: [{ node: 'tea' }],
    nodes: {
      tea: {
        lines: [s("Just off the boil. It has been 'just off the boil' all day. Schrödinger's tea.")],
      },
    },
  }
})()

/* ================================================================== */
/* Objects — the Workshop                                              */
/* ================================================================== */

const workbench: Tree = (() => {
  const s = object('Workbench')
  return {
    id: 'workbench',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [s('A written spec lies clamped flat where the vice should be. The contract comes first; the sawdust later.')],
      },
    },
  }
})()

const whiteboard: Tree = (() => {
  const s = object('Whiteboard')
  return {
    id: 'whiteboard',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [s('Boxes and arrows. Every arrow has exactly one start and one end. Someone was very firm about it.')],
      },
    },
  }
})()

/* ================================================================== */
/* Objects — Safe Stride, the Lighthouse, the Vault                    */
/* ================================================================== */

const sos: Tree = (() => {
  const s = object('SOS Button')
  return {
    id: 'sos',
    entry: [{ node: 'read' }],
    nodes: {
      read: {
        lines: [
          s("A big red button behind glass. Safe Stride's SOS — it fires on its own when a fall is detected."),
          s('An accelerometer feels the fall; the app calls emergency services and pins the spot on a live map.'),
          s("Best left unpressed. It's wired to people who would come running."),
        ],
      },
    },
  }
})()

const lens: Tree = (() => {
  const s = object('The Lens')
  return {
    id: 'lens',
    entry: [
      { when: { questDone: 'beacon' }, node: 'lit' },
      { when: { questActive: 'beacon' }, node: 'ready' },
      { node: 'dark' },
    ],
    nodes: {
      lit: {
        lines: [s('The lens hums, warm as a kettle. The beam swings out over the sea, round and round.')],
      },
      ready: {
        lines: [s('The great lens. Cold, dark, patient. There is a lever, and the lever wants pulling.')],
        choices: [
          { text: 'Light the lens', next: 'light' },
          { text: 'Not yet', next: 'wait' },
        ],
      },
      light: {
        lines: [s('You pull the lever. Somewhere below, something enormous clears its throat.')],
        effects: [{ cutscene: 'beacon' }],
        effectsAtEnd: true,
      },
      wait: {
        lines: [s('The lens waits. It has had practice.')],
      },
      dark: {
        lines: [s('A great glass lens, cold and dark. Keeper Ilse, down at the door, would know about lighting it.')],
      },
    },
  }
})()

const vault_door: Tree = (() => {
  const s = object('Vault Door')
  return {
    id: 'vault_door',
    entry: [
      { when: { packets: 20 }, node: 'open' },
      { node: 'sealed' },
    ],
    nodes: {
      sealed: {
        lines: [
          s('A door in the cliff, sealed tight. The seal reads: packets recovered. It wants all twenty.'),
          s('Lost motes hide in tall grass, old chests and odd corners. Sol, at the Engine, keeps count.'),
        ],
      },
      open: {
        lines: [
          s('Twenty of twenty. The seal clicks. The door grinds open.'),
          s("Inside: a workbench, a covered prototype, and a note — 'details under wraps for now'."),
        ],
        effects: [{ panel: 'zone:stealth' }],
        effectsAtEnd: true,
      },
    },
  }
})()

/* ================================================================== */
/* Objects — out on the island                                         */
/* ================================================================== */

const telescope: Tree = (() => {
  const s = object('Telescope')
  return {
    id: 'telescope',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [
          s('The whole island, edge to edge. The Stream glitters all the way down to the sea.'),
          s('You can see the Lighthouse from here. On a clear day, the Lighthouse can see you.'),
        ],
        effects: [{ achievement: 'summit' }],
      },
    },
  }
})()

const fountain: Tree = (() => {
  const s = object('Fountain')
  return {
    id: 'fountain',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [
          s('Coins shine on the bottom. Somebody wished for exactly-once delivery.'),
          s('The water goes round and round and never loses a drop. Sol would approve.'),
        ],
      },
    },
  }
})()

const well: Tree = (() => {
  const s = object('Well')
  return {
    id: 'well',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [s('Deep. You drop a pebble and count to four. Nothing yet.'), s("A note on the bucket: 'NOT a data lake.'")],
      },
    },
  }
})()

const stall: Tree = (() => {
  const s = object("Lou's Stall")
  return {
    id: 'stall',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [
          s("Buns, loaves, and a tray of something golden. A chalkboard: 'Rumours free with every bun.'"),
          s('Lou is watching you not buy a bun.'),
        ],
      },
    },
  }
})()

const boat: Tree = (() => {
  const s = object('Boat')
  return {
    id: 'boat',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [s('The boat that brought you here. It bobs. It waits.'), s('It is not leaving without you. That is the contract.')],
      },
    },
  }
})()

const mailbox: Tree = (() => {
  const s = object('Mailbox')
  return {
    id: 'mailbox',
    entry: [{ node: 'look' }],
    nodes: {
      look: {
        lines: [s('No new mail. The Stream delivers faster anyway.')],
      },
    },
  }
})()

const bell: Tree = (() => {
  const s = object('Bell')
  return {
    id: 'bell',
    entry: [{ node: 'ring' }],
    nodes: {
      ring: {
        lines: [s('CLANG.'), s('The gulls file a formal complaint.')],
        effects: [{ sfx: 'bell' }],
      },
    },
  }
})()

/* ================================================================== */

export const NPC_TREES: Record<string, Tree> = {
  mira,
  tomas,
  pip,
  lou,
  ada,
  ravi,
  sol,
  devi,
  arjun,
  ilse,
  naman,
  cat,
  bookshelf,
  bed,
  photo,
  fireplace,
  kettle,
  workbench,
  whiteboard,
  sos,
  lens,
  vault_door,
  telescope,
  fountain,
  well,
  stall,
  boat,
  mailbox,
  bell,
}
