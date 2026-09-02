import { describe, expect, it } from 'vitest'
import { TILE } from '../src/config'
import { ZONES } from '../src/data/content'
import { NPC_TREES } from '../src/data/npcs'
import { ROOMS } from '../src/data/rooms'
import type { MinigameId } from '../src/systems/Minigame'
import { parseRoom, type ParsedRoom } from '../src/world/rooms'
import { PACKS } from './sprites/helpers'

/**
 * Every frame name the atlas will hold, derived from the sprite packs the way
 * `buildSheet` derives them: one frame per def, or `name_0…name_n` for a strip.
 * A room prop naming anything outside this set draws as a brown placeholder box
 * in-game, which is exactly the failure this replaces a hand-kept list with.
 */
const ATLAS_FRAMES = new Set<string>()
for (const defs of Object.values(PACKS))
  for (const d of defs) {
    const n = d.frames ?? 1
    if (n === 1) ATLAS_FRAMES.add(d.name)
    else for (let i = 0; i < n; i++) ATLAS_FRAMES.add(`${d.name}_${i}`)
  }

/**
 * Every interact string a room may carry, resolved rather than merely prefixed:
 * a prop pointing at a deleted mini-game or a deleted dialogue tree is a prompt
 * that opens nothing, and `InteriorScene.use()` fails silently on both.
 *
 * `MinigameId` is pinned as a `Record` rather than imported at runtime — the
 * host in `systems/Minigame.ts` reaches for the DOM, and this suite is a data
 * check. Rename a mini-game and this line stops compiling.
 */
const EVERY_MINIGAME: Record<MinigameId, true> = { wordle: true, claw: true, flappy: true, forge: true, crew: true }
/** Purpose-built panels an interior prop may open, beside the chapter cards. */
const ROOM_PANELS = ['elevator', 'toolwall', 'prizes']

function interactResolves(target: string): boolean {
  if (target.startsWith('minigame:')) return target.slice(9) in EVERY_MINIGAME
  if (target.startsWith('tree:')) return target.slice(5) in NPC_TREES
  if (target.startsWith('panel:')) {
    const id = target.slice(6)
    if (id.startsWith('zone:')) return ZONES.some((z) => z.id === id.slice(5))
    return ROOM_PANELS.includes(id)
  }
  return false
}

/* ------------------------------------------------------------------ */
/* Reachability: can the hero actually walk up to each interactable?    */

const HW = 5 // Player.hw
const HH = 3 // Player.hh
const STEP = 4 // sampling lattice, in pixels

/** Where the hero's feet sit when standing in interior tile (tx, ty) — see parseRoom.spawn. */
type Pt = { x: number; y: number }

/** Everything the player can walk up to and press E on, with the runtime's own radii. */
function interactables(room: ParsedRoom): { label: string; x: number; y: number; radius: number; priority: number }[] {
  const out = room.props
    .filter((p) => p.interact)
    .map((p) => ({ label: `prop ${p.sprite} (${p.interact})`, x: p.x, y: p.y + 6, radius: 24, priority: 1 }))
  for (const n of room.npcs) out.push({ label: `npc ${n.id}`, x: n.x, y: n.y, radius: 26, priority: 3 })
  return out
}

/** Solids the scene adds on top of the parsed room: one small block per NPC. */
function solidsWithNpcs(room: ParsedRoom) {
  return [...room.solids, ...room.npcs.map((n) => ({ x: n.x - 6, y: n.y - 6, w: 12, h: 8 }))]
}

/** Can the hero's collision box sit at (x, y)? Mirrors world/collision.overlaps. */
function freeAt(room: ParsedRoom, x: number, y: number): boolean {
  if (x - HW < 0 || y - HH < 0 || x + HW > room.w * TILE || y + HH > room.h * TILE) return false
  return !solidsWithNpcs(room).some((s) => x - HW < s.x + s.w && x + HW > s.x && y - HH < s.y + s.h && y + HH > s.y)
}

/**
 * `InteriorScene.update`'s own leave() predicate, verbatim. Anything weaker —
 * "got near the door tile", say — passes a room whose walkable floor stops short
 * of the trigger band, which is a room you can enter and never leave.
 */
const triggersExit = (room: ParsedRoom, p: Pt): boolean => p.y > room.exit.y - 4 && Math.abs(p.x - room.exit.x) < 14

/** Flood the room from the hero's spawn over every position the collision box fits in. */
function reachable(room: ParsedRoom): Pt[] {
  const free = (x: number, y: number) => freeAt(room, x, y)
  const key = (x: number, y: number) => `${x},${y}`
  const snap = (v: number) => Math.round(v / STEP) * STEP
  const start = { x: snap(room.spawn.x), y: snap(room.spawn.y) }
  const seen = new Set<string>()
  const out: Pt[] = []
  if (!free(start.x, start.y)) return out
  const stack = [start]
  seen.add(key(start.x, start.y))
  while (stack.length) {
    const p = stack.pop()!
    out.push(p)
    for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const nx = p.x + dx
      const ny = p.y + dy
      if (seen.has(key(nx, ny)) || !free(nx, ny)) continue
      seen.add(key(nx, ny))
      stack.push({ x: nx, y: ny })
    }
  }
  return out
}

/** InteractSystem.update: nearest in range wins, priority beating distance by 100px. */
function winnerAt(items: ReturnType<typeof interactables>, p: Pt): string | null {
  let best: string | null = null
  let bestScore = Infinity
  for (const i of items) {
    const d = Math.hypot(i.x - p.x, i.y - p.y)
    if (d > i.radius) continue
    const score = d - i.priority * 100
    if (score < bestScore) {
      bestScore = score
      best = i.label
    }
  }
  return best
}

/* ------------------------------------------------------------------ */

describe('rooms', () => {
  it('defines a room behind every landmark door', () => {
    expect(Object.keys(ROOMS).sort()).toEqual(['about', 'campus', 'contact', 'experience', 'fair', 'safestride', 'skills', 'stealth', 'warehouse'])
  })

  for (const [id, def] of Object.entries(ROOMS)) {
    describe(id, () => {
      const room = parseRoom(def)

      it('has consistent row widths and a wall border', () => {
        for (const r of def.rows) expect(r.length).toBe(def.rows[0].length)
        expect(room.w).toBe(def.rows[0].length + 2)
        expect(room.h).toBe(def.rows.length + 3)
      })

      it('spawn and exit are on walkable floor', () => {
        const blocked = (x: number, y: number) => room.solids.some((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)
        expect(blocked(room.spawn.x, room.spawn.y)).toBe(false)
        expect(blocked(room.exit.x, room.exit.y - 2)).toBe(false)
      })

      it('uses known interior sprites and valid interactions', () => {
        for (const p of room.props) {
          const frame = p.frames > 1 ? `${p.sprite}_0` : p.sprite
          expect(ATLAS_FRAMES.has(frame), `${p.sprite} is not an atlas frame`).toBe(true)
          if (p.interact) expect(interactResolves(p.interact), `${p.sprite} points at nothing: ${p.interact}`).toBe(true)
          expect(p.x).toBeGreaterThan(0)
          expect(p.x).toBeLessThan(room.w * TILE)
          expect(p.y).toBeGreaterThan(0)
          expect(p.y).toBeLessThan(room.h * TILE)
        }
      })

      it('puts exactly one door glyph in the bottom wall, at the exit column', () => {
        const doorCol = Math.floor(room.exit.x / TILE)
        const bottom = room.tiles[room.h - 1]
        expect(bottom.flatMap((t, i) => (t === 'exit_door' ? [i] : [])), 'door glyphs in the bottom wall row').toEqual([doorCol])
        for (let y = 0; y < room.h - 1; y++) expect(room.tiles[y].includes('exit_door'), `row ${y} carries a stray door glyph`).toBe(false)
      })

      it('leaves the door tile itself walkable, right through the trigger band', () => {
        // The scene fires leave() at y > exit.y - 4, which is INSIDE the bottom
        // wall row: the hero has to be able to step onto the door tile, not just
        // stand on the floor above it.
        const band = room.exit.y - 4
        expect(band, 'the trigger band falls outside the room').toBeLessThan(room.h * TILE - HH)
        for (let y = (room.h - 1) * TILE; y < room.h * TILE - HH; y += 2)
          expect(freeAt(room, room.exit.x, y), `door tile blocked at y=${y}`).toBe(true)
      })

      it('lets the hero walk from the spawn onto the door tile and actually leave', () => {
        const spots = reachable(room)
        expect(spots.length, 'nowhere to stand').toBeGreaterThan(0)
        expect(spots.some((p) => triggersExit(room, p)), 'no reachable position satisfies InteriorScene.leave()').toBe(true)
      })

      it('lets the hero walk from the door to every interactable and trigger it', () => {
        const spots = reachable(room)
        const items = interactables(room)
        for (const i of items) expect(spots.some((p) => winnerAt(items, p) === i.label), `${i.label} cannot be reached and selected`).toBe(true)
      })
    })
  }
})
