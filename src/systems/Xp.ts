export const LEVELS = [0, 60, 150, 280, 450, 680, 980, 1350, 1800, 2400]

export class Xp {
  constructor(
    public xp: number,
    private onLevel: (level: number) => void,
  ) {}

  get level(): number {
    let l = 1
    for (let i = 1; i < LEVELS.length; i++) if (this.xp >= LEVELS[i]) l = i + 1
    return l
  }

  get pct(): number {
    const l = this.level
    if (l >= LEVELS.length) return 1
    const a = LEVELS[l - 1]
    const b = LEVELS[l]
    return Math.max(0, Math.min(1, (this.xp - a) / (b - a)))
  }

  add(n: number): void {
    if (n <= 0) return
    const before = this.level
    this.xp += n
    const after = this.level
    for (let l = before + 1; l <= after; l++) this.onLevel(l)
  }
}
