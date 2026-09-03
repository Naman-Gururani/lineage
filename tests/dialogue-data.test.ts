// The dialogue budget, enforced.
//
// v4 ("Naman's World Fair") cut the cast down to eleven trees: Bo on the gate,
// the coaster operator, the four stall-holders, the three errand-givers, the
// cat, and the turnstile. Every résumé fact left the dialogue for the cards —
// which is why the hardest rule in here is the simplest one: a spoken line may
// not contain a digit. Figures live on cards, where they can be read twice and
// copied.
//
// What this suite pins:
//   · the exact tree list — nothing may be added without deciding to
//   · the line budget: ≤3 lines a node, ≤120 chars a line, no digits, no emoji
//   · every tree terminates, and every edge names a node that exists
//   · every effect names a real quest / step / achievement / mini-game / chapter
//   · Bo's entry ladder, in order — the guide always speaks to where you are
import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS } from '../src/data/achievements'
import { ZONES } from '../src/data/content'
import { NPC_INFO, NPC_TREES, ROOM_HOSTS, STORY_TREE_IDS, greetFlag } from '../src/data/npcs'
import { QUESTS } from '../src/data/quests'
import { DialogueRunner, type Cond, type Ctx, type Effect, type Tree } from '../src/systems/Dialogue'
import type { MinigameId } from '../src/systems/Minigame'
import { QuestLog } from '../src/systems/Quests'

/**
 * The five cabinets, pinned at compile time rather than imported: the host in
 * `systems/Minigame.ts` reaches for the DOM, and this suite must stay a pure
 * data check. `Record<MinigameId, true>` is the drift guard — add or rename a
 * mini-game and this line stops compiling until it is listed here.
 */
const EVERY_MINIGAME: Record<MinigameId, true> = { wordle: true, claw: true, flappy: true, forge: true, crew: true }
const MINIGAME_IDS = Object.keys(EVERY_MINIGAME) as MinigameId[]

/* ------------------------------------------------------------------ */
/* Budgets                                                             */

/** One dialogue box, and nothing that needs a second breath to read. */
const MAX_LINE = 120
/** Three boxes is the most anyone at this fair may hold the floor for. */
const MAX_LINES_PER_NODE = 3
/** An auto-greet fires before the player has asked for anything: two boxes. */
const MAX_INTRO_LINES = 2
/** Bo's arrival cutscene is the one authored exception (spec §8). */
const MAX_ARRIVAL_LINES = 3
const MAX_CHOICES = 4
const MAX_CHOICE_TEXT = 40
const MAX_ADVANCES = 60

/** Figures live on cards. A spoken figure is spelled out, or it is not spoken. */
const DIGIT = /\d/
const EMOJI = /\p{Extended_Pictographic}/u
/** The client-approved skill set never grew a front end. */
const UNAPPROVED = /\b(React|Node\.js|NodeJS|JavaScript|TypeScript|Angular|Vue|Phaser)\b/i

const trees = Object.entries(NPC_TREES)
const questIds = new Set(QUESTS.map((q) => q.id))
const achievementIds = new Set(ACHIEVEMENTS.map((a) => a.id))
const zoneIds = new Set(ZONES.map((z) => z.id))
const minigameIds = new Set<string>(MINIGAME_IDS)

/** Chapters the story never gates. `contact` is reachable from the first minute. */
const FREE_FACETS = new Set(['contact'])

function stepIds(quest: string): Set<string> {
  return new Set(QUESTS.find((q) => q.id === quest)?.steps.map((s) => s.id) ?? [])
}

function allEffects(tree: Tree): { nodeId: string; effect: Effect }[] {
  const out: { nodeId: string; effect: Effect }[] = []
  for (const [nodeId, node] of Object.entries(tree.nodes)) for (const effect of node.effects ?? []) out.push({ nodeId, effect })
  return out
}

function allLines(tree: Tree) {
  return Object.entries(tree.nodes).flatMap(([nodeId, node]) => node.lines.map((line) => ({ nodeId, line })))
}

/** Everything passes; effects are recorded. */
function permissive(applied: Effect[] = []): Ctx {
  return { check: () => true, apply: (e) => applied.push(...e) }
}

/** A tree that starts at a given node, for exercising arbitrary nodes/choices. */
function startingAt(tree: Tree, node: string): Tree {
  return { ...tree, entry: [{ node }] }
}

/** Drive a runner until it ends or reaches a choice. Returns what stopped it. */
function drive(r: DialogueRunner, budget = MAX_ADVANCES): 'choice' | 'end' {
  for (let i = 0; i < budget; i++) {
    const res = r.advance()
    if (res === 'choice' || res === 'end') return res
  }
  throw new Error(`Dialogue "${r.tree.id}" did not end or reach a choice within ${budget} advances (at "${r.nodeId}")`)
}

/* ------------------------------------------------------------------ */
/* A small stateful world: the reference semantics for Cond / Effect.   */

type World = {
  flags: Set<string>
  items: Map<string, number>
  packets: number
  unlocked: Set<string>
  night: boolean
  quests: QuestLog
  xp: number
  applied: Effect[]
}

function makeWorld(
  init: Partial<Pick<World, 'packets' | 'night'>> & { flags?: string[]; items?: Record<string, number>; unlocked?: string[] } = {},
): World {
  return {
    flags: new Set(init.flags ?? []),
    items: new Map(Object.entries(init.items ?? {})),
    packets: init.packets ?? 0,
    unlocked: new Set(init.unlocked ?? []),
    night: init.night ?? false,
    quests: new QuestLog({}, () => {}),
    xp: 0,
    applied: [],
  }
}

/** `GameState.isUnlocked`: the free chapters are always open. */
const isUnlocked = (w: World, id: string): boolean => FREE_FACETS.has(id) || w.unlocked.has(id)

function ctxFor(w: World): Ctx {
  return {
    check(c?: Cond): boolean {
      if (!c) return true
      if (c.flag && !w.flags.has(c.flag)) return false
      if (c.notFlag && w.flags.has(c.notFlag)) return false
      if (c.questDone && !w.quests.isDone(c.questDone)) return false
      if (c.questActive && !w.quests.isActive(c.questActive)) return false
      if (c.questNotStarted && w.quests.isStarted(c.questNotStarted)) return false
      if (c.item && (w.items.get(c.item[0]) ?? 0) < c.item[1]) return false
      if (c.packets !== undefined && w.packets < c.packets) return false
      if (c.night !== undefined && w.night !== c.night) return false
      if (c.unlocked && !isUnlocked(w, c.unlocked)) return false
      if (c.locked && isUnlocked(w, c.locked)) return false
      return true
    },
    apply(effects: Effect[]): void {
      for (const e of effects) {
        w.applied.push(e)
        if (e.setFlag) w.flags.add(e.setFlag)
        if (e.clearFlag) w.flags.delete(e.clearFlag)
        if (e.startQuest) w.quests.start(e.startQuest)
        if (e.advanceQuest) w.quests.advance(...e.advanceQuest)
        if (e.give) w.items.set(e.give[0], (w.items.get(e.give[0]) ?? 0) + e.give[1])
        if (e.take) w.items.set(e.take[0], Math.max(0, (w.items.get(e.take[0]) ?? 0) - e.take[1]))
        if (e.xp) w.xp += e.xp
        if (e.unlockFacet) w.unlocked.add(e.unlockFacet)
      }
    },
  }
}

/** Play a tree to the end, answering choices by their text in order. Returns every line shown. */
function play(id: string, w: World, answers: string[] = [], from?: string): string[] {
  const tree = from ? startingAt(NPC_TREES[id], from) : NPC_TREES[id]
  const r = new DialogueRunner(tree, ctxFor(w))
  const seen: string[] = []
  const queue = [...answers]
  for (let i = 0; i < MAX_ADVANCES; i++) {
    seen.push(r.line.text)
    const res = r.advance()
    if (res === 'end') return seen
    if (res === 'choice') {
      const want = queue.shift()
      const idx = r.choices.findIndex((c) => c.text === want)
      if (idx < 0) throw new Error(`"${id}" at "${r.nodeId}": no choice "${want}" among ${r.choices.map((c) => c.text).join(' | ')}`)
      r.choose(idx)
    }
  }
  throw new Error(`"${id}" did not end within ${MAX_ADVANCES} advances`)
}

/** Which node an entry ladder lands on in a given world. */
const entersAt = (id: string, w: World): string => new DialogueRunner(NPC_TREES[id], ctxFor(w)).nodeId

/* ------------------------------------------------------------------ */

describe('the cast list', () => {
  it('holds exactly the eleven fair trees, keyed by their own ids', () => {
    expect(STORY_TREE_IDS).toEqual(['dockmaster', 'professor', 'sol', 'ravi', 'arjun', 'mira', 'tomas', 'pip', 'ilse', 'cat', 'gate'])
    expect(Object.keys(NPC_TREES).sort()).toEqual([...STORY_TREE_IDS].sort())
    for (const [key, tree] of trees) expect(tree.id, `NPC_TREES["${key}"].id`).toBe(key)
  })

  it('kept none of the chatter the island carried — the interiors and their props are gone', () => {
    const cut = [
      // v2's villagers and talking scenery
      'lou', 'devi', 'vault_keeper', 'bookshelf', 'photo', 'fireplace', 'kettle', 'workbench', 'whiteboard', 'sos', 'fountain', 'well', 'stall', 'boat', 'mailbox', 'bell',
      // v3's room hosts and interior objects — the fair has no indoors
      'naman', 'ada', 'bed', 'lens', 'telescope', 'vault_door',
    ]
    for (const id of cut) expect(NPC_TREES[id], `"${id}" should have been deleted`).toBeUndefined()
  })

  it('names the dockmaster Bo, and gives every speaking part a portrait', () => {
    expect(NPC_INFO.dockmaster).toEqual({ name: 'Bo', face: 'face_dockmaster' })
    for (const [id, tree] of trees) {
      const info = NPC_INFO[id]
      if (!info) continue // objects (the turnstile) speak with a nameplate, not a face
      expect(info.face, `"${id}" face`).toBe(`face_${id}`)
      for (const { nodeId, line } of allLines(tree)) {
        expect(line.who, `"${id}/${nodeId}" wrong speaker`).toBe(info.name)
        expect(line.face, `"${id}/${nodeId}" wrong face`).toBe(info.face)
      }
    }
  })

  it('gives every object tree a nameplate and no portrait', () => {
    for (const id of ['gate']) {
      for (const { nodeId, line } of allLines(NPC_TREES[id])) {
        expect(line.who.trim().length, `"${id}/${nodeId}" nameplate`).toBeGreaterThan(0)
        expect(line.face, `"${id}/${nodeId}" should not carry a face`).toBeUndefined()
      }
    }
  })
})

describe('the line budget', () => {
  it('holds every node to three short boxes with a speaker', () => {
    for (const [id, tree] of trees) {
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        expect(node.lines.length, `"${id}/${nodeId}" has no lines`).toBeGreaterThan(0)
        const cap = id === 'dockmaster' && nodeId === 'intro' ? MAX_ARRIVAL_LINES : MAX_LINES_PER_NODE
        expect(node.lines.length, `"${id}/${nodeId}" holds the floor too long`).toBeLessThanOrEqual(cap)
        for (const line of node.lines) {
          expect(line.who.trim().length, `"${id}/${nodeId}" line without speaker`).toBeGreaterThan(0)
          expect(line.text.trim().length, `"${id}/${nodeId}" empty line`).toBeGreaterThan(0)
          expect(line.text.length, `"${id}/${nodeId}" too long (${line.text.length}): ${line.text}`).toBeLessThanOrEqual(MAX_LINE)
          expect(line.text, `"${id}/${nodeId}" contains a newline`).not.toMatch(/\n/)
        }
      }
    }
  })

  it('holds every greeting bar Bo’s arrival to two boxes', () => {
    for (const [id, tree] of trees) {
      if (!tree.nodes.intro || id === 'dockmaster') continue
      expect(tree.nodes.intro.lines.length, `"${id}/intro" greeting is over budget`).toBeLessThanOrEqual(MAX_INTRO_LINES)
    }
  })

  it('never speaks a digit — every figure at this fair lives on a card', () => {
    for (const [id, tree] of trees)
      for (const { nodeId, line } of allLines(tree))
        expect(line.text, `"${id}/${nodeId}" speaks a figure: ${line.text}`).not.toMatch(DIGIT)
  })

  it('never uses emoji and never names an unapproved skill', () => {
    for (const [id, tree] of trees)
      for (const { nodeId, line } of allLines(tree)) {
        expect(line.text, `"${id}/${nodeId}" contains emoji`).not.toMatch(EMOJI)
        expect(line.text, `"${id}/${nodeId}" names an unapproved skill`).not.toMatch(UNAPPROVED)
      }
  })

  it('keeps choice lists short and their labels readable', () => {
    for (const [id, tree] of trees)
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        expect(node.choices?.length ?? 0, `"${id}/${nodeId}" offers too many choices`).toBeLessThanOrEqual(MAX_CHOICES)
        for (const c of node.choices ?? []) {
          expect(c.text.trim().length, `"${id}/${nodeId}" empty choice`).toBeGreaterThan(0)
          expect(c.text.length, `"${id}/${nodeId}" choice too long`).toBeLessThanOrEqual(MAX_CHOICE_TEXT)
          expect(c.text, `"${id}/${nodeId}" choice speaks a figure`).not.toMatch(DIGIT)
        }
      }
  })

  it('never opens a topic list — "tell me more" is not a feature any more', () => {
    for (const [id, tree] of trees)
      for (const nodeId of ['nearby', 'about_place', 'more', 'topics'])
        expect(tree.nodes[nodeId], `"${id}" still carries a "${nodeId}" topic`).toBeUndefined()
  })
})

describe('structure', () => {
  it('gives every tree an entry ladder that ends unconditionally', () => {
    for (const [id, tree] of trees) {
      expect(tree.entry.length, `"${id}" has no entries`).toBeGreaterThan(0)
      expect(tree.entry[tree.entry.length - 1].when, `"${id}": last entry must be unconditional`).toBeUndefined()
      for (const e of tree.entry) expect(tree.nodes[e.node], `"${id}" entry → missing "${e.node}"`).toBeDefined()
    }
  })

  it('points every next and every choice at a node that exists', () => {
    for (const [id, tree] of trees)
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        if (node.next) expect(tree.nodes[node.next], `"${id}/${nodeId}" next → missing "${node.next}"`).toBeDefined()
        for (const c of node.choices ?? []) expect(tree.nodes[c.next], `"${id}/${nodeId}" choice → missing "${c.next}"`).toBeDefined()
      }
  })

  it('leaves no node stranded', () => {
    for (const [id, tree] of trees) {
      const reachable = new Set<string>()
      const stack = tree.entry.map((e) => e.node)
      if (tree.nodes.intro) stack.push('intro') // the scene enters `intro` itself
      while (stack.length) {
        const n = stack.pop()!
        if (reachable.has(n)) continue
        reachable.add(n)
        const node = tree.nodes[n]
        if (node.next) stack.push(node.next)
        for (const c of node.choices ?? []) stack.push(c.next)
      }
      for (const nodeId of Object.keys(tree.nodes)) expect(reachable.has(nodeId), `"${id}/${nodeId}" is unreachable`).toBe(true)
    }
  })

  it('keeps `intro` for the greeting alone — never an entry, never an edge', () => {
    for (const [id, tree] of trees) {
      if (!tree.nodes.intro) continue
      expect(tree.entry.some((e) => e.node === 'intro'), `"${id}" lists intro as an entry`).toBe(false)
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        expect(node.next, `"${id}/${nodeId}" leads into intro`).not.toBe('intro')
        for (const c of node.choices ?? []) expect(c.next, `"${id}/${nodeId}" chooses into intro`).not.toBe('intro')
      }
    }
  })
})

describe('termination', () => {
  it('following next alone always ends (no loop without a choice)', () => {
    for (const [id, tree] of trees) {
      const ids = Object.keys(tree.nodes)
      for (const start of ids) {
        let cur: string | undefined = start
        let steps = 0
        while (cur && tree.nodes[cur].next) {
          cur = tree.nodes[cur].next
          if (++steps > ids.length) throw new Error(`"${id}": next-chain from "${start}" never ends`)
        }
      }
    }
  })

  it('runs from every entry and greeting, taking the first option, and stops', () => {
    for (const [id, tree] of trees) {
      const starts = [...tree.entry.map((e) => e.node), ...(tree.nodes.intro ? ['intro'] : [])]
      for (const start of starts) {
        const r = new DialogueRunner(startingAt(tree, start), permissive())
        const seenChoices = new Set<string>()
        for (let guard = 0; ; guard++) {
          expect(guard, `"${id}" from "${start}" ran away`).toBeLessThan(MAX_ADVANCES)
          const res = drive(r)
          if (res === 'end') break
          if (seenChoices.has(r.nodeId)) break // a loop guarded by a choice is fine
          seenChoices.add(r.nodeId)
          expect(r.choices.length).toBeGreaterThan(0)
          r.choose(0)
        }
      }
    }
  })

  it('lands every single choice on an end or another choice', () => {
    for (const [id, tree] of trees)
      for (const [nodeId, node] of Object.entries(tree.nodes))
        for (let i = 0; i < (node.choices ?? []).length; i++) {
          const r = new DialogueRunner(startingAt(tree, nodeId), permissive())
          expect(drive(r), `"${id}/${nodeId}" should offer choices`).toBe('choice')
          r.choose(i)
          expect(['choice', 'end'], `"${id}/${nodeId}" choice ${i}`).toContain(drive(r))
        }
  })

  it('still ends cleanly when no choice on a node passes its condition', () => {
    for (const [id, tree] of trees)
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        if (!node.choices?.length) continue
        const r = new DialogueRunner(startingAt(tree, nodeId), { check: (c?: Cond) => !c, apply: () => {} })
        expect(['choice', 'end'], `"${id}/${nodeId}"`).toContain(drive(r))
      }
  })
})

describe('effects', () => {
  it('names only quests, steps and achievements that exist', () => {
    for (const [id, tree] of trees) {
      for (const { nodeId, effect } of allEffects(tree)) {
        const where = `"${id}/${nodeId}"`
        if (effect.startQuest) expect(questIds.has(effect.startQuest), `${where} unknown quest ${effect.startQuest}`).toBe(true)
        if (effect.completeQuest) expect(questIds.has(effect.completeQuest), `${where} unknown quest ${effect.completeQuest}`).toBe(true)
        if (effect.advanceQuest) {
          const [q, step, n] = effect.advanceQuest
          expect(questIds.has(q), `${where} unknown quest ${q}`).toBe(true)
          expect(stepIds(q).has(step), `${where} unknown step ${q}/${step}`).toBe(true)
          expect(n).toBeGreaterThan(0)
        }
        if (effect.achievement) expect(achievementIds.has(effect.achievement), `${where} unknown achievement ${effect.achievement}`).toBe(true)
      }
      const conds = [...tree.entry.map((e) => e.when), ...Object.values(tree.nodes).flatMap((n) => (n.choices ?? []).map((c) => c.when))]
      for (const c of conds) {
        for (const q of [c?.questActive, c?.questDone, c?.questNotStarted]) if (q) expect(questIds.has(q), `"${id}" condition names unknown quest ${q}`).toBe(true)
        for (const z of [c?.unlocked, c?.locked]) if (z) expect(zoneIds.has(z), `"${id}" condition names unknown chapter ${z}`).toBe(true)
      }
    }
  })

  it('opens only mini-games that exist and only chapters that exist', () => {
    for (const [id, tree] of trees)
      for (const { nodeId, effect } of allEffects(tree)) {
        const where = `"${id}/${nodeId}"`
        if (effect.minigame) expect(minigameIds.has(effect.minigame), `${where} unknown mini-game ${effect.minigame}`).toBe(true)
        if (effect.unlockFacet) expect(zoneIds.has(effect.unlockFacet), `${where} unknown chapter ${effect.unlockFacet}`).toBe(true)
        if (effect.panel?.startsWith('zone:')) expect(zoneIds.has(effect.panel.slice(5)), `${where} unknown card ${effect.panel}`).toBe(true)
      }
  })

  it('pays XP only from a node that also sets the flag remembering it', () => {
    for (const [id, tree] of trees)
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        if (!node.effects?.some((e) => e.xp)) continue
        const flag = node.effects.find((e) => e.setFlag)?.setFlag
        expect(flag, `"${id}/${nodeId}" pays XP without recording it`).toBeDefined()
        // …and the node is either the once-only greeting, or guarded by that flag
        const guarded = tree.entry.some((e) => e.when?.notFlag === flag && e.node === nodeId)
        expect(nodeId === 'intro' || guarded, `"${id}/${nodeId}" can pay XP twice`).toBe(true)
      }
  })
})

describe('the interiors are gone', () => {
  // `ROOM_HOSTS` and `greetFlag` survive as empty shells only because
  // `scenes/InteriorScene.ts` still imports them; Wave 2 deletes that scene and
  // then these two go with it. Nothing may be added to the table meanwhile.
  it('keeps ROOM_HOSTS as an empty table — the fair has no rooms to greet you in', () => {
    expect(ROOM_HOSTS).toEqual({})
    expect(Object.keys(ROOM_HOSTS)).toHaveLength(0)
  })

  it('still names a greet flag after its room, for the scene that has not been deleted yet', () => {
    expect(greetFlag('about')).toBe('greet_about')
  })
})

/* ------------------------------------------------------------------ */
/* Bo — the guide. His entry ladder is the story's compass.             */

describe('Bo the gateman', () => {
  const bo = NPC_TREES.dockmaster

  it('reads the story off the chapters you have not unlocked yet, in order', () => {
    expect(bo.entry).toEqual([
      { when: { flag: 'story_done' }, node: 'done' },
      { when: { notFlag: 'ticket' }, node: 'puzzle_again' },
      { when: { locked: 'experience' }, node: 'to_coaster' },
      { when: { locked: 'lineage' }, node: 'to_tent' },
      { when: { locked: 'safestride' }, node: 'to_tent' },
      { when: { locked: 'stealth' }, node: 'to_tent' },
      { when: { locked: 'skills' }, node: 'to_forge' },
      { node: 'to_guestbook' },
    ])
  })

  it('keeps asking for the ticket until the turnstile flag is set', () => {
    // The ticket is a save flag, not a chapter: reading the About card at the
    // booth no longer counts as having paid your way in.
    expect(entersAt('dockmaster', makeWorld({ unlocked: ['about'] }))).toBe('puzzle_again')
    expect(entersAt('dockmaster', makeWorld({ unlocked: ['about'], flags: ['ticket'] }))).toBe('to_coaster')
  })

  it('keeps pointing at the tent while any prize is still on the shelf', () => {
    const at = (unlocked: string[]) => entersAt('dockmaster', makeWorld({ unlocked, flags: ['ticket'] }))
    const won = ['about', 'experience', 'education']
    expect(at([...won, 'stealth'])).toBe('to_tent')
    expect(at([...won, 'stealth', 'lineage'])).toBe('to_tent')
    expect(at([...won, 'stealth', 'safestride'])).toBe('to_tent')
    expect(at([...won, 'lineage', 'safestride'])).toBe('to_tent')
    expect(at([...won, 'lineage', 'safestride', 'stealth'])).toBe('to_forge')
  })

  it('sends you to the right place at each stage of the fair', () => {
    const all = ['about', 'experience', 'education', 'lineage', 'safestride', 'stealth', 'skills']
    const at = (unlocked: string[], flags: string[] = ['ticket']) => entersAt('dockmaster', makeWorld({ unlocked, flags }))
    expect(at([], [])).toBe('puzzle_again')
    expect(at(['about'])).toBe('to_coaster')
    expect(at(['about', 'experience', 'education'])).toBe('to_tent')
    expect(at(['about', 'experience', 'education', 'lineage', 'safestride'])).toBe('to_tent')
    expect(at(['about', 'experience', 'education', 'lineage', 'safestride', 'stealth'])).toBe('to_forge')
    expect(at(all)).toBe('to_guestbook')
    expect(at(all, ['ticket', 'story_done'])).toBe('done')
  })

  it('greets you on arrival, opens the About card and offers the word puzzle', () => {
    const w = makeWorld()
    const said = play('dockmaster', w, ["Let's solve it"], 'intro')
    expect(said.slice(0, 3)).toEqual([
      "Welcome to Naman's World Fair. I'm Bo — I run the gate.",
      "Everything in here is a chapter of Naman's résumé, and I know the way round.",
      "Here's the man himself.",
    ])
    expect(said[3]).toBe("Tickets are one word each. Five letters, six tries — crack it and you're in.")
    expect(w.flags.has('met_dockmaster')).toBe(true)
    expect(w.xp).toBe(20)
    expect(w.applied).toContainEqual({ panel: 'zone:about' })
    expect(w.applied).toContainEqual({ minigame: 'wordle' })
  })

  it('holds the arrival greeting to three boxes and opens the card at the end of them', () => {
    const intro = bo.nodes.intro
    expect(intro.lines.length).toBe(3)
    expect(intro.effects).toEqual([{ setFlag: 'met_dockmaster' }, { xp: 20 }, { panel: 'zone:about' }])
    expect(intro.effectsAtEnd, 'the card must not open over Bo mid-sentence').toBe(true)
    expect(intro.next).toBe('puzzle')
  })

  it('lets the puzzle wait, and offers it again every time you pass the booth', () => {
    const w = makeWorld()
    play('dockmaster', w, ['Maybe later'], 'intro')
    expect(w.applied.some((e) => e.minigame)).toBe(false)
    expect(entersAt('dockmaster', w)).toBe('puzzle_again')
    const again = makeWorld({ flags: ['met_dockmaster'] })
    play('dockmaster', again, ['Try the puzzle'])
    expect(again.applied).toContainEqual({ minigame: 'wordle' })
  })
})

/* ------------------------------------------------------------------ */
/* The stalls and the errands, trimmed to the game and nothing else.    */

describe('the stalls point at their games', () => {
  it('gives the operator and the three stall-holders one thing to say', () => {
    for (const id of ['professor', 'sol', 'ravi', 'arjun']) {
      const w = makeWorld()
      expect(play(id, w).length, `"${id}" says more than it needs to`).toBeGreaterThan(0)
      expect(w.applied, `"${id}" should not hand anything out`).toEqual([])
    }
  })

  it('lets the coaster operator greet you in two boxes and wave you aboard after', () => {
    const w = makeWorld()
    const said = play('professor', w, [], 'intro')
    expect(said).toEqual(['All aboard. Every hill up there is a year of his career.', 'Ride it whenever you like.'])
  })
})

describe('the errands still run', () => {
  it('Tomas lends the pole, takes three ducks and hands over the cat', () => {
    const w = makeWorld()
    play('tomas', w)
    expect(w.quests.isActive('ducks')).toBe(true)
    w.quests.advance('ducks', 'hook', 3) // the pond does this bit
    w.items.set('fish', 3)
    play('tomas', w)
    expect(w.items.get('fish')).toBe(0)
    expect(w.applied).toContainEqual({ companion: true })
    expect(w.quests.isDone('ducks')).toBe(true)
    // and never a second time
    const before = w.applied.length
    play('tomas', w)
    expect(w.applied.length).toBe(before)
  })

  it('Pip asks for five balloons and takes them once', () => {
    const w = makeWorld()
    play('pip', w)
    expect(w.quests.isActive('balloons')).toBe(true)
    w.quests.advance('balloons', 'find', 5) // the lawns do this bit
    w.items.set('shell', 5)
    play('pip', w)
    expect(w.items.get('shell')).toBe(0)
    expect(w.quests.isDone('balloons')).toBe(true)
    const before = w.applied.length
    play('pip', w)
    expect(w.applied.length).toBe(before)
  })

  it('Ilse only asks for the lights once it is dark, and remarks on them after', () => {
    const day = makeWorld()
    play('ilse', day)
    expect(day.quests.isActive('lights'), 'the lights are not worth switching on at noon').toBe(false)

    const w = makeWorld({ night: true })
    play('ilse', w)
    expect(w.quests.isActive('lights')).toBe(true)
    w.quests.advance('lights', 'switch', 1)
    expect(w.quests.isDone('lights')).toBe(true)
    expect(entersAt('ilse', w)).toBe('lit')
    // and the finished quest reads the same by daylight
    w.night = false
    expect(entersAt('ilse', w)).toBe('lit')
  })

  it('Mira hands out her crew game at the arcade tent', () => {
    const w = makeWorld()
    play('mira', w)
    expect(w.quests.isActive('crew')).toBe(true)
    w.quests.advance('crew', 'win', 1)
    expect(entersAt('mira', w)).toBe('done')
  })
})

/* ------------------------------------------------------------------ */

describe('the fixtures', () => {
  it('the turnstile asks for a ticket and points at the window', () => {
    const w = makeWorld()
    expect(play('gate', w)).toEqual(["Ticket first. Bo's window is right there."])
    expect(w.applied).toEqual([])
  })

  it('the cat says one word', () => {
    const w = makeWorld()
    expect(play('cat', w)).toEqual(['Mrrp.'])
  })
})
