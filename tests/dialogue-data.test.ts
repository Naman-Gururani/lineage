import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS } from '../src/data/achievements'
import { ZONES } from '../src/data/content'
import { NEARBY, NPC_INFO, NPC_TREES, ROOM_HOSTS, greetFlag } from '../src/data/npcs'
import { QUESTS } from '../src/data/quests'
import { ROOMS } from '../src/data/rooms'
import { SIGN_TARGETS, type SignDir } from '../src/data/signs'
import { DialogueRunner, type Cond, type Ctx, type Effect, type Tree } from '../src/systems/Dialogue'
import { QuestLog } from '../src/systems/Quests'
import { BLUEPRINT } from '../src/world/blueprint'

// One dialogue box. The longest authored line is Naman's doorway greeting
// (125 chars); `.dlg-text` has no fixed height, so it wraps inside a taller box.
const MAX_LINE = 125
const MAX_LINES_PER_NODE = 4
// A bottom-anchored dialogue box grows upward, so a long choice list walks off
// the top of a short viewport. Seven 44px rows is the authored ceiling.
const MAX_CHOICES = 7
const MAX_ADVANCES = 200

const CAST = ['mira', 'tomas', 'pip', 'lou', 'ada', 'ravi', 'sol', 'devi', 'arjun', 'ilse', 'naman', 'cat', 'professor', 'dockmaster']
const OBJECTS = ['bookshelf', 'bed', 'photo', 'fireplace', 'kettle', 'workbench', 'whiteboard', 'sos', 'lens', 'vault_door', 'vault_keeper', 'telescope', 'fountain', 'well', 'stall', 'boat', 'mailbox', 'bell']

/** Host trees greet on room entry: `intro` is entered by the scene, not by `entry`. */
const HOST_TREES = Object.entries(ROOM_HOSTS)
const introOf = (treeId: string): string | undefined => (Object.values(ROOM_HOSTS).includes(treeId) ? 'intro' : undefined)

/**
 * Villagers who also stand out on the island. They can be met without opening a
 * door, so their room greeting must not pay the meeting reward a second time —
 * the gear errand sends you to Sol on the Engine road long before the Engine.
 */
const OUTDOORS = new Set(Object.keys(BLUEPRINT.npcSpots))

const trees = Object.entries(NPC_TREES)
const questIds = new Set(QUESTS.map((q) => q.id))
const achievementIds = new Set(ACHIEVEMENTS.map((a) => a.id))

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
  discovered: Set<string>
  night: boolean
  quests: QuestLog
  xp: number
  applied: Effect[]
}

function makeWorld(init: Partial<Pick<World, 'packets' | 'night'>> & { flags?: string[]; items?: Record<string, number>; discovered?: string[] } = {}): World {
  const w: World = {
    flags: new Set(init.flags ?? []),
    items: new Map(Object.entries(init.items ?? {})),
    packets: init.packets ?? 0,
    discovered: new Set(init.discovered ?? []),
    night: init.night ?? false,
    quests: new QuestLog({}, () => {}),
    xp: 0,
    applied: [],
  }
  return w
}

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
      if (c.discovered && !w.discovered.has(c.discovered)) return false
      if (c.night !== undefined && w.night !== c.night) return false
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
      }
    },
  }
}

/** Play a tree to the end, answering choices by their text in order. Returns every line shown. */
function play(id: string, w: World, answers: string[] = []): string[] {
  const tree = NPC_TREES[id]
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

/* ------------------------------------------------------------------ */

describe('NPC_TREES structure', () => {
  it('has every cast member and object tree, keyed by its id', () => {
    for (const id of [...CAST, ...OBJECTS]) {
      expect(NPC_TREES[id], `missing tree "${id}"`).toBeDefined()
      expect(NPC_TREES[id].id).toBe(id)
    }
    for (const id of CAST) expect(NPC_INFO[id], `missing NPC_INFO "${id}"`).toBeDefined()
  })

  it('every entry, next and choice target names an existing node', () => {
    for (const [id, tree] of trees) {
      expect(tree.entry.length, `"${id}" has no entries`).toBeGreaterThan(0)
      expect(tree.entry[tree.entry.length - 1].when, `"${id}": last entry must be unconditional`).toBeUndefined()
      for (const e of tree.entry) expect(tree.nodes[e.node], `"${id}" entry → missing "${e.node}"`).toBeDefined()
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        if (node.next) expect(tree.nodes[node.next], `"${id}/${nodeId}" next → missing "${node.next}"`).toBeDefined()
        for (const c of node.choices ?? []) expect(tree.nodes[c.next], `"${id}/${nodeId}" choice → missing "${c.next}"`).toBeDefined()
      }
    }
  })

  it('every node is reachable from an entry, an auto-greet or an edge', () => {
    for (const [id, tree] of trees) {
      const reachable = new Set<string>()
      const stack = tree.entry.map((e) => e.node)
      const intro = introOf(id)
      if (intro) stack.push(intro)
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

  it('every node has 1–4 short, non-empty lines with a speaker', () => {
    for (const [id, tree] of trees) {
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        expect(node.lines.length, `"${id}/${nodeId}" has no lines`).toBeGreaterThan(0)
        expect(node.lines.length, `"${id}/${nodeId}" has too many lines`).toBeLessThanOrEqual(MAX_LINES_PER_NODE)
        for (const line of node.lines) {
          expect(line.who.trim().length, `"${id}/${nodeId}" line without speaker`).toBeGreaterThan(0)
          expect(line.text.trim().length, `"${id}/${nodeId}" empty line`).toBeGreaterThan(0)
          expect(line.text.length, `"${id}/${nodeId}" too long: ${line.text}`).toBeLessThanOrEqual(MAX_LINE)
          expect(line.text, `"${id}/${nodeId}" contains a newline`).not.toMatch(/\n/)
        }
        expect(node.choices?.length ?? 0, `"${id}/${nodeId}" offers too many choices`).toBeLessThanOrEqual(MAX_CHOICES)
        for (const c of node.choices ?? []) {
          expect(c.text.trim().length, `"${id}/${nodeId}" empty choice`).toBeGreaterThan(0)
          expect(c.text.length, `"${id}/${nodeId}" choice too long`).toBeLessThanOrEqual(40)
        }
      }
    }
  })

  it('faces look like face_<id>, and cast members speak with their own name and face', () => {
    for (const [id, tree] of trees) {
      for (const { nodeId, line } of allLines(tree)) {
        if (line.face !== undefined) expect(line.face, `"${id}/${nodeId}" odd face "${line.face}"`).toMatch(/^face_[a-z][a-z0-9_]*$/)
      }
    }
    for (const id of CAST) {
      const info = NPC_INFO[id]
      expect(info.face).toBe(`face_${id}`)
      expect(info.name.trim().length).toBeGreaterThan(0)
      for (const { nodeId, line } of allLines(NPC_TREES[id])) {
        expect(line.who, `"${id}/${nodeId}" wrong speaker`).toBe(info.name)
        expect(line.face, `"${id}/${nodeId}" wrong face`).toBe(info.face)
      }
    }
  })

  it('quest, step and achievement ids in effects exist', () => {
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
      for (const e of tree.entry) for (const q of [e.when?.questActive, e.when?.questDone, e.when?.questNotStarted]) if (q) expect(questIds.has(q), `"${id}" entry references unknown quest ${q}`).toBe(true)
      for (const node of Object.values(tree.nodes))
        for (const c of node.choices ?? []) for (const q of [c.when?.questActive, c.when?.questDone, c.when?.questNotStarted]) if (q) expect(questIds.has(q), `"${id}" choice references unknown quest ${q}`).toBe(true)
    }
  })

  it('never names unapproved skills, never uses emoji', () => {
    const banned = /\b(React|Node\.js|NodeJS|JavaScript|TypeScript|Angular|Vue|Phaser)\b/i
    const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u
    for (const [id, tree] of trees) {
      for (const { nodeId, line } of allLines(tree)) {
        expect(line.text, `"${id}/${nodeId}" names an unapproved skill`).not.toMatch(banned)
        expect(line.text, `"${id}/${nodeId}" contains emoji`).not.toMatch(emoji)
      }
    }
  })
})

describe('NPC_TREES termination', () => {
  it('following next alone always terminates (no loop without a choice)', () => {
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

  it('runs from every entry and auto-greet (choosing the first option) and ends or returns to a choice already seen', () => {
    for (const [id, tree] of trees) {
      const starts = [...tree.entry.map((e) => ({ node: e.node })), ...(introOf(id) ? [{ node: 'intro' }] : [])]
      for (const e of starts) {
        const r = new DialogueRunner(startingAt(tree, e.node), permissive())
        const seenChoices = new Set<string>()
        for (let guard = 0; ; guard++) {
          expect(guard, `"${id}" from "${e.node}" ran away`).toBeLessThan(MAX_ADVANCES)
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

  it('every choice, taken once, leads to an end or another choice', () => {
    for (const [id, tree] of trees) {
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        for (let i = 0; i < (node.choices ?? []).length; i++) {
          const r = new DialogueRunner(startingAt(tree, nodeId), permissive())
          expect(drive(r), `"${id}/${nodeId}" should offer choices`).toBe('choice')
          expect(r.nodeId).toBe(nodeId)
          r.choose(i)
          expect(['choice', 'end']).toContain(drive(r))
        }
      }
    }
  })

  it('choice nodes with a next also work when no choice passes', () => {
    for (const [id, tree] of trees) {
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        if (!node.choices?.length) continue
        const r = new DialogueRunner(startingAt(tree, nodeId), { check: (c?: Cond) => !c, apply: () => {} })
        // every choice on this node is either unconditional (still offered) or the node must end/continue cleanly
        expect(['choice', 'end']).toContain(drive(r))
      }
    }
  })
})

describe('NPC_TREES first meetings and rewards', () => {
  it('each cast member’s first meeting is guarded and sets met_<id> with some XP', () => {
    for (const id of CAST) {
      const tree = NPC_TREES[id]
      // A host who lives only indoors meets you in their doorway: the auto-greet
      // `intro`, guarded by the room's greet flag. Anyone you can also meet out
      // on the island — Sol, Arjun, Ilse and the villagers — meets you at entry[0].
      const room = OUTDOORS.has(id) ? undefined : Object.keys(ROOM_HOSTS).find((r) => ROOM_HOSTS[r] === id)
      const guard = room ? greetFlag(room) : tree.entry[0].when?.notFlag
      const node = room ? tree.nodes.intro : tree.nodes[tree.entry[0].node]
      expect(guard, `"${id}" first meeting should be guarded by notFlag`).toBeTruthy()
      expect(node, `"${id}" has no first-meeting node`).toBeDefined()
      const effects = node.effects ?? []
      expect(effects.some((e) => e.setFlag === guard), `"${id}" first node must set ${guard}`).toBe(true)
      expect(effects.some((e) => e.setFlag === `met_${id}`), `"${id}" first node must set met_${id}`).toBe(true)
      expect(effects.some((e) => (e.xp ?? 0) > 0), `"${id}" first node must grant XP`).toBe(true)
    }
  })

  it('pays each villager’s meeting reward once — a room greeting never pays it again', () => {
    for (const id of CAST) {
      const intro = NPC_TREES[id].nodes.intro
      if (!intro || !OUTDOORS.has(id)) continue
      // `met_<id>` and the greet flag are independent guards: neither implies
      // the other, so meeting outdoors and then walking in would pay twice.
      const fx = intro.effects ?? []
      expect(fx.some((e) => e.setFlag === `met_${id}`), `"${id}/intro" re-awards met_${id} — its outdoor hello already does`).toBe(false)
      expect(fx.some((e) => (e.xp ?? 0) > 0), `"${id}/intro" re-awards XP — its outdoor hello already does`).toBe(false)
    }
  })

  it('never lets two meeting rewards fire in one playthrough', () => {
    for (const id of CAST) {
      const tree = NPC_TREES[id]
      const payers = Object.keys(tree.nodes).filter((n) => (tree.nodes[n].effects ?? []).some((e) => e.setFlag === `met_${id}`))
      if (payers.length < 2) continue
      // Only an indoor-only host may carry two. InteriorScene runs `intro`
      // before the player can move, so the greeting always fires first…
      expect(payers, `"${id}" has two meeting rewards and no auto-greet to order them`).toContain('intro')
      expect(OUTDOORS.has(id), `"${id}" can be met outdoors, so both rewards could fire`).toBe(false)
      // …and every other payer is an entry guarded by a flag that greeting sets,
      // which makes it unreachable from then on.
      const introFlags = new Set((tree.nodes.intro.effects ?? []).map((e) => e.setFlag).filter(Boolean) as string[])
      for (const nodeId of payers) {
        if (nodeId === 'intro') continue
        const entries = tree.entry.filter((e) => e.node === nodeId)
        expect(entries.length, `"${id}/${nodeId}" awards met_${id} but is not an entry`).toBeGreaterThan(0)
        for (const e of entries)
          expect(introFlags.has(e.when?.notFlag ?? ''), `"${id}/${nodeId}" is not blocked by anything "${id}/intro" sets`).toBe(true)
      }
    }
  })

  it('XP-granting nodes are entered once and guarded by a flag they set (no XP farming)', () => {
    for (const [id, tree] of trees) {
      const targets = new Set<string>()
      for (const node of Object.values(tree.nodes)) {
        if (node.next) targets.add(node.next)
        for (const c of node.choices ?? []) targets.add(c.next)
      }
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        if (!node.effects?.some((e) => e.xp)) continue
        expect(targets.has(nodeId), `"${id}/${nodeId}" grants XP but is reachable from an edge`).toBe(false)
        // Either a guarded tree entry, or the auto-greet the scene runs once per
        // room — both are gated by a flag the node itself sets.
        if (nodeId === introOf(id)) {
          const room = Object.keys(ROOM_HOSTS).find((r) => ROOM_HOSTS[r] === id)!
          expect(node.effects.some((x) => x.setFlag === greetFlag(room)), `"${id}/intro" must set ${greetFlag(room)}`).toBe(true)
          continue
        }
        const entries = tree.entry.filter((e) => e.node === nodeId)
        expect(entries.length, `"${id}/${nodeId}" grants XP but is not an entry`).toBeGreaterThan(0)
        for (const e of entries) {
          expect(e.when?.notFlag, `"${id}/${nodeId}" XP entry needs a notFlag guard`).toBeTruthy()
          expect(node.effects.some((x) => x.setFlag === e.when!.notFlag), `"${id}/${nodeId}" must set its guard flag`).toBe(true)
        }
      }
    }
  })

  it('give effects are guarded by a flag they set (no duplicate items)', () => {
    for (const [id, tree] of trees) {
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        if (!node.effects?.some((e) => e.give)) continue
        const flag = node.effects.find((e) => e.setFlag)?.setFlag
        expect(flag, `"${id}/${nodeId}" gives an item but sets no flag`).toBeTruthy()
        const guards = [...tree.entry.filter((e) => e.node === nodeId).map((e) => e.when), ...Object.values(tree.nodes).flatMap((n) => (n.choices ?? []).filter((c) => c.next === nodeId).map((c) => c.when))]
        expect(guards.length).toBeGreaterThan(0)
        for (const g of guards) expect(g?.notFlag, `"${id}/${nodeId}" give path must be guarded by notFlag ${flag}`).toBe(flag)
      }
    }
  })
})

/* ------------------------------------------------------------------ */
/* Hosts: the villager (or voice) that greets you inside a landmark.    */

/** Everything every villager and object can say, as one string. */
const allDialogueText = trees.flatMap(([, t]) => allLines(t).map(({ line }) => line.text)).join('\n')

/** A fact as the zone card states it — the only place a figure is authored. */
const cardFact = (zoneId: string, k: string): string => ZONES.find((z) => z.id === zoneId)!.content.facts!.find((f) => f.k === k)!.v

describe('room hosts', () => {
  it('gives every interior a host whose tree exists', () => {
    expect(Object.keys(ROOM_HOSTS).sort()).toEqual(Object.keys(ROOMS).sort())
    for (const [room, host] of HOST_TREES) {
      expect(NPC_TREES[host], `room "${room}" host "${host}" has no tree`).toBeDefined()
      expect(NPC_TREES[host].id).toBe(host)
    }
    expect(new Set(Object.values(ROOM_HOSTS)).size, 'one host per room').toBe(HOST_TREES.length)
  })

  it('names greet flags after the room', () => {
    for (const room of Object.keys(ROOMS)) expect(greetFlag(room)).toBe(`greet_${room}`)
  })

  it('gives every host an `intro` that sets its room’s greet flag', () => {
    for (const [room, host] of HOST_TREES) {
      const intro = NPC_TREES[host].nodes.intro
      expect(intro, `host "${host}" has no intro node`).toBeDefined()
      expect(intro.effects?.some((e) => e.setFlag === greetFlag(room)), `"${host}/intro" must set ${greetFlag(room)}`).toBe(true)
      expect(intro.lines.length, `"${host}/intro" greeting is over budget`).toBeLessThanOrEqual(3)
    }
  })

  it('keeps `intro` for the auto-greet alone — never an entry or an edge', () => {
    for (const [, host] of HOST_TREES) {
      const tree = NPC_TREES[host]
      expect(tree.entry.some((e) => e.node === 'intro'), `"${host}" lists intro as an entry`).toBe(false)
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        expect(node.next, `"${host}/${nodeId}" leads into intro`).not.toBe('intro')
        for (const c of node.choices ?? []) expect(c.next, `"${host}/${nodeId}" chooses into intro`).not.toBe('intro')
      }
    }
  })

  it('gives every host the three place topics, reachable and terminating', () => {
    for (const [, host] of HOST_TREES) {
      const tree = NPC_TREES[host]
      for (const topic of ['about_place', 'more', 'nearby']) {
        const node = tree.nodes[topic]
        expect(node, `"${host}" has no "${topic}" node`).toBeDefined()
        expect(node.lines.length, `"${host}/${topic}" is empty`).toBeGreaterThanOrEqual(1)
        expect(node.lines.length, `"${host}/${topic}" is over budget`).toBeLessThanOrEqual(4)
        // reachable by choice from somewhere in the tree
        const chosen = Object.values(tree.nodes).some((n) => (n.choices ?? []).some((c) => c.next === topic))
        expect(chosen, `"${host}/${topic}" is not offered as a choice`).toBe(true)
      }
      expect(tree.nodes.about_place.lines.length, `"${host}/about_place" should be 1–2 boxes`).toBeLessThanOrEqual(2)
    }
  })

  it('lets the outdoor villagers point the way too', () => {
    for (const id of ['mira', 'tomas', 'pip', 'lou', 'devi']) {
      const tree = NPC_TREES[id]
      expect(tree.nodes.nearby, `"${id}" has no nearby node`).toBeDefined()
      expect(Object.values(tree.nodes).some((n) => (n.choices ?? []).some((c) => c.next === 'nearby')), `"${id}" never offers directions`).toBe(true)
    }
  })

  it('runs each greeting the way InteriorScene does: flag set, XP once, lands on a hub', () => {
    for (const [room, host] of HOST_TREES) {
      const w = makeWorld()
      // exactly what the scene builds on a first room entry
      const greeting: Tree = { ...NPC_TREES[host], entry: [{ node: 'intro' }] }
      const r = new DialogueRunner(greeting, ctxFor(w))
      const seen: string[] = []
      for (let i = 0; i < MAX_ADVANCES; i++) {
        seen.push(r.line.text)
        const res = r.advance()
        if (res === 'end') break
        if (res === 'choice') break // the host's hub — the player takes it from here
      }
      expect(w.flags.has(greetFlag(room)), `"${host}" greeting never set ${greetFlag(room)}`).toBe(true)
      expect(seen.length, `"${host}" greeting says nothing`).toBeGreaterThan(0)
      // A host you can only meet indoors is met by the greeting, and paid for
      // it. One you can also meet outdoors is paid out there instead.
      if (OUTDOORS.has(host)) expect(w.xp, `"${host}" is paid twice — once outdoors, once for the room`).toBe(0)
      else expect(w.xp, `"${host}" greeting granted no XP`).toBeGreaterThan(0)

      // a second visit is impossible: the flag now routes the tree elsewhere
      const again = new DialogueRunner(NPC_TREES[host], ctxFor(w))
      expect(again.nodeId, `"${host}" still enters at intro`).not.toBe('intro')
    }
  })

  it('resolves every interpolated content reference — no undefined text', () => {
    for (const [id, tree] of trees)
      for (const { nodeId, line } of allLines(tree)) {
        expect(line.text, `"${id}/${nodeId}" has an unresolved reference`).not.toMatch(/undefined|NaN|\[object|\{\{/)
        expect(line.who, `"${id}/${nodeId}" has an unresolved speaker`).not.toMatch(/undefined/)
      }
  })
})

/* ------------------------------------------------------------------ */
/* Directions. The same 8-way bearing maths as tests/signs.test.ts: a   */
/* host and a finger post must not disagree about where a place is.     */

const DIRS: SignDir[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/** Compass bearing in degrees clockwise from North (screen y grows southward). */
function bearing(fx: number, fy: number, tx: number, ty: number): number {
  return ((Math.atan2(tx - fx, -(ty - fy)) * 180) / Math.PI + 360) % 360
}

/** Smallest angle between an 8-way sector centre and an actual bearing. */
function offBy(dir: SignDir, deg: number): number {
  const d = Math.abs(deg - DIRS.indexOf(dir) * 45) % 360
  return d > 180 ? 360 - d : d
}

/** Where a `NEARBY.from` anchor stands, in tiles. */
function anchor(from: string): { tx: number; ty: number } {
  if (from.startsWith('npc:')) {
    const spot = BLUEPRINT.npcSpots[from.slice(4)]
    expect(spot, `unknown npc anchor "${from}"`).toBeDefined()
    return { tx: spot.x, ty: spot.y }
  }
  const lm = BLUEPRINT.landmarks.find((l) => l.id === from.slice(3))
  expect(lm, `unknown landmark anchor "${from}"`).toBeDefined()
  return { tx: lm!.door.x, ty: lm!.door.y }
}

describe('host directions', () => {
  it('measures 8-way sectors clockwise from North', () => {
    expect(bearing(10, 10, 10, 0)).toBe(0)
    expect(bearing(10, 10, 20, 10)).toBe(90)
    expect(bearing(10, 10, 10, 20)).toBe(180)
    expect(bearing(10, 10, 20, 0)).toBe(45)
    expect(offBy('N', 350)).toBe(10)
    expect(offBy('NW', 350)).toBe(35)
  })

  it('covers every host and every outdoor villager, twice over', () => {
    const want = [...Object.values(ROOM_HOSTS), 'mira', 'tomas', 'pip', 'lou', 'devi']
    expect(Object.keys(NEARBY).sort()).toEqual([...new Set(want)].sort())
    for (const [id, def] of Object.entries(NEARBY)) {
      expect(def.arms.length, `"${id}" should name two places`).toBe(2)
      expect(def.from, `"${id}" anchor`).toMatch(/^(npc|lm):[a-z_]+$/)
      for (const a of def.arms) {
        expect(DIRS, `"${id}" dir ${a.dir}`).toContain(a.dir)
        expect(SIGN_TARGETS[a.target], `"${id}" unknown target "${a.target}"`).toBeDefined()
        expect(a.place.trim().length, `"${id}" empty place name`).toBeGreaterThan(0)
      }
      expect(new Set(def.arms.map((a) => a.target)).size, `"${id}" names the same place twice`).toBe(2)
    }
  })

  it('points every arm within ±45° of the as-built place — the finger posts agree', () => {
    for (const [id, def] of Object.entries(NEARBY)) {
      const from = anchor(def.from)
      for (const a of def.arms) {
        const t = SIGN_TARGETS[a.target]
        const deg = bearing(from.tx, from.ty, t.tx, t.ty)
        expect(offBy(a.dir, deg), `"${id}" says ${a.place} is ${a.dir}, but it bears ${deg.toFixed(1)}°`).toBeLessThanOrEqual(45)
      }
    }
  })

  it('speaks every direction it stores — the words and the data cannot drift apart', () => {
    const WORD: Record<SignDir, string> = { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' }
    for (const [id, def] of Object.entries(NEARBY)) {
      const said = NPC_TREES[id].nodes.nearby.lines.map((l) => l.text).join(' ').toLowerCase()
      for (const a of def.arms) {
        expect(said, `"${id}/nearby" never names ${a.place}`).toContain(a.place.toLowerCase())
        expect(said, `"${id}/nearby" never says ${WORD[a.dir]}`).toContain(WORD[a.dir])
      }
    }
  })
})

/* ------------------------------------------------------------------ */
/* Content drift. Facts live in content.ts; dialogue may only quote     */
/* them. Numbers cannot be import-compared inside prose, so every       */
/* figure a villager says must also appear on a zone card.              */

const contentText = [
  ...Object.values(ZONES).flatMap((z) => [
    z.name,
    z.label,
    z.content.kicker ?? '',
    z.content.title,
    z.content.sub ?? '',
    ...(z.content.body ?? []),
    ...(z.content.points ?? []),
    ...(z.content.chips ?? []),
    ...(z.content.facts ?? []).map((f) => `${f.k} ${f.v}`),
    ...(z.content.groups ?? []).flatMap((g) => [g.label, ...g.items]),
    ...(z.content.links ?? []).map((l) => `${l.label} ${l.value}`),
  ]),
].join('\n')

describe('facts come from content.ts', () => {
  it('never says 9.57 — the CGPA is 9.63', () => {
    expect(allDialogueText).not.toContain('9.57')
    expect(allDialogueText).toContain('9.63')
    expect(contentText).toContain('9.63')
  })

  it('says every figure the zone cards say, and invents none', () => {
    // decimals (9.63, 2.0) and any run of three or more digits (750, 2024)
    const figures = (s: string) => new Set(s.match(/\b\d+\.\d+\b|\b\d{3,}\b/g) ?? [])
    const inContent = figures(contentText)
    for (const f of figures(allDialogueText)) expect(inContent.has(f), `dialogue says "${f}", no zone card does`).toBe(true)
  })

  it('carries the headline numbers on both sides', () => {
    for (const figure of ['9.63', '750', '2020', '2024', '2023']) {
      expect(contentText, `content.ts lost "${figure}"`).toContain(figure)
      expect(allDialogueText, `no villager quotes "${figure}"`).toContain(figure)
    }
  })

  it('leaves the in-development product unnamed', () => {
    expect(NPC_TREES.vault_keeper.nodes.about_place.lines.map((l) => l.text).join(' ')).toContain('A consumer product, in development')
  })
})

describe('Captain Mira', () => {
  it('teaches the controls on the first meeting and rewards it once', () => {
    const w = makeWorld()
    const text = play('mira', w).join(' ')
    expect(text).toMatch(/WASD/)
    expect(text).toMatch(/arrows/i)
    expect(text).toMatch(/Shift/)
    expect(text).toMatch(/\bE\b/)
    expect(text).toMatch(/Esc/)
    expect(text).toMatch(/\bM\b/)
    expect(w.flags.has('metMira')).toBe(true)
    expect(w.flags.has('met_mira')).toBe(true)
    expect(w.xp).toBe(10)
    const again = play('mira', w, ['Just passing'])
    expect(again.join(' ')).not.toMatch(/WASD/)
    expect(w.xp).toBe(10)
  })

  it('gives directions and remarks on the beam once the beacon is lit', () => {
    const w = makeWorld({ flags: ['metMira', 'met_mira'] })
    const dirs = play('mira', w, ["Where's Naman?", 'Just passing']).join(' ')
    expect(dirs).toMatch(/Cottage/)
    w.quests.start('beacon')
    w.quests.advance('beacon', 'light', 1)
    expect(w.quests.isDone('beacon')).toBe(true)
    const lit = play('mira', w, ['Just passing'])
    expect(lit[0]).toMatch(/beam/i)
  })
})

describe('Pip — Shell Seeker', () => {
  it('offers, reminds, takes five shells and thanks', () => {
    const w = makeWorld()
    play('pip', w, ["I'll find them"])
    expect(w.quests.isActive('shells')).toBe(true)
    expect(w.flags.has('met_pip')).toBe(true)
    expect(w.xp).toBe(5)

    const reminder = play('pip', w)
    expect(w.applied.some((e) => e.take)).toBe(false)
    expect(reminder.join(' ')).toMatch(/shell/i)

    w.items.set('shell', 6)
    w.quests.advance('shells', 'find', 5)
    play('pip', w)
    expect(w.applied).toContainEqual({ take: ['shell', 5] })
    expect(w.applied).toContainEqual({ advanceQuest: ['shells', 'return', 1] })
    expect(w.items.get('shell')).toBe(1)
    expect(w.quests.isDone('shells')).toBe(true)

    const thanks = play('pip', w, ['Bye, Pip'])
    expect(thanks.join(' ')).toMatch(/hat/i)
    expect(w.xp).toBe(5)
  })

  it('can be declined and offers again later', () => {
    const w = makeWorld()
    play('pip', w, ['Not now'])
    expect(w.quests.isStarted('shells')).toBe(false)
    play('pip', w, ["I'll find them"])
    expect(w.quests.isActive('shells')).toBe(true)
  })
})

describe('Old Tomas — Gone Fishing', () => {
  it('lends the rod, hints at the pier, and hands over Byte with three fish', () => {
    const w = makeWorld()
    const offer = play('tomas', w, ['Lend me the rod'])
    expect(w.quests.isActive('fishing')).toBe(true)
    expect(offer.join(' ')).toMatch(/pier/i)
    expect(offer.join(' ')).toMatch(/\bE\b/)

    play('tomas', w)
    expect(w.applied.some((e) => e.companion)).toBe(false)

    w.items.set('fish', 3)
    w.quests.advance('fishing', 'catch', 3)
    play('tomas', w)
    expect(w.applied).toContainEqual({ take: ['fish', 3] })
    expect(w.applied).toContainEqual({ advanceQuest: ['fishing', 'return', 1] })
    expect(w.applied).toContainEqual({ companion: true })
    expect(w.items.get('fish')).toBe(0)
    expect(w.quests.isDone('fishing')).toBe(true)

    const done = play('tomas', w, ['Just sitting']).join(' ')
    expect(done).toMatch(/Byte/)
  })
})

describe('Ravi and Sol — Spare Parts', () => {
  it('runs the whole gear errand, handing over exactly one gear', () => {
    const w = makeWorld()
    play('ravi', w, ["I'll find one"])
    expect(w.quests.isActive('gear')).toBe(true)

    // First ever chat with Sol while the quest is active: the intro, then the gear via a choice.
    const sol1 = play('sol', w, ['Ravi sent me for a gear', "That's all"])
    expect(sol1.join(' ')).toMatch(/gear/i)
    expect(w.applied).toContainEqual({ give: ['gear', 1] })
    expect(w.flags.has('gotGear')).toBe(true)
    expect(w.flags.has('met_sol')).toBe(true)
    expect(w.quests.stepProgress('gear', 'gear')).toBe(1)
    expect(w.items.get('gear')).toBe(1)

    // Sol never hands out a second one.
    const before = w.applied.length
    play('sol', w, ["That's all"])
    expect(w.applied.slice(before).some((e) => e.give)).toBe(false)
    expect(w.items.get('gear')).toBe(1)

    play('ravi', w)
    expect(w.applied).toContainEqual({ take: ['gear', 1] })
    expect(w.applied).toContainEqual({ advanceQuest: ['gear', 'return', 1] })
    expect(w.items.get('gear')).toBe(0)
    expect(w.quests.isDone('gear')).toBe(true)

    const done = play('ravi', w, ['Back to the bench']).join(' ')
    expect(done).toMatch(/spec/i)
  })

  it('Sol hands over the gear directly on a later visit', () => {
    const w = makeWorld({ flags: ['met_sol'] })
    w.quests.start('gear')
    play('sol', w, ["That's all"])
    expect(w.applied).toContainEqual({ give: ['gear', 1] })
    expect(w.applied).toContainEqual({ setFlag: 'gotGear' })
    expect(w.applied).toContainEqual({ advanceQuest: ['gear', 'gear', 1] })
  })

  it('Ravi reminds you where to look while the gear is missing', () => {
    const w = makeWorld({ flags: ['met_ravi'] })
    w.quests.start('gear')
    expect(play('ravi', w, ['Back to the bench']).join(' ')).toMatch(/Sol/)
    expect(w.applied.some((e) => e.take)).toBe(false)
  })

  it('Sol comments on packet progress', () => {
    const none = play('sol', makeWorld({ flags: ['met_sol'] }), ["That's all"])[0]
    const half = play('sol', makeWorld({ flags: ['met_sol'], packets: 10 }), ["That's all"])[0]
    const all = play('sol', makeWorld({ flags: ['met_sol'], packets: 20 }), ["That's all"])[0]
    expect(new Set([none, half, all]).size).toBe(3)
    expect(all).toMatch(/twenty/i)
  })
})

describe('Keeper Ilse and the lens — Light the Beacon', () => {
  it('offers the quest, lets you light the lens, then hums', () => {
    const w = makeWorld()
    play('ilse', w, ["I'll light it"])
    expect(w.applied).toContainEqual({ startQuest: 'beacon' })
    expect(w.quests.isActive('beacon')).toBe(true)

    play('lens', w, ['Light the lens'])
    expect(w.applied).toContainEqual({ cutscene: 'beacon' })

    w.quests.advance('beacon', 'light', 1)
    const n = w.applied.length
    const lit = play('lens', w)
    expect(lit.join(' ')).toMatch(/hum/i)
    expect(w.applied.length).toBe(n)

    const proud = play('ilse', w, ['Mind the stairs']).join(' ')
    expect(proud).toMatch(/Keeper/)
  })

  it('the lens stays dark before the quest and can be left alone during it', () => {
    const w = makeWorld()
    play('lens', w)
    expect(w.applied.some((e) => e.cutscene)).toBe(false)
    w.quests.start('beacon')
    play('lens', w, ['Not yet'])
    expect(w.applied.some((e) => e.cutscene)).toBe(false)
  })
})

describe('The Vault door', () => {
  it('stays sealed under twenty packets and opens the Vault panel at twenty', () => {
    const sealed = makeWorld({ packets: 19 })
    expect(play('vault_door', sealed).join(' ')).toMatch(/twenty/i)
    expect(sealed.applied.some((e) => e.panel)).toBe(false)
    const open = makeWorld({ packets: 20 })
    play('vault_door', open)
    expect(open.applied).toContainEqual({ panel: 'zone:stealth' })
  })
})

describe('Naman at his desk', () => {
  it('rewards the first visit once and answers every question from content.ts', () => {
    const w = makeWorld()
    const text = play('naman', w, ['Who are you?', 'What do you work on?', 'How do you work?', 'Just saying hi', 'See you around']).join(' ')
    expect(w.applied).toContainEqual({ setFlag: 'metNaman' })
    expect(w.applied).toContainEqual({ setFlag: 'met_naman' })
    expect(w.xp).toBe(20)
    expect(text).toMatch(/Barclays/)
    expect(text).toMatch(/August 2024/)
    expect(text).toMatch(/SRM IST/)
    expect(text).toContain(cardFact('education', 'Years'))
    expect(text).toContain(cardFact('about', 'CGPA').split('/')[0].trim())
    expect(text).toMatch(/Kafka/)
    expect(text).toMatch(/IBM MQ/)
    expect(text).toMatch(/750 million/)
    expect(text).toMatch(/lineage/i)
    expect(text).toMatch(/spec/i)
    expect(w.applied.some((e) => e.panel)).toBe(false)

    const again = play('naman', w, ['See you around'])
    expect(again.join(' ')).not.toMatch(/made it/)
    expect(w.xp).toBe(20)
  })

  it('"Show me your notes" opens the About panel and ends', () => {
    const w = makeWorld({ flags: ['metNaman', 'met_naman'] })
    play('naman', w, ['Show me your notes'])
    expect(w.applied).toContainEqual({ panel: 'zone:about' })
  })
})

describe('Cottage objects', () => {
  it('the bed sleeps till morning or night, or not at all', () => {
    const morning = makeWorld()
    play('bed', morning, ['Sleep till morning'])
    expect(morning.applied).toContainEqual({ sleep: 'morning' })
    const night = makeWorld()
    play('bed', night, ['Nap till night'])
    expect(night.applied).toContainEqual({ sleep: 'night' })
    const no = makeWorld()
    play('bed', no, ['Never mind'])
    expect(no.applied.some((e) => e.sleep)).toBe(false)
  })

  it('the bookshelf tells the education facts, straight off the zone card', () => {
    const text = play('bookshelf', makeWorld()).join(' ')
    expect(text).toMatch(/SRM IST/)
    expect(text).toContain(cardFact('about', 'CGPA'))
    expect(text).toContain(cardFact('education', 'Years'))
  })

  it('the mailbox has no mail', () => {
    expect(play('mailbox', makeWorld())[0]).toBe('No new mail. The Stream delivers faster anyway.')
  })
})

describe('Island objects', () => {
  it('the telescope awards Summit', () => {
    const w = makeWorld()
    play('telescope', w)
    expect(w.applied).toContainEqual({ achievement: 'summit' })
  })

  it('the bell rings', () => {
    const w = makeWorld()
    play('bell', w)
    expect(w.applied).toContainEqual({ sfx: 'bell' })
  })

  it('the SOS button explains itself without being pressed', () => {
    const w = makeWorld()
    const text = play('sos', w).join(' ')
    expect(text).toMatch(/fall/i)
    expect(text).toMatch(/SOS/)
    expect(w.applied.length).toBe(0)
    expect(NPC_TREES.sos.nodes[NPC_TREES.sos.entry[0].node].choices ?? []).toHaveLength(0)
  })

  it('Byte has three meows', () => {
    const day = play('cat', makeWorld({ flags: ['met_cat'] }))[0]
    const night = play('cat', makeWorld({ flags: ['met_cat'], night: true }))[0]
    const friend = makeWorld({ flags: ['met_cat'] })
    friend.quests.start('fishing')
    friend.quests.advance('fishing', 'catch', 3)
    friend.quests.advance('fishing', 'return', 1)
    const purr = play('cat', friend)[0]
    expect(new Set([day, night, purr]).size).toBe(3)
    for (const t of [day, night, purr]) expect(t).toMatch(/^[A-Za-z]+[.?!]/)
  })
})

// Finger posts are no longer dialogue: their arms, headings and bearings are
// checked against the as-built island in tests/signs.test.ts.
