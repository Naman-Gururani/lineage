# HANDOFF — Naman's World: Lineage Isle (v3 "Story Isle")

> **The living state document.** `/getcontext` reads this first in a new session; `/checkpoint` and `/handoff` keep it current. If this file and reality disagree, trust `git status` + the test suite, then fix this file.

- **Branch:** `v3/story-isle` (created in place from `main`@`63fc12d`). **Nothing is committed** — the whole v3 redesign sits uncommitted in the working tree, by the standing rule (never commit/push unless the user asks). `main` = `origin/main` = `redesign/lineage-isle` = `63fc12d` (v2.5, live).
- **Dates:** v2 rebuilt 2026-08-30/31 · v2.5 HD Isle 2026-09-01 (deployed) · **v3 Story Isle 2026-09-02** (overnight, autonomous, per the user's brief).
- **Status:** ✅ v3 complete: 11 tasks implemented + reviewed (see Checkpoint #4), gates green, browser-verified on a static build. **Not deployed** — the live site still serves v2.5. Ship = user's word → commit on `v3/story-isle`, merge/fast-forward `main`, `npm run build` + `npx gh-pages -d dist`.
- **Docs:** v3 spec `docs/superpowers/specs/2026-09-02-story-isle-design.md` (with dated amendments in §5 and §6.5) · plan `docs/superpowers/plans/2026-09-02-story-isle.md` · v2.5/v2 docs under `docs/superpowers/` for history. Execution ledger (every ruling, review, fix round): `.superpowers/sdd/2026-09-02-story-isle/progress.md` (gitignored — **keep until v3 is committed**).

## TL;DR

v2.5's open world became a **story-mode résumé**. **Bo** (the dockmaster) meets you on the pier, hands you the **About** card, and gates **Experience** behind a real-format **Wordle** (with a hint button). He then waits at whichever venue the story sends you to next; a HUD objective chip and a pulsing map marker point the way; free exploration (fishing, shells, packets, chests, hats, the cat, day/night) stays. Each chapter is won at a game everyone knows: **claw machine** at Sol's Prize Tent (one project card per prize — PLE, Safe Stride, the unnamed product), **Flappy Bird** drawn in chalk at the campus (Education), a **Wordscapes letter wheel** at the Workshop bench where the words are Naman's tech stack (Skills), and an **Among Us tile-drop vs four bots** in the old warehouse (Mira's bonus game). Every fact is a **complete card popup**; NPC dialogue is fixed and short (16 trees, 66 lines, zero digits). Old games (Lights Out, Cargo, Packet Rush, Tower Climb), the Engine console and 17 talking objects are gone. Reader Mode stays fully ungated. **941 tests / 59 files / 0 skips**, tsc clean, build green.

## What exists (v3 features)

- **Flow:** loading → welcome card (pitch now ends "Bo will show you around.") → boat → Bo walks over → 3 lines → About card auto-opens → Bo offers the puzzle **[Let's solve it / Maybe later]** → Wordle → Experience card → Bo's follow-up points west → free play with the story spine.
- **Story spine (`data/story.ts`, quest `story`):** steps `meet → experience → projects(×3) → education → skills → contact`; order **suggested, not enforced** (every venue works when reached; Bo follows the first incomplete step). Bo's station per step (`BLUEPRINT.storySpots`): pier → tent door → campus door → workshop door → lighthouse door → pier. He snaps only **off-camera** (walks off when on-camera). Finishing the story: 200 XP, flag `story_done`, badge *The Whole Story*, fireworks. 100% (`complete`) keeps its definition (all discoveries + quests + badges).
- **Chapters & locks:** `save.unlocked` (zone ids). Locked card = 🔒 + chapter label + hint (`STORY_HINTS`) + venue name + **[Show on map]** (focuses the pin) — never the title/body. `contact` is never locked; Reader Mode ungated. Re-read spots: cottage desk, tower elevator (locked view = "Floor ?" buttons + visitor-pass line), vault crate, Safe Stride map screen, campus notice board, workshop tool walls (silhouettes until won), tent prize shelf (`panel:prizes`), lighthouse lens. **Journal → Résumé tab** lists all 8 chapters with ✓/🔒 and hints.
- **Games** (`src/games/*` pure reducers · `src/ui/minigames/*` renderers · shared `createLoop` 120 Hz fixed-step + interpolation, `makeCanvas` DPR-aware, `mountPad` touch d-pad):
  | id | Name | Venue prop | Unlocks | Hat | Notes |
  |---|---|---|---|---|---|
  | `wordle` | Bo's Word Puzzle | Bo (pier) | experience (+`tower_express`) | — | answers derived from content skills (`kafka flink redis linux`), 14,858-word dictionary lazy-loaded, 3 hints, `?word=` override |
  | `claw` | Prize Grab | `int_claw` in Sol's Prize Tent | lineage · safestride · stealth (one per catch) | goggles | one-button timing; catch opens the project card over the game; 6 tokens |
  | `flappy` | Chalk Flight | campus chalkboard | education | grad | win at 10 gaps; Hire-me continues at score; `FLAPPY` knobs at top of `games/flappy.ts` |
  | `forge` | Word Forge | workshop bench | skills | hardhat | 5 rounds, 10 skill words from `content.ts` (drift-tested); drag/tap/type |
  | `crew` | Crew Drop | `int_cabinet` in Harbor Arcade | (bonus: quest `crew`) | captain | 10×7 tiles regrow 1.8 s, permanent accelerating shrink from 15 s, bots hold their nerve; rounds 16–51 s |
  All keep the gag `[Try again] [🤝 Hire me — extra life] [Exit]` + pinned mailto; **mercy rule:** the 3rd Hire-me in a round wins it. Debug: `?cheat=1` adds a **Skip (dev)** button to every game; `?word=<answer>` forces the Wordle answer.
- **Dialogue:** `data/npcs.ts` (572 lines): `dockmaster`(Bo) `naman ada sol professor ravi mira ilse tomas pip arjun cat` + `bed lens telescope vault_door`. Budget enforced by tests: ≤3 lines/node, ≤120 chars, no digits, no emoji, hosts' `intro` ≤2 lines. Lou/Devi removed; Mira hosts the arcade (indoors); Sol lives only in the tent; six props (well/stall/boat/mailbox/bell/fountain) are scenery.
- **World:** The Engine → **Sol's Prize Tent** (`bld_fair`, room `fair`) on **The Fairground** (region id still `engine`) with bunting/balloons/stalls; warehouse → **Harbor Arcade**; signs relabelled; 8 discoverable landmarks unchanged.
- **Progression data:** quests (7): `story` (auto) `explore packets shells fishing beacon crew`; achievements (23): + `ach_wordle ach_claw ach_flappy ach_forge ach_crew story`, `arcade` = all five games; hats unchanged (7).
- **Save:** schema **v3** (`nw2.save.v3`, + `unlocked`); v1/v2 saves dropped with the fresh-start toast; `?fresh=1` clears all three keys.

## Architecture map (v3 deltas marked ★)

```
src/config.ts · main.ts (★ imports styles/games.css; ?fresh clears v1+v2+v3)
src/core/    keys (leaf) · save ★v3 + hadLegacySave · events ★facet:unlocked, story:changed · rng/noise/time/hooks
src/art/     sprites ★buildings: bld_fair(+night) · props: bunting, balloons · interior: int_claw, int_prizeshelf, int_cabinet, int_bunting, int_balloons (art-direction.md rules; pack tests pin dims/anchors)
src/world/   blueprint ★lineage→bld_fair/room fair, storySpots, fair props, npcSpots (dockmaster at pier; mira/lou/devi/sol removed) · scatter ★bans around storySpots · rooms/terrain/paths/collision/bake/regions
src/scenes/  WorldScene ★Bo arrival (unlock about → intro tree → Wordle wait → follow-up), relocateBo (off-camera snap), objectiveFor/refreshObjective, handlers.minigame, six props silent, useTelescope · InteriorScene ★modal-aware unlock · transitions.ts
src/entities/Npc.ts ★rehome(), idle NPCs honour walkTo
src/games/   ★ loop.ts (createStepper) · wordle · claw · flappy · forge · crew — pure, seeded, no DOM/timers
src/systems/ GameState ★unlockFacet/isUnlocked/storyNext, MINIGAME_FACETS/HATS/XP, ARCADE_GAMES ×5, story credit, full_house roster · Minigame ★ids ×5, host.unlockFacet, mercy (MERCY_HIRES=3), cheatEnabled · Dialogue ★Cond.unlocked/locked, Effect.minigame/unlockFacet
src/data/    content ★lineage.name "Sol's Prize Tent", LandmarkKind 'fair' · ★story.ts (STORY_ORDER, STATIONS, STORY_HINTS, FACET_STEP, nextStep, stationSpot, PIER) · npcs ★rewrite · rooms ★fair/arcade · signs ★relabel · quests ★7 · achievements ★23 · ★wordlist.ts (generated; dynamic import)
src/ui/      ★minigames/{index,loop,canvas,pad,wordle,claw,flappy,forge,crew} · panels ★locked card, isUnlocked, facet queue (push-before-decide) · journal ★Résumé tab · hud ★objective chip · map ★.map-objective marker, focus, KIND_ICON fair · elevator/toolwall ★lock views · ★prizes.ts · welcome ★pitch · state ★unlocked/objective
src/styles/  ui.css · panels.css ★locks/objective/pulse, .mg-canvas (--ar) · ★games.css → games/{wordle,claw,flappy,forge,crew}.css (one file per game)
tests/       941 across 59 files ★: wordle/claw/flappy/forge/crew reducers · minigame (host: mercy, cheat) + minigame-<game> e2e ×5 · loop · ui-pad · story · ui-locks/ui-resume/ui-objective · dialogue-data (budget rules) · registry/rooms/signs/content/gamestate/save/quests/progression/blueprint/scatter updated
tools/       preview.ts (`npm run preview:art -- sheet <pack> 3`)
scratch/     snap.sh / pkg.sh (working-tree snapshot review packages) · shots/v3-e2e-*.png, v3-arrival-*.png · gen-wordlist.cjs · wordle-words.txt
.superpowers/sdd/2026-09-02-story-isle/   ledger + briefs + reports + review packages (gitignored; KEEP until committed)
```

## Conventions & critical gotchas

1. **Never commit/push unless the user asks.** v3 is entirely uncommitted on `v3/story-isle`.
2. **Content rules:** facts about Naman only from `src/data/content.ts` (CGPA 9.63); dialogue carries **no digits** and no facts (cards do); skills = approved set only; the in-development product stays unnamed. Wordle answers and Forge words are *derived from* / *drift-tested against* content.
3. **Keyboard:** world input via `src/core/keys.ts` only; `ui/*` never imports it (module-graph test). Mini-game renderers attach their own listeners to the modal root with `e.repeat` guards. Escape-that-opens-a-modal stays `setTimeout(0)`-deferred; armed-on-first-keyup guard for own-key closes (`openSign`).
4. **Art pipeline:** 32px/tile; palette keys only; new packs register via the pack arrays; per-pack tests pin dims/anchors; render `npm run preview:art -- sheet <pack> 3` and look. Style rules: `.superpowers/sdd/2026-09-01-naman-world-hd/art-direction.md`.
5. **Purity:** `core/`, `world/`, `src/games/*`, `src/data/*` never import Phaser/DOM (exception: `core/events.ts`). Games are pure reducers; renderers are thin DOM/canvas; the simulation is driven only by `createLoop` (120 Hz fixed step + interpolation), never timers.
6. **Minigame framework:** rewards/records happen ONLY in `MinigameHost.teardown()`; chapters unlock through `GameState.unlockFacet(zoneId, announce)` — the claw calls it with `announce=false` *before* opening the card itself; the panel layer's `facet:unlocked` listener pushes into `uiState.unlocked` **before** deciding whether to queue a card (the claw relies on that). Renderers that can outlive their win expose `won()` (Esc during the 650 ms win beat must not record a loss). `__step(ms)` on canvas sessions is a test seam.
7. **Story wiring:** Bo's `intro` node is NOT in his entry ladder — only the fresh-save arrival runs it (and it unlocks `about` **before** the card effect flushes). `uiState.unlocked` is a **copy** of the save array. Pier stations use landmark sentinel `PIER` (no pin); the map's `.map-objective` marker at `(tx,ty)` is the guidance. Bo relocates only off-camera.
8. **Browser testing protocol:** dev server `:5173` hot-reloads on every source change — with agents editing concurrently, **build and test against `npx vite preview --port 4173` instead**. URL flags: `?st=1` (timer stepping; distorts feel), `?fresh=1`, `?cheat=1` (Skip buttons), `?word=kafka`. Seed saves only on the title screen. Synthetic window `KeyboardEvent`s reach `core/keys` consumers but NOT element-scoped listeners — use real CDP keys/clicks; a gag modal intercepts pointer clicks (use `document.querySelector(...).click()` from `browser_evaluate` when needed). `window.__game` / `__events` exposed; `__events.emit('ui:panel', {id:'minigame', data:'<id>'})` opens a cabinet; `__game.scene.getScene('world').state` is the live GameState.
9. **Windows shell:** long heredocs get mangled — write `scratch/*.cjs` with the Write tool. Playwright's tab is shared — one browser user at a time.
10. **Registry invariant:** every non-minor landmark ↔ `ZONES` entry ↔ `ROOMS` room (`tests/registry.test.ts`): 8 zones / 8 major / 9 landmarks / 9 rooms; minor = `warehouse`.
11. **Parallel agents:** disjoint file ownership per task, one CSS file per game (`src/styles/games/<id>.css`), review packages from working-tree snapshots (`scratch/snap.sh`, `scratch/pkg.sh`) since nothing is committed.
12. **Fish determinism (deliberate):** unchanged from v2.5 (golden koi = cast #4).

## Verification gates (all green, 2026-09-02)

```bash
npm test          # 59 files / 948 tests / 0 skips
npx tsc --noEmit  # clean
npm run build     # app 480.3 kB (158.2 gzip) + css 78.5 kB (21.2 gzip) + wordlist 89.3 kB (38.4 gzip, lazy) + phaser 1.48 MB (339.8 gzip)
```
Browser-verified on a static build (`scratch/shots/v3-e2e-01..18.png`, zero console errors): welcome pitch → arrival → Bo ×3 → About card **unlocked** (+20 XP) → puzzle offer → Wordle typed `kafka` → Experience card + *Five Letters* + objective → Bo's follow-up → claw (real miss, then skip) → 3 project cards queued in order → Chalk Flight (death gag → Hire-me revive) → Education card → Word Forge (JAVA, KAFKA typed, round hand-off) → Skills card → simulated lens → story done (chip hidden, Contact card, fireworks) → Journal Résumé 8/8 → Crew Drop (idle ejection gag; skip → quest, captain, *Arcade Legend*) → map (no marker when done) → Reader Mode ungated (8 sections) → fresh save: Esc-skip unlocks About, locked Skills card, Show-on-map focus, locked lift → 390×844 layout. Per-task screenshots: `scratch/shots/v3-arrival-*.png`.

## How to run / resume

```bash
npm install
npm run dev                     # http://localhost:5173/lineage/  (or: npm run build && npx vite preview --port 4173)
npm test && npx tsc --noEmit    # gates
npm run build                   # → dist ; deploy = npx gh-pages -d dist (USER-TRIGGERED ONLY)
```
- Quick tour: `http://localhost:5173/lineage/?fresh=1&cheat=1&word=kafka` — Skip buttons in every game, Wordle answer forced.
- New session: `/getcontext`. The ledger `.superpowers/sdd/2026-09-02-story-isle/progress.md` holds every ruling made on the user's behalf.

## Backlog (ordered; each item actionable cold)

1. **Ship decision (user):** commit `v3/story-isle`, fast-forward `main`, redeploy. Until then the live site is v2.5.
2. **Feel pass on real hardware (user):** Chalk Flight (`FLAPPY.GAP` 130 / `SPEED_GAIN` 0.05 / `WIN` 10), Crew Drop (`CREW.REGROW_MS` 1800, `SHRINK_*`, `NERVE`), claw sweep speed/tolerance (`CLAW.SWEEP`, `TOL`), Forge wheel tile size on phones, Wordle flip timing.
3. **Bo's copy / pacing (user):** read the 16 trees in `src/data/npcs.ts` once; every line is fixed copy.
4. **Real-phone touch pass:** joystick + A/B, the Crew Drop d-pad (`@media (pointer: coarse)`), Flap button, Wordle keyboard, Forge drag.
5. **Music/SFX listen-through** (carried from v2.5): bus levels in `src/audio/engine.ts`; the new games reuse existing stingers.
6. **OG image** for `index.html` (welcome card over the island).
7. **Deferred minors from the final review** (all "leave" verdicts, listed in the ledger): `el`/`esc` could move to a Phaser-free `ui/dom.ts`; `createLoop` pauses on visibility only (not blur); `Cond.unlocked` and `Objective.step` are declared but unread; Lou/Devi frames still painted in the atlas; curly apostrophes in `achievements.ts`; the `ui/minigames/index.ts` comment overstates its uniqueness (forge.ts also spans lines); Chalk Flight's focused-button guard drops W/↑ as well as Space; the HUD objective chip shares the Map button's interior double-emit (`InteriorScene` forwards `world:action` ungated while the slept `WorldScene` also listens); `package-lock.json` still lists Press Start 2P until the next `npm install`.
8. **Housekeeping after commit:** delete `.superpowers/` and `scratch/` at will (history is the record); `tests/ui-objective.test.ts` fixture still says `landmark: 'warehouse'` (self-contained).

## Checkpoint log

### 2026-08-31 — Session 1 (v2 full rebuild) — CHECKPOINT #1
Rebuilt the game per spec/plan; 220 tests; nothing committed. (Details in git history / earlier HANDOFF revisions.)

### 2026-09-01 — Session 2 (v2.5 "HD Isle") — CHECKPOINT #2 + commit/deploy addendum
14 subagent-driven tasks: 32px HD art, 96×72 relayout, hop/ledges, welcome card, token UI, host dialogue + signs, education/CGPA 9.63, four mini-games + gag + wardrobe, fishing pass, save v2. 719 tests. Committed as `c336964 → de6f21e → dc1f78b`, deployed to gh-pages `4ce6fe7`.

### 2026-09-02 — Session 2 close — CHECKPOINT #3
Doc refresh; working tree clean; 47 files / 719 tests.

### 2026-09-02 — Session 3 (v3 "Story Isle") — CHECKPOINT #4
**Brief (user):** replace the "bad" games with ones everyone knows; a pier greeter who introduces Naman like a résumé intro, gates Experience behind a Wordle (with hints) and guides the whole game; a fair game for the projects (delegated → claw machine); Flappy Bird for Education; an Among Us disappearing-tile challenge vs bots; a Wordscapes-style letter wheel to guess the tech stack; few fixed NPC lines; complete cards as popups; smooth games; "make all the changes on your own, I'll check in the morning".
**Executed:** brainstorm → spec → plan → Task 0 (contracts/stubs/deletions/wordlist, orchestrator) → Wave 1 (progression core, game utilities, art, dialogue/rooms/signs) → Wave 2 (five games, UI locks/guidance, Bo's scene wiring) → per-task reviews with fix rounds → browser e2e → final whole-branch review. One API-limit outage (~04:10–06:20 IST) killed eight agents mid-flight; all were re-dispatched and partial files reconciled.
**Key rulings (full list in the ledger):** claw machine for the fair; Crew Drop gates no chapter (bonus in the old warehouse); Vault/Safe Stride buildings kept as re-read spots; story order suggested not enforced; Bo = existing `dockmaster`, Mira indoors, Lou/Devi removed; Reader Mode ungated, `contact` never gated; mercy rule + `?cheat=1` + `?word=`; venue names allowed on locked cards; Crew Drop rules amended (regrow 1.8 s, permanent accelerating shrink, hold-your-nerve bots) after a 2–5 s round-length finding; digits allowed in game status lines (not dialogue); spec counts corrected (7 quests, 23 badges).
**Final review + fix wave:** the whole-branch review returned five must-fix items and ten cheap ones; one fix wave landed all fifteen — the story finale now gets its own banner (`celebrate('story' | 'complete')`), Crew Drop starts on the first input (ready line while idle), Bo's ladder has one fair rung per prize (catching the mystery box first no longer sends you north early), the packets quest no longer mentions the Engine, ~405 lines of dead CSS for the deleted games are gone (css 31.5 → 21.2 kB gzip), `openZone` ignores a re-open of the card already on top, ASCII apostrophes in `story.ts`, Press Start 2P dropped, Space on a focused button no longer flaps, the objective chip is a real `<button>`, stale comments reworded, `lou`/`devi` rows removed, the campus room is "SRM Campus — Lecture Hall" (Chalk Flight kicker `SRM CAMPUS`), the Résumé tab iterates `ZONES`. Leftover cosmetic: `src/data/achievements.ts:21-22` still uses curly apostrophes (`Bo’s`, `Sol’s`). The re-review's one out-of-scope catch — Crew Drop's session lacked `won()` (an Esc during its win beat recorded a walk-out) — was closed by the orchestrator with the same one-liner the other four games carry.
**Gates:** 59 files / 948 tests / 0 skips · tsc clean · build green. **Nothing committed.** Next: the user's morning check → ship decision → feel pass.
