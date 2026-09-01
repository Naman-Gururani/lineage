import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS } from '../src/data/achievements'
import { NPC_INFO, NPC_TREES } from '../src/data/npcs'
import { QUESTS } from '../src/data/quests'
import { SIGNS } from '../src/data/signs'
import { DialogueRunner, type Cond, type Ctx, type Effect, type Tree } from '../src/systems/Dialogue'
import { QuestLog } from '../src/systems/Quests'

const MAX_LINE = 110
const MAX_LINES_PER_NODE = 4
const MAX_ADVANCES = 200
const MAX_SIGN_LINE = 60

const CAST = ['mira', 'tomas', 'pip', 'lou', 'ada', 'ravi', 'sol', 'devi', 'arjun', 'ilse', 'naman', 'cat']
const OBJECTS = ['bookshelf', 'bed', 'photo', 'fireplace', 'kettle', 'workbench', 'whiteboard', 'sos', 'lens', 'vault_door', 'telescope', 'fountain', 'well', 'stall', 'boat', 'mailbox', 'bell']
const SIGN_IDS = ['harbor', 'plaza_e', 'plaza_w', 'woods', 'bridge_a', 'bridge_b', 'ridge', 'point']

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

  it('every node is reachable from an entry or an edge', () => {
    for (const [id, tree] of trees) {
      const reachable = new Set<string>()
      const stack = tree.entry.map((e) => e.node)
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

  it('runs from every entry (choosing the first option) and ends or returns to a choice already seen', () => {
    for (const [id, tree] of trees) {
      for (const e of tree.entry) {
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
  it('each cast member’s first entry is guarded and sets met_<id> with some XP', () => {
    for (const id of CAST) {
      const tree = NPC_TREES[id]
      const guard = tree.entry[0].when?.notFlag
      expect(guard, `"${id}" first entry should be guarded by notFlag`).toBeTruthy()
      const effects = tree.nodes[tree.entry[0].node].effects ?? []
      expect(effects.some((e) => e.setFlag === guard), `"${id}" first node must set ${guard}`).toBe(true)
      expect(effects.some((e) => e.setFlag === `met_${id}`), `"${id}" first node must set met_${id}`).toBe(true)
      expect(effects.some((e) => (e.xp ?? 0) > 0), `"${id}" first node must grant XP`).toBe(true)
    }
  })

  it('XP-granting nodes are entry-only and guarded by a flag they set (no XP farming)', () => {
    for (const [id, tree] of trees) {
      const targets = new Set<string>()
      for (const node of Object.values(tree.nodes)) {
        if (node.next) targets.add(node.next)
        for (const c of node.choices ?? []) targets.add(c.next)
      }
      for (const [nodeId, node] of Object.entries(tree.nodes)) {
        if (!node.effects?.some((e) => e.xp)) continue
        expect(targets.has(nodeId), `"${id}/${nodeId}" grants XP but is reachable from an edge`).toBe(false)
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

    const thanks = play('pip', w)
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

    const done = play('tomas', w).join(' ')
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

    const done = play('ravi', w).join(' ')
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
    expect(play('ravi', w).join(' ')).toMatch(/Sol/)
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

    const proud = play('ilse', w).join(' ')
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
    expect(text).toMatch(/2020 to 2024/)
    expect(text).toMatch(/9\.57/)
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

  it('the bookshelf tells the education facts', () => {
    const text = play('bookshelf', makeWorld()).join(' ')
    expect(text).toMatch(/SRM IST/)
    expect(text).toMatch(/9\.57/)
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

describe('SIGNS', () => {
  it('has exactly the eight signposts with 1–3 short lines each', () => {
    expect(Object.keys(SIGNS).sort()).toEqual([...SIGN_IDS].sort())
    for (const id of SIGN_IDS) {
      const lines = SIGNS[id]
      expect(lines.length, `sign "${id}"`).toBeGreaterThanOrEqual(1)
      expect(lines.length, `sign "${id}"`).toBeLessThanOrEqual(3)
      for (const l of lines) {
        expect(l.trim().length, `sign "${id}" empty line`).toBeGreaterThan(0)
        expect(l.length, `sign "${id}" too long: ${l}`).toBeLessThanOrEqual(MAX_SIGN_LINE)
      }
      expect(lines.some((l) => /^[←→↑↓]/.test(l)), `sign "${id}" needs a direction`).toBe(true)
    }
  })
})
