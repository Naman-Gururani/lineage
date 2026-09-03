import type { QuestSave } from '../core/save'
import { QUESTS, type QuestDef } from '../data/quests'

/**
 * `silent` rides along on a `started` event only: the quest is begun and
 * journalled exactly as any other, but whoever renders the event is asked not
 * to announce it. It is for the quests that start themselves — see the
 * auto-start loop in `GameState`'s constructor.
 */
export type QuestEvent = { type: 'started' | 'progress' | 'done'; id: string; silent?: boolean }

export class QuestLog {
  constructor(
    public state: Record<string, QuestSave>,
    private on: (e: QuestEvent) => void,
    private defs: QuestDef[] = QUESTS,
  ) {}

  def(id: string): QuestDef | undefined {
    return this.defs.find((q) => q.id === id)
  }

  isStarted(id: string): boolean {
    return !!this.state[id]?.started
  }

  isActive(id: string): boolean {
    const s = this.state[id]
    return !!s && s.started && !s.done
  }

  isDone(id: string): boolean {
    return !!this.state[id]?.done
  }

  /** `silent` starts the quest without asking for it to be announced. */
  start(id: string, silent = false): boolean {
    if (!this.def(id) || this.isStarted(id)) return false
    this.state[id] = { started: true, done: false, progress: {} }
    this.on({ type: 'started', id, silent })
    return true
  }

  advance(id: string, step: string, n = 1): void {
    const d = this.def(id)
    if (!d || !this.isActive(id)) return
    const st = d.steps.find((s) => s.id === step)
    if (!st) return
    const s = this.state[id]
    const cur = s.progress[step] ?? 0
    const next = Math.min(st.target, cur + n)
    if (next === cur) return
    s.progress[step] = next
    this.on({ type: 'progress', id })
    if (d.steps.every((x) => (s.progress[x.id] ?? 0) >= x.target)) {
      s.done = true
      this.on({ type: 'done', id })
    }
  }

  stepProgress(id: string, step: string): number {
    return this.state[id]?.progress[step] ?? 0
  }

  /** Headline progress: the step with the largest target. */
  progress(id: string): { done: number; total: number } {
    const d = this.def(id)
    if (!d) return { done: 0, total: 0 }
    let main = d.steps[0]
    for (const s of d.steps) if (s.target > main.target) main = s
    return { done: Math.min(main.target, this.stepProgress(id, main.id)), total: main.target }
  }

  active(): QuestDef[] {
    return this.defs.filter((q) => this.isActive(q.id))
  }

  completed(): QuestDef[] {
    return this.defs.filter((q) => this.isDone(q.id))
  }
}
