// Pure dialogue runner: walks a tree of nodes with lines, conditional choices
// and data-driven effects. The scene supplies `Ctx` to evaluate and apply them.

export type Cond = {
  flag?: string
  notFlag?: string
  questDone?: string
  questActive?: string
  questNotStarted?: string
  item?: [string, number]
  packets?: number
  discovered?: string
  night?: boolean
  /** a résumé chapter (zone id) the player has unlocked */
  unlocked?: string
  /** a résumé chapter (zone id) still locked */
  locked?: string
}

export type Effect = {
  setFlag?: string
  clearFlag?: string
  startQuest?: string
  advanceQuest?: [string, string, number]
  completeQuest?: string
  give?: [string, number]
  take?: [string, number]
  xp?: number
  hat?: string
  panel?: string
  achievement?: string
  companion?: boolean
  sleep?: 'morning' | 'night'
  teleport?: string
  cutscene?: string
  sfx?: string
  toast?: { title: string; sub?: string; icon?: string }
  /** open a mini-game cabinet by id (`ui:panel` → minigame) */
  minigame?: string
  /** hand over a résumé chapter (zone id) — the lens does this for Contact */
  unlockFacet?: string
}

export type Emote = 'happy' | 'sad' | 'think' | 'shout' | 'wink'

export type Line = { who: string; text: string; face?: string; emote?: Emote }
export type Choice = { text: string; next: string; when?: Cond }
export type Node = { lines: Line[]; choices?: Choice[]; next?: string; effects?: Effect[]; effectsAtEnd?: boolean }
export type Tree = { id: string; entry: { when?: Cond; node: string }[]; nodes: Record<string, Node> }
export type Ctx = { check(c?: Cond): boolean; apply(e: Effect[]): void }

export class DialogueRunner {
  node!: Node
  nodeId = ''
  lineIndex = 0
  ended = false
  private choosing = false
  private endEffectsPending = false

  constructor(
    readonly tree: Tree,
    private ctx: Ctx,
  ) {
    const entry = tree.entry.find((e) => ctx.check(e.when)) ?? tree.entry[tree.entry.length - 1]
    if (!entry) throw new Error(`Dialogue "${tree.id}" has no entry`)
    this.enter(entry.node)
  }

  private enter(id: string): void {
    const node = this.tree.nodes[id]
    if (!node) throw new Error(`Dialogue "${this.tree.id}": missing node "${id}"`)
    this.flushEndEffects()
    this.nodeId = id
    this.node = node
    this.lineIndex = 0
    this.choosing = false
    if (node.effects) {
      if (node.effectsAtEnd) this.endEffectsPending = true
      else this.ctx.apply(node.effects)
    }
  }

  private flushEndEffects(): void {
    if (this.endEffectsPending && this.node?.effects) {
      this.endEffectsPending = false
      this.ctx.apply(this.node.effects)
    }
  }

  get line(): Line {
    return this.node.lines[Math.min(this.lineIndex, this.node.lines.length - 1)]
  }

  get choices(): Choice[] {
    return (this.node.choices ?? []).filter((c) => this.ctx.check(c.when))
  }

  get atChoice(): boolean {
    return this.choosing
  }

  /** Move to the next line / choice / node. */
  advance(): 'line' | 'choice' | 'end' {
    if (this.ended) return 'end'
    if (this.choosing) return 'choice'
    if (this.lineIndex < this.node.lines.length - 1) {
      this.lineIndex++
      return 'line'
    }
    const choices = this.choices
    if (choices.length) {
      this.choosing = true
      return 'choice'
    }
    if (this.node.next) {
      this.enter(this.node.next)
      return 'line'
    }
    this.flushEndEffects()
    this.ended = true
    return 'end'
  }

  choose(i: number): void {
    const c = this.choices[i]
    if (!c) return
    this.enter(c.next)
  }
}
