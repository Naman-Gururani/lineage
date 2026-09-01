# Naman's World v2.5 "HD Isle" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve Lineage Isle to 32px HD art on a smaller, denser 96×72 island with faster movement + jumping, a welcome card, modern UI, explanatory NPC hosts, navigating signs, a campus (education, CGPA 9.63), four mini-games with unlocks and the "Hire me" retry gag, and a fishing pass.

**Architecture:** unchanged from v2 — pure TS modules unit-tested in vitest, Phaser 3.90 scenes over a baked chunk world, DOM UI via the typed event bus. This plan modifies constants/art/blueprint in place and adds pure-reducer mini-games rendered in DOM or small Phaser scenes.

**Tech Stack:** Vite 6, TS 5 strict, Phaser 3.90, vitest 4, happy-dom, tsx preview tool, Playwright MCP. Fonts: Inter (body, promote existing devDep), Pixelify Sans (accents).

**Spec:** `docs/superpowers/specs/2026-09-01-naman-world-hd-redesign-design.md` (read it first; its §ns are cited throughout).

## Global Constraints

- **NEVER commit or push.** The repo rule overrides this skill's per-task commit steps: every task instead ends with gates — `npm test`, `npm run typecheck` (and `npm run build` where stated) — all green before the task is done.
- Facts about Naman ONLY from `src/data/content.ts`; skills = approved set only (no React/Node/JS); the in-development product stays unnamed. CGPA is **9.63** (spec §10).
- All art painted in code from `palette.ts` keys; every pack must appear in `atlas.ts allDefs()`; preview PNGs before trusting art (`npm run preview:art -- sheet <pack> 3`, `-- world` for the island).
- Keyboard via `src/core/keys.ts` only; Escape-opens-modal must stay `setTimeout(0)`-deferred.
- Pure modules (core/, world/ non-bake, systems/{Quests,Xp,Achievements,Dialogue} + all new reducers) never import Phaser.
- Reduced motion disables squash/stretch, look-ahead, particles, micro-transitions. Reader Mode exposes every content section including Education.
- Browser testing: `http://localhost:5173/lineage/?st=1&fresh=1`; synthetic KeyboardEvents need `keyCode`; `window.__game`/`__events` exposed; Playwright tab is shared (subagents must not navigate it — main agent playtests).
- Granularity precedent (as v2): exact interfaces, algorithms, copy and test code are given in full; pixel-map data (sprites, rooms, climb stages 2–3) is specified by format + style rules + one worked example, gated by preview-PNG review.
- Windows shell gotcha: write any patch scripts to `scratch/*.cjs` via the Write tool; no long `node -e` heredocs.

---

## File map (Create ▸ / Modify ◆)

```
◆ src/config.ts                     TILE 32, 96×72, CHUNK 1024, speeds, pickZoom 1/1.5/2
◆ src/core/save.ts                  Save v2 (hats[], minigames, fish, welcomeSeen), key nw2.save.v2, v1 discard
◆ src/core/keys.ts                  add Space to tracked keys if not already
◆ src/art/palette.ts                6–7 step ramps + campus-brick/warehouse-wood hues (keys superset of old)
◆ src/art/tiles.ts                  32px terrain painters, 3 variants, autotile edges
◆ src/art/sprites/hero.ts           32×48 rig, walk/idle/hop/fish frames + portrait_naman
◆ src/art/sprites/npcs.ts           rig at 32×48 for 11 NPCs + professor + dockmaster + faces
◆ src/art/sprites/env.ts            trees ≈64×80, rocks, bushes, grass, flowers @32
◆ src/art/sprites/props.ts          fences, crates, lamps, finger-post signs, chests… @32
◆ src/art/sprites/buildings.ts      7 landmarks + campus + warehouse + houses @2× px
◆ src/art/sprites/interior.ts       32px interior sets + study-hall + warehouse props
◆ src/art/atlas.ts                  buildSheet budget 2048 → 4096
◆ src/world/terrain.ts              LOW + LEDGE flags (see Task 3)
◆ src/world/blueprint.ts            96×72 relayout incl. campus + warehouse + brook + ledges
◆ src/world/collision.ts            (unchanged API; hop planner is separate)
▸ src/world/hop.ts                  pure hop landing planner + ledge lookup
◆ src/world/rooms.ts               (parser unchanged) rooms data gains campus + warehouse
◆ src/entities/Player.ts            speeds, always-run, hop animation + shadow, ledge auto-hop
◆ src/data/content.ts               CGPA 9.63, PROFILE.location, education zone, LandmarkKind 'campus'
◆ src/data/npcs.ts                  host greetings + tell-me-more (imports content.ts) + directions
◆ src/data/signs.ts                 finger-post arms schema + authored junctions
◆ src/data/quests.ts                4 mini-game quests, explore→8
◆ src/data/achievements.ts          +5 (4 games + Arcade Legend + golden fish ⇒ recount)
◆ src/data/rooms.ts                 campus study hall + harbor warehouse ASCII rooms
▸ src/systems/Minigame.ts           overlay host: pause world, input, results/gag, rewards
▸ src/games/lightsout.ts            pure reducer
▸ src/games/sokoban.ts              pure reducer (+ solver in tests)
▸ src/games/packetrush.ts           pure seeded reducer
▸ src/games/climb.ts                pure platformer physics + stage data
▸ src/ui/minigames/{studyhall,cargo,packetrush,climb}.ts   thin renderers (DOM grids / canvas / Phaser scene for climb)
◆ src/systems/Fishing.ts            windows/tolerance/fish table/?fish=gold
◆ src/systems/GameState.ts          hats[] wardrobe, minigame rewards, packet credits, complete=8
▸ src/ui/welcome.ts                 landing card (replaces title menu contents; attract mode stays)
◆ src/ui/{hud,dialogue,toasts,banner,map,journal,settings,pause,reader,loading,panels,touch}.ts   restyle + wardrobe + education + jump btn
◆ src/styles/ui.css + panels.css    modern token system (§Task 8 block)
◆ src/scenes/WorldScene.ts          hop wiring, ledge tiles, campus/warehouse doors, minigame launch
◆ src/scenes/InteriorScene.ts       new rooms, host auto-greet trigger
◆ tests/*                           updated constants + new suites (each task lists its own)
```

Execution note: dispatch implementation subagents on **Opus 5, max effort** (user instruction; Fable orchestrates, reviews, and playtests).

---

### Task 1: Core reshape — config, save v2, keys

**Files:** ◆ `src/config.ts` ◆ `src/core/save.ts` ◆ `src/core/keys.ts` ◆ `tests/config.test.ts` ◆ `tests/save.test.ts` (+ sweep: update any test asserting old constants)

**Produces (later tasks consume):**
```ts
// config.ts
export const TILE = 32
export const WORLD_TW = 96
export const WORLD_TH = 72
export const CHUNK = 1024
export const WALK_SPEED = 144   // 4.5 t/s
export const RUN_SPEED = 224    // 7 t/s
export function pickZoom(viewW: number, viewH: number): number // 1 | 1.5 | 2
// save.ts
export type Save = { v: 2; …all v1 fields…; hats: string[]; minigames: Record<string, MinigameSave>; fish: Record<string, number>; welcomeSeen: boolean }
export type MinigameSave = { won: boolean; best: number; plays: number }
```

- [ ] **Failing tests first** (`tests/config.test.ts`, extend `tests/save.test.ts`):
```ts
expect(TILE).toBe(32); expect(WORLD_TW).toBe(96); expect(WORLD_TH).toBe(72)
expect(WALK_SPEED / TILE).toBeCloseTo(4.5); expect(RUN_SPEED / TILE).toBeCloseTo(7)
expect(pickZoom(1280, 800)).toBe(1); expect(pickZoom(1920, 1080)).toBe(1.5); expect(pickZoom(2560, 1440)).toBe(2)
// save v2
const s = defaultSave(); expect(s.v).toBe(2); expect(s.hats).toEqual([]); expect(s.welcomeSeen).toBe(false)
// v1 in storage is discarded (fresh default returned), and a migration flag is surfaced:
store.setItem('nw2.save.v1', JSON.stringify({ v: 1 })); expect(loadSave(store)).toBeNull()
```
- [ ] Implement: constants above; `pickZoom`: `const m = Math.min(viewW, viewH * 1.78); if (m >= 2400) return 2; if (m >= 1400) return 1.5; return 1`. Save: bump type/key to `nw2.save.v2`; `loadSave` returns null for any non-v2 payload (old key ignored entirely; on first boot WorldScene shows toast "The island got a big upgrade — fresh start!" when old key exists — wire flag `hadV1Save` exported from save.ts). Extend `defaultSave()`; keep Settings untouched but add `alwaysRun: boolean` (default `true`) to `Settings` + `defaultSettings()` + settings UI task 8 consumes it.
- [ ] `keys.ts`: ensure Space (`' '`/`Space`) is tracked and exported as `jump` binding.
- [ ] Sweep repo tests for `160|120` world-size and speed literals; update to import config constants instead of literals where possible.
- [ ] Gates: `npm test` + `npm run typecheck` green (game will render mis-scaled art until Tasks 2–4 land — that is expected and stated; `npm run build` must still compile).

### Task 2: HD palette + all sprite packs @32px (parallel subagents)

**Files:** ◆ `src/art/palette.ts` ◆ `src/art/sprites/{hero,npcs,env,props,buildings,interior}.ts` ◆ `tests/sprites.test.ts` (dims/legends) — six sub-dispatches, one per pack, after palette lands.

**Binding style rules (spec §3):** ramps 6–7 shades; characters/props 1px selective dark outline + top-left rim light; 2-step AA on curves within a ramp; no pillow shading; terrain/foliage no outline; 40%-alpha ellipse shadows are drawn by entities, not baked into sprites (existing behavior).

**Contracts:**
- `palette.ts` keeps every existing key valid (packs reference keys, so the key set may only grow). Add ramps: `brick1..brick7`, `wood1..wood7` extensions, and extend each existing hue family to ≥6 steps.
- Character rig: frame 32×48, anchor bottom-center `[16, 46]`; sets per character: `walk_{n,e,s,w}_{0..3}`, `idle_{dir}`, `hop_0`, `hop_1` (airborne tuck + stretch); hero additionally `fish_cast`, `fish_reel`, and `portrait_naman` 48×48 (welcome card). Faces (`face_*`) 24×24.
- Buildings double their current pixel dims; keep the SAME frame names and tile footprints as today (blueprint Task 4 relies on footprints; `bld_campus` 6×4 tiles → 192×160px + `bld_warehouse` 4×3 → 128×120px are NEW).
- Trees `tree_oak/pine/willow` ≈64×80; env/props/interior everything ×2 with the same names; NEW: `sign_finger` (multi-arm finger post, 40×56), `prop_chalkboard` (56×40), `prop_noticeboard` (48×40), interior campus set (desks, bookshelf rows, lectern), warehouse set (crate stacks, pallet, rope coil), hats `hat_goggles`, `hat_captain`, `hat_grad` (+ existing hats redrawn to fit the 32×48 rig).
- One full worked example per category is in the current packs (ASCII+legend format unchanged) — study 2–3 existing defs before redrawing; procedural `paint` allowed and preferred for foliage.
- `tests/sprites.test.ts`: update dimension expectations (rig 32×48, faces 24×24…), keep legend-validity checks; add: every def name present in v2 must still exist (rename-guard list frozen in the test).
- [ ] Palette first (its own sub-task; run palette tests).
- [ ] Then six pack subagents in parallel, each: update defs → `npm run preview:art -- sheet <pack> 3` → PNG saved to `scratch/` for MAIN-AGENT review (hard gate: art does not pass on tests alone) → pack tests green.
- [ ] Atlas budget: `buildSheet(allDefs(), 4096)` in `atlas.ts` (one-line change, done with the last pack).
- [ ] Gates green; main agent reviews every sheet PNG against the style rules before Task 3 starts.

### Task 3: Terrain @32 + collision flags (LOW / LEDGE)

**Files:** ◆ `src/art/tiles.ts` ◆ `src/world/terrain.ts` ◆ `tests/terrain.test.ts`

**Produces:**
```ts
// terrain.ts — additive; existing T enum/ids keep their values
export const LOW_KINDS: ReadonlySet<string>   // prop kinds hoppable: 'fence','rock_s','bush','crate','flowerbed'
export type LedgeDir = 'n' | 'e' | 's' | 'w'
// grid gains a parallel ledge layer:
export function ledgeAt(g: Grid, tx: number, ty: number): LedgeDir | null
export function setLedge(g: Grid, tx: number, ty: number, d: LedgeDir): void
export const T_BROOK: number                  // new terrain id: 1-wide water, LOW for hop, blocks walk
```
- [ ] Failing tests: brook blocks `isWalkable` but is listed in `HOPPABLE_TERRAIN`; `setLedge/ledgeAt` roundtrip; painters produce 32×32 rasters; each ground painter yields 3 variants (assert distinct pixels for variant seeds).
- [ ] Implement: repaint all tile painters at 32px (soft dithered edges, autotile grass↔sand↔road as today's mask system); add brook painter (narrow water + banks). Ledge layer: `Uint8Array` sized to grid, 0=none.
- [ ] `npm run preview:art -- world` → review PNG (will still show OLD blueprint at new tile size — layout comes next; judge tile art only).
- [ ] Gates green.

### Task 4: Island relayout @96×72 (campus, warehouse, brook, ledges)

**Files:** ◆ `src/world/blueprint.ts` ◆ `src/world/regions.ts` (if region polys live there) ◆ `tests/blueprint.test.ts` ◆ `tests/world.test.ts`

**Authoritative layout (coordinates in tiles; ±2 latitude where terrain wobble demands, invariants below are the contract):**

| Element | Value |
|---|---|
| land | main `E(48,36,35,24,0.16)`; harbor bulge `E(48,59,15,8,0.1)`; woods NE `E(72,19,18,12,0.12)`; tower NW `E(23,18,17,12,0.1)`; ridge N `E(49,13,16,10,0.1)`; engine SW `E(20,50,14,10,0.1)`; willow SE `E(73,52,15,9,0.08)`; point islet `E(88,63,5,4,0.06)` |
| plateaus | tower `E(23,18,12,8,0.06)`; ridge `E(49,10,9,4,0.05)` |
| ramps | `R(26,25,4,4)` (tower), `R(49,16,4,4)` (ridge) |
| river | pts `(26,28)(29,31)(32,36)(32,41)(30,46)(26,50)(23,55)(20,60)(19,65)`, width 2 |
| brook (NEW, T_BROOK w1) | pts `(66,44)(66,48)(67,52)(67,56)(67,58)` — pond→willow coast, **no bridge: hop it** |
| ponds | `E(66,43,4,2,0.1)` |
| plaza | `E(48,40,8,5,0)` |
| docks | pier `R(47,60,3,8)`; engine jetty `R(13,53,2,6)`; boardwalk `R(76,55,2,8)` + `R(76,61,11,2)` |
| bridges | `R(29,38,6,2)` (tower rd), `R(24,52,6,2)` (engine rd) |
| landmarks | about `(46,31,5,3)` door `(48,34)`; experience `(20,17,6,4)` door `(23,21)`; skills `(69,16,5,4)` door `(71,20)`; lineage `(16,48,6,4)` door `(19,52)`; stealth `(47,8,5,3)` door `(49,11)`; safestride `(71,49,4,3)` door `(73,52)`; contact `(87,61,3,3)` door `(88,64)`; **education `(57,26,6,4)` door `(60,30)`**; **warehouse `(42,55,4,3)` door `(44,58)`, `minor: true`** |
| roads | harbor(48,58)→plaza(48,45); plaza(48,37)→about door; plaza(41,40)→ramp foot(28,28); ramp(26,24)→experience door; plaza(55,38)→education door(60,30); education(62,29)→skills door(71,20); about(46,32)→stealth door(49,12) via ridge ramp; plaza(41,42)→lineage door(19,52); plaza(55,42)→safestride door(73,52); safestride→boardwalk start(76,55); harbor(47,58)→warehouse door(44,58) |
| regions (9) | Harbor S-center; Sunny Meadow (plaza); Tower Heights; Stone Ridge; Whispering Woods; Engine Works; Willow Fields; The Point; **Campus Green** centered ~(58,28) |
| spawn | `(48,59)` pier head; fishingSpot `(48,66)` pier end; viewpoint `(23,13)` plateau top |
| npcSpots | keep all existing ids, repositioned into their regions; NEW `professor`→campus interior (rooms data), `dockmaster`→warehouse interior; outdoor spots: mira(47,57), tomas(49,61), pip(52,57), lou(46,41), ada→tower interior as today, ravi(70,22), sol(21,49), devi(60,29) **moved to Campus Green as groundskeeper**, arjun(72,50), ilse→lighthouse, naman→cottage |
| packetSpots | 20, ≥3 per region except Point(1)/Campus(2) — scatter along roads/grass |
| chestSpots | 6: (18,14) heights, (52,9) ridge, (78,15) deep woods, (14,57) past engine, (79,50) willow, (60,25) campus lawn |
| shellSpots | 5 on harbor/point sand |
| tallGrass | 8 patches `E(40,48,4,2) E(58,34,4,2) E(66,28,3,2) E(76,44,4,2) E(36,30,3,2) E(56,50,3,2) E(26,44,3,2) E(80,26,3,2)` |
| ledges (setLedge) | tower plateau S lip segment tx 20–27 at plateau edge (`'s'`), E lip ty 15–20 (`'e'`); ridge S lip tx 46–53 (`'s'`) — exact tiles = the cliff-ring edge rows the generator already computes; mark during cliff ring pass |

- [ ] Failing tests first (update `tests/blueprint.test.ts` invariants to the new numbers): all 9 landmark doors on walkable land; every door reachable from spawn (flood fill over walkable); roads connect (each road endpoint within 2 tiles of walkable path network); all packet/chest/shell/npc outdoor spots on land and non-overlapping solids; brook tiles are `T_BROOK` and exactly 1 wide; `ledgeAt` returns a dir for ≥ 12 tiles; region polys cover every landmark's door; spawn/fishing on pier.
- [ ] Implement the table. `LandmarkId` union += `'education' | 'warehouse'`; `Landmark` gains `minor?: boolean` (warehouse only: no discovery, no journal, no map label).
- [ ] `npm run preview:art -- world` → **main-agent visual review** of the whole island PNG (composition, road flow, region balance).
- [ ] Gates green.

### Task 5: Hop + ledge system + player feel

**Files:** ▸ `src/world/hop.ts` ◆ `src/entities/Player.ts` ◆ `src/scenes/WorldScene.ts` ◆ `src/ui/touch.ts` ◆ `tests/hop.test.ts`

**Produces:**
```ts
// hop.ts (pure)
export type HopPlan = { lx: number; ly: number; dist: 0 | 0.5 | 1 | 1.5 }  // in tiles, along facing
export function planHop(px: number, py: number, dirX: number, dirY: number, moving: boolean,
  blockedHard: (x: number, y: number) => boolean,   // solids EXCLUDING LOW
  blockedAny: (x: number, y: number) => boolean,    // solids INCLUDING LOW (landing must be clear of both)
): HopPlan
export const HOP_TIME = 0.38
```
- [ ] Failing tests: idle hop → dist 0; clear path → 1.5; landing blocked at 1.5 but clear at 1.0 → 1.0; fully blocked → 0; a LOW obstacle midway is ignored but a LOW obstacle ON the landing point rejects it; hard solid anywhere on candidate landing rejects.
- [ ] Implement `planHop` (candidates 1.5→1.0→0.5→0 sampling the player box at each landing).
- [ ] Player: Space (via `keys.ts`) triggers hop when not in dialogue/cutscene/modal/fishing; motion = tween of render offset (arc peak 0.6·TILE) while logical x/y lerps to the plan over `HOP_TIME`; grounded shadow ellipse persists; squash-stretch on land (skip under reduced motion); during hop, movement input ignored; `hop_0/hop_1` frames; SFX `hop` (reuse existing jump-adjacent blip or nearest SFX id).
- [ ] Ledge auto-hop: in WorldScene movement resolution, walking into a tile whose `ledgeAt` dir matches movement dir → auto-hop 2 tiles down that dir (one-way; same tween, longer arc). No Space needed.
- [ ] Always-run: Player reads `settings.alwaysRun` — base speed RUN_SPEED, Shift = WALK_SPEED (inverted).
- [ ] Touch: add **B jump** button beside A; layout per existing touch UI conventions.
- [ ] Interiors: Space does an in-place cosmetic hop only (`planHop` with blocked-everything).
- [ ] Gates green. Main-agent Playwright check: hop a fence, hop the brook, ledge-hop off the plateau, try to hop into a building (must refuse).

### Task 6: Signs → finger posts

**Files:** ◆ `src/data/signs.ts` ◆ `src/entities/Sign.ts` ◆ `src/ui/prompt.ts` or sign card in `src/ui/panels.ts` ◆ `tests/signs.test.ts`

**Produces:**
```ts
export type SignArm = { dir: 'N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW'; label: string; note?: string }
export type SignDef = { id: string; tx: number; ty: number; arms: SignArm[] }
export const SIGNS: SignDef[]
export const SIGN_TARGETS: Record<string, { tx: number; ty: number }>  // label → world anchor used by the bearing test
```
**Authored junction set (labels must match landmark/region display names):**
- `harbor (48,56)`: N "Village Plaza", S "Harbor · your boat", W "Cargo Warehouse" (note "puzzles inside"), E "Willow Fields"
- `plaza_w (43,40)`: NW "Barclays Tower — Experience", SW "The Engine — payment lineage project", S "Harbor"
- `plaza_e (53,40)`: NE "SRM Campus — Education", E "Safe Stride & The Point", N "Stone Ridge — The Vault"
- `campus (60,32)`: NE "The Workshop — Skills", SW "Village Plaza", N "Whispering Woods"
- `bridge_tower (31,38)`: NW "Tower Heights (ramp ahead)", SE "Village Plaza"
- `bridge_engine (26,52)`: W "Engine Works", E "Village Plaza & Harbor"
- `ridge (49,17)`: N "The Vault (sealed?)", S "The Cottage — About Naman"
- `willow (73,54)`: E "The Point — Lighthouse · Contact", W "Village Plaza", N "the brook — try jumping it"
- [ ] Failing tests: every arm label resolves via `SIGN_TARGETS`; bearing from sign to target within ±45° of arm dir (`Math.atan2`, 8-way sectors); every sign tx/ty is walk-adjacent (a neighbouring walkable tile exists).
- [ ] Implement data + card UI: interact opens a compact list "⬅ The Engine — a real-time payment lineage project" (arrow glyph per dir, label bold, note dim); `sign_finger` sprite replaces old signpost rendering.
- [ ] Gates green.

### Task 7: Welcome card

**Files:** ▸ `src/ui/welcome.ts` ◆ `src/ui/title.ts` (delegate to welcome) ◆ `src/ui/index.ts` ◆ `tests/ui-welcome.test.ts` (happy-dom)

**Copy (verbatim):** headline `Naman Gururani`; sub `Software Development Engineer · Barclays · India`; pitch `I build real-time systems that move money — this island is my résumé. Explore it.`; how-to rows: `Move — WASD / arrows` · `Run — automatic (Shift to stroll)` · `Jump — Space` · `Interact — E`; footer line `Prefer plain text? Reader Mode has everything.`
- [ ] Failing tests (happy-dom): renders name/role from `PROFILE` (import — no string dupes); shows `Continue` as primary when a save exists, `▶ Start` otherwise, with `New Game` secondary + confirm when continuing exists; quick links GitHub/LinkedIn/Email hrefs from PROFILE; Reader Mode button fires the existing reader-open event; focus is trapped and Enter activates primary.
- [ ] Implement over the existing attract mode (drifting island stays behind); portrait uses `frameDataURL('portrait_naman', 2)`; on Start set `save.welcomeSeen`; mobile: stacked layout + touch legend (`Move — left stick` · `Jump — B` · `Interact — A`).
- [ ] Gates green.

### Task 8: Modern UI pass (tokens + every surface)

**Files:** ◆ `src/styles/ui.css` ◆ `src/styles/panels.css` ◆ `src/ui/{hud,dialogue,toasts,banner,map,journal,settings,pause,reader,loading}.ts` ◆ `src/main.ts` (font import) ◆ `package.json` (move `@fontsource/inter` to dependencies) ◆ `tests/ui-*.test.ts` selector updates

**Token block (authoritative, top of ui.css):**
```css
:root {
  --font-body: 'Inter', system-ui, sans-serif;
  --font-accent: 'Pixelify Sans', monospace;
  --radius: 16px; --radius-sm: 12px;
  --glass: rgba(16, 22, 34, 0.72);
  --glass-border: rgba(255, 255, 255, 0.14);
  --ink: #eef3ff; --ink-dim: #9fadc8;
  --accent: #5eead4; --accent-warm: #ffc24b;
  --shadow: 0 12px 32px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.25);
  --ease: cubic-bezier(0.22, 1, 0.36, 1); --t-fast: 160ms; --t-med: 220ms;
}
.card { background: var(--glass); border: 1px solid var(--glass-border);
  border-radius: var(--radius); box-shadow: var(--shadow);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
@supports not (backdrop-filter: blur(1px)) { .card { background: rgba(16,22,34,0.94); } }
@media (prefers-reduced-motion: reduce) { * { transition-duration: 0.01ms !important; } }
```
- [ ] Apply: body text → `--font-body`; Pixelify only on headings/kickers/HUD numerals; HUD → top-left chip cluster (XP pill, coins, packets, clock, region) on `.card`; dialogue → bottom-center card max-width 720px, 48px portrait in a ring, typewriter kept; toasts top-center slide+fade (`--t-med`); panels/map/journal/settings/pause/reader restyled on tokens; loading screen: name + thin progress bar on tokens; settings gains **Always run** toggle (Task 1's setting).
- [ ] Reduced-motion: media query above + JS honors existing setting.
- [ ] Update happy-dom UI tests' selectors/assertions as needed; gates green.
- [ ] Main-agent Playwright screenshot review: welcome, HUD, dialogue, map, journal, settings, reader, pause — desktop + 390×844.

### Task 9: Content — education, CGPA, campus + warehouse rooms & hosts

**Files:** ◆ `src/data/content.ts` ◆ `src/data/rooms.ts` ◆ `src/data/npcs.ts` (info entries only here; trees in Task 10) ◆ `src/scenes/InteriorScene.ts` ◆ `src/ui/reader.ts` ◆ `tests/content.test.ts` ◆ `tests/rooms.test.ts`

- [ ] content.ts: About facts CGPA → `9.63 / 10`; `PROFILE.location = 'India'`; `LandmarkKind` += `'campus'`; new zone:
```ts
{ id: 'education', name: 'SRM Campus', label: 'Education', kind: 'campus', tx: 57, ty: 26, accent: 0x7ec8ff,
  content: { kicker: 'STUDY', title: 'SRM Institute of Science and Technology',
    sub: 'B.Tech, Computer Science & Engineering · 2020 – 2024',
    facts: [ { k: 'Degree', v: 'B.Tech CSE' }, { k: 'Years', v: '2020 – 2024' }, { k: 'CGPA', v: '9.63 / 10' } ],
    body: [ 'Where systems stopped being homework and started being fun.' ] } }
```
- [ ] Rooms (ASCII format as existing rooms.ts): `campus` study hall (~14×10): lectern + chalkboard (`prop_chalkboard`, interact id `studyhall`), noticeboard (interact → education content card), 3 desk rows, bookshelves, professor spot; `warehouse` (~12×9): crate stacks, pallet play-area marker (interact id `cargo`), dockmaster spot. Tests: rooms parse, props resolve to atlas frames, walkable path door→every interactable.
- [ ] `NPC_INFO` += `professor: { name: 'Prof. Iyer', face: 'face_professor' }`, `dockmaster: { name: 'Dockmaster Bo', face: 'face_dockmaster' }`.
- [ ] Reader Mode: Education section renders the new zone (order: About → Experience → **Education** → Skills → Projects → Contact).
- [ ] Journal/map/discovery: education counts (discoveries 7→8 — update `GameState.checkComplete` and explore quest in Task 12); warehouse is `minor` (no discovery/map label).
- [ ] Gates green.

### Task 10: Dialogue depth — hosts, tell-me-more, directions

**Files:** ◆ `src/data/npcs.ts` ◆ `src/systems/DialogueRegistry.ts` (if registration lists live there) ◆ `src/scenes/InteriorScene.ts` (first-visit auto-greet hook) ◆ `tests/dialogue.test.ts`

**Mechanism:** deep branches import content: `import { ZONES, PROFILE } from './content'`; helper `zone(id)` returns the Content; lines interpolate `zone('lineage').body[0]` etc. Registry test asserts every content reference resolves (no undefined text) and every tree's nodes terminate.

**First-visit auto-greet:** InteriorScene, on room enter with flag `greet_<room>` unset → walk host 2 tiles toward player, run node `intro`, set flag. Skippable (existing dialogue skip).

**Copy (verbatim greetings; ≤3 boxes; deep branches use content.ts bodies as their text):**
- Naman (cottage `intro`): "Oh hey — you made it! Welcome to my corner of the island." / "This cottage is the 'about me' chapter. Poke the bookshelf, the photo, the PC — everything answers." / "And if you want the short version: I'm {PROFILE.role} at {PROFILE.company}. The rest of the island is the long version."
- Ada (tower `intro`): "Welcome to the Tower — this building is Naman's job at Barclays." / "The elevator is the trick: every floor is a chapter of his career. Top floor is today." / "Ask me for the guided version anytime."
- Ravi (workshop `intro`): "Careful with the pegboards — every tool up there is something Naman actually uses." / "Three walls: languages, streaming, state & tooling. No decorative tools. I checked."
- Sol (engine `intro`): "You're standing inside Naman's biggest build — a payment lineage engine, rendered as a machine." / "Real thing runs at Barclays: ~750 million records a day, every payment's full path reconstructed hop by hop." / "The console shows it live. Ask me for the deep dive if you like plumbing."
- Vault keeper/object (vault `intro`): "This one stays covered. A product Naman is building on his own — AI spec-driven from day one." / "Even I don't know what's under the sheet. Twenty packets might loosen the lock."
- Arjun (safestride `intro`): "Safe Stride — Naman built this for elders: fall detection, live location, one-press SOS." / "The map on the wall is real. Try the SOS drill — it's a demo, nobody panics."
- Ilse (lighthouse `intro`): "The last chapter. Light the lens and the island sends word to Naman himself." / "Email, GitHub, LinkedIn — the beam carries all three."
- Prof. Iyer (campus `intro`): "Welcome to the campus — SRM Institute of Science and Technology, four years of it." / "Computer Science & Engineering, 2020 to 2024, CGPA 9.63. I keep the notice board honest." / "The chalkboard puzzle is my office hours. Solve all five and earn the cap."
- Dockmaster Bo (warehouse `intro`): "Mind the crates! Actually — go ahead, push the crates. It's a whole thing." / "Six shipping puzzles. Clear them and the captain's cap is yours."
- [ ] Every host also gets nodes: `about_place` ("What is this place?" → 1–2 boxes restating the mapping), `more` (deep dive quoting content bodies), `nearby` (directions: name 2 nearest landmarks + dir words matching Task 6 sign data).
- [ ] Outdoor villagers (mira/tomas/pip/lou/devi): add `nearby` topic each (reuse sign knowledge; devi's is campus-flavored — she keeps the campus lawn now).
- [ ] Tests: registry resolves; every `intro` sets its `greet_*` flag; every tree reachable/terminating; a content-drift test — the strings above that quote numbers (750M, 9.63, 2020–2024) must be sourced from content.ts values, not literals (assert by import equality where quoted).
- [ ] Gates green.

### Task 11: Minigame framework + Study Hall + Cargo Cove

**Files:** ▸ `src/systems/Minigame.ts` ▸ `src/games/lightsout.ts` ▸ `src/games/sokoban.ts` ▸ `src/ui/minigames/studyhall.ts` ▸ `src/ui/minigames/cargo.ts` ◆ `src/systems/GameState.ts` ◆ `tests/{lightsout,sokoban,minigame}.test.ts`

**Framework contract:**
```ts
export type MinigameId = 'studyhall' | 'cargo' | 'packetrush' | 'climb'
export type MinigameResult = { id: MinigameId; won: boolean; score: number }
export class MinigameHost {
  open(id: MinigameId): void            // pauses world (existing modal manager), mounts renderer, routes keys
  close(result: MinigameResult): void   // dispatches rewards via GameState, unpauses
  gag(opts: { title: string; hint?: () => void; retry: () => void }): void  // the lose/stuck overlay
}
```
**Gag overlay (shared DOM, verbatim):** title per game; buttons `[Try again]` `[🤝 Hire me — extra life]` `[Exit]`; Hire-me → run retry/hint AND toast `Excellent choice. HR will be in touch.` with body link `email Naman` (mailto from PROFILE, no auto-open).

**lightsout.ts:**
```ts
export type LoBoard = { n: number; cells: boolean[] }           // true = lit
export function press(b: LoBoard, i: number): LoBoard            // toggle i + orthogonal
export function solved(b: LoBoard): boolean                      // all false
export function genBoard(n: number, presses: number, seed: number): { board: LoBoard; par: number }
export const STUDY_BOARDS: { n: number; presses: number; seed: number }[] =
  [ {n:3,presses:3,seed:11}, {n:3,presses:4,seed:22}, {n:4,presses:5,seed:33}, {n:4,presses:6,seed:44}, {n:5,presses:7,seed:55} ]
```
Tests: press toggles exactly the plus-shape; `genBoard` output is solvable by replaying its own press sequence (generator returns solvable by construction — assert `solved` after re-pressing the recorded cells); all 5 STUDY_BOARDS non-trivial (not already solved).

**sokoban.ts:** chars `# wall · . floor · o goal · $ crate · * crate-on-goal · @ player · + player-on-goal`
```ts
export type SokState = { w: number; h: number; walls: boolean[]; goals: boolean[]; crates: boolean[]; player: number; moves: number; trail: SokState[] }
export function parse(rows: string[]): SokState
export function move(s: SokState, dx: 0|1|-1, dy: 0|1|-1): SokState   // push rules; returns same state if illegal
export function undo(s: SokState): SokState
export function won(s: SokState): boolean
export const CARGO_LEVELS: string[][]   // 6 levels below
```
Levels (verbatim; test proves each solvable with the BFS solver written IN the test file — if one fails the solver test, the implementer fixes the level minimally and re-runs):
```
L1: ["#####","#@$o#","#####"]
L2: ["######","#@$ o#","# $ o#","######"]
L3: ["#######","#  o  #","# @$  #","# $o  #","#######"]
L4: ["#######","#o$ $o#","#  @  #","#o$ $o#","#######"]  // may need widening — solver decides
L5: ["########","#o  #  #","# $@$ o#","#   $  #","#  o   #","########"]
L6: ["########","# o o  #","#$$@ $ #","# o    #","#   #  #","########"]
```
Renderers: DOM grids on `.card` (CSS grid, 48px cells, sprites via `frameDataURL`); Study Hall: click/keys 1–9+arrows; par counter; 12-over-par → `gag({hint})` (hint = flash one correct press computed by replaying generator sequence). Cargo: arrows move, Z undo, R reset; 3 resets same level → `gag({hint})` (hint = show first 5 solver moves as ghost arrows).
- [ ] Rewards wiring in GameState: `minigameWon(id)` → save.minigames[id], hat grant (`studyhall→'grad'`, `cargo→'captain'`) into `save.hats` (Task 12 wardrobe), coins for cargo (+40 via inventory), achievements (Task 12), toast.
- [ ] Gates green; main-agent playtest both games via Playwright.

### Task 12: Wardrobe, achievements, quests wiring

**Files:** ◆ `src/systems/GameState.ts` ◆ `src/ui/pause.ts` ◆ `src/data/achievements.ts` ◆ `src/data/quests.ts` ◆ `tests/{gamestate,quests}.test.ts`

- [ ] `save.hats` = owned; `save.hat` = equipped. Every previously-granted hat migrates conceptually: quest rewards now push into `hats` and auto-equip if bare. Pause menu → **Wardrobe** row: list owned hats (icons via `frameDataURL('hat_*')`), Enter equips (`handlers.hat`), "none" option.
- [ ] Achievements += `ach_studyhall` "Dean's List", `ach_cargo` "Shipshape", `ach_packetrush` "Backpressure? Never", `ach_climb` "Corner Office", `arcade` "Arcade Legend" (all four), `goldfish` "One in a Million" (Task 13). `checkComplete` uses the dynamic list (verify it already does; discoveries ≥ 8 now).
- [ ] Quests += (givers exist after Tasks 9–10): `studyhall` (giver professor, steps solve 5 boards, reward grad cap text), `cargo` (dockmaster, 6 levels, captain's cap), `packetrush` (sol, score 30, goggles + "5 packets recovered"), `climb` (ada, reach roof, hard hat + Tower Express). Explore quest target 7→8. Packet credit: `minigameWon('packetrush')` calls the same packet-collect pathway 5× with synthetic ids `pr_1..pr_5` (world packets stay 20; requirement stays 20).
- [ ] Tests: wardrobe equip/own logic; new quests complete via their event paths; packet credit shows 25-possible/20-needed math; achievement recount.
- [ ] Gates green.

### Task 13: Packet Rush + Tower Climb + fishing pass

**Files:** ▸ `src/games/packetrush.ts` ▸ `src/games/climb.ts` ▸ `src/ui/minigames/packetrush.ts` ▸ `src/ui/minigames/climb.ts` (Phaser mini-scene) ◆ `src/systems/Fishing.ts` ◆ `tests/{packetrush,climb,fishing}.test.ts`

**packetrush.ts (pure, seeded):**
```ts
export type Packet = { lane: 0|1|2; jur: 0|1|2; y: number }      // y 0→1
export type PrState = { seed: number; t: number; speed: number; lives: number; score: number;
  falling: Packet[]; spawnIn: number; over: boolean; won: boolean }
export function prInit(seed: number): PrState                     // speed 0.22, lives 3, spawnIn 1.2
export function prStep(s: PrState, dt: number): PrState           // fall, spawn (rng from seed), overflow at y≥1 → life−1
export function prRoute(s: PrState, jur: 0|1|2): PrState          // routes LOWEST packet: match → score+1 (+speed 4% each 10), else life−1
```
Win at score 30 (`won`, host closes to results + endless option); jurisdiction glyphs `£ € $` with distinct colors. Tests: seeded determinism (same seed ⇒ same first 10 spawns), overflow costs a life, mismatch costs a life, ramp at 10/20, win at 30.

**climb.ts (pure physics + stages):**
```ts
export type ClimbInput = { left: boolean; right: boolean; jump: boolean }
export type ClimbState = { x: number; y: number; vx: number; vy: number; grounded: boolean;
  coyote: number; buffer: number; falls: number; stage: number; atCheckpoint: boolean; done: boolean }
export const CLIMB = { G: 1400, JUMP_V: -420, MOVE_V: 150, COYOTE: 0.08, BUFFER: 0.1, MAX_FALLS: 3 }
export function climbStep(s: ClimbState, inp: ClimbInput, dt: number, stage: StageData): ClimbState
export type StageData = { rows: string[]; platforms: { x: number; y: number; range: number; speed: number }[] }
```
Stage rows chars: `#` solid, `^` hazard (touch = fall/respawn at checkpoint), `C` checkpoint, `E` exit, `.` air. Stage 1 authored here as the worked example (14 rows × 24 cols, gentle); stages 2–3 authored by implementer to constraints (≤25% hazard density, always a jump-reachable path — proven by the test's reachability BFS over the jump lattice). Checkpoint floors show captions: `2023 — DevOps Intern` → `2024 — SDE, Barclays` → `The Lineage Engine — 750M records/day` (strings imported from content.ts where the numbers live).
```
Stage 1 rows (bottom-up authoring allowed; test normalizes):
"........................"
".E......................"
"####...................."
"....................^^.."
"............########.C.."
"........................"
"......###....^^........."
"..C........####........."
"####...................."
"........................"
".....########..........."
"........................"
"@...........###........."
"########################"
```
Tests: gravity integrates; coyote window allows late jump ≤0.08s; buffer fires queued jump on landing ≤0.1s; hazard → falls+1 + respawn at last checkpoint; MAX_FALLS → over; stage reachability BFS start→E for all 3 stages.
Renderer: small Phaser scene (reuses atlas hero frames side-on = `hop_*` + walk_e frames), launched by MinigameHost; lose → gag (`title: 'The corner office stays corner-less — today.'`).

- [ ] **Fishing pass** (`Fishing.ts` constants + logic): bite window `1.6 − 0.07·min(catches,10)` s (floor 0.9); reel tolerance ×1.15; fish table `[{ id:'sardine', p:0.62 }, { id:'parrot', p:0.33 }, { id:'golden', p:0.05 }]` (seeded roll; URL `?fish=gold` forces golden); per-type counts into `save.fish`; golden → `goldfish` achievement; journal stats row. Tests: window shrink curve, table sums to 1, forced-gold flag, counts persist.
- [ ] Gates green; main-agent playtests all: rush lose→gag→win; climb stage 1; catch golden via flag.

### Task 14: Integration sweep + verification + handoff

**Files:** ◆ whatever the sweep flags ◆ `docs/HANDOFF.md`

- [ ] Full gates: `npm test` (expect ≈260+, zero fails) · `npm run typecheck` · `npm run build` (record gzip sizes).
- [ ] Main-agent Playwright full pass (spec §14 flow, desktop + 390×844 with jump button) — fix-forward any finding, re-run gates.
- [ ] Perf sanity: chunk count/log at boot ≤ 12 chunks; no per-frame allocations added in hop path (eyeball profile).
- [ ] Update `docs/HANDOFF.md`: status, TL;DR, architecture deltas (hop.ts, games/, minigames UI, welcome), conventions additions (reducer purity for games; art at 32px; sign schema), verification snapshot, checkpoint entry. Do NOT commit.
```

---

## Self-review (spec coverage)

- §2 config → T1 · §3 art/atlas → T2 · §3 terrain → T3 · §4 island/campus/warehouse → T4 (+rooms T9) · §5 movement/jump/ledges/touch → T5 (always-run setting T1/T8) · §6 welcome → T7 · §7 UI tokens/surfaces → T8 · §8 hosts/tell-me-more/directions → T10 (+greet hook T10) · §9 signs → T6 · §10 education/CGPA → T9 · §11 games/gag/wardrobe/fishing → T11+T12+T13 · §12 quests → T12 · §13 save v2 → T1 (+wardrobe fields T12) · §14 tests/Playwright → per-task + T14 · §15 phasing = task order. Type names cross-checked (HopPlan, MinigameHost, PrState, ClimbState, SokState, LoBoard consistent throughout).
