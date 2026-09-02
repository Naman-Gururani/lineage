# Story Isle (v3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four custom mini-games and the chatty villagers with a guided story spine (Bo at the pier), five universally known games that each unlock a résumé chapter as a complete card popup, and few fixed dialogue lines.

**Architecture:** Pure game reducers in `src/games/*` (no DOM, no Phaser, seeded RNG) drive thin renderers in `src/ui/minigames/*` (DOM or a DPR-aware canvas on a fixed-step loop). `GameState.unlockFacet()` is the single choke point that records a chapter, credits the `story` quest, and raises `facet:unlocked`; panels turn that into the card popup. Bo's position is a pure function of the next story step (`data/story.ts`), and `WorldScene` only moves him while he is off-camera.

**Tech Stack:** TypeScript, Phaser 3 (world only), Vite, vitest + happy-dom, procedural pixel art via `src/art/pixel.ts`.

**Spec:** `docs/superpowers/specs/2026-09-02-story-isle-design.md` — read it first; every task below cites its sections.

## Global Constraints

- **Never commit or push.** The repo rule (HANDOFF §Conventions #1) stands: tasks end with green gates, not commits. Ignore the "Commit" convention of the planning skill.
- Résumé facts only from `src/data/content.ts`; dialogue lines contain **no digit characters**, no emoji, no unapproved skills (React/Node/JS never appear). The in-development product stays unnamed.
- `ui/*` never imports `core/keys` (`tests/module-graph.test.ts`); `core/`, `world/`, `src/games/*`, `src/data/*` never import Phaser or DOM.
- Escape-that-opens-a-modal is `setTimeout(0)`-deferred; element-scoped key listeners use the armed-on-first-keyup guard or `e.repeat` return (see `openSign` in `src/ui/panels.ts`).
- New sprites use only `src/art/palette.ts` keys, live in the existing pack arrays (`*_DEFS`), and are pinned in `tests/sprites/<pack>.test.ts`. Render `npm run preview:art -- sheet <pack> 3` and look at `scratch/<pack>.png` before reporting art done.
- Canvas games: 120 Hz fixed-step simulation with an accumulator, rAF draw with interpolation, DPR-aware backing store, no per-frame DOM writes, pause on `document.hidden`. Reduced motion (`reducedMotion()` from `src/ui/state.ts`) disables shake/particles/flip animations.
- Every game keeps the gag (`host.gag({...})`) and the mercy rule (third "Hire me" wins the round — implemented in the host, Task 0). Every renderer exposes `score()` and, where a round can outlive its win, `won()`.
- Gates after every task: `npx vitest run <your test files>` then `npx tsc --noEmit`. Full suite `npm test` at the end of each wave. `npm run build` at the end.
- Windows shell: long heredocs get mangled — write helper scripts to `scratch/*.cjs` with the Write tool and run `node scratch/x.cjs`.
- File ownership is strict (listed per task). Do not edit files owned by another task in your wave; if you must, stop and report.

---

## File structure (who owns what)

| Path | Responsibility | Task |
|---|---|---|
| `src/systems/Minigame.ts` | ids, labels, host (`unlockFacet`, mercy, cheat) | 0 |
| `src/systems/Dialogue.ts` | `Effect.minigame` | 0 |
| `src/core/events.ts` | `facet:unlocked`, `story:changed` | 0 |
| `src/ui/state.ts` | `uiState.unlocked`, `uiState.objective` | 0 |
| `src/ui/minigames/index.ts` + 5 stub renderers | registration | 0 (stubs) → 5–9 |
| `src/data/wordlist.ts` | generated 5-letter dictionary | 0 |
| deletions (old games, Engine console, their tests) | — | 0 |
| `src/core/save.ts` | save v3 | 1 |
| `src/systems/GameState.ts` | facets, story credit, game tables | 1 |
| `src/data/{quests,achievements,story}.ts`, `src/world/blueprint.ts` | progression data, Bo stations, fair dressing | 1 |
| `src/games/loop.ts`, `src/ui/minigames/{loop,canvas,pad}.ts` | shared game utilities | 2 |
| `src/art/sprites/{buildings,props,interior}.ts` + pack tests | new sprites | 3 |
| `src/data/{npcs,rooms,signs,content}.ts` + their tests | dialogue, rooms, signs | 4 |
| `src/games/wordle.ts`, `src/ui/minigames/wordle.ts` | Wordle | 5 |
| `src/games/claw.ts`, `src/ui/minigames/claw.ts` | claw machine | 6 |
| `src/games/flappy.ts`, `src/ui/minigames/flappy.ts` | Flappy | 7 |
| `src/games/forge.ts`, `src/ui/minigames/forge.ts` | letter wheel | 8 |
| `src/games/crew.ts`, `src/ui/minigames/crew.ts` | Among Us tiles | 9 |
| `src/ui/{panels,journal,hud,map,elevator,toolwall,prizes,welcome}.ts`, `src/styles/*.css` | locks, résumé tab, objective, prizes | 10 |
| `src/scenes/{WorldScene,InteriorScene}.ts` | Bo arrival/relocation, state emission | 11 |
| `docs/HANDOFF.md` | living doc | 12 |

Waves: **0** (orchestrator) → **1** = Tasks 1, 2, 3, 4 in parallel → **2** = Tasks 5–11 in parallel → **3** = Task 12.

---

### Task 0: Contracts, stubs, deletions (orchestrator, inline)

**Files:**
- Modify: `src/systems/Minigame.ts`, `src/systems/Dialogue.ts`, `src/core/events.ts`, `src/ui/state.ts`, `src/ui/index.ts`, `tests/minigame.test.ts`
- Create: `src/ui/minigames/index.ts`, `src/ui/minigames/{wordle,claw,flappy,forge,crew}.ts` (stubs), `src/data/wordlist.ts`, `scratch/gen-wordlist.cjs`
- Delete: `src/games/{lightsout,sokoban,packetrush,climb}.ts`, `src/ui/minigames/{studyhall,cargo,packetrush,climb}.ts`, `src/ui/lineage.ts`, `tests/{lightsout,sokoban,packetrush,climb}.test.ts`, `tests/helpers/climb-plan.ts`

**Produces (contracts every later task compiles against):**

```ts
// src/systems/Minigame.ts
export type MinigameId = 'wordle' | 'claw' | 'flappy' | 'forge' | 'crew'
export const MINIGAME_IDS: MinigameId[] = ['wordle', 'claw', 'flappy', 'forge', 'crew']
export const MINIGAME_LABELS: Record<MinigameId, string> = {
  wordle: "Bo's Word Puzzle", claw: 'Prize Grab', flappy: 'Chalk Flight', forge: 'Word Forge', crew: 'Crew Drop',
}
export function cheatEnabled(): boolean            // location.search has `cheat`
export class MinigameHost {
  unlockFacet(zoneId: string, announce = true): void   // → this.state?.unlockFacet(zoneId, announce)
  // gag(): the 'hire' branch increments a per-round counter; the 3rd hire toasts
  // "HR fast-tracked you." and calls close({ id, won: true, score }) — the mercy rule.
  // open(): when cheatEnabled(), appends <button class="pbtn mg-cheat" data-act="cheat">Skip (dev)</button>
  // to the panel; click → close({ id, won: true, score: 99 }).
}
// src/systems/Dialogue.ts
export type Effect = { /* existing */ minigame?: string }
// src/core/events.ts
'facet:unlocked': { id: string; first: boolean; announce: boolean }
'story:changed': { next: string | null }
// src/ui/state.ts
export type Objective = { step: string; text: string; landmark: string; tx: number; ty: number }
uiState.unlocked: string[]          // zone ids; 'contact' is implicitly unlocked
uiState.objective: Objective | null
// src/ui/minigames/index.ts
export function initMinigameRenderers(): void   // registerMinigame(id, mountX) ×5
// each src/ui/minigames/<id>.ts exports  mountWordle | mountClaw | mountFlappy | mountForge | mountCrew : MinigameMount
// src/data/wordlist.ts
export const WORDS: string        // 14,854 lowercase 5-letter words, space-separated
export function wordSet(): Set<string>
```

- [ ] Step 1: Delete the files listed above (`git rm` is fine — nothing is committed).
- [ ] Step 2: Rewrite `MinigameId`/`MINIGAME_IDS`/`MINIGAME_LABELS`; add `cheatEnabled()`, `unlockFacet()`, the mercy counter (`private hires = 0`, reset in `open()`/`teardown()`), and the cheat button.
- [ ] Step 3: Add `Effect.minigame`, the two events, the two `uiState` fields (`unlocked: []`, `objective: null`).
- [ ] Step 4: Create the five stub renderers (each: `panelHead(label)`, `<p class="mg-rule">Coming soon.</p>`, a Leave button → `host.quit()`, returns `{ score: () => 0 }`) and `index.ts`; in `src/ui/index.ts` drop `initLineage/initStudyHall/initCargo/initPacketRush/initClimb` imports and calls, add `initMinigameRenderers()` after `initMinigames()`.
- [ ] Step 5: `scratch/gen-wordlist.cjs` reads `scratch/wordle-words.txt`, lowercases, keeps `/^[a-z]{5}$/`, dedupes, sorts, adds `kafka flink redis linux`, writes `src/data/wordlist.ts`. Run it. Assert 14,850+ words.
- [ ] Step 6: Trim `tests/minigame.test.ts` to the host tests (ids, modal/lock, abandoned round, Esc confirm, gag order, hire pays out, mailto pinned, exit, records on outside close, backdrop focus) using `'wordle'` where it used `'packetrush'`; add tests: cheat button appears only with `?cheat=1` (stub `location.search` via `history.replaceState`), third hire closes the round as a win.
- [ ] Step 7: `npx tsc --noEmit` clean; `npx vitest run tests/minigame.test.ts tests/module-graph.test.ts` green.

---

### Task 1: Progression core — save v3, facets, story quest, Bo stations, fair dressing

**Files:**
- Modify: `src/core/save.ts`, `src/systems/GameState.ts`, `src/data/quests.ts`, `src/data/achievements.ts`, `src/world/blueprint.ts`, `src/scenes/WorldScene.ts` (one line: `hadV1Save` → `hadLegacySave`), `src/main.ts` (only if it references `hadV1Save`)
- Create: `src/data/story.ts`, `tests/story.test.ts`
- Test: `tests/save.test.ts`, `tests/gamestate.test.ts`, `tests/quests.test.ts`, `tests/progression.test.ts`, `tests/blueprint.test.ts` (update)

**Interfaces:**
- Consumes: Task 0 contracts (`MINIGAME_IDS`, events, `Effect.minigame`).
- Produces:

```ts
// src/core/save.ts
export type Save = { v: 3; /* all v2 fields */ unlocked: string[] }
const SAVE_KEY = 'nw2.save.v3'; LEGACY_SAVE_KEYS = ['nw2.save.v1', 'nw2.save.v2']
export function hadLegacySave(s?: Storage): boolean   // any legacy key present
export function clearSave(s?: Storage): void          // removes v3 + both legacy keys
migrate(raw): Save | null                             // rejects v !== 3

// src/data/story.ts
export type StoryStep = 'meet' | 'experience' | 'projects' | 'education' | 'skills' | 'contact'
export const STORY_ORDER: readonly StoryStep[] = ['meet', 'experience', 'projects', 'education', 'skills', 'contact']
export type Station = { step: StoryStep; landmark: string; hint: string }
export const STATIONS: Record<StoryStep, Station> = {
  meet:       { step: 'meet',       landmark: 'warehouse',  hint: 'Talk to Bo at the pier' },
  experience: { step: 'experience', landmark: 'warehouse',  hint: "Solve Bo's word puzzle at the pier" },
  projects:   { step: 'projects',   landmark: 'lineage',    hint: "Sol's Prize Tent — west along the shore" },
  education:  { step: 'education',  landmark: 'education',  hint: 'SRM Campus — north, on the green' },
  skills:     { step: 'skills',     landmark: 'skills',     hint: 'The Workshop — north-east, past the woods' },
  contact:    { step: 'contact',    landmark: 'contact',    hint: 'The Lighthouse — east, on the Point' },
}
export const STORY_HINTS: Record<string, string> = {   // zone id → locked-card line
  about: "Bo introduces Naman at the pier.",
  experience: "Solve Bo's word puzzle at the pier.",
  lineage: "Win it at Sol's Prize Tent on the fairground.",
  safestride: "Win it at Sol's Prize Tent on the fairground.",
  stealth: "Win the mystery box at Sol's Prize Tent.",
  education: "Fly the chalkboard course at SRM Campus.",
  skills: "Spell the toolkit at the Workshop bench.",
  contact: '',
}
export const FACET_STEP: Record<string, StoryStep> = {
  about: 'meet', experience: 'experience', lineage: 'projects', safestride: 'projects', stealth: 'projects',
  education: 'education', skills: 'skills', contact: 'contact',
}
export function nextStep(done: (s: StoryStep) => boolean): StoryStep | null   // first not-done in STORY_ORDER
export function stationSpot(step: StoryStep | null): Vec2   // BLUEPRINT.storySpots[step] ; null → BLUEPRINT.npcSpots.dockmaster

// src/world/blueprint.ts
storySpots: Record<string, Vec2>   // meet:(47,57) experience:(47,57) projects:(21,53) education:(62,31) skills:(69,21) contact:(86,63)
// npcSpots: dockmaster → V(47,57); remove mira, lou, devi. landmark lineage → sprite 'bld_fair', room 'fair'.
// region id 'engine' keeps its id, name → 'The Fairground'.
// props near the tent: { kind:'bunting', x:14, y:46 }, { kind:'bunting', x:24, y:46 }, { kind:'bunting', x:19, y:56 },
//   { kind:'balloons', x:13, y:53 }, { kind:'balloons', x:25, y:49 }, { kind:'stall', x:12, y:50, solid:R(10.5,49,3,2) },
//   { kind:'stall', x:26, y:56, solid:R(24.5,55,3,2) }  — adjust ±2 tiles if a blueprint test says water/road/door.

// src/systems/GameState.ts
export const ARCADE_GAMES = ['wordle', 'claw', 'flappy', 'forge', 'crew'] as const
export const MINIGAME_HATS: Record<string, string> = { claw: 'goggles', flappy: 'grad', forge: 'hardhat', crew: 'captain' }
export const MINIGAME_FACETS: Record<string, string[]> = {
  wordle: ['experience'], claw: ['lineage', 'safestride', 'stealth'], flappy: ['education'], forge: ['skills'],
}
export const FREE_FACETS = ['contact']
export const MINIGAME_XP: Record<string, number> = { wordle: 90, claw: 110, flappy: 100, forge: 110, crew: 100 }
class GameState {
  isUnlocked(zoneId: string): boolean
  unlockFacet(zoneId: string, announce = true): boolean   // first time → true
  storyNext(): StoryStep | null
  minigameWon(id, score)     // record; ach_<id>; arcade; hat; MINIGAME_XP; MINIGAME_FACETS → unlockFacet each; crew → quests.advance('crew','win',1)
  minigamePlayed(id, score)  // record; crew → quests.start('crew') if not started
}
```

- [ ] Step 1 (save): tests in `tests/save.test.ts` — default is v3 with `unlocked: []`; writes to `nw2.save.v3`; `migrate` rejects v2 payloads; `hadLegacySave` true for a v1 **or** v2 blob; `clearSave` removes all three keys. Run → FAIL. Implement. PASS.
- [ ] Step 2 (story data): `tests/story.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { FACET_STEP, STATIONS, STORY_HINTS, STORY_ORDER, nextStep, stationSpot } from '../src/data/story'
import { ZONES } from '../src/data/content'
import { BLUEPRINT } from '../src/world/blueprint'

describe('story spine', () => {
  it('orders six steps and maps every chapter onto one', () => {
    expect(STORY_ORDER).toEqual(['meet', 'experience', 'projects', 'education', 'skills', 'contact'])
    for (const z of ZONES) expect(STORY_ORDER, z.id).toContain(FACET_STEP[z.id])
    for (const z of ZONES) expect(typeof STORY_HINTS[z.id], z.id).toBe('string')
  })
  it('picks the first unfinished step, or null when done', () => {
    expect(nextStep(() => false)).toBe('meet')
    expect(nextStep((s) => s === 'meet' || s === 'experience')).toBe('projects')
    expect(nextStep(() => true)).toBeNull()
  })
  it('stands Bo on a designed spot for every step, and at the pier when done', () => {
    for (const s of STORY_ORDER) {
      expect(BLUEPRINT.storySpots[s], s).toBeDefined()
      expect(stationSpot(s)).toEqual(BLUEPRINT.storySpots[s])
    }
    expect(stationSpot(null)).toEqual(BLUEPRINT.npcSpots.dockmaster)
  })
  it('points every station at a real landmark', () => {
    const ids = new Set(BLUEPRINT.landmarks.map((l) => l.id))
    for (const st of Object.values(STATIONS)) expect(ids.has(st.landmark), st.landmark).toBe(true)
  })
})
```
  Run → FAIL. Write `story.ts` and the blueprint additions (`storySpots` forced to land in the same list as `npcSpots`, line ~332 and ~416). PASS. `tests/blueprint.test.ts`: storySpots included in the "designed spots are land and not in footprints" checks (extend the spread at line 39).
- [ ] Step 3 (quests/achievements): `tests/quests.test.ts` → eight quests (`explore, packets, shells, fishing, beacon, story, crew`, plus none of `gear/studyhall/cargo/packetrush/climb`); `story` is `auto` with steps `meet(1) experience(1) projects(3) education(1) skills(1) contact(1)` and reward `{ xp: 200, flag: 'story_done', text: "You've heard the whole story." }`; `crew` giver `mira`, one step `win`, reward captain + 100 XP. Achievements: 22; ids `ach_wordle ach_claw ach_flappy ach_forge ach_crew story` present, the four old cabinet ids absent; `arcade` desc mentions five. Update `tests/progression.test.ts` ("keeps the six village errands" → the eight quests). Implement. PASS.
- [ ] Step 4 (GameState): rewrite the "mini-game credit", "Packet Rush credit" and "100%" blocks of `tests/gamestate.test.ts`:

```ts
describe('chapters', () => {
  it('starts with only Contact readable', () => {
    const st = mk()
    expect(st.isUnlocked('contact')).toBe(true)
    expect(st.isUnlocked('experience')).toBe(false)
  })
  it('unlocks a chapter once, credits its story step and says so', () => {
    const st = mk(); const seen: unknown[] = []
    events.on('facet:unlocked', (p) => seen.push(p))
    expect(st.unlockFacet('experience')).toBe(true)
    expect(st.unlockFacet('experience')).toBe(false)
    expect(st.save.unlocked).toEqual(['experience'])
    expect(st.quests.stepProgress('story', 'experience')).toBe(1)
    expect(st.flag('tower_express')).toBe(true)
    expect(seen).toEqual([{ id: 'experience', first: true, announce: true }, { id: 'experience', first: false, announce: true }])
  })
  it('counts the three prizes toward one story step', () => {
    const st = mk()
    for (const z of ['lineage', 'safestride', 'stealth']) st.unlockFacet(z, false)
    expect(st.quests.stepProgress('story', 'projects')).toBe(3)
  })
  it('names the next station and finishes the story with a flag', () => {
    const st = mk(); const next: unknown[] = []
    events.on('story:changed', (p) => next.push(p.next))
    expect(st.storyNext()).toBe('meet')
    for (const z of ['about', 'experience', 'lineage', 'safestride', 'stealth', 'education', 'skills', 'contact']) st.unlockFacet(z)
    expect(st.storyNext()).toBeNull()
    expect(st.quests.isDone('story')).toBe(true)
    expect(st.flag('story_done')).toBe(true)
    expect(next.at(-1)).toBeNull()
  })
})
describe('mini-game payout', () => {
  it('a Wordle win unlocks Experience, pays XP and the badge, no hat', () => { /* minigameWon('wordle', 5) → isUnlocked('experience'), ach ach_wordle, hats [] */ })
  it('a claw win unlocks whatever prizes are still locked', () => { /* minigameWon('claw', 3) → all three project zones unlocked, goggles owned */ })
  it('Crew Drop hands out and finishes Mira’s dare', () => { /* minigamePlayed('crew', 0) starts quest; minigameWon('crew', 1) completes it; captain owned */ })
  it('crowns the arcade only once all five games are beaten', () => { /* ARCADE_GAMES loop */ })
})
```
  Run → FAIL. Implement: `unlockFacet` (push, `quests.advance('story', FACET_STEP[id], 1)`, `experience` → `setFlag('tower_express')`, toast `📖 New chapter: <zone.label>` on first, emit `facet:unlocked`, then `emit('story:changed', { next: this.storyNext() })`); `storyNext()` = `nextStep((s) => stepProgress('story', s) >= target)`; on `story` quest done → `handlers.celebrate?.()` (already in `onQuest`? no — add `if (q.id === 'story') this.handlers.celebrate?.()`), `ach.unlock('story')`. Remove `RUSH_PACKET_IDS`, `creditRushPackets`, `MINIGAME_COINS`, `creditMinigameQuest`; `recoverHats` keeps working with the new `MINIGAME_HATS`. `full_house` roster → `['dockmaster','tomas','pip','ada','ravi','sol','arjun','ilse','naman','professor','mira']`. `ITEM_NAMES` drop `gear`. PASS.
- [ ] Step 5: `src/scenes/WorldScene.ts:614` `hadV1Save()` → `hadLegacySave()` (import). `npx tsc --noEmit`; run the five test files.

---

### Task 2: Shared game utilities — stepper, rAF loop, DPR canvas, touch pad

**Files:**
- Create: `src/games/loop.ts`, `src/ui/minigames/loop.ts`, `src/ui/minigames/canvas.ts`, `src/ui/minigames/pad.ts`, `tests/loop.test.ts`, `tests/ui-pad.test.ts`
- Modify: `src/styles/panels.css` (only the `.mg-pad`/`.mg-padbtn` block already present — keep; add `.mg-canvas` rule: `display:block; width:100%; height:auto; max-height:70vh; touch-action:none; background:transparent`)

**Produces:**

```ts
// src/games/loop.ts (pure)
export type Stepper = { advance(dtMs: number): { steps: number; alpha: number }; reset(): void }
export function createStepper(hz = 120, maxFrameMs = 50): Stepper
// steps = floor(acc / stepMs) after clamping dtMs to maxFrameMs; acc -= steps*stepMs; alpha = acc/stepMs (0..1)

// src/ui/minigames/loop.ts
export type Loop = { start(): void; stop(): void; running: boolean; destroy(): void }
export function createLoop(opts: { hz?: number; step: () => void; draw: (alpha: number) => void }): Loop
// rAF; uses createStepper; on document 'visibilitychange' hidden → stop (and resets the stepper on resume so no catch-up burst);
// draw is called once per frame even when steps === 0; destroy removes listeners.

// src/ui/minigames/canvas.ts
export type Surface = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number; dpr: number }
export function makeCanvas(root: HTMLElement, w: number, h: number, opts: { pixelated?: boolean; label: string }): Surface
// canvas.width = w*dpr, height = h*dpr (dpr = min(devicePixelRatio||1, 3)); style.aspectRatio = `${w}/${h}`; ctx.scale(dpr,dpr);
// ctx.imageSmoothingEnabled = !pixelated; canvas.style.imageRendering = pixelated ? 'pixelated' : 'auto'; role=img aria-label; tabIndex 0.

// src/ui/minigames/pad.ts
export type PadDir = 'up' | 'down' | 'left' | 'right'
export function mountPad(root: HTMLElement, onDir: (d: PadDir) => void, opts?: { held?: (d: PadDir | null) => void }): HTMLElement
// <div class="mg-pad" role="group" aria-label="Direction pad"> with four <button class="mg-padbtn" data-dir="up|left|right|down">;
// click → onDir; pointerdown/up → held(d)/held(null) when provided. Returns the pad element.
```

- [ ] Step 1: `tests/loop.test.ts` — stepper: 8.33 ms → 1 step alpha≈0; 16.6 ms → 2 steps; a 400 ms frame is clamped to 50 ms → 6 steps; residual carries between calls; `reset()` zeroes it. rAF loop under happy-dom with a stubbed `requestAnimationFrame`: `step` count matches elapsed, `draw` called each frame, `stop()` halts, `destroy()` removes the visibility listener (spy on `document.removeEventListener`). → implement → PASS.
- [ ] Step 2: `tests/ui-pad.test.ts` — four buttons with `data-dir`, click dispatches the direction, `held` fires down/up. Port the markup from the deleted Cargo renderer (git history: `git show HEAD:src/ui/minigames/cargo.ts`). → PASS.
- [ ] Step 3: `makeCanvas` test: sizes by a stubbed `devicePixelRatio = 2` (width attr = 2w), label set, pixelated toggles `imageRendering`. → PASS. `npx tsc --noEmit`.

---

### Task 3: Art — fair tent, fair dressing, tent interior, arcade cabinet

**Files:**
- Modify: `src/art/sprites/buildings.ts`, `src/art/sprites/props.ts`, `src/art/sprites/interior.ts`, `tests/sprites/buildings.test.ts`, `tests/sprites/props.test.ts`, `tests/sprites/interior.test.ts`
- Read first: `.superpowers/sdd/2026-09-01-naman-world-hd/art-direction.md` (binding), 2–3 existing defs per pack, `tools/preview.ts`.

**Produces (exact names/dims; anchors as noted):**

| Pack | Name | Size | Frames | Anchor | Notes |
|---|---|---|---|---|---|
| buildings | `bld_fair`, `bld_fair_night` | 192×128 | 1 | `[96,128]` | red/cream striped big top, scalloped valance, pennant on the peak, dark door centred at the bottom (door tile = footprint col 3), warm window-glow keys so the night overlay lights up; `outline: 'outline'` on the day def like the others (use `push(name, day, night)`) |
| props | `bunting` | 96×24 | 1 | `[48,20]` | rope between two poles with 7 alternating pennants (red/teal/gold), `flat`-friendly |
| props | `balloons` | 32×56 | 1 | `[16,54]` | three balloons on strings tied to a peg |
| interior | `int_claw` | 64×96 | 2 | `[32,92]` | claw cabinet: glass box with three boxes visible, claw on a cable, coin slot, marquee; frame 2 = marquee lights alternate |
| interior | `int_prizeshelf` | 96×48 | 1 | `[48,44]` | wall shelf with three wrapped prizes + two plushies |
| interior | `int_cabinet` | 48×80 | 2 | `[24,76]` | arcade cabinet, screen shows a tiny grid of tiles with beans; frame 2 = one tile missing |
| interior | `int_bunting` | 96×16 | 1 | `[48,12]` | indoor pennant string (wall prop) |
| interior | `int_balloons` | 32×48 | 1 | `[16,44]` | balloon cluster |

- [ ] Step 1: Pin the table above in the three pack tests (`expectFrame`, anchor, `frames`), plus rename guards untouched. Run → FAIL.
- [ ] Step 2: Draw. Keep `bld_lineage` defined (rename guard). Run `npm run preview:art -- sheet buildings 3`, `-- sheet props 3`, `-- sheet interior 3`; open the PNGs (Read tool) and fix anything that does not read by silhouette.
- [ ] Step 3: `npx vitest run tests/sprites tests/atlas-capacity.test.ts` green; `npx tsc --noEmit`.

---

### Task 4: Data — dialogue rewrite, rooms, signs, content names

**Files:**
- Modify: `src/data/npcs.ts` (rewrite), `src/data/rooms.ts`, `src/data/signs.ts`, `src/data/content.ts` (`lineage.name`, `LandmarkKind`), `tests/dialogue-data.test.ts` (rewrite), `tests/rooms.test.ts`, `tests/signs.test.ts`, `tests/content.test.ts`, `tests/registry.test.ts`, `tests/ui-dialogue.test.ts` (if it names removed trees)
- Read first: spec §7–§8; `src/systems/Dialogue.ts` (`Tree`/`Node`/`Effect` incl. new `minigame`), `src/scenes/InteriorScene.ts:242-300` (how `intro` auto-greets), `src/world/rooms.ts` (legend fields).

**Produces:**

```ts
// src/data/npcs.ts
export const NPC_INFO: Record<string, { name: string; face: string }>  // dockmaster → { name: 'Bo', face: 'face_dockmaster' }; mira, tomas, pip, ada, ravi, sol, arjun, ilse, professor, naman, cat; (lou/devi may stay in NPC_INFO — harmless)
export const ROOM_HOSTS: Record<string, string> = { about:'naman', experience:'ada', skills:'ravi', fair:'sol', stealth:'', safestride:'arjun', campus:'professor', warehouse:'mira', contact:'ilse' }  // '' = no host (drop the key instead)
export const greetFlag = (room: string) => `greet_${room}`
export const NPC_TREES: Record<string, Tree>   // exactly: dockmaster naman ada sol professor ravi mira ilse tomas pip arjun cat bed lens telescope vault_door
export const STORY_TREE_IDS = ['dockmaster', ...]  // for tests
```

Bo's tree (`dockmaster`) — nodes and entries, verbatim from spec §7. Entry list order (first match wins), using `Cond`:
1. `{ when: { flag: 'story_done' }, node: 'done' }`
2. `{ when: { questDoneStep?… } }` — `Cond` has no per-step condition; use flags set by GameState? No: use `questActive`/flags the story sets: add flags **in `unlockFacet`?** Not this task. Instead express with `Cond.flag` on `chapter_<zone>` flags — **Task 1 does not set those.** Resolution: Bo's entry uses the `discovered`-style check on the *unlocked* list: extend `Cond` with `unlocked?: string` and `notUnlocked?: string` (this task owns Dialogue.ts? No — Task 0 owns it). → **Task 4 adds `unlocked?: string; locked?: string` to `Cond` in `src/systems/Dialogue.ts` and the two checks in `GameState.check()`** (`if (c.unlocked && !this.isUnlocked(c.unlocked)) return false; if (c.locked && this.isUnlocked(c.locked)) return false`). Coordinate: Task 1 owns GameState — so Task 4 writes the `Cond` fields only, and Task 1 implements the two `check()` lines (both tasks are in Wave 1; the plan is the contract).
   Entries, in order: `story_done` → `done`; `{ locked: 'experience' }` → `puzzle_again`; `{ locked: 'lineage' }` → `to_fair` (also covers safestride/stealth — use `locked:'stealth'` since the mystery box is last); `{ locked: 'education' }` → `to_campus`; `{ locked: 'skills' }` → `to_workshop`; default → `to_lighthouse`.
   `intro` is not in `entry` (arrival runs it directly, as InteriorScene does for hosts). `intro.effects = [{ setFlag: 'met_dockmaster' }, { xp: 20 }, { panel: 'zone:about' }]` with `effectsAtEnd: true`, `next: 'puzzle'`. `puzzle.choices = [{ text: "Let's solve it", next: 'play' }, { text: 'Maybe later', next: 'later' }]`; `play = { lines: [Bo: 'Five letters. Six tries. Go on.'], effects: [{ minigame: 'wordle' }] }`.
- [ ] Step 1: Rewrite `tests/dialogue-data.test.ts` to the new rules (spec §7): exact tree id set; every node ≤ 3 lines; every line ≤ 120 chars, no digits (`/\d/`), no emoji (`/\p{Extended_Pictographic}/u`), no unapproved skills; `intro` nodes ≤ 2 lines and not in `entry`; every `next`/choice target exists; every tree terminates (reuse the existing termination walkers); every `minigame` effect names a `MINIGAME_IDS` member; quest/step/achievement ids exist; Bo's entry order as above; `ROOM_HOSTS` values have trees and every room key exists in `ROOMS`. Delete the NEARBY/bearing/content-interpolation blocks. Run → FAIL.
- [ ] Step 2: Write `npcs.ts` (≈300 lines). Trim Ilse/Tomas/Pip to two nodes each keeping their quest effects (`startQuest`, `advanceQuest`, `completeQuest`, `companion`, `cutscene: 'beacon'`); `lens`: if `questDone: 'beacon'` or not — **always** offers `Send a signal?` → `{ panel: 'zone:contact' }`; lighting the lens stays on the beacon quest path. `vault_door` two entries (locked/unlocked), `bed` sleep choice, `telescope` sets `summit`, `cat` one line. PASS.
- [ ] Step 3: `rooms.ts` per spec §8 (rename `lineage` room to `fair`, name "Sol's Prize Tent", floor wood, music 'interior'; legend: `C: { sprite:'int_claw', w:2, h:3, frames:2, fps:2, light:true, interact:'minigame:claw', prompt:'Play the claw machine' }`, `S: { sprite:'int_prizeshelf', w:3, wall:true, interact:'panel:prizes', prompt:'Look at the prizes' }`, `b: { sprite:'int_bunting', w:3, wall:true }`, `L: { sprite:'int_balloons' }`, `N: { sprite:'', npc:'sol', facing:'down' }`, rug). Warehouse → name 'Harbor Arcade', `A: { sprite:'int_cabinet', w:2, h:3?` — cabinet is 48×80 = 1.5×2.5 tiles: use `w:2, h:3` footprint with `center:true`? Follow how `int_pallet` (64×?) was placed; if unsure use `w:2,h:2` `}`, interact `minigame:crew`, prompt 'Play Crew Drop'; `M: npc 'mira'`. Other rooms per spec. Update `tests/rooms.test.ts` (every interact is `minigame:<MINIGAME_IDS>`, `panel:zone:<zone>`, `panel:elevator|toolwall|prizes`, or `tree:<existing tree>`; the reachability tests keep running). `tests/registry.test.ts`: room key list now includes `fair`, not `lineage`; counts unchanged (8/8/9/9). PASS.
- [ ] Step 4: `signs.ts` labels + `SIGN_TARGETS` keys per spec §8; `tests/signs.test.ts` label expectations. `content.ts`: `lineage.name = "Sol's Prize Tent"`, `LandmarkKind` `'engine'` → `'fair'` (grep `kind === 'engine'` in `src/` and fix — `ui/map.ts`/`panels.ts` may switch on kind for icons; if so that's Task 10's file: leave a `// TODO(task10)` is **not allowed** — instead keep the union containing both `'engine' | 'fair'` this task, and Task 10 removes `'engine'`). `tests/content.test.ts` adjustments. PASS. `npx tsc --noEmit`.

---

### Task 5: Wordle — "Bo's Word Puzzle"

**Files:**
- Create: `src/games/wordle.ts`, `tests/wordle.test.ts`, `tests/minigame-wordle.test.ts`
- Replace: `src/ui/minigames/wordle.ts` (keep `export function mountWordle`)
- Modify: `src/styles/panels.css` (append a `/* wordle */` block only)
- Read: `src/systems/Minigame.ts`, `src/ui/modal.ts`, `src/ui/panels.ts` (`panelHead`), `src/data/wordlist.ts`, `src/data/content.ts`, spec §6.1.

**Produces:**

```ts
// src/games/wordle.ts
export type Mark = 'g' | 'y' | 'x'
export const WORD_LEN = 5, MAX_ROWS = 6
export function wordleAnswers(): string[]        // from ZONES skills groups: tokens /^[a-z]{5}$/ of every item, lowercased, deduped, stable order → ['kafka','flink','redis','linux']
export function scoreGuess(guess: string, answer: string): Mark[]  // two-pass: greens first, then yellows with remaining letter counts
export type KeyState = Record<string, Mark>    // best mark per letter (g > y > x)
export function keyStates(rows: { guess: string; marks: Mark[] }[]): KeyState
export function pickAnswer(attempt: number, override?: string | null): string   // override (from ?word=) wins if it is 5 letters
export type WordleState = { answer: string; rows: { guess: string; marks: Mark[] }[]; current: string; hints: string[]; maxRows: number; status: 'play' | 'won' | 'lost' }
export function newGame(answer: string): WordleState
export function typeLetter(s: WordleState, ch: string): WordleState
export function backspace(s: WordleState): WordleState
export function submit(s: WordleState, isWord: (w: string) => boolean): { state: WordleState; error?: 'short' | 'notword' }
export function hint(s: WordleState): WordleState  // reveals the next unrevealed answer letter (left→right) into hints[]; max 3
export function extraRow(s: WordleState): WordleState  // maxRows + 1, status back to 'play' (the Hire-me row)
```

- [ ] Step 1: `tests/wordle.test.ts` — answers derive from content (equal to the four, and every one appears in an approved skills item); `scoreGuess('allee','eagle')` handles duplicates (`['x','y','y','g','x']`... compute by hand and assert), `scoreGuess('kafka','kafka')` all green; `keyStates` prefers green over yellow; `submit` rejects short and non-words (using a stub `isWord`), accepts the answer even if the dictionary says no; `hint` reveals left→right and stops at 3; `extraRow` after a loss re-opens play; `pickAnswer` cycles and honours override; `wordSet()` has ≥ 14,850 five-letter entries and contains all answers. → implement → PASS.
- [ ] Step 2: Renderer `mountWordle(host, root)`:
  - DOM: `panelHead("Bo's Word Puzzle", 'PIER')`, `<p class="mg-rule">Guess the five-letter word in six tries. Green is right, yellow is misplaced.</p>`, hint row `<div class="wd-hint" aria-live="polite">`, grid `<div class="wd-grid" role="grid">` 6×5 `<div class="wd-tile" data-state="">`, keyboard `<div class="wd-kbd">` rows `qwertyuiop / asdfghjkl / ⏎ zxcvbnm ⌫` as `<button class="wd-key" data-key="q">`, footer with `💡 Hint (3 left)` button, `Leave` button, and `<p class="mg-live sr-only" role="status">`.
  - Dictionary: `let words: Set<string> | null = null; void import('../../data/wordlist').then((m) => { words = m.wordSet() })`; `isWord = (w) => !words || words.has(w)` (lenient until loaded).
  - Input: `root.addEventListener('keydown', ...)` for letters/Enter/Backspace (`e.repeat` return; `e.stopPropagation()`); clicks on keys. Set `root.tabIndex = 0` and `root.dataset.autofocus = ''`; focus it.
  - Reveal: on submit, set each tile's `data-state` with a staggered `--i` CSS delay (flip via `.wd-tile.flip`); reduced motion → no animation. Invalid → `.wd-row.shake` + in-panel note `.wd-note` "Not in word list" for 1.2 s.
  - Win: `say('Solved!')`, `afterWin(() => host.close({ id: 'wordle', won: true, score: 7 - rowsUsed }))`.
  - Lose: `host.gag({ title: 'Out of tries.', sub: `It was ${answer.toUpperCase()}.`, retry: newWord, hint: () => { state = extraRow(state); render() } })`.
  - Hints: button → `state = hint(state)`; label counts down; Bo's kicker text changes: 0 → "Bo is watching.", 1 → "Bo coughs meaningfully.", 2 → "Bo points at a letter.", 3 → "Bo has basically told you."
  - Answer override: `new URLSearchParams(location.search).get('word')`; attempt counter kept in module scope (`let attempts = 0`).
  - Return `{ score: () => (state.status === 'won' ? 7 - state.rows.length : 0), destroy }`.
- [ ] Step 3: `tests/minigame-wordle.test.ts` (happy-dom; copy the harness prelude from `tests/minigame.test.ts`): opening `ui:panel {id:'minigame', data:'wordle'}` renders 30 tiles and 28 keys; typing via keyboard buttons fills the current row; Enter on a short word does not advance; a wrong full word marks tiles; solving (use `?word=` via `history.replaceState('', '', '?word=kafka')` before opening) closes the round as a win and `state.isUnlocked('experience')` becomes true; six misses open the gag with the answer in `.mg-gag-sub`; hint button reveals letters and disables at three. → PASS.
- [ ] Step 4: CSS block (`.wd-grid` 5 columns, tiles 52px, colours `--wd-g:#538d4e --wd-y:#b59f3b --wd-x:#3a3a3c`, keyboard keys ≥ 40px tall for touch, `.wd-tile.flip` keyframe 500 ms, `.reduce-motion .wd-tile { animation: none }`). `npx tsc --noEmit`.

---

### Task 6: Claw machine — "Prize Grab"

**Files:**
- Create: `src/games/claw.ts`, `tests/claw.test.ts`, `tests/minigame-claw.test.ts`
- Replace: `src/ui/minigames/claw.ts` (keep `export function mountClaw`)
- Modify: `src/styles/panels.css` (append `/* claw */`)
- Read: Task 2 utilities (`createLoop`, `makeCanvas`), `src/systems/Minigame.ts`, `src/ui/panels.ts` (`openZone`), spec §6.2.

**Produces:**

```ts
// src/games/claw.ts
export const CLAW = { W: 640, H: 400, SHELF_Y: 300, TOKENS: 6, SWEEP: 0.55, SWEEP_GAIN: 0.15, TOL: [0.45, 0.35, 0.28], DROP_MS: 700, RISE_MS: 700, CHUTE_X: 0.08 } as const
export type Prize = { id: 'lineage' | 'safestride' | 'stealth' | 'plush_a' | 'plush_b'; x: number; w: number; caught: boolean; decoy: boolean }
export type Phase = 'sweep' | 'drop' | 'grab' | 'rise' | 'carry' | 'release' | 'done'
export type ClawState = { x: number; dir: 1 | -1; y: number; phase: Phase; t: number; tokens: number; prizes: Prize[]; holding: Prize['id'] | null; caught: number; speed: number; justCaught: Prize['id'] | null }
export function newClaw(): ClawState     // prizes at x = 0.22, 0.5, 0.78 (lineage, safestride, stealth) w 0.14; decoys at 0.36, 0.64 w 0.08
export function step(s: ClawState, dtMs: number): ClawState   // sweep: x += dir*speed*dt, bounce in [0.06, 0.94]; drop → at bottom test catch; rise; carry to CHUTE_X; release → justCaught set once; back to sweep with speed *= 1+GAIN after a real prize
export function drop(s: ClawState): ClawState      // only in 'sweep' with tokens > 0: tokens-1, phase 'drop'
export function catchTarget(s: ClawState): Prize | null   // nearest uncaught, non-decoy? — decoys CAN be grabbed (they rise and fall off the claw: phase 'rise' then release nothing); real prize caught if |x - p.x| <= p.w * TOL[caught]
export function allCaught(s: ClawState): boolean
export function refill(s: ClawState, n: number): ClawState
```

- [ ] Step 1: `tests/claw.test.ts` — sweep bounces within bounds and is deterministic; `drop` spends a token and refuses at zero; dropping exactly over a prize catches it (`justCaught` fires exactly once, `caught` increments, speed rises); dropping over a gap catches nothing and costs a token; tolerance tightens per catch (a drop that caught prize 1 at offset 0.44·w would miss as the third); `allCaught` after three. → implement → PASS.
- [ ] Step 2: Renderer `mountClaw`: header `panelHead('Prize Grab', "SOL'S PRIZE TENT")`, `<p class="mg-rule">One button. Drop the claw over a prize. Three prizes, three projects.</p>`, stats (tokens, prizes), `makeCanvas(root, 640, 400, { pixelated: true, label: 'Claw machine' })`, footer with `Drop` button + `Leave`. Loop: `createLoop({ step: () => (state = step(state, 1000/120)), draw })`. Draw procedurally: cabinet frame (wood ramp), glass with a diagonal glare band, shelf, prize boxes (rounded rects with a ribbon; label text under each: "Lineage Engine", "Safe Stride", "???"; decoys as round plushies), claw (two arms open/closed by phase) on a cable from the rail at `x`, chute at the left. Interpolate `x` with `alpha` between the last two states for smooth sweep. Input: Space/Enter/click/tap on the canvas or the Drop button → `state = drop(state)`.
  - On `state.justCaught` (real prize): `loop.stop()`, `host.unlockFacet(id, false)`, `events.emit('ui:panel', { id: `zone:${id}` })`, and `events.on('ui:closed', once id === `zone:${id}`)` → `loop.start()`; clear `justCaught`. Sol's kicker: the card foot is Task 10's; here just toast `🎁 ${title}` via `ui:toast`.
  - Tokens 0 and not all caught → `host.gag({ title: 'Out of tokens.', sub: 'The claw is honest. Mostly.', retry: () => (state = refill(newRound), ...) , hint: () => (state = refill(state, 2)) })` (retry keeps caught prizes: rebuild prizes from `state.prizes`).
  - Win: `afterWin(() => host.close({ id: 'claw', won: true, score: 3 }))`. Session `{ score: () => state.caught, won: () => allCaught(state), destroy: () => loop.destroy() }`.
- [ ] Step 3: `tests/minigame-claw.test.ts` — opening renders a canvas and a Drop button; with a stubbed rAF and the reducer driven directly (export a `__test` hook `debugState()` only under `import.meta.vitest`? No: test the reducer separately and here assert wiring: Drop button spends a token (stats text), gag appears at zero tokens with three prizes uncaught (drive by calling `drop` through the button on a canvas where the claw is parked over a gap — deterministic start position 0.5 sweeping right; the first drop over `x=0.5` catches `safestride`: assert `state.isUnlocked('safestride')` and that a `zone:safestride` modal opened). → PASS.
- [ ] Step 4: CSS (`.cw-stats`), `npx tsc --noEmit`.

---

### Task 7: Flappy Bird — "Chalk Flight"

**Files:**
- Create: `src/games/flappy.ts`, `tests/flappy.test.ts`, `tests/minigame-flappy.test.ts`
- Replace: `src/ui/minigames/flappy.ts` (keep `export function mountFlappy`)
- Modify: `src/styles/panels.css` (append `/* flappy */`)

**Produces:**

```ts
// src/games/flappy.ts
export const FLAPPY = { W: 480, H: 360, WIN: 10, GRAVITY: 1500, FLAP: -420, SPEED: 150, SPEED_GAIN: 0.05, GAP: 130, SPACING: 220, R: 10, FLOOR: 330, COL_W: 52, GRACE_MS: 1000 } as const
export type Column = { x: number; gapY: number; passed: boolean }
export type FlappyState = { y: number; vy: number; cols: Column[]; score: number; speed: number; dead: boolean; started: boolean; grace: number; seed: number; t: number }
export function newFlappy(seed = 1): FlappyState     // bird at y=H/2, first column at x = W + 60, three columns pre-spawned SPACING apart
export function flap(s: FlappyState): FlappyState     // sets started, vy = FLAP (ignored when dead)
export function step(s: FlappyState, dtMs: number): FlappyState  // not started → idle bob only; gravity; columns move −speed·dt; spawn when last.x < W − SPACING; score on passing col.x + COL_W < birdX(=W*0.3); speed *= 1+GAIN each 5 points; collision (circle vs column rects, floor, ceiling) → dead unless grace > 0
export function revive(s: FlappyState): FlappyState   // dead → alive at y=H/2, vy=0, remove any column within 120px of the bird, grace = GRACE_MS
export function won(s: FlappyState): boolean          // score >= WIN
```

- [ ] Step 1: `tests/flappy.test.ts` — seeded gap positions are deterministic and inside `[60, FLOOR-60-GAP]`; without flaps the bird hits the floor and dies; a flap sets vy negative; passing a column scores once; speed rises at 5; collision with a column kills; `revive` clears the nearby column and grants grace during which collisions are ignored; `won` at 10. → implement → PASS.
- [ ] Step 2: Renderer: `panelHead('Chalk Flight', 'STUDY HALL')`, `<p class="mg-rule">Tap or press Space to flap. Fly through ten gaps and the notice board is yours.</p>`, `makeCanvas(root, 480, 360, { label: 'Chalkboard' })`, score `<b data-f="score">`. Draw as chalk: fill `#1f3d2f`, a static grain layer (pre-rendered once to an offscreen canvas with 400 faint random dots), columns as stacks of chalk-outlined books (rects with 2 px off-white stroke, slight random tilt per column seeded by `gapY`), the bird as a chalk circle with a wing arc and a tiny grad-cap triangle, ground line dashed. Interpolate bird `y` and column `x` with alpha. Input: Space/ArrowUp/W (element-scoped, `e.repeat` return), pointerdown on the canvas, and a big `Flap` button in the footer for touch.
  - Death: `host.gag({ title: 'Bonk.', sub: `${state.score} of ${FLAPPY.WIN}.`, retry: () => (state = newFlappy(seed+1)), hint: () => (state = revive(state)) })`.
  - Win: `afterWin(() => host.close({ id: 'flappy', won: true, score: state.score }))`. Session `{ score: () => state.score, destroy }`. Reduced motion: no grain, no wing flutter.
- [ ] Step 3: `tests/minigame-flappy.test.ts` — renders canvas + Flap button; Space flaps (drive `step` through the loop with a fake rAF or expose the loop's `step` via the session for tests — add `__step?(ms: number)` on the returned session, harmless in prod); dying opens the gag; `?cheat=1` button closes as a win and unlocks `education`. → PASS.
- [ ] Step 4: CSS + `npx tsc --noEmit`.

---

### Task 8: Letter wheel — "Word Forge"

**Files:**
- Create: `src/games/forge.ts`, `tests/forge.test.ts`, `tests/minigame-forge.test.ts`
- Replace: `src/ui/minigames/forge.ts` (keep `export function mountForge`)
- Modify: `src/styles/panels.css` (append `/* forge */`)

**Produces:**

```ts
// src/games/forge.ts
export type ForgeWord = { word: string; skill: string }       // word uppercase; skill = exact item string in content.ts skills groups
export type ForgeRound = { ring: string[]; words: ForgeWord[] }
export const FORGE_ROUNDS: ForgeRound[] = [
  { ring: ['J','A','A','V','K','K','F'], words: [{ word:'JAVA', skill:'Java' }, { word:'KAFKA', skill:'Apache Kafka' }] },
  { ring: ['F','L','I','N','K','U','X'], words: [{ word:'FLINK', skill:'Apache Flink' }, { word:'LINUX', skill:'Linux' }] },
  { ring: ['R','E','D','I','S','O','C','K'], words: [{ word:'REDIS', skill:'Redis' }, { word:'DOCKER', skill:'Docker' }] },
  { ring: ['G','I','T','S','P','R','N'], words: [{ word:'GIT', skill:'Git' }, { word:'SPRING', skill:'Spring Boot' }] },
  { ring: ['P','Y','T','H','O','N','S','Q','L'], words: [{ word:'PYTHON', skill:'Python' }, { word:'SQL', skill:'SQL' }] },
]
export function canSpell(ring: string[], word: string): boolean     // multiset containment
export function groupOf(skill: string): string                     // label of the content.ts group containing the skill
export type ForgeState = { round: number; found: string[]; revealed: Record<string, number>; misses: number; picked: number[]; status: 'play' | 'won' }
export function newForge(): ForgeState
export function pick(s: ForgeState, ringIndex: number): ForgeState       // append if not already picked
export function unpick(s: ForgeState): ForgeState
export function current(s: ForgeState): string                           // letters of picked
export function submit(s: ForgeState): { state: ForgeState; result: 'found' | 'dup' | 'miss' | 'short' }  // clears picked; miss increments misses; found → next round when all words found (misses reset); status 'won' after last round
export function hint(s: ForgeState): ForgeState                          // revealed[word]++ for the first unfound word with the fewest reveals; max 2 per round total
export function revealWord(s: ForgeState): ForgeState                    // marks the first unfound word found (the Hire-me payout)
export function shuffle(ring: string[], seed: number): string[]          // seeded Fisher–Yates
```

- [ ] Step 1: `tests/forge.test.ts` — every `skill` string exists verbatim in `ZONES` skills groups (drift guard); every ring spells every word of its round (`canSpell`); rings ≤ 9 letters; no word is spellable from another round's ring **is not required** (skip); `submit` found/dup/miss/short and round advance; `hint` limits; `revealWord`; `shuffle` is a permutation. → implement → PASS.
- [ ] Step 2: Renderer: `panelHead('Word Forge', 'THE WORKSHOP')`, `<p class="mg-rule">Spell the tools Naman actually uses. Drag or tap the letters, then press Enter.</p>`, slots `<ul class="fg-slots">` one `<li>` per word: group label + `<span class="fg-tile">` per letter (revealed letters shown, found words filled), current word `<div class="fg-current">`, ring `<div class="fg-ring">` with `<button class="fg-letter" style="--a:<deg>">` placed by `transform: rotate(var(--a)) translate(110px) rotate(calc(-1*var(--a)))`, an `<svg class="fg-path">` polyline overlay for the drag trail, footer: `Shuffle`, `💡 Hint (2 left)`, `Enter`, `⌫`, `Leave`. Pointer: `pointerdown` on a letter starts a drag (`setPointerCapture` on the ring), `pointermove` hit-tests letters (`elementFromPoint`) to `pick`, `pointerup` submits. Keyboard: letters (must be present unpicked in the ring), Enter, Backspace. Results: found → chip toast `ui:toast { icon:'🔧', title:`${word} — ${skill}`, sub: groupOf(skill) }` and `.fg-slot.found` flash; miss → `.fg-current.shake` + note "Not one of Naman's tools."; 6 misses in a round → `host.gag({ title: 'Stuck at the bench?', sub: 'Every word is a tool on the walls.', retry: () => (misses = 0), hint: () => (state = revealWord(state)) })`.
  - Win: `afterWin(() => host.close({ id: 'forge', won: true, score: FORGE_ROUNDS.length }))`. Session `{ score: () => state.round, destroy }`.
- [ ] Step 3: `tests/minigame-forge.test.ts` — renders 7 letters for round 1 and two slots; clicking J,A,V,A then Enter marks JAVA found and toasts the skill; KAFKA finishes round 1 and renders round 2's 7 letters; a miss shakes and counts; 6 misses open the gag; typing letters works; finishing all rounds closes as a win and unlocks `skills`. → PASS.
- [ ] Step 4: CSS; `npx tsc --noEmit`.

---

### Task 9: Among Us tiles — "Crew Drop"

**Files:**
- Create: `src/games/crew.ts`, `tests/crew.test.ts`, `tests/minigame-crew.test.ts`
- Replace: `src/ui/minigames/crew.ts` (keep `export function mountCrew`)
- Modify: `src/styles/panels.css` (append `/* crew */`)
- Read: `src/core/rng.ts` (seeded RNG helpers — reuse), Task 2 utilities (`createLoop`, `makeCanvas`, `mountPad`).

**Produces:**

```ts
// src/games/crew.ts
export const CREW = { W: 10, H: 7, CRACK_MS: 700, MOVE_MS: 160, THINK_MS: 220, SHRINK_START_MS: 15000, SHRINK_EVERY_MS: 2500, ERR0: 0.1, ERR1: 0.4, ERR_RAMP_MS: 30000, BOTS: 4, FREEZE_MS: 1000 } as const
export type Tile = { state: 'ok' | 'cracking' | 'gone'; t: number }
export type Bean = { id: 'you' | 'bot0' | 'bot1' | 'bot2' | 'bot3'; x: number; y: number; fx: number; fy: number; moveT: number; alive: boolean; think: number; frozen: number }
export type CrewState = { tiles: Tile[]; beans: Bean[]; t: number; nextShrink: number; seed: number; status: 'play' | 'won' | 'lost' }
export type Dir = 'up' | 'down' | 'left' | 'right'
export function newCrew(seed: number): CrewState      // you at (1, 3); bots at (8,1),(8,5),(4,0),(5,6); all tiles ok
export function tileAt(s: CrewState, x: number, y: number): Tile | null
export function tryMove(s: CrewState, id: Bean['id'], d: Dir): CrewState   // ignored mid-move, off-grid, onto 'gone', or frozen; sets fx/fy target and moveT
export function step(s: CrewState, dtMs: number): CrewState    // advance moves; on arrival start cracking the tile stood on; cracks expire → gone → any bean standing there dies; bots think; shrink schedule; status when you die or all bots dead
export function botChoice(s: CrewState, b: Bean, rnd: () => number): Dir | null   // greedy: neighbour 'ok' tile with most 'ok' neighbours; with prob err(t) pick any non-gone neighbour
export function revive(s: CrewState): CrewState   // you → random 'ok' tile (seeded), bots frozen FREEZE_MS, status 'play'
```

- [ ] Step 1: `tests/crew.test.ts` — deterministic for a seed; a bean standing still dies after `CRACK_MS`; moving keeps you alive; bots never step onto `gone`; with a "always move to the best neighbour" player policy every seed 1..20 ends (won or lost) within 60 s of simulated time; `revive` places you on an `ok` tile and freezes bots; shrink starts after 15 s (some border tile cracking with no bean on it). → implement → PASS.
- [ ] Step 2: Renderer: `panelHead('Crew Drop', 'HARBOR ARCADE')`, `<p class="mg-rule">The floor gives way wherever you stand. Keep moving. Last bean standing wins.</p>`, `makeCanvas(root, 640, 420, { pixelated: true, label: 'Dropping floor' })`, `mountPad` for touch (visible when `matchMedia('(pointer: coarse)')` or always on small widths — CSS `@media (pointer: coarse)`), footer `Leave`. Draw: tiles 56×48 with a lit top face and a darker lip, cracking → hairline cracks + slight sink, gone → dark pit; beans: rounded body, visor ellipse, backpack, colours `you: #ff7a59` (the visitor's coral), bots red/blue/green/yellow ramps; movement interpolated by `moveT`; a falling bean shrinks and fades over 400 ms. Keys: WASD/arrows (element-scoped). Lose: `host.gag({ title: 'You were ejected.', sub: 'Naman was not the impostor.', retry: () => (state = newCrew(seed+1)), hint: () => (state = revive(state)) })`. Win: `afterWin(() => host.close({ id: 'crew', won: true, score: 1 }))`. Session `{ score: () => (state.status === 'won' ? 1 : 0), destroy }`.
- [ ] Step 3: `tests/minigame-crew.test.ts` — canvas + pad render; ArrowRight moves you (drive with the exposed `__step`); standing still → gag; cheat → win, quest `crew` done, captain owned. → PASS.
- [ ] Step 4: CSS; `npx tsc --noEmit`.

---

### Task 10: UI — locked cards, Résumé tab, objective chip, map pulse, prizes panel, lock views

**Files:**
- Modify: `src/ui/panels.ts`, `src/ui/journal.ts`, `src/ui/hud.ts`, `src/ui/map.ts`, `src/ui/elevator.ts`, `src/ui/toolwall.ts`, `src/ui/welcome.ts`, `src/ui/index.ts` (register prizes), `src/styles/panels.css`, `src/styles/ui.css`, `src/data/content.ts` (`LandmarkKind` drop `'engine'` if Task 4 left both)
- Create: `src/ui/prizes.ts`, `tests/ui-locks.test.ts`, `tests/ui-resume.test.ts`, `tests/ui-objective.test.ts`
- Test (update): `tests/ui-elevator.test.ts`, `tests/registry.test.ts` (map section, if pin markup changes)
- Read: Task 0 contracts (`uiState.unlocked`, `uiState.objective`, `facet:unlocked`), `src/data/story.ts` (`STORY_HINTS`, `STATIONS`).

**Produces / behaviour:**

- `panels.ts`: `export const isUnlocked = (id: string) => id === 'contact' || uiState.unlocked.includes(id)`. `openZone(id)`: locked → `.book.locked` card: `<p class="d-kicker">LOCKED</p><h2 class="d-title">${z.label}</h2><p class="d-body">${STORY_HINTS[id]}</p>` + `[Show on map]` (`events.emit('ui:panel', { id: 'map', data: { focus: lm.id } })`) + `[Close]`. Facet queue: `events.on('facet:unlocked', ({ id, first, announce }) => { if (!announce || !first) return; queue.push(id); flush() })` where `flush` opens `zone:<id>` when `!isModalOpen()`, else waits for the next `ui:closed`. Also push `id` into `uiState.unlocked` if absent (scenes also do this; idempotent).
- `prizes.ts`: panel id `prizes` — a chooser of the three projects (`lineage`, `safestride`, `stealth`) as buttons with lock state; click → `openZone`.
- `journal.ts`: new first tab `Résumé` (`resume`): the eight `ZONES` in Reader order (`about, experience, education, skills, lineage, stealth, safestride, contact`) as `<button class="rs-row" data-zone>` with ✓/🔒, the zone label + title (title hidden when locked → show hint instead); click → `openZone`. `lastTab` default `'resume'`.
- `hud.ts`: `.hud-objective` chip (in `.hud-chips`) `<span class="hud-chip hud-objective" hidden><i class="hud-compass" aria-hidden="true">➤</i><span class="hud-obj-text"></span></span>`; `refreshObjective()` every 500 ms (setInterval started in `initHud`) reads `uiState.objective` and `uiState.player`: text, and `--rot` = bearing in degrees from player to `(tx*TILE+16, ty*TILE+16)` (`Math.atan2(dy, dx)` → CSS rotate; use `TILE` from `src/config.ts`); hidden when `null`. Click → `events.emit('ui:panel', { id: 'map' })`.
- `map.ts`: `openMap(data?: { focus?: string })` — accept the `ui:panel` data; pin for `uiState.objective?.landmark` gets `.objective` (CSS pulse ring) even if undiscovered; `focus` selects that pin (hint text says where it is). Express route copy: "the roof is one hop away" stays, subtitle "Bo's visitor pass".
- `elevator.ts`: if `!isUnlocked('experience')` → floors disabled except Lobby, card text: "The lift wants a visitor pass. Bo hands them out at the pier — solve his word puzzle." (still no digits).
- `toolwall.ts`: if `!isUnlocked('skills')` → tools render as silhouettes (`.tool.locked` with `🔧` glyph and `???` names) and the note reads "Spell them out at the bench and Ravi hangs them up."
- `welcome.ts`: `PITCH = 'I build real-time systems that move money — this island is my résumé. Bo will show you around.'` (update the verbatim expectation in `tests/ui-welcome.test.ts` only if it hardcodes the string).
- [ ] Step 1: `tests/ui-locks.test.ts` — locked `openZone` shows label + hint, never the title/body; "Show on map" opens the map with the pin selected; unlocked opens the normal card; `facet:unlocked` with a modal open defers the card until `ui:closed`; `announce:false` never opens. → implement → PASS.
- [ ] Step 2: `tests/ui-resume.test.ts` — eight rows in order; ✓/🔒 states; clicking a locked row opens the locked card; `prizes` panel lists three. → PASS.
- [ ] Step 3: `tests/ui-objective.test.ts` — chip hidden when `objective` null; shows text and rotates toward the target; click opens map; map pin `.objective` present; elevator/toolwall lock views. Update `tests/ui-elevator.test.ts` to set `uiState.unlocked = ['experience']` in its `beforeEach`. → PASS.
- [ ] Step 4: CSS (`.book.locked` muted accent + lock glyph, `.rs-row`, `.hud-objective`, `.hud-compass { display:inline-block; transform: rotate(var(--rot)) }`, `.map-lm.objective::after` pulse keyframe, `.tool.locked`), `npx tsc --noEmit`.

---

### Task 11: Scenes — Bo's arrival, relocation, story wiring

**Files:**
- Modify: `src/scenes/WorldScene.ts`, `src/scenes/InteriorScene.ts` (only if `panel:prizes`/host greet needs a tweak — likely none), `src/main.ts` (`?fresh=1` clears via `clearSave`, unchanged; `hadLegacySave` if referenced)
- Read: spec §4, `src/data/story.ts`, `src/entities/Npc.ts`, `src/systems/Cutscene.ts`, current `arrival()` at `WorldScene.ts:964-1010`.

- [ ] Step 1: Cast: `NPC_CAST` → remove `mira`, `lou`, `devi`; add `{ id: 'dockmaster', name: 'Bo', x: 0, y: 0, behaviour: { kind: 'idle' }, facing: 'down' }`. `hadV1Save` → `hadLegacySave` (if Task 1 did not already).
- [ ] Step 2: Handlers: `this.state.handlers.minigame = (id) => events.emit('ui:panel', { id: 'minigame', data: id })`.
- [ ] Step 3: State emission: in `emitState()` (and once after `startPlay`): `uiState.unlocked = this.state.save.unlocked`; `uiState.objective = objectiveFor(this.state.storyNext())` where `objectiveFor(step)` → `null` when step is null, else `{ step, text: STATIONS[step].hint, landmark: STATIONS[step].landmark, tx, ty }` with `tx,ty` = the **landmark door** tile for that station's landmark (`BLUEPRINT.landmarks.find(l => l.id === landmark).door`), except `meet`/`experience` which use Bo's pier spot. Subscribe `events.on('story:changed', …)` → refresh + `this.relocateBo()`; `events.on('facet:unlocked', …)` → refresh.
- [ ] Step 4: Bo relocation: `private boStation(): Vec2` = `stationSpot(this.state.storyNext())` in pixels (`tile*TILE+8`, `tile*TILE+12` like NPC creation). `private relocateBo(force = false)`: if Bo's `home` already equals the station → return; if `force` or Bo is outside the camera view (`this.cameras.main.worldView` inflated by `2*TILE`) → snap `bo.setPosition`, update `bo.home` (add a public `rehome(x, y)` to `Npc` that sets `home`, position, clears `target`); else set `bo.target` toward the station: `home + normalize(station − pos) * 4*TILE` (walk off). Call `relocateBo()` every 500 ms from `update` (throttled) and `relocateBo(true)` in `onWake` (returning from an interior — Bo is off-screen by definition) and in `startPlay` after the save loads.
- [ ] Step 5: Arrival (§4.4): replace the Mira block with Bo: find `dockmaster`, walk him over, `cs.end()`, then `await this.runDialogue({ ...tree, entry: [{ node: 'intro' }] }, 'dockmaster')` (the About card opens from the `effectsAtEnd`; the dialogue box waits while a modal is open — verify by reading `ui/dialogue.ts:99`). After the tree ends: `this.state.unlockFacet('about', false)` (idempotent, in case the cutscene was skipped). If the player chose "Let's solve it" the `minigame` effect opened the Wordle: await `new Promise(r => { const off = events.on('ui:closed', ({ id }) => { if (id === 'minigame') { off(); r() } }) })` **only if** `minigames.openId === 'wordle'` right after the dialogue. Then `await this.talkTo(bo)` once more so Bo speaks his follow-up entry (won → `to_fair`; else `puzzle_again`). Finally the existing banner + `tutorialDone`. If `cs.skipped`: skip the walk, still run `unlockFacet('about', false)` and show the controls hint.
- [ ] Step 6: `events.emit('ui:hint', { text: 'WASD / arrows to move · Space to hop · E to talk' })` after Bo's follow-up (once).
- [ ] Step 7: `npx tsc --noEmit`; `npx vitest run tests/transitions.test.ts tests/registry.test.ts`; then a browser smoke: `npm run dev`, `http://localhost:5173/lineage/?st=1&fresh=1&cheat=1&word=kafka` → Start → arrival → Bo's three lines → About card → Wordle opens → solve (type kafka) → Experience card → Bo's follow-up → objective chip reads the tent. Report screenshots to `scratch/shots/v3-*.png`.

---

### Task 12: Integration, full verification, handoff (orchestrator)

- [ ] `npm test` (0 failures, 0 skips) · `npx tsc --noEmit` · `npm run build`; fix integration seams.
- [ ] Playwright run of spec §11's browser list, plus mobile 390×844 and Reader Mode ungated.
- [ ] Update `docs/HANDOFF.md` (TL;DR, architecture map, conventions, gates, backlog, checkpoint #4) and the memory file. Do not commit; tell the user how to run and that one word ships it.

---

## Self-review (done at authoring)

- Spec coverage: §3 mapping → Tasks 1, 5–9; §4 spine → 1, 10, 11; §5 cards → 1, 10; §6 games → 2, 5–9 (+0 for host mercy/cheat); §7 dialogue → 4 (+ `Cond.unlocked/locked` split between 4 and 1); §8 world/rooms → 1 (blueprint), 4 (rooms/signs/content); §9 art → 3; §10 data → 1; §11 tests → each task + 12. Vault/Safe Stride re-read → 4 (rooms) + 10 (locks).
- Type consistency: `unlockFacet(zoneId, announce)` everywhere; `storyNext()` returns `StoryStep | null`; `Objective` fields `step,text,landmark,tx,ty`; renderer exports `mountWordle/mountClaw/mountFlappy/mountForge/mountCrew`; `createLoop({hz, step, draw})`; `makeCanvas(root,w,h,{pixelated,label})`; `mountPad(root,onDir,{held})`.
- Known cross-task seam: `Cond.unlocked/locked` — Task 4 adds the type fields, Task 1 adds the two `check()` lines (both Wave 1). `LandmarkKind 'engine'|'fair'` — Task 4 widens, Task 10 narrows.
