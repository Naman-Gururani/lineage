// The two decisions that govern the world <-> interior hand-off. They live
// here, free of Phaser, because getting either of them wrong strands the game
// between two scenes and neither is observable from a unit test inside a Scene.

/** How the world scene is running: the attract screen, or an actual run. */
export type Mode = 'title' | 'play'

/** Why a room is being left. */
export type ExitReason =
  /** walked onto the exit tile (or a cutscene queued behind a dialogue) — resume outside the door */
  | 'door'
  /** fast-travelled from the map — the world moves the hero itself, so it keeps its own position */
  | 'travel'
  /** "Back to Title" — the world scene is restarting itself; the room only has to stand down */
  | 'title'

export type ExitPlan = {
  /** wake the sleeping world scene and hand it this payload */
  wakeWorld: boolean
  /** how long the room fades out for before the hand-off */
  fadeMs: number
  /** the `scene.wake('world', …)` payload — read by `WorldScene.onWake` */
  data: { x?: number; y?: number; cutscene?: string }
}

/**
 * What leaving a room has to do.
 *
 * The `'title'` case is the one that bites: `game:title` is a global event and
 * **both** scenes hear it — `WorldScene` restarts itself into the attract
 * screen, and the room leaves. If the room left down the ordinary door path it
 * would, 240ms later, `scene.wake('world', {x, y})` a world that is already
 * showing the welcome card: `onWake` would light the HUD over it and hand the
 * registry the dead pre-restart `GameState`. Going to the title means the room
 * shuts down and says nothing.
 */
export function planRoomExit(reason: ExitReason, returnPos: { x: number; y: number }, cutscene: string | null): ExitPlan {
  if (reason === 'title') return { wakeWorld: false, fadeMs: 0, data: {} }
  const data: ExitPlan['data'] = {}
  if (cutscene) data.cutscene = cutscene
  if (reason === 'door') {
    data.x = returnPos.x
    data.y = returnPos.y
  }
  return { wakeWorld: true, fadeMs: 240, data }
}

/**
 * Whether a `wake` payload is still meant for this world.
 *
 * A room's hand-off is queued (Phaser defers every scene op to the next frame,
 * and the door path waits out a fade first), so a wake can land after the world
 * has already restarted — at which point `resetBuild()` has dropped the player
 * and the state, and the run the payload describes no longer exists.
 */
export function acceptsRoomWake(mode: Mode): boolean {
  return mode === 'play'
}
