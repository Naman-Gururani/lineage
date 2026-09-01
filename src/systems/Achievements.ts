import { ACHIEVEMENTS, type AchievementDef } from '../data/achievements'

export class Achievements {
  private set: Set<string>

  constructor(
    unlocked: string[],
    private on: (id: string) => void,
    private defs: AchievementDef[] = ACHIEVEMENTS,
  ) {
    this.set = new Set(unlocked)
  }

  has(id: string): boolean {
    return this.set.has(id)
  }

  unlock(id: string): boolean {
    if (!this.defs.some((d) => d.id === id) || this.set.has(id)) return false
    this.set.add(id)
    this.on(id)
    return true
  }

  count(): number {
    return this.set.size
  }

  list(): string[] {
    return Array.from(this.set)
  }

  def(id: string): AchievementDef | undefined {
    return this.defs.find((d) => d.id === id)
  }
}
