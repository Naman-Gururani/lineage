# Naman's World 2 ("Lineage Isle") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Phaser portfolio into a rich pixel-art open-world game (title, cutscene, living island, NPCs, quests, interiors, mini-games, save) that delivers the same résumé content.

**Architecture:** Pure TypeScript modules (no Phaser import) for terrain, collision, time, quests, dialogue and save are unit-tested with vitest; Phaser 3.90 scenes (Boot → Title → World ⇄ Interior) render a deterministic, code-generated pixel-art world baked into chunk textures; the DOM overlay (HUD, dialogue, panels, map, journal, settings, reader mode) talks to scenes only through a typed event bus.

**Tech Stack:** Vite 6, TypeScript 5 (strict), Phaser 3.90, Web Audio (generated), vitest, Playwright MCP for browser verification. Fonts: Press Start 2P (UI chrome), Pixelify Sans (dialogue/headers, `@fontsource/pixelify-sans`), Fredoka (long body text).

**Spec:** `docs/superpowers/specs/2026-08-30-naman-world-2-design.md`

## Global Constraints

- No image/audio asset files: all art painted in code, all sound synthesised (spec §1).
- Skills shown are only the approved set — no React/Node/JS; the in-development product stays unnamed; NPC dialogue never invents facts about Naman (spec §1).
- World is 160 × 120 tiles of 16 px, deterministic from `WORLD_SEED = 20240816` (spec §5).
- Pure modules (`src/core`, `src/world/{terrain,blueprint,paths,collision,scatter}`, `src/systems/{quests,achievements,dialogue}`) must not import Phaser (spec §15).
- Reduced motion must disable shake/flash/weather particles (spec §13). Reader Mode must expose every content section (spec §13).
- `npm run typecheck`, `npm test`, `npm run build` must be clean at the end of every task.
- Note on granularity: this plan gives exact interfaces, algorithms and test code; pixel-map data (sprites, rooms) is specified by format + one full worked example per category rather than reproduced in full.

---

## File map

```
src/main.ts                          boot fonts → Phaser + DOM UI (modify)
src/config.ts                        TILE=16, WORLD_W/H tiles, WORLD_SEED, zoom rules, key names
src/core/rng.ts                      seeded PRNG (mulberry32) + helpers
src/core/time.ts                     day-cycle model (pure)
src/core/events.ts                   typed event bus (Phaser EventEmitter under the hood; allowed to import Phaser)
src/core/save.ts                     save/settings persistence (pure over localStorage-like store)
src/art/palette.ts                   named palette
src/art/pixel.ts                     ASCII → canvas painter, outline, sheet packer
src/art/tiles.ts                     per-tile terrain painters
src/art/sprites/{hero,env,buildings,npcs,critters,interior,icons}.ts   ASCII sprite defs
src/art/atlas.ts                     builds one Phaser atlas texture from all sheets, creates anims
src/world/blueprint.ts               the designed island (data + shape helpers)
src/world/terrain.ts                 Terrain ids, grid, rasterise, autotile masks
src/world/paths.ts                   A* roads with curviness
src/world/collision.ts               moveAndSlide
src/world/scatter.ts                 deterministic decor/entity placement
src/world/bake.ts                    grid → chunk canvases (uses art/tiles)
src/world/regions.ts                 region polygons + lookup
src/entities/{Player,Npc,Critter,Companion,Packet,Chest,Grass,Sign,Door,Lamp}.ts
src/systems/{DayNight,Weather,CameraRig,Quests,Achievements,Xp,Dialogue,Fishing,Cutscene}.ts
src/audio/{engine,sfx,music,songs,ambience}.ts
src/scenes/{BootScene,TitleScene,WorldScene,InteriorScene}.ts
src/data/{content,npcs,quests,rooms,signs,achievements,regions}.ts
src/ui/{index,hud,dialogue,panels,map,journal,settings,toasts,banner,reader,touch,pause,title,loading}.ts
src/styles/ui.css
tests/*.test.ts
tools/preview.mjs                    renders any sprite sheet / the baked world to PNG for eyeballing
```

---

### Task 0: Tooling (vitest, preview renderer)

**Files:** Modify `package.json`; Create `vitest.config.ts`, `tools/preview.mjs`, `tests/smoke.test.ts`

**Produces:** `npm test` (vitest run), `npm run preview:art -- <sheet>` writing `scratch/<sheet>.png`.

- [ ] Install: `npm i -D vitest @fontsource/pixelify-sans` (pixelify is a runtime dep: `npm i @fontsource/pixelify-sans`).
- [ ] `vitest.config.ts`: `export default defineConfig({ test: { include: ['tests/**/*.test.ts'], environment: 'node' } })`.
- [ ] `package.json` scripts: `"test": "vitest run"`, `"preview:art": "node tools/preview.mjs"`.
- [ ] `tools/preview.mjs`: minimal PNG encoder (zlib deflate + CRC32) taking an RGBA buffer; imports `src/art/*.ts` via Node's type-stripping (`node --experimental-strip-types` not needed on Node ≥ 23; Node 24 here). Because `HTMLCanvasElement` does not exist in Node, `pixel.ts` must expose a canvas-free core: `rasterize(def): { w, h, data: Uint8ClampedArray }`. The preview tool calls that and writes PNG.
- [ ] `tests/smoke.test.ts`: `expect(1+1).toBe(2)`; run `npm test` → PASS.

### Task 1: Seeded RNG

**Files:** Create `src/core/rng.ts`, `tests/rng.test.ts`

**Produces:**
```ts
export type Rng = {
  next(): number                   // [0,1)
  int(min: number, max: number): number   // inclusive
  range(min: number, max: number): number // float
  chance(p: number): boolean
  pick<T>(arr: readonly T[]): T
  shuffle<T>(arr: T[]): T[]        // in place, returns arr
  fork(label: string): Rng         // independent stream derived from seed+label
}
export function hashString(s: string): number
export function makeRng(seed: number | string): Rng
```
- [ ] Test: same seed → identical 100-number sequences; different labels in `fork` differ; `int(1,6)` over 1000 draws stays within [1,6] and hits every value.
- [ ] Implement mulberry32; `fork` = `makeRng(hashString(String(seed) + ':' + label))`.

### Task 2: Day-cycle model

**Files:** Create `src/core/time.ts`, `tests/time.test.ts`

**Produces:**
```ts
export const DAY_LENGTH = 480            // seconds per in-game day
export type Phase = 'dawn' | 'day' | 'dusk' | 'night'
export const PHASES: { phase: Phase; start: number; end: number }[] // dawn 0–45, day 45–285, dusk 285–330, night 330–480
export function phaseAt(t: number): Phase
export function daylight(t: number): number        // 0..1, smooth (dawn ramps up, dusk ramps down)
export function clockOf(t: number): { h: number; m: number; label: string } // maps t→ 05:00 … 05:00 next day, label "07:30"
export function ambientAt(t: number): { tint: number; darkness: number; warmth: number }
  // tint: 0xRRGGBB multiply colour for sprites (day 0xffffff, dusk 0xffc9a0, night 0x6f7fc0, dawn 0xffe0c8)
  // darkness: 0..0.72 alpha for the overlay; warmth: 0..1 drives lamp glow intensity
export function wrap(t: number): number             // t mod DAY_LENGTH
```
- [ ] Tests: `phaseAt(10)==='dawn'`, `phaseAt(100)==='day'`, `phaseAt(300)==='dusk'`, `phaseAt(400)==='night'`; `daylight` is 1 at t=150, 0 at t=400, monotone within dawn; `clockOf(0).label==='05:00'`; `ambientAt(150).darkness===0`; `ambientAt(400).darkness>0.6`; `wrap(490)===10`.
- [ ] Implement with piecewise smoothstep interpolation between phase keyframes.

### Task 3: Palette + pixel painter

**Files:** Create `src/art/palette.ts`, `src/art/pixel.ts`, `tests/pixel.test.ts`

**Produces:**
```ts
// palette.ts
export const PAL = {
  ink:'#1b1a2e', inkSoft:'#3d3b5c', outline:'#2a2340',
  white:'#fdfbf4', cream:'#f6e7c9', sand:'#e9d59c', sandDark:'#d2b978', sandWet:'#c7ad74',
  grass:'#79c457', grassLight:'#95d66a', grassDark:'#5da745', grassDeep:'#3f8a3b', moss:'#2f6b35',
  leaf:'#4fae4f', leafLight:'#7fd06b', leafDark:'#2f7a3e', pine:'#2b6d4a', pineDark:'#1e5238',
  path:'#c9a36a', pathLight:'#dbb87d', pathDark:'#a9834f', dirt:'#8f6a45',
  water:'#3e9fd8', waterLight:'#67c4ee', waterDeep:'#2b7fc0', waterDeeper:'#1f5f9c', foam:'#e8f8ff', shallow:'#8ad6ee',
  stone:'#8d95a3', stoneLight:'#b4bcc8', stoneDark:'#5f6776', stoneDeep:'#3f4553',
  wood:'#a86e42', woodLight:'#c98c5a', woodDark:'#7a4b2c', plank:'#b98a5a',
  roofRed:'#d8574a', roofRedDark:'#a63d38', roofBlue:'#4d7fc4', roofBlueDark:'#33578f', roofGreen:'#4faa78', roofGreenDark:'#2f7a52',
  wall:'#f1e2c4', wallShade:'#d8c39c', brick:'#c9705a', glass:'#9fdcf5', glassLight:'#d8f3ff', windowNight:'#ffd77a',
  skin:'#f2c6a0', skinShade:'#d9a17b', hairDark:'#3a2a24', hairBrown:'#7a4a2c', hairBlond:'#e5c15b', hairGrey:'#c9c9d6',
  red:'#e2483f', orange:'#f28c28', yellow:'#ffd23f', teal:'#31c7b3', tealLight:'#8ff0e0', purple:'#9b6bf2', pink:'#ff8fb0', blue:'#3a6fe0',
  metal:'#7f8797', metalLight:'#aab2c0', metalDark:'#4a515e', glow:'#bfffe9', shadow:'rgba(20,30,40,0.28)',
} as const
export type PalKey = keyof typeof PAL

// pixel.ts (canvas-free core + browser wrapper)
export type Legend = Record<string, PalKey | 'transparent' | `#${string}`>
export type SpriteDef = {
  name: string
  rows: string[]              // each row same length; '.' = transparent unless remapped
  legend: Legend
  outline?: PalKey            // auto 1px outline around opaque pixels (drawn into transparent neighbours)
  frames?: number             // horizontal strip: rows width = frames * frameW
  anchor?: [number, number]   // origin in frame pixels (default: bottom-centre)
}
export type Raster = { w: number; h: number; data: Uint8ClampedArray }
export function rasterize(def: SpriteDef): Raster
export function outlineRaster(r: Raster, color: string): Raster
export function toCanvas(r: Raster): HTMLCanvasElement          // browser only
export type Sheet = { canvas: HTMLCanvasElement; frames: Record<string, { x: number; y: number; w: number; h: number; ax: number; ay: number }> }
export function packSheet(defs: SpriteDef[], maxW = 1024): { w: number; h: number; place: Record<string, { x: number; y: number; w: number; h: number; frames: number }> }
export function buildSheet(defs: SpriteDef[]): Sheet              // browser only; frame names `${name}` or `${name}_${i}` for strips
export function hex(c: string): [number, number, number, number]
```
- [ ] Tests: rasterize a 3×3 `'.X.', 'XXX', '.X.'` with `X: 'red'` → centre pixel = (226,72,63,255), corners alpha 0; `outlineRaster` makes corners = outline colour; a 2-frame strip `frames: 2` on a 6-wide row yields `place[name].frames === 2` and frame width 3; `packSheet` places non-overlapping rects.
- [ ] Implement: shelf packing sorted by height; `'.'` default transparent; digits/letters map through legend; throw on unknown char (fail fast during boot).

### Task 4: Terrain grid + autotile

**Files:** Create `src/world/terrain.ts`, `tests/terrain.test.ts`

**Produces:**
```ts
export const T = { DEEP:0, WATER:1, SHALLOW:2, SAND:3, GRASS:4, PATH:5, CLIFF:6, PLATEAU:7, RIVER:8, BRIDGE:9, DOCK:10, PLAZA:11, POND:12, TALLGRASS:13 } as const
export type Terrain = typeof T[keyof typeof T]
export type Grid = { w: number; h: number; cells: Uint8Array; get(x: number, y: number): Terrain; set(x: number, y: number, t: Terrain): void; inb(x: number, y: number): boolean }
export function makeGrid(w: number, h: number, fill: Terrain): Grid
export function isWalkable(t: Terrain): boolean   // SAND GRASS PATH PLATEAU BRIDGE DOCK PLAZA TALLGRASS SHALLOW → true
export function isLand(t: Terrain): boolean       // not DEEP/WATER/SHALLOW/RIVER/POND
export function mask8(grid: Grid, x: number, y: number, same: (t: Terrain) => boolean): number
  // bit order: N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128; out of bounds counts as same
export function mask4(grid: Grid, x: number, y: number, same: (t: Terrain) => boolean): number // N=1 E=2 S=4 W=8
export function floodCount(grid: Grid, x: number, y: number, pass: (t: Terrain) => boolean): number
export function distanceField(grid: Grid, pass: (t: Terrain) => boolean): Float32Array // BFS distance to nearest non-pass
```
- [ ] Tests: `mask4` on a grass tile surrounded by water = 0; with N grass = 1; `mask8` out-of-bounds counts as same (corner tile of all-grass grid = 255); `floodCount` on a 3×3 island in water = 9; `distanceField` on centre of 5×5 grass square = 2.
- [ ] Implement with typed arrays, no allocation in hot loops.

### Task 5: Blueprint (the designed island)

**Files:** Create `src/config.ts`, `src/world/blueprint.ts`, `tests/blueprint.test.ts`

**Produces:**
```ts
// config.ts
export const TILE = 16, WORLD_TW = 160, WORLD_TH = 120, WORLD_W = 2560, WORLD_H = 1920, WORLD_SEED = 20240816
export const CHUNK = 512
export function pickZoom(viewW: number, viewH: number): number // ≥1700→4, ≥900→3, else 2

// blueprint.ts
export type Vec2 = { x: number; y: number }   // tile coords (floats allowed)
export type Shape = { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; wobble?: number }
                  | { kind: 'poly'; pts: Vec2[]; wobble?: number }
export type Landmark = { id: 'about'|'experience'|'skills'|'lineage'|'stealth'|'safestride'|'contact'; tx: number; ty: number; w: number; h: number; door: Vec2; sprite: string; room: string }
export type Region = { id: string; name: string; poly: Vec2[] }
export type Blueprint = {
  land: Shape[]; sandWidth: number; plateaus: Shape[]; ramps: { x: number; y: number; w: number; h: number }[]
  river: { pts: Vec2[]; width: number }; ponds: Shape[]
  plaza: Shape; docks: { x: number; y: number; w: number; h: number }[]
  bridges: { x: number; y: number; w: number; h: number }[]
  roads: [Vec2, Vec2][]; landmarks: Landmark[]; regions: Region[]
  spawn: Vec2; npcSpots: Record<string, Vec2>; packetSpots: Vec2[]; chestSpots: Vec2[]; fishingSpot: Vec2; viewpoint: Vec2
}
export const BLUEPRINT: Blueprint
export function inShape(s: Shape, x: number, y: number, noise: (x: number, y: number) => number): boolean
export function rasterize(bp: Blueprint, rng: Rng): Grid   // order: DEEP → land ellipses (GRASS) → sand ring by distanceField ≤ sandWidth → shallows ring outside → plateaus (PLATEAU with CLIFF edge ring) → ramps → river (RIVER) with POND → plaza → docks → bridges → tall grass patches → carve landmark footprints (PLAZA under buildings)
```
Layout (tile coords, 160×120): main land ellipse (80,62,64,44) plus lobes: harbor bulge (80,104,26,12), NE woods lobe (120,34,30,22), NW plateau lobe (36,30,26,18), SE point (138,98,14,10) connected by a 3-wide dock strip; plateau ellipse (36,30,20,13) with a ramp at (44,42,4,3); river spline from (40,40)→(52,58)→(48,78)→(36,96)→sea; ponds (118,86,6,4); plaza ellipse (80,66,9,6); spawn (80,100); landmarks: about (80,52) 5×4 door (82,56); experience (34,26) 6×7 door (37,33); skills (122,30) 6×4 door (125,34); lineage (30,90) 7×5 door (33,95); stealth (82,14) 5×3 door (84,17); safestride (120,84) 5×4 door (122,88); contact (140,98) 3×6 door (141,104). Roads: spawn→plaza, plaza→about, plaza→experience(via ramp), plaza→skills, plaza→lineage, about→stealth, plaza→safestride, safestride→contact.
- [ ] Tests: every landmark footprint is on land and its door tile is walkable; spawn walkable; `floodCount` from spawn over walkable tiles ≥ 6000 and reaches every door tile (connectivity); grid is identical across two `rasterize` calls (determinism); sand ring exists (some SAND adjacent to SHALLOW).
- [ ] Implement `inShape` with `wobble` = noise-scaled radius jitter using value noise over the rng fork `'coast'`.

### Task 6: Roads (A*)

**Files:** Create `src/world/paths.ts`, `tests/paths.test.ts`

**Produces:**
```ts
export function carveRoads(grid: Grid, roads: [Vec2, Vec2][], rng: Rng): void
  // A* on walkable tiles; cost: 1 on PATH (reuse roads), 1.6 grass, 2.2 sand, 8 bridge/dock, +0..0.8 noise for curviness; writes PATH; width 2 (paint neighbour E/S); never overwrites BRIDGE/DOCK/PLAZA
export function astar(grid: Grid, a: Vec2, b: Vec2, cost: (t: Terrain, x: number, y: number) => number): Vec2[] | null
```
- [ ] Tests: astar across a 10×10 grass grid returns a path starting at a and ending at b with 4-neighbour steps; returns null when b is water-locked; `carveRoads` leaves both endpoints PATH.

### Task 7: Collision

**Files:** Create `src/world/collision.ts`, `tests/collision.test.ts`

**Produces:**
```ts
export type Box = { x: number; y: number; hw: number; hh: number }   // centre + half extents (pixels)
export type Solid = { x: number; y: number; w: number; h: number }   // top-left rect (pixels)
export type Blocked = (px: number, py: number) => boolean             // pixel-space predicate (terrain)
export function moveAndSlide(b: Box, dx: number, dy: number, blocked: Blocked, solids: Solid[]): { x: number; y: number; hitX: boolean; hitY: boolean }
  // axis-separated: try x (sample 3 points on leading edge), then y; if blocked, try 1px nudges toward the free side (corner rounding); returns new centre
export function overlaps(b: Box, s: Solid): boolean
```
- [ ] Tests: free move applies dx/dy; a solid directly east stops x but keeps y (slide); a tile predicate blocking y>100 keeps hero at y≤100; corner-nudge lets a hero 1px off a doorway slip through.

### Task 8: Scatter (decor & entities)

**Files:** Create `src/world/scatter.ts`, `tests/scatter.test.ts`

**Produces:**
```ts
export type Decor = { kind: 'tree'|'pine'|'palm'|'bush'|'flower'|'rock'|'grass'|'mushroom'|'shell'|'fence'|'lamp'|'bench'|'crate'|'barrel'|'lily'|'reed'|'stump'|'log'|'flowerbed'; x: number; y: number; v: number; solid: boolean }
export function scatterDecor(grid: Grid, bp: Blueprint, rng: Rng): Decor[]
  // rules: trees/pines dense in the woods region (poisson-ish min spacing 18px), palms near sand in the harbor, no decor on PATH/PLAZA/DOCK/BRIDGE or within landmark footprints+1 tile margin or within 2 tiles of roads' door tiles; lamps along plaza ring and every 12 tiles on roads; fences around cottage garden and safestride garden; reeds/lilies on POND edges; shells on SAND in harbor (exactly 5 quest shells at bp-defined spots + random decorative shells)
```
- [ ] Tests: no decor on non-land or on PATH; no decor inside landmark footprints; deterministic; woods region has > 120 trees; exactly 5 `shell` with `v === 1` (quest shells).

### Task 9: Tile painters + bake

**Files:** Create `src/art/tiles.ts`, `src/world/bake.ts`

**Produces:**
```ts
// tiles.ts — draws one 16×16 tile into a 2D context at (px,py)
export type TilePaintCtx = { ctx: CanvasRenderingContext2D; rng: Rng; frame: number }
export function paintTile(c: TilePaintCtx, grid: Grid, x: number, y: number, px: number, py: number): void
  // GRASS: base + 0–3 speckles (lighter/darker) + rare tuft; edges to SAND: scalloped autotile using mask8; SAND: base + grains; wet sand band next to SHALLOW; PATH: dirt with lighter centre, stones, grass creeping in at edges (mask8); CLIFF: stone face with dark base line and highlight top; PLATEAU: grass variant slightly lighter; PLAZA: cobble 2×2 pattern; DOCK: planks with nails; BRIDGE: planks horizontal + rails on edges; RIVER/POND/WATER/SHALLOW: left transparent (ocean layer shows through) except RIVER paints translucent lighter streaks; TALLGRASS is painted as GRASS (the grass sprite goes on top)
export function paintWaterFrame(ctx, frame: 0|1|2|3): void     // 64×64 seamless tile: two blues + highlight lines shifting per frame
export function paintFoamFrame(ctx, frame: 0|1|2|3): void      // 16×16 shore foam ring pieces per mask4 (4 frames)

// bake.ts
export type Chunk = { cx: number; cy: number; canvas: HTMLCanvasElement }
export function bakeChunks(grid: Grid, rng: Rng, onProgress?: (done: number, total: number) => void): Chunk[]  // 5×4 chunks of 512px
export function bakeMinimap(grid: Grid, scale = 4): HTMLCanvasElement   // 1 px per `scale` tiles → 40×30… use 2 px per tile → 320×240
```
- [ ] Implement; verify with `npm run preview:art -- world` producing `scratch/world.png`; eyeball for coherent coastlines (no 1-tile sand islands: bake applies a 2-pass majority smoothing before painting).

### Task 10: Hero sprites

**Files:** Create `src/art/sprites/hero.ts`

**Produces:** `HERO_DEFS: SpriteDef[]` with frames `hero_idle_{down,up,left,right}`, `hero_walk_{dir}_{0..3}` (16×24 each; right is a mirrored copy of left generated in code), `hero_swing_{dir}_{0,1}`, hats `hat_{seashell,hardhat,catears,crown}_{down,up,side}` (12×8). Design: teal hoodie, dark hair, warm skin, orange sneakers (Naman's accent colours from content: teal/orange/yellow). Walk cycle: contact/pass/contact/pass with 1px body bob and alternating legs.
- [ ] Author ASCII maps; run `npm run preview:art -- hero`; check silhouette reads at 3×.

### Task 11: Environment sprites

**Files:** Create `src/art/sprites/env.ts`

**Produces:** `ENV_DEFS`: `tree_{0,1}` (32×40, canopy 2-frame sway strip), `pine` (24×40), `palm` (28×44, 2 frames), `bush`, `bush_berry`, `flower_{0..3}` (8×8), `flowerbed`, `grass_tall_{0,1}` (16×16, 2 frames), `grass_cut` (particles), `rock_{0,1}`, `stump`, `log`, `mushroom`, `shell_{0,1}`, `fence_h`, `fence_v`, `fence_post`, `lamp` (16×40, plus `lamp_glow` radial 64×64 drawn procedurally), `bench`, `crate`, `barrel`, `lily`, `reed`, `signpost` (20×32), `sign_small`, `fountain` (48×48, 3 frames), `windmill` (48×72 body) + `windmill_blades` (40×40, 4 frames), `boat` (48×28), `dock_post`, `chest_{closed,open}` (16×16), `packet` (10×10, 4 frames glow), `mote` (4×4), `stall` (48×40), `well`, `telescope`, `mailbox`, `bell`, `crab_{0,1}`, `gull_{0,1}`, `butterfly_{0,1}` (8×8), `fish_jump_{0,1,2}`, `firefly`, `puddle`, `rain_drop`, `splash_{0,1,2}`, `dust`, `spark`, `leaf`, `star`, `cloud_shadow` (procedural blob 128×96 soft alpha).
- [ ] Author; preview sheet; every def uses only PAL keys (the painter throws otherwise).

### Task 12: Building sprites

**Files:** Create `src/art/sprites/buildings.ts`

**Produces:** `BUILDING_DEFS`: `bld_about` (80×80 cottage, red roof, chimney, garden fence), `bld_experience` (96×140 tower: cream stone, blue windows in 5 rows, flag, glass elevator shaft on the side), `bld_skills` (96×72 workshop: slanted roof, big door, gear sign), `bld_lineage` (112×88 engine works: dark steel, two chimneys, pipes, glowing core window), `bld_stealth` (80×56 vault door carved in cliff: stone frame, purple sigil, caution tape), `bld_safestride` (80×72 clinic: green roof, heart sign), `bld_contact` (48×120 lighthouse: white/red bands, lamp room, gallery rail). Each also has `_night` overlay def (only lit windows, drawn additively at night) and `_door` position exported: `BUILDING_DOORS: Record<id, {x: number; y: number}>` (pixel offset from sprite bottom-centre).
- [ ] Author; preview; doors align with `BLUEPRINT.landmarks[].door`.

### Task 13: NPC, portrait, critter sprites

**Files:** Create `src/art/sprites/npcs.ts`

**Produces:** `NPC_DEFS`: for each of `mira, tomas, pip, lou, ada, ravi, sol, devi, arjun, ilse, naman`: `npc_{id}_idle_{down,up,left}` + `npc_{id}_walk_{dir}_{0,1}` (16×24; right mirrored in code), portraits `face_{id}` (32×32) and `face_hero`; `cat_{idle,walk_0,walk_1}_{down,up,left}` (16×14). Distinct silhouettes: Mira (captain hat, navy coat), Tomas (bucket hat, beard), Pip (kid, red cap), Lou (apron, chef hat), Ada (blazer, glasses), Ravi (goggles, overalls), Sol (hard hat, hi-vis), Devi (grey bun, shawl, cane), Arjun (hoodie), Ilse (yellow raincoat), Naman (dark hair, teal jacket — the hero's palette so the "you/him" link reads).
- [ ] Author; preview.

### Task 14: Interior tileset + furniture

**Files:** Create `src/art/sprites/interior.ts`

**Produces:** `INTERIOR_DEFS`: tiles `floor_wood`, `floor_stone`, `floor_tile`, `floor_metal`, `rug_{corner,edge,mid}`, `wall_top`, `wall_face_{0,1}`, `wall_bottom`, `door_mat`, `window_day`, `window_night`, `window_sky_{0..3}` (elevator floor views: ground, mid, high, rooftop); furniture `bed`, `desk_pc` (32×24, screen 2 frames), `bookshelf`, `table`, `chair_{l,r}`, `plant`, `fireplace_{0,1}`, `sofa`, `counter`, `reception`, `elevator_{closed,mid,open}` (32×40), `console` (48×32, 2 frames), `tank` (24×40), `pipe_h`, `pipe_v`, `gear_big` (24×24, 4 frames), `workbench`, `toolwall` (64×32 board), `tool_{java,spring,python,cpp,sql,kafka,flink,kstreams,mq,redis,dynamo,docker,linux,git}` (12×12 icon-like tools), `lens` (32×32, 2 frames), `stairs`, `mapscreen` (32×24, 2 frames), `sos_button`, `crate_covered` (the veiled prototype), `poster_{a,b}`, `lamp_table`, `kettle`, `frame_photo`.
- [ ] Author; preview.

### Task 15: Icons + atlas assembly

**Files:** Create `src/art/sprites/icons.ts`, `src/art/atlas.ts`

**Produces:**
```ts
export const ICON_DEFS: SpriteDef[]   // ic_packet, ic_shell, ic_fish, ic_gear, ic_coin, ic_xp, ic_quest, ic_check, ic_map_{about|experience|…}, ic_sun, ic_moon, ic_rain, ic_hat_*, ic_lock
export const ATLAS = 'atlas'
export function buildAtlas(scene: Phaser.Scene): void   // buildSheet(all defs) → scene.textures.addCanvas(ATLAS, canvas); texture.add(frameName,…) per frame; sets customPivot from anchor
export function createAnims(scene: Phaser.Scene): void  // hero walk/idle/swing per dir (8 fps walk), npc walk (6 fps), cat, water/foam handled elsewhere, fountain 4 fps, windmill 6 fps, packet 6 fps, butterfly 8 fps, gull 6 fps, crab 6 fps, fish_jump 8 fps once, fireplace 4 fps, console 3 fps, gear 8 fps, lens 2 fps, mapscreen 2 fps, desk_pc 2 fps, splash 12 fps once
export function frame(name: string): { key: string; frame: string }  // helper → { key: ATLAS, frame: name }
```
- [ ] Implement; boot must throw with a clear message if any frame is missing.

### Task 16: Boot + Title

**Files:** Modify `src/main.ts`, `index.html`; Create `src/scenes/BootScene.ts`, `src/scenes/TitleScene.ts`, `src/ui/loading.ts`, `src/ui/title.ts`, `src/core/events.ts`, `src/core/save.ts`, `tests/save.test.ts`

**Produces:**
```ts
// events.ts
export type Events = {
  'load:progress': { pct: number; label: string }
  'ui:prompt': { text: string | null; key?: string }
  'ui:banner': { title: string; sub?: string }
  'ui:toast': { icon?: string; title: string; sub?: string; kind?: 'xp'|'quest'|'ach'|'info' }
  'ui:dialogue': { tree: string; npc: string }            // world → ui (open box)
  'ui:dialogueClosed': {}                                  // ui → world
  'ui:panel': { id: string }                               // world → ui: show content panel by zone id (or 'elevator' | 'toolwall' | 'lineage')
  'ui:closed': {}                                          // ui → world (any modal closed)
  'ui:lock': { locked: boolean }                           // ui → scenes (modal open)
  'world:state': { packets: number; packetsTotal: number; xp: number; level: number; levelPct: number; time: number; weather: string; coins: number }
  'world:travel': { id: string }                           // ui → world (fast travel)
  'world:action': { action: 'interact'|'run'|'menu'|'map'|'journal' }  // touch → world
  'game:new': {}; 'game:continue': {}; 'game:reader': {}; 'game:pause': {}; 'game:resume': {}; 'game:title': {}
  'save:changed': {}
}
export const events: { on<K extends keyof Events>(k: K, fn: (p: Events[K]) => void): void; off(...); emit<K>(k: K, p: Events[K]): void }

// save.ts
export type Save = { v: 1; x: number; y: number; scene: string; time: number; weather: 'clear'|'breezy'|'rain'; discoveries: string[]; packets: string[]; chests: string[]; grassCut: number; quests: Record<string, { started: boolean; done: boolean; progress: Record<string, number> }>; achievements: string[]; xp: number; hat: string; flags: Record<string, number>; inventory: Record<string, number>; visitedRegions: string[]; talked: string[] }
export type Settings = { master: number; music: number; sfx: number; textSpeed: 'slow'|'normal'|'fast'; shake: boolean; reducedMotion: boolean; touch: 'auto'|'on'|'off' }
export function defaultSave(): Save; export function defaultSettings(): Settings
export function loadSave(store?: Storage): Save | null; export function writeSave(s: Save, store?: Storage): void; export function clearSave(store?): void
export function loadSettings(store?): Settings; export function writeSettings(s: Settings, store?): void
export function migrate(raw: unknown): Save | null   // returns null for unknown/corrupt
```
- [ ] Tests (save): round-trip through an in-memory Storage stub; `migrate({v:99})` → null; `migrate` fills missing fields from `defaultSave()`.
- [ ] BootScene: runs generation as a queue of labelled steps executed one per frame (`'Painting sprites'`, `'Shaping the coast'`, `'Laying roads'`, `'Baking the island'` ×20 chunks, `'Waking villagers'`), emitting `load:progress`; stores results in `scene.registry` (`grid`, `chunks`, `decor`, `minimap`); then `scene.start('title')`.
- [ ] `ui/loading.ts`: replaces the `#loading` block with a pixel progress bar + label; hides on 100 %.
- [ ] TitleScene: draws chunks, slow camera drift along a loop of waypoints (plaza → harbor → lighthouse → woods), ocean layer animated, ambient day; DOM title (`ui/title.ts`): logo "NAMAN'S WORLD" (Press Start 2P, layered shadow, gentle wave via CSS), sub "Lineage Isle", menu: New Game / Continue (if save) / Reader Mode / Settings; first key/click unlocks audio + starts title music; New Game → `events.emit('game:new')` → `scene.start('world', { newGame: true })`.

### Task 17: WorldScene core — movement, camera, depth

**Files:** Create `src/scenes/WorldScene.ts`, `src/entities/Player.ts`, `src/systems/CameraRig.ts`, `src/ui/touch.ts`, `src/ui/hud.ts`, `src/ui/index.ts`; Modify `src/styles/ui.css`

**Produces:**
```ts
// Player.ts
export class Player extends Phaser.GameObjects.Container {  // children: shadow, body sprite, hat sprite
  dir: 'down'|'up'|'left'|'right'; running: boolean; moving: boolean; surface: 'grass'|'sand'|'wood'|'stone'|'water'
  constructor(scene, x, y); move(dx: number, dy: number, dt: number, blocked: Blocked, solids: Solid[]): void
  swing(): Promise<void>; setHat(id: string | null): void; hop(dy: number): Promise<void>; freeze(f: boolean): void
  get feet(): { x: number; y: number }; facingPoint(dist = 14): { x: number; y: number }
}
// CameraRig.ts
export class CameraRig { constructor(scene, target: Player); update(dt): void; shake(intensity: number, ms: number): void; punchZoom(amount: number): void; focus(x, y, ms): Promise<void>; release(): void; setZoomForViewport(): void }
// speeds: walk 80 px/s, run 136 px/s; lookahead 20 px in facing dir, lerp 0.1; deadzone 8 px
```
- [ ] WorldScene.create: read registry; add chunk images (depth −10000) + ocean TileSprites (depth −20000) animated with 4-frame texture swap every 260 ms + slow scroll; decor sprites grouped in per-chunk Containers toggled visible by camera overlap each 200 ms; solids from decor (`solid: true` → 12×8 box at feet) and buildings (footprint minus door); Player at spawn; CameraRig; keyboard (WASD/arrows/Shift/E/Space/Esc/M/J), gamepad (left stick, A=interact, B=run, Start=menu); touch joystick + A/B via `ui/touch.ts` (existing joystick code moved + B button + menu button).
- [ ] Depth: every world sprite `depth = feetY`; chunks −10000; overlays ≥ 100000.
- [ ] HUD (`ui/hud.ts`): portrait, level + XP bar, packets `n/20`, coins, clock dial (sun/moon icon rotates by time), buttons Map (M) / Journal (J) / Menu (Esc). Subscribes to `world:state`.
- [ ] Verify in browser: walk around, run, collide with trees/buildings, camera lookahead, 60 fps (log `game.loop.actualFps` for 5 s).

### Task 18: Interactables + swing action

**Files:** Create `src/entities/{Sign,Door,Chest,Packet,Grass,Lamp}.ts`, `src/data/signs.ts`, `src/systems/Interact.ts`

**Produces:**
```ts
export interface Interactable { x: number; y: number; radius: number; prompt: string; key?: string; onInteract(): void; enabled(): boolean }
export class InteractSystem { add(i: Interactable): void; remove(i): void; update(px, py, facing): Interactable | null /* nearest within radius, in front */; trigger(): boolean }
// Grass: tall grass sprite; hit by swing → 'grass_cut' particles + coin (30 %) or packet (if this grass is a packet host) + achievement counter; regrows after 90 s
// Packet: bobbing 4-frame glow; collected by touch → spark burst, sfx, `world:state`; `id` from blueprint index; hidden hosts (in grass / chests) spawn on reveal
// Chest: E opens → lid anim, spawns packet/coins/item (`gear`, `shell`), shake
// Sign: E → small speech-bubble panel with `signs.ts` text; swing → bonk wobble tween + counter
// Door: E → `scene.enterRoom(roomId)`; locked door (vault) shows `Sealed — 12/20 packets`
// Lamp: registers a light with DayNight
```
- [ ] Swing: `E`/`Space` with no interactable → `player.swing()` (2 frames, 220 ms, hit-stop 40 ms when something is hit) checks a 14×12 box in front for Grass/Sign/bell.
- [ ] Signs content (`signs.ts`): 12 signposts with real directions ("← Barclays Tower · Harbor →"), jokes and hints ("Tall grass hides lost packets. Swing at it.").

### Task 19: Day/night lighting

**Files:** Create `src/systems/DayNight.ts`

**Produces:**
```ts
export type Light = { x: number; y: number; r: number; color?: number; flicker?: boolean; on?: () => boolean }
export class DayNight {
  constructor(scene: Phaser.Scene, opts: { getTime: () => number })
  addLight(l: Light): Light; removeLight(l): void
  update(dt: number): void   // tint all tinted layers via ambientAt; darkness RenderTexture sized to camera view (scrollFactor 0), fill(0x101433, darkness), erase 'light_soft' at each light (screen coords) scaled r*(1±flicker), then draw additive warm glow sprites (BlendModes.ADD, alpha = warmth*0.35); stars: 60 twinkling 1px sprites over water when darkness>0.4; building `_night` overlays alpha = warmth
  get isNight(): boolean
}
```
- [ ] Verify: at t=400 the scene is dark with lamp pools; the lighthouse beam (a long triangle sprite rotating at 20°/s, ADD blend) only when the beacon quest is done — but at night unlit, the lamp room glows faintly.

### Task 20: Weather, wind, water life

**Files:** Create `src/systems/Weather.ts`, `src/systems/Wind.ts`, `src/systems/Water.ts`

**Produces:**
```ts
export class Weather { state: 'clear'|'breezy'|'rain'; constructor(scene, rng); update(dt); set(state); }   // rain: 180 diagonal drop sprites recycled in camera view + 20 puddle ripples on land + darker ambient (−0.18 daylight) + rain ambience; rainbow arc sprite for 30 s after rain; weather rolls each in-game day at t=45: clear 55 %, breezy 25 %, rain 20 %
export class Wind { register(sprite, kind: 'grass'|'flower'|'canopy'); update(dt) }  // gust field g(x,t)=sin(t*0.8 + x*0.01)*strength; applies skewX/rotation ±0.06 rad to registered sprites in view; leaves emitter in woods when strength>0.5
export class Water { constructor(scene, grid); update(dt) } // ocean TileSprite frames, foam sprites on coast tiles cycling, sparkles at daylight>0.9 near camera, Stream motes: 40 `mote` sprites moving along river polyline at 24 px/s (ADD, brighter at night), fish jumps every 6–14 s in ponds/harbor
export class CloudShadows { constructor(scene); update(dt) } // 6 `cloud_shadow` sprites, MULTIPLY blend alpha 0.18, drifting at 6–10 px/s, wrapping across the world
```
- [ ] Reduced motion → no rain particles/leaves (rain shows as tint + puddles only), cloud shadows static.

### Task 21: NPCs, critters, companion

**Files:** Create `src/entities/{Npc,Critter,Companion}.ts`

**Produces:**
```ts
export type NpcBehaviour = { kind: 'idle' } | { kind: 'wander'; radius: number } | { kind: 'patrol'; pts: Vec2[] }
export class Npc extends Phaser.GameObjects.Container { id: string; constructor(scene, def: { id; x; y; behaviour: NpcBehaviour; facing? }); update(dt, playerNear: boolean); face(x, y); talkStart(); talkEnd(); }  // wander: pick point within radius every 2–5 s, walk 40 px/s avoiding solids (moveAndSlide), idle bob; shows '!' bubble while it has an untriggered quest, '…' when nothing new
export class Critter { kind: 'butterfly'|'gull'|'crab'|'firefly'; ... }  // butterflies: 2-frame flutter, sine wander around flowerbeds, day only; gulls: fly across harbor every 20–40 s with cry; crabs: scuttle sideways between pauses on sand, hide when player within 24 px; fireflies: night in woods, glow (ADD) drift
export class Companion { follow(target: Player) }  // cat: path-follow with 24 px lag, sits when idle > 3 s, meows on interact
```
- [ ] Only update entities within 1.5× camera view; others sleep.

### Task 22: Dialogue system + NPC scripts

**Files:** Create `src/systems/Dialogue.ts`, `src/data/npcs.ts`, `src/ui/dialogue.ts`, `tests/dialogue.test.ts`

**Produces:**
```ts
export type Cond = { flag?: string; notFlag?: string; questDone?: string; questActive?: string; item?: [string, number]; packets?: number }
export type Effect = { setFlag?: string; startQuest?: string; advanceQuest?: [string, string, number]; completeQuest?: string; give?: [string, number]; take?: [string, number]; xp?: number; hat?: string; panel?: string; achievement?: string; companion?: boolean; sleep?: 'morning'|'night'; teleport?: string }
export type Line = { who: string; text: string; face?: string; emote?: 'happy'|'sad'|'think'|'shout' }
export type Node = { lines: Line[]; choices?: { text: string; next: string; when?: Cond }[]; next?: string; effects?: Effect[] }
export type Tree = { id: string; entry: { when?: Cond; node: string }[]; nodes: Record<string, Node> }   // first entry whose `when` passes
export type Ctx = { check(c?: Cond): boolean; apply(e: Effect[]): void }
export class DialogueRunner { constructor(tree: Tree, ctx: Ctx); node: Node; lineIndex: number; get line(): Line; get atChoice(): boolean; advance(): 'line'|'choice'|'end'; choose(i: number): void; get ended(): boolean }
export const NPC_TREES: Record<string, Tree>   // mira, tomas, pip, lou, ada, ravi, sol, devi, arjun, ilse, naman, cat, plus object trees: bookshelf, bed, photo, toolwall_*, console, lens, elevator_*
```
- [ ] Tests: runner walks lines then `end`; `entry` picks the first passing branch; choices route to nodes; effects are applied once when a node is entered.
- [ ] `ui/dialogue.ts`: bottom box (portrait left, name plate, typewriter 40/25/12 ms per char by setting, blip every 2 chars, click/E/Space = complete-or-advance, choices list with arrow keys/click), `aria-live="polite"`.
- [ ] Write the scripts: Mira tutorial (3 branches: first meet / after tutorial / after beacon), Tomas (fishing quest give/turn-in), Pip (shells), Lou (hints), Ada (elevator), Ravi (gear quest + spec-driven line), Sol (packets status), Devi/Arjun (Safe Stride story), Ilse (beacon), Naman (About as a 3-choice conversation: "Who are you?" / "What do you work on?" / "How do you work?" using only `content.ts` facts), cat (meow variants). Keep each line ≤ 110 chars.

### Task 23: Regions, banners, map, minimap, fast travel

**Files:** Create `src/world/regions.ts`, `src/data/regions.ts`, `src/ui/banner.ts`, `src/ui/map.ts`, `tests/regions.test.ts`

**Produces:**
```ts
export function regionAt(regions: Region[], tx: number, ty: number): Region | null   // point-in-polygon
// ui/banner.ts: shows "— Sunny Meadow —" centred with fade/slide (or fade only when reduced motion), 2.2 s
// ui/map.ts: full-screen map modal: minimap canvas scaled ×2.5 (image-rendering pixelated), landmark icons (greyed until discovered), player dot, region labels, "Travel" buttons for discovered landmarks (emits world:travel); minimap widget bottom-right 128×96 with player dot + landmark pips, toggled by settings
```
- [ ] Tests: `regionAt` inside/outside a square; every landmark tile belongs to a region.
- [ ] Fast travel: fade out, teleport to door tile, fade in, small "whoosh".

### Task 24: Interiors

**Files:** Create `src/scenes/InteriorScene.ts`, `src/world/rooms.ts`, `src/data/rooms.ts`, `tests/rooms.test.ts`

**Produces:**
```ts
export type RoomDef = { id: string; name: string; floor: 'wood'|'stone'|'tile'|'metal'; rows: string[]; legend: Record<string, { sprite: string; solid?: boolean; interact?: string; anim?: string; light?: boolean; w?: number; h?: number }>; exit: Vec2; spawn: Vec2; music: 'interior'|'tower'|'engine' }
export function parseRoom(def: RoomDef): { w: number; h: number; solids: Solid[]; props: { sprite; x; y; interact?; anim? }[]; walls: Solid[] }
// InteriorScene: builds floor tiles + wall band + props from a RoomDef; same Player/CameraRig/InteractSystem/Dialogue; exit tile → world.wake at door + 1 tile south
```
Rooms: `about` (Naman NPC at desk_pc, bookshelf→tree `bookshelf`, bed→`bed`, frame_photo→`photo`, kettle, plant, fireplace, rug), `experience` (reception + Ada, elevator → panel `elevator`, posters, plant), `skills` (workbench + Ravi, toolwall board with tools placed by category → interact `toolwall_lang`/`toolwall_stream`/`toolwall_state` → panel `toolwall` with group index), `lineage` (console → panel `lineage`, tanks, pipes, gear_big anim, Sol), `stealth` (crate_covered → panel `stealth`, purple lamp), `safestride` (mapscreen → panel `safestride`, sos_button → tree `sos`, Devi + Arjun), `contact` (lens → tree `lens` → cutscene + panel `contact`, Ilse, stairs deco).
- [ ] Tests: every room's spawn and exit are walkable; every `interact` id exists in `NPC_TREES` or panel ids.

### Task 25: Content panels + special panels

**Files:** Modify `src/ui/panels.ts` (from old `ui.ts` contentHTML), Create `src/ui/elevator.ts`, `src/ui/toolwall.ts`, `src/ui/lineage.ts`

- [ ] Panels: keep `contentHTML`, restyle as RPG book frame (pixel border via layered box-shadows, accent stripe, kicker in Press Start 2P, title typewritten). Opening a zone panel the first time = Discovery: emits `world:discovered` (add to Events) → fanfare + banner "Discovered: The Cottage" + XP.
- [ ] Elevator: floors list (G Lobby · 2 DevOps Intern · Jun–Aug 2023 · 5 Software Development Engineer · Aug 2024–now · R Rooftop: the stack) — selecting a floor animates the panel (shake + ding), swaps the room's `window_sky_*` frame via `events.emit('room:window', {frame})`, and shows that role's card (from `content.ts` experience body split by the ⭐/🛠️ markers).
- [ ] Tool wall: three groups from `content.skills.groups`; each tool icon → chip list; the "How I work" sub text shown as Ravi's pinned note.
- [ ] Lineage viz: canvas animation in the panel: 6 system nodes in a row (labels: Ingress · Tokenise · Classify · Map · Stitch · Ledger — generic, from the content's verbs), packets travel hop-to-hop; the engine draws the stitched path under them; counter "records/day ≈ 750M" ticking. Pure DOM canvas, 30 fps, stops when closed.

### Task 26: Progression — XP, quests, achievements, journal, toasts, hats, 100 %

**Files:** Create `src/systems/{Xp,Quests,Achievements}.ts`, `src/data/{quests,achievements}.ts`, `src/ui/{journal,toasts}.ts`, `tests/quests.test.ts`, `tests/achievements.test.ts`

**Produces:**
```ts
export const QUESTS: QuestDef[]  // explore(7 discoveries) · packets(20) · shells(5) · fishing(3) · gear(1) · beacon(1)
export type QuestDef = { id: string; title: string; giver?: string; desc: string; steps: { id: string; text: string; target: number }[]; reward: { xp: number; hat?: string; text: string } }
export class QuestLog { constructor(state: Save['quests'], on: (e: { type: 'started'|'progress'|'done'; id: string }) => void); start(id); advance(id, step, n = 1); isActive(id); isDone(id); progress(id): { done: number; total: number }; state }
export const ACHIEVEMENTS: { id: string; title: string; desc: string; icon: string; secret?: boolean }[]  // 14 from spec §9
export class Achievements { constructor(unlocked: string[], on: (id) => void); unlock(id); has(id); count() }
export class Xp { constructor(xp: number, on: (level: number) => void); add(n); level; pct; }  // level thresholds: 0,60,150,280,450,680,980,1350,1800,2400
```
- [ ] Tests: QuestLog advance clamps to target and fires `done` once; Xp levels at thresholds; Achievements unlock once.
- [ ] Journal (J): tabs Quests / Achievements / Stats (steps, distance, grass cut, time played); toasts stack top-centre (XP +10, quest updated, achievement unlocked with icon), auto-dismiss 3.5 s, `aria-live`.
- [ ] 100 % = all discoveries + all quests + all non-secret achievements → fireworks over the plaza (particles, 6 bursts), crown hat, credits overlay.

### Task 27: Fishing mini-game

**Files:** Create `src/systems/Fishing.ts`

- [ ] At `bp.fishingSpot` (dock end): E → cast (line sprite + bobber, splash), wait 1.5–4 s, bobber dips + "!" → press E within 600 ms → reel bar mini-game (DOM bar: keep a moving fish inside a green zone by holding E; 4 s) → success: `fish_jump` anim + toast "Caught a Sunfish" + inventory fish +1; fail: "It got away…". Tomas turn-in at 3 fish.

### Task 28: Cutscenes + tutorial

**Files:** Create `src/systems/Cutscene.ts`

**Produces:** `class Cutscene { constructor(scene); letterbox(on: boolean): Promise<void>; moveTo(obj, x, y, speed): Promise<void>; wait(ms); say(tree: string): Promise<void>; cameraTo(x, y, ms); skip(): void }` with Esc/"Skip ▸" button.
- [ ] Arrival: boat enters from south with wake particles → docks → hero hops off (`hop`) with squash → Mira walks over → tutorial tree (shows key hints as diegetic bubbles: "WASD to walk", "Shift to run", "E to talk") → letterbox off → banner "Harbor".
- [ ] Beacon: lens interact → screen flash (skipped if reduced motion) → exit to world automatically at the lighthouse gallery → camera pulls back → beam sweeps → fireworks → contact panel; quest done, achievement Keeper.

### Task 29: Audio

**Files:** Create `src/audio/{engine,sfx,music,songs,ambience}.ts`

**Produces:**
```ts
export const audio = { unlock(): void; setVolumes(s: Settings): void; get ctx(): AudioContext | null }
export const sfx: Record<'step_grass'|'step_sand'|'step_wood'|'step_stone'|'splash'|'swing'|'grass'|'coin'|'packet'|'chest'|'door'|'blip'|'select'|'back'|'elevator'|'ding'|'bell'|'bonk'|'levelup'|'discover'|'quest'|'achievement'|'cast'|'reel'|'catch'|'meow'|'gull'|'firework'|'rain_start', () => void>
export const music: { play(id: 'title'|'day'|'night'|'interior'|'tower'|'engine'|'fanfare', fadeMs = 1200): void; stop(fadeMs): void; current: string | null }
export const ambience: { set(mix: { coast: number; woods: number; night: number; rain: number; interior: number }): void }
```
- [ ] Sequencer: 16th-note scheduler (lookahead 100 ms), per-track pattern data in `songs.ts` (note strings like `'C4:2 E4 G4 -'`), voices: lead (triangle + lowpass 2.2 kHz), bass (square 0.3 gain lowpass), pad (two detuned sines), perc (noise hat + sine kick). Day: bright I–V–vi–IV in D major 104 BPM; Night: same chords, slower 84 BPM, pad only + sparse lead; Interior: music-box (sine bells) 96 BPM; Tower: soft elevator bossa; Engine: steady pulse with filtered square; Title: pad + slow arpeggio.
- [ ] Ambience: waves = filtered pink noise LFO-swelled, gain by `coast`; birds = random 3-note chirps when day; crickets = high pulsed tone at night; wind = band-passed noise by `woods`; rain = white noise lowpassed.

### Task 30: Save/settings wiring, pause, settings UI, reader mode, gamepad

**Files:** Create `src/ui/{pause,settings,reader}.ts`; Modify `src/scenes/WorldScene.ts`, `src/ui/index.ts`

- [ ] Autosave every 10 s when state changed + on visibilitychange + on interior enter/exit; "Continue" restores position/scene/time/etc.
- [ ] Pause (Esc): Resume / Map / Journal / Settings / Reader Mode / Controls / Back to Title.
- [ ] Settings: sliders master/music/sfx, text speed, screen shake, reduced motion (default from media query), touch controls auto/on/off, minimap on/off, reset save (confirm).
- [ ] Reader Mode: full-page overlay listing all `content.ts` sections in order + links; "Back to game"; announces via `aria-live`; unlocks achievement Well-Read; also linked from `<noscript>` text.

### Task 31: Polish, performance, verification, docs

**Files:** Modify `index.html`, `README.md`, `src/styles/ui.css`

- [ ] Perf: chunk/decor culling verified (count visible sprites), critter/NPC sleep, `game.loop.sleep()` on hidden tab, particle caps, `pickZoom` integer.
- [ ] Playwright pass: boot has zero console errors; title → New Game → skip cutscene → walk 3 s → E on Mira → dialogue advances → Esc → M opens map → J journal → enter Cottage → talk to Naman → panel → Esc; screenshots 1280×800 / 1920×1080 / 390×844 saved to scratchpad and reviewed; `game.loop.actualFps` ≥ 50 on the dev machine.
- [ ] `index.html`: new loading markup, meta description mentions the game; `README.md`: rewritten for the new game (controls, features, dev, deploy).
- [ ] `npm run typecheck && npm test && npm run build` clean.

## Parallelisation notes

Foundation (T0–T9, T10, T16–T17) is sequential and sets the visual language. After T10 the following are independent and may run as parallel subagents: art packs (T11, T12, T13, T14 — each with `npm run preview:art`), audio (T29), dialogue data + runner (T22 data), UI CSS/reader/settings/journal shells (parts of T25/T26/T30). Integration tasks (T18–T28) then run in order.
