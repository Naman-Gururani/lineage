# HANDOFF — Naman's World: Lineage Isle

> **The living state document.** `/getcontext` reads this first in a new session; `/checkpoint` and `/handoff` keep it current. If this file and reality disagree, trust `git status` + the test suite, then fix this file.

- **Branch:** `redesign/lineage-isle` (branched off `main`) — **all work uncommitted by design** (the user commits/deploys themselves; never commit or push unless asked).
- **Dates:** rebuilt 2026-08-30 → 2026-08-31.
- **Status:** ✅ Feature-complete and verified. Ready for the user to play, commit, and deploy.
- **Docs:** spec `docs/superpowers/specs/2026-08-30-naman-world-2-design.md` · plan `docs/superpowers/plans/2026-08-30-naman-world-2.md` · `README.md` (rewritten, current).

## TL;DR

The old "cozy island with popup panels" portfolio was rebuilt into a full pixel-art open-world game (~21k lines of TS across 114 files): title screen → boat-arrival cutscene → a designed 160×120-tile island with day/night lighting, weather, critters, 10 quest-giving NPCs, a fishing mini-game, a cat companion, collectibles/XP/achievements, walk-in interiors for all 7 landmarks, journal/map/minimap/pause/settings/Reader-Mode DOM panels, generated music+SFX, and autosave. All résumé content is delivered through mechanics (Naman is an NPC; the Tower elevator is the career timeline; the Engine has a live lineage console; lighting the Lighthouse is Contact). 220 vitest tests, tsc clean, prod build green.

## What exists (features)

- **Flow:** loading bar (real generation steps) → title menu over the live drifting island (New Game / Continue / Reader Mode / Settings) → skippable arrival cutscene (boat, hop, Captain Mira tutorial dialogue) → free play.
- **World:** deterministic from `WORLD_SEED` (src/config.ts). Regions with entry banners: Harbor, Sunny Meadow (plaza), Tower Heights (cliff plateau), Stone Ridge, Whispering Woods, Engine Works, Willow Fields, The Point (lighthouse islet + boardwalk). River "Stream" with flowing glow-motes and two bridges; roads carved by A*; ponds, coves, tall-grass patches.
- **Living world:** 8-min day cycle (tint grading + darkness veil + additive lamp/door/window light pools + stars + lit-window overlays above the veil); weather roll each dawn (clear/breezy/rain with particles, puddles, extra dark); wind sways trees + tall grass, leaves in the woods; ocean 4-frame animation + shore foam + noon sparkles + cloud shadows; butterflies/gulls/crabs/fireflies/fish-jumps near the camera.
- **NPCs & dialogue:** 10 outdoor/indoor villagers (wander/idle AI, face-on-talk, `!`/`?` quest bubbles) + Naman + Byte the cat companion (trail-follow, sits, pettable). 29 dialogue trees (`src/data/npcs.ts`) with conditions/effects; typewriter DOM dialogue box with portraits and choices; signposts with real directions.
- **Progression:** quests (explore ×7, packets ×20, shells, fishing, gear, beacon) with journal + toasts; XP/levels; 15 achievements; hats (seashell/hardhat/crown, cat ears spare); coins from grass/chests; 100 % → crown + fireworks + fanfare. The Vault stays sealed until 20/20 packets (Reader Mode never gated).
- **Interiors:** all 7 landmarks are enterable rooms (ASCII room defs → tiles/props/NPCs/solids). Specials: Cottage (Naman at his PC, bookshelf/bed/photo/fireplace), Tower lobby (Ada + **elevator panel**: floors = career, window views change per floor), Workshop (3 tool-wall pegboards with 14 hung tool icons from the skills groups), Engine (console → **live lineage canvas**), Vault (covered prototype), Safe Stride (map screen + SOS button), Lighthouse (lens → beacon cutscene → beam + fireworks + Contact).
- **Mini-game:** fishing at the pier end (cast → bite window → hold-E reel bar) — verified catchable.
- **UI:** pixel-RPG DOM layer — HUD (XP bar, packets, coins, clock, region), location banners, toast stack, modal manager (focus trap, stacking, Esc), full map with fast travel, minimap widget, journal (quests/achievements/stats), settings (volumes, text speed, shake, reduced motion, minimap, touch, reset), Reader Mode (full accessible page), pause menu, content "book" panels per zone.
- **Audio (all synthesised):** 7 sequencer tracks (title/day/night/interior/tower/engine/fanfare) with crossfades; ambience beds (waves/birds/crickets/wind/rain, interior muffling); 36 SFX incl. per-surface footsteps. Wired via `src/systems/Soundtrack.ts`; unlocks on first gesture.
- **Save:** autosave every ~10 s + on transitions → `localStorage nw2.save.v1`; settings `nw2.settings.v1`; Continue restores position/time/weather/progress.
- **Mobile/a11y:** integer zoom 2/3/4; touch joystick + A/B + menu; keyboard-first panels; reduced-motion honoured everywhere; `aria-live` dialogue/toasts; noscript fallback.

## Architecture map

```
src/config.ts                 TILE/world size/WORLD_SEED/pickZoom/speeds
src/main.ts                   fonts → Phaser config (pixelArt, RESIZE, ?st=1 timer stepping, ?fresh=1 clears save) + initUI()
src/core/    rng (seeded), noise, time (day model), events (typed bus + touchInput), keys (WINDOW-level key tracker — see gotchas), save (schema+migrate), hooks (UI late-binding)
src/art/     palette → pixel.ts (ASCII/procedural SpriteDef → raster/sheet) → raster.ts (RGBA ops) → tiles.ts (terrain painters) → procedural.ts (foliage/glows) → sprites/{hero,env,npcs,props,buildings,interior}.ts → atlas.ts (ONE atlas + anims; register new packs here)
src/world/   blueprint (the designed island + all spots), terrain (grid/masks/flood), paths (A* roads), collision (moveAndSlide), scatter (decor), bake (chunk rasters), rooms (interior parser), regions
src/entities/ Player, Npc, Critters, Companion, Packet, Chest, Grass, Sign, Door, Lamp
src/systems/ GameState (save+quests+xp+ach+dialogue ctx+effect handlers), Dialogue (runner), DialogueRegistry, Interact, DayNight, Weather, Wind, Water, CameraRig, Cutscene, Fishing, Soundtrack, Quests, Achievements, Xp
src/scenes/  BootScene (staged generation, registers trees+interior scene) → WorldScene (title-attract + play modes) ⇄ InteriorScene
src/audio/   engine (ctx/buses/compressor), sfx, music (sequencer), songs (note data), ambience
src/data/    content (résumé — SINGLE SOURCE OF FACTS), npcs (dialogue trees), signs, quests, achievements, rooms
src/ui/      index (init order), state (uiState the game fills), modal, panels (zone books), dialogue, hud, title, map (+minimap), journal, settings, reader, pause, elevator, toolwall, lineage, banner/toasts, prompt, touch, loading
src/styles/  ui.css (game chrome) + panels.css (panel layer)
tests/       220 tests: pure modules + sprite-pack validation + UI (happy-dom)
tools/       preview.ts (`npm run preview:art -- sheet <pack> 3` or `world [tx ty tw th scale]` → scratch/*.png), png.ts
```

## Conventions & critical gotchas

1. **Never commit/push** unless the user asks. Branch `redesign/lineage-isle`.
2. **Content rules:** facts about Naman only from `src/data/content.ts`; skills = approved set only (no React/Node/JS); the in-development product stays unnamed.
3. **Keyboard:** read keys via `src/core/keys.ts` (`keys.any/down/onDown`) — **not** Phaser's per-scene keyboard (it stalls after scene sleep/wake). Escape actions that OPEN a modal must be deferred `setTimeout(...,0)` past the modal layer's same-event Escape handling.
4. **Art pipeline:** sprites are `SpriteDef`s (ASCII rows+legend or procedural `paint`) using ONLY `palette.ts` keys; new packs must be imported in `atlas.ts allDefs()` or they silently don't render (`hasFrame` guards everywhere). Preview any pack from Node before trusting it.
5. **Browser testing:** dev server on :5173 (`/lineage/` base). Use `?st=1` (Playwright's occluded window throttles rAF to ~1fps; this forces setTimeout stepping) and `?fresh=1` (clears the save so the title's first button is New Game — otherwise Enter hits Continue). Synthetic `KeyboardEvent`s need `keyCode`. `window.__game` and `window.__events` are exposed for scripting.
6. **Windows shell:** long heredocs/`node -e` with backticks get mangled — write patch scripts to `scratch/*.cjs` with the Write tool, then `node scratch/x.cjs`. Playwright's browser tab is shared — subagents must not navigate it.
7. **Pure vs Phaser:** `core/`, `world/` (minus bake's callers), `systems/{Quests,Xp,Achievements,Dialogue}` never import Phaser → keep them unit-testable. UI ↔ scenes talk only via `core/events.ts` (+ `core/hooks.ts`, `ui/state.ts`).
8. **TDD:** RED first for pure modules; sprites/scenes are verified by preview PNGs + Playwright screenshots (`scratch/shots/` has ~30 from this session).

## Verification gates (all green as of 2026-08-31)

```bash
npm test          # 25 files / 220 tests
npx tsc --noEmit  # clean
npm run build     # dist: app ~104 kB gzip + phaser chunk ~340 kB gzip
```
Playwright pass: boot no-errors → title → New Game → cutscene (skippable) → Mira dialogue → doors/interiors in+out → fishing caught → quests/turn-ins → cat follows → night/rain/lighting → panels (about/lineage/elevator/journal/map/settings/reader/pause) → mobile 390×844.

## Change inventory (vs `main`, snapshot 2026-08-31)

- **Deleted:** `src/game/*` (art/bus/input-state/sound — old engine), `src/ui/ui.ts` (old monolith UI).
- **Modified:** `README.md`, `index.html`, `package.json` (+vitest/tsx/@types/node/@fontsource/pixelify-sans; scripts test/preview:art), `package-lock.json`, `tsconfig.json` (include tests/tools, node types), `vite.config.ts` (phaser manualChunk), `.gitignore` (+scratch/, .playwright-mcp/), `src/main.ts`, `src/scenes/{BootScene,WorldScene}.ts`, `src/styles/ui.css`.
- **New (untracked):** `docs/`, `src/{art,audio,core,data(−content.ts),entities,systems,world}/`, `src/scenes/InteriorScene.ts`, `src/ui/` (17 modules), `src/styles/panels.css`, `src/config.ts`, `tests/` (25 files), `tools/`, `vitest.config.ts`, `.claude/commands/`.
- **Unchanged on purpose:** `src/data/content.ts` (résumé content), `LICENSE`, `public/favicon.svg`.
- The user's pre-redesign uncommitted diff is preserved at `<session scratchpad>/pre-redesign-uncommitted.patch` (intent — perf, reduced-motion, focus traps — was carried into the redesign).

## How to run / resume

```bash
npm install
npm run dev                     # http://localhost:5173/lineage/
npm test && npx tsc --noEmit    # gates
npm run build                   # → dist ; deploy = publish /dist to gh-pages
```
Debug: `?fresh=1` new save · `?st=1` timer stepping · `npm run preview:art -- sheet npcs 3` renders sprite packs to `scratch/`.

## Backlog (nice-to-haves, none blocking)

- Listen-through of music/SFX on real speakers and tune levels (composed + unit-tested, only briefly auditioned via analyser).
- Fishing difficulty tuning on real input; maybe a second fish type.
- Rain drops could still read stronger at night; possible thunder flash (respect reduced motion).
- Credits screen content (pause → Credits is wired to a stub panel).
- Windmill blades placement fine-tune; vertical fence spacing polish (one pass done).
- Perf profile on a real GPU/60 Hz (architecture: baked chunks + culling + sleep — expected fine; Playwright environment can't measure honestly).
- Deploy + OG screenshot image for social embeds.

## Checkpoint log

### 2026-08-31 — Session 1 (full rebuild) — CHECKPOINT #1
Rebuilt the entire game per spec/plan (see docs/superpowers/): foundation (rng/time/pixel/terrain/blueprint/paths/collision/scatter, TDD), art pipeline + all six sprite packs, Phaser scenes (Boot/World/Interior), living-world systems, dialogue/quests/achievements/XP/save, fishing, cutscenes, DOM panel layer, generated audio, soundtrack wiring. Seven parallel subagents delivered buildings/props/npcs/interior art, audio, UI panels, dialogue scripts (one rate-limit restart, one stall-resume; all completed green). Bugs found & fixed via Playwright playtesting: chunk-cull bounds, Phaser keyboard stall after sleep/wake (→ core/keys.ts), Escape same-event modal race (→ deferred open), interact prompt during lock, sealed-door bypass, travel-from-interior position clobber, cliff-ring diagonal gaps, render-texture lighting (→ veil + additive pools), night overlays under the veil, missing atlas registrations. Final: 220 tests, tsc clean, build green, ~30 verification screenshots in scratch/shots/. Nothing committed.
