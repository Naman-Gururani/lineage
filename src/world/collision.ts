// Axis-separated sliding collision against a terrain predicate and a list of
// solid rectangles, with small corner nudges so doorways feel forgiving.

export type Box = { x: number; y: number; hw: number; hh: number }
export type Solid = { x: number; y: number; w: number; h: number }
export type Blocked = (px: number, py: number) => boolean

export function overlaps(b: Box, s: Solid): boolean {
  return b.x - b.hw < s.x + s.w && b.x + b.hw > s.x && b.y - b.hh < s.y + s.h && b.y + b.hh > s.y
}

const EPS = 0.001

function collides(x: number, y: number, b: Box, blocked: Blocked, solids: Solid[]): boolean {
  const l = x - b.hw + EPS
  const r = x + b.hw - EPS
  const t = y - b.hh + EPS
  const bt = y + b.hh - EPS
  if (blocked(l, t) || blocked(r, t) || blocked(l, bt) || blocked(r, bt) || blocked(x, bt) || blocked(x, t)) return true
  const box = { x, y, hw: b.hw, hh: b.hh }
  for (const s of solids) if (overlaps(box, s)) return true
  return false
}

const NUDGES = [1, -1, 2, -2, 3, -3]

export function moveAndSlide(
  b: Box,
  dx: number,
  dy: number,
  blocked: Blocked,
  solids: Solid[],
): { x: number; y: number; hitX: boolean; hitY: boolean } {
  let x = b.x
  let y = b.y
  let hitX = false
  let hitY = false
  const hit = (px: number, py: number) => collides(px, py, b, blocked, solids)

  if (dx !== 0) {
    const target = x + dx
    if (!hit(target, y)) x = target
    else {
      const step = Math.sign(dx)
      let remaining = Math.abs(dx)
      while (remaining >= 1) {
        if (hit(x + step, y)) {
          // try to slip around a corner by shifting sideways a few pixels
          let slipped = false
          for (const n of NUDGES) {
            if (!hit(x, y + n) && !hit(x + step, y + n)) {
              y += n
              slipped = true
              break
            }
          }
          if (!slipped) break
        }
        x += step
        remaining -= 1
      }
      if (remaining > 0) hitX = true
    }
  }

  if (dy !== 0) {
    const target = y + dy
    if (!hit(x, target)) y = target
    else {
      const step = Math.sign(dy)
      let remaining = Math.abs(dy)
      while (remaining >= 1) {
        if (hit(x, y + step)) {
          let slipped = false
          for (const n of NUDGES) {
            if (!hit(x + n, y) && !hit(x + n, y + step)) {
              x += n
              slipped = true
              break
            }
          }
          if (!slipped) break
        }
        y += step
        remaining -= 1
      }
      if (remaining > 0) hitY = true
    }
  }

  return { x, y, hitX, hitY }
}
