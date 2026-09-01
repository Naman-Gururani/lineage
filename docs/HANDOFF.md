# HANDOFF — Naman's World: Lineage Isle (v2.5 "HD Isle")

> **The living state document.** `/getcontext` reads this first in a new session; `/checkpoint` and `/handoff` keep it current. If this file and reality disagree, trust `git status` + the test suite, then fix this file.

- **Branch:** `main` = `redesign/lineage-isle` = `dc1f78b` — **committed and pushed 2026-09-01 at the user's request** (history: `c336964` v2 rebuild → `de6f21e` v2.5 HD Isle → `dc1f78b` cleanup). The never-commit-unless-asked rule still governs future work.
- **Dates:** v2 rebuilt 2026-08-30 → 08-31 · **v2.5 HD redesign 2026-09-01** · **deployed 2026-09-01**.
- **Status:** ✅ v2.5 complete, reviewed, browser-verified, all gates green — **LIVE at [naman-gururani.github.io/lineage](https://naman-gururani.github.io/lineage/)** (gh-pages `4ce6fe7`). Next: the user's real-input feel pass (Backlog #1); redeploy = `npm run build` + `npx gh-pages -d dist`.
- **Docs:** v2.5 spec `docs/superpowers/specs/2026-09-01-naman-world-hd-redesign-design.md` · plan `docs/superpowers/plans/2026-09-01-naman-world-hd.md` · v2 docs under `docs/superpowers/` for history. The v2.5 execution ledger (`.superpowers/sdd/2026-09-01-naman-world-hd/progress.md`, gitignored) and `scratch/` are now disposable — git history is the record — but harmless to keep.

## TL;DR

v2's game was redesigned into **v2.5 "HD Isle"**: all six sprite packs + terrain redrawn at **32px/tile** (Stardew-register HD pixel art, 33-ramp palette), the island re-laid at **96×72 tiles** (denser; 9 regions including the new **Campus Green**), movement raised to walk 4.5 / run 7 t/s with **always-run**, a functional **jump** (Space/B: hops low obstacles + one-way cliff ledges + the brook shortcut), a **welcome card** front page (identity + how-to-play over the live island), a **modern glass UI** (Inter + tokens, pixel type as accent), **host NPCs** that explain every interior with content.ts-sourced deep dives, **finger-post signs** with bearing-tested destinations, **education surfaced** (SRM Campus zone; CGPA corrected to **9.63** everywhere, derived not duplicated), **four mini-games** with unlocks and the **"🤝 Hire me — extra life"** lose-screen gag (real mailto), a **wardrobe** (7 hats), 21 achievements / 10 quests / 100% crown provably reachable, and a fishing pass (3 species incl. the Golden Koi). **719 tests / 47 files / 0 skips**, tsc clean, build green.

## What exists (v2.5 features)

- **Flow:** loading (tokens brand) → **welcome card** over the live drifting island (portrait, "SDE · Barclays · India", pitch, how-to incl. `Run — automatic (Shift to stroll)` / `Jump — Space`, quick links GitHub/LinkedIn/Email/**Reader Mode**, Start/Continue with wipe-confirm) → skippable boat arrival + Mira tutorial → free play.
- **World:** 96×72 deterministic island (`WORLD_SEED`), 9 regions: Harbor, Sunny Meadow, Tower Heights (ledge-ringed plateau), Stone Ridge, Whispering Woods, Engine Works, Willow Fields, The Point, **Campus Green**. River (2 bridges), **1-wide brook with NO bridge — hop it**, roads by A*, pond, coves. Living world systems (day/night, weather, wind, critters, cat companion) carried from v2 at HD.
- **Movement:** always-run 7 t/s (Shift strolls), **hop** = Space/touch-B (arc 0.6 tile, grounded shadow, squash/stretch; clears fences/small rocks/bushes/crates/barrels/brook; refuses buildings/trees/water), **one-way ledge hop-downs** on cliff lips (walk into them), smooth lerp camera.
- **Interiors (9 rooms):** 7 landmarks + **SRM Campus study hall** (Prof. Iyer, chalkboard = Study Hall game, noticeboard = education card) + **Harbor warehouse** (Dockmaster Bo, pallet = Cargo game; `minor` landmark: no discovery/map pin). Every room has a host with a first-visit auto-greet (walks over, skippable) + topics: *What is this place? / Tell me more (quotes content.ts) / What's nearby (bearing-true directions)*.
- **Signs:** 8 finger-posts; interact opens a card of arrows+destinations+notes; every arm bearing-tested within ±45° of truth.
- **Mini-games** (all with the lose/stuck gag: `[Try again] [🤝 Hire me — extra life] [Exit]`, "Excellent choice. HR will be in touch." + in-panel `email Naman` mailto):
  | Game | Venue | Type | Unlock |
  |---|---|---|---|
  | Study Hall (Lights-Out ×5 boards) | Campus chalkboard | pure puzzle | 🎓 grad cap |
  | Cargo Cove (sokoban ×6, solver-verified) | Warehouse pallet | pure puzzle | captain's cap + 40 coins |
  | Packet Rush (route packets, win 30, endless after) | Engine console | work-themed arcade | goggles + 5 vault-packet credits |
  | Tower Climb (3-floor platformer, coyote+buffer physics, career captions) | Tower stairs | work-themed platformer | hard hat + **Tower Express** fast travel |
- **Progression:** 10 quests (explore ×8, packets 20, shells, fishing, gear, beacon + 4 game errands), 21 achievements (incl. per-game, Arcade Legend, One in a Million golden koi, full_house now truthfully lists all 13 talkables), XP/levels, **Wardrobe** in pause (7 hats, single-writer equip), 100% → crown + fireworks (reachable exactly at completion — verified).
- **Fishing:** pier end; bite window 1.6s→0.9s ramp, tolerance ×1.15, species sardine/parrot/**golden** (deterministic per-catch-count schedule — golden arrives cast #4 by design so the crown never luck-gates; see Conventions #12), per-species journal stats, `?fish=gold` debug.
- **Content:** résumé single-sourced in `src/data/content.ts` (CGPA **9.63**; education zone `SRM Institute of Science and Technology`, B.Tech CSE 2020–2024); dialogue derives figures via `fact()`/`cgpa()` helpers; drift-tests scan cards AND dialogue; the in-development product stays unnamed (test-pinned).
- **UI:** token system (`--font-body` Inter, `.card` glass, `--accent`s incl. `--accent-bright`), HUD chip cluster w/ live avatar, dialogue card w/ portrait ring, map (8 discoverable pins + fast travel incl. flag-gated Tower Express), journal (quests/achievements/stats+fish), settings (+Always run), pause (+Wardrobe, +Credits), Reader Mode (+Education, order About→Experience→Education→Skills→Projects→Contact), toasts (cap 6).
- **Save:** schema **v2** (`nw2.save.v2`): hats[], minigames{}, fish{}, welcomeSeen + v1 fields. v1 saves discarded with a friendly toast; `?fresh=1` clears BOTH keys.
- **Audio/mobile/a11y:** v2 systems carried; touch gains **B = Hop**, Cargo has an on-screen d-pad; reduced-motion honored everywhere (incl. hop/typewriter/mini-games); AA contrast raised for dim text.

## Architecture map (v2.5 deltas marked ★)

```
src/config.ts                 ★ TILE=32, 96×72, CHUNK=1024, speeds 144/224, pickZoom 1/1.5/2
src/main.ts                   ★ Inter fonts, ?fresh=1→clearSave(both keys), ?fish=gold, ?st=1
src/core/    keys (leaf module — window-level tracker; NEVER import from ui/*: module-graph test enforces), save ★v2+hadV1Save, rng/noise/time/events(Phaser bus, baseline exception)/hooks
src/art/     palette ★33 ramps ×6-7 · pixel/raster · tiles ★32px+brook · sprites/* ★all HD (hero incl. hop/fish/portrait_naman/7 hats; npcs 13 rigs+17 faces; env species floors; props incl. sign_finger/boards; buildings incl. bld_campus/bld_warehouse; interior incl. campus/warehouse sets) · atlas ★4096 · procedural ★slimmed to live painters
src/world/   blueprint ★96×72 relayout (9 landmarks, minor flag, brook, ledges via setLedge) · terrain ★LOW_KINDS/LEDGE layer/T_BROOK · ★hop.ts (pure planHop) · paths/collision/scatter(★rock_s)/bake/rooms/regions
src/scenes/  Boot · World ★(mode via transitions, hop/ledges, boot-safe zone guards, resetBuild) · Interior ★(hosts auto-greet, locked-door guard, settings handler) · ★transitions.ts (pure planRoomExit/acceptsRoomWake — the interior↔world/title race fix)
src/games/   ★ lightsout · sokoban(+solve) · packetrush · climb — pure reducers, no Phaser, no timers
src/systems/ GameState ★(hats single-writer equipHat/unlockHat, minigameWon/Played, credit contract: binary steps win-only, recoverHats, full_house 13) · ★Minigame.ts (host+gag+won?()+teardown funnel) · Fishing ★(view only) · Interact ★identity guard · rest as v2
src/data/    content ★(9.63, education, location) · ★fish.ts (pure table/roll/summary) · npcs ★(hosts, topics, derived figures) · signs ★finger-post schema+SIGN_TARGETS · quests ★10 · achievements ★21 · rooms ★9
src/ui/      ★welcome (front page; title.ts = thin delegate) · ★minigames/{studyhall,cargo,packetrush,climb} · index/state/modal(★inert exemption+backdrop focus)/panels(★sign card+armed guard)/hud(★avatar)/dialogue/map(★/8+travel)/journal(★fish row)/settings(★alwaysRun)/pause(★Wardrobe/Credits)/reader(★Education)/banner(★cap 6)/touch(★B hop)/loading
src/styles/  ui.css ★tokens (+.card glass, --accent-bright) · panels.css ★tokenized + game styles
tests/       719 across 47 files ★: per-pack sprites/* + helpers · hop · signs(bearings) · registry (landmarks↔ZONES↔ROOMS invariant — the "unbootable state" guard) · transitions · dialogue-data(figure drift) · content · lightsout/sokoban/packetrush/climb(+tests/helpers/climb-plan.ts route generator) · fishing · minigame(plays games end-to-end) · gamestate/quests · ui-welcome/ui-sign(real-ordering) · module-graph(★cycle/leaf/boundary guard, multi-line-aware)
tools/       preview.ts ★defaults 96×72 (`npm run preview:art -- world` / `-- sheet <pack> 3`)
.superpowers/sdd/2026-09-01-naman-world-hd/   execution ledger + all task reports/review packages (gitignored; KEEP until committed)
```

## Conventions & critical gotchas

1. **Never commit/push unless the user asks.** (The 2026-09-01 commit+deploy was user-requested; the rule stands for all future work.) `main` and `redesign/lineage-isle` currently point at the same head.
2. **Content rules:** facts about Naman only from `src/data/content.ts` (CGPA is **9.63**); dialogue derives figures via helpers, never literals; skills = approved set only (no React/Node/JS); the in-development product stays unnamed. Tests enforce all of this — keep them green.
3. **Keyboard:** world input via `src/core/keys.ts` only (window-level). `core/keys` is a **leaf**: `ui/*` must never import it (`tests/module-graph.test.ts` enforces; the rule exists because a suspected cycle cost a debugging round). Escape-that-OPENS-a-modal must stay `setTimeout(0)`-deferred; panel own-key close listeners need the **armed-on-first-keyup guard** (see `openSign`) or an `e.repeat` return (map/journal) — same-press-close is a real bug class here.
4. **Art pipeline:** 32px/tile; sprites are `SpriteDef`s using ONLY `palette.ts` keys; new packs must register in `atlas.ts allDefs()` or silently don't render; per-pack tests in `tests/sprites/<pack>.test.ts` pin dims/anchors/rename-guards; ALWAYS render `npm run preview:art -- sheet <pack> 3` (or `-- world`) and look before trusting art. Style rules live in `.superpowers/sdd/.../art-direction.md`.
5. **Purity:** `core/`, `world/` (minus bake callers), `systems/{Quests,Xp,Achievements,Dialogue}`, `src/games/*`, `src/data/fish.ts` never import Phaser (exception: `core/events.ts` wraps Phaser's EventEmitter — v2 baseline). Mini-game logic = pure reducers; renderers are thin DOM/canvas (a second Phaser.Game is deliberately avoided — modal z-index + WebGL context cost).
6. **Minigame framework:** rewards/recording happen ONLY in `MinigameHost.teardown()` (every dismissal funnels there); binary quest steps credit only from a WIN (`GameState.creditMinigameQuest` contract comment); hats: save stores bare ids, frames are `hat_<id>`, `equipHat` is the single `save.hat` writer.
7. **Browser testing protocol** (hard-won this session):
   - Dev server :5173, URL `http://localhost:5173/lineage/?st=1&fresh=1`. `?st=1` forces setTimeout stepping (occluded-tab rAF); note it DISTORTS real-time feel — difficulty judgments need a live tab.
   - **Seed saves only while parked on the title screen** (`?fresh=1` load first): a running play session's ~10s autosave will clobber `localStorage` seeds written from the old page. Never trust a teleport (`player.x=`) to stick — walk or reload with a seeded position.
   - Synthetic `KeyboardEvent`s (window-dispatched) reach `core/keys` consumers but NOT element-scoped listeners (pause menu, mini-game roots, panel guards) — use real CDP keys (`browser_press_key`) or `.click()` for those. Fixed-position elements have `offsetParent === null` — don't use it as a visibility probe for them.
   - `window.__game` / `__events` are exposed; `ui:panel {id:'minigame', data:'<id>'}` opens cabinets directly.
8. **Scene transitions:** interior→world goes through `scenes/transitions.ts` (`planRoomExit`/`acceptsRoomWake`); `game:title` during an interior stops the room with NO wake. Don't hand-roll wake payloads.
9. **Windows shell:** long heredocs/`node -e` get mangled — write `scratch/*.cjs` with the Write tool and `node scratch/x.cjs`. Playwright's tab is shared — subagents must not navigate it.
10. **Registry invariant:** every non-minor landmark needs a `ZONES` entry AND every landmark's `room` must exist in `ROOMS` (`tests/registry.test.ts`) — this is the guard that makes "added a landmark, game won't boot" impossible again.
11. **TDD:** RED first for pure modules; art/scenes verified by preview PNGs + controller screenshots (`scratch/shots/` holds ~25 from v2.5).
12. **Fish determinism (deliberate):** species-per-catch-count is a fixed schedule from `WORLD_SEED` (golden = cast #4) so 100% never luck-gates. To restore true 5% odds: salt `castSpecies`'s fork per save (one-liner; see comment in `tests/fishing.test.ts`). If you do, expect grindy 100% runs.

## Verification gates (all green, 2026-09-01)

```bash
npm test          # 47 files / 719 tests / 0 skips
npx tsc --noEmit  # clean
npm run build     # app 477.6 kB (154.6 gzip) + css 89.1 kB (29.2 gzip) + phaser 1.48 MB (339.8 gzip)
```
Browser-verified (real session, screenshots in `scratch/shots/`): boot 0 errors → welcome card → arrival + Mira → movement 7 t/s → hop (numeric arc = 0.6 tile exactly) → ledges → finger-post card → campus + warehouse interiors round-trip → Prof. Iyer auto-greet + topic menu → Study Hall + gag both trigger paths + pinned mailto **hit-tested** → Cargo + d-pad → Packet Rush + lose gag → Tower Climb render → map (…/8) → journal → wardrobe/credits rows → Reader Education (9.63) → mobile 390×844 (night lighting) → pause. Fishing logic is unit-tested (15 tests); a live-tab catch is on the user's feel pass.

## Repository state (snapshot 2026-09-02)

- **Working tree: CLEAN** (`git status --short` = 0). Everything is committed and pushed.
- **History on `main` (= `redesign/lineage-isle`):** `310a2f9` (old site) → `c336964` *v2 rebuild* → `de6f21e` *v2.5 HD Isle* → `dc1f78b` *stray-screenshot cleanup* → `4bfc056`+ *handoff docs*. Remote `origin/main` matches local.
- **Deployed:** `gh-pages` = `4ce6fe7`, built from this exact source (bundle hash `index-CX-KMjHK.js` verified identical between the deploy and a fresh local build). Live: https://naman-gururani.github.io/lineage/
- Gitignored local leftovers (`scratch/`, `.playwright-mcp/`, `.superpowers/`, `dist/`) are disposable artifacts, not work.

## How to run / resume

```bash
npm install
npm run dev                     # http://localhost:5173/lineage/
npm test && npx tsc --noEmit    # gates
npm run build                   # → dist ; deploy = publish /dist to gh-pages
```
- **Redeploy after any change:** `npm run build` then `npx gh-pages -d dist` (publishes `/dist` to the `gh-pages` branch; live in ~1–2 min).
- Debug URLs: `?fresh=1` wipe save (both keys) · `?st=1` timer stepping (testing only — distorts feel) · `?fish=gold` force golden koi.
- Art previews: `npm run preview:art -- sheet hero 3` · `npm run preview:art -- world` → `scratch/*.png`.
- New session: run `/getcontext` (reads this file, verifies against reality). The full v2.5 decision trail (every ruling, review, fix round) is `.superpowers/sdd/2026-09-01-naman-world-hd/progress.md` if it still exists locally (gitignored, deletable).

## Backlog (ordered; each item actionable cold)

1. **Real-input feel pass (user, live tab — cannot be judged under `?st=1`):** play all four mini-games + fishing + hop/movement on real hardware. Named dials: Packet Rush `prSpawnInterval`/ramp constants (`src/games/packetrush.ts` top), Climb `CLIMB` constants + stage hoist cycle 3.5s (`src/games/climb.ts`; stage-1's high checkpoint respawns onto a moving hoist ~75% of its cycle — nudge `platforms[0].speed` or move the flag if it frustrates), fishing bite/reel constants (`src/data/fish.ts`). T13 report §9 lists all dials.
2. **Music/SFX listen-through on speakers** (v2 backlog, still open): tune bus levels in `src/audio/engine.ts`; audition mini-game win/lose stingers.
3. **Real-phone touch pass:** joystick + A/B + Cargo d-pad on an actual device (desktop resize hides them correctly via `touch:auto`); verify hop button feel.
4. **Deploy + OG image:** build → gh-pages; capture a hero screenshot (welcome card over the island) for `og:image` in `index.html`.
5. **Fish determinism decision (optional):** keep the guaranteed-crown schedule (current, recommended) or add a per-save salt to `castSpecies` for true 5% odds (`src/data/fish.ts:81`, note in `tests/fishing.test.ts`).
6. **Credits content:** pause → Credits opens a stub panel (`src/ui/panels.ts` `openCredits`) — write real copy when wanted.
7. **Night-rain readability / thunder flash** (v2 backlog, untouched): weather layer in `src/systems/Weather.ts`; respect reduced-motion.
8. **Perf profile on a real GPU** (architecture: baked 1024px chunks + culling — expected fine; Playwright can't measure honestly).
9. **`npm audit`: 2 pre-existing high advisories** in dev tooling deps (predate v2.5; not shipped code) — review when convenient.
10. **Housekeeping (unblocked — everything is committed):** delete local `.superpowers/` + `scratch/` at will; `src/ui/title.ts` is a deliberate 4-line delegate (contract-tested), not dead code; `export type Tones` in `procedural.ts` is unreferenced (one-line delete if it bothers you).

## Checkpoint log

### 2026-08-31 — Session 1 (full rebuild) — CHECKPOINT #1
Rebuilt the entire game per spec/plan (see docs/superpowers/): foundation (rng/time/pixel/terrain/blueprint/paths/collision/scatter, TDD), art pipeline + all six sprite packs, Phaser scenes (Boot/World/Interior), living-world systems, dialogue/quests/achievements/XP/save, fishing, cutscenes, DOM panel layer, generated audio, soundtrack wiring. Seven parallel subagents delivered buildings/props/npcs/interior art, audio, UI panels, dialogue scripts (one rate-limit restart, one stall-resume; all completed green). Bugs found & fixed via Playwright playtesting: chunk-cull bounds, Phaser keyboard stall after sleep/wake (→ core/keys.ts), Escape same-event modal race (→ deferred open), interact prompt during lock, sealed-door bypass, travel-from-interior position clobber, cliff-ring diagonal gaps, render-texture lighting (→ veil + additive pools), night overlays under the veil, missing atlas registrations. Final: 220 tests, tsc clean, build green, ~30 verification screenshots in scratch/shots/. Nothing committed.

### 2026-09-01 — Session 2 (v2.5 "HD Isle" redesign) — CHECKPOINT #2
**What was done:** the full v2.5 redesign per the 2026-09-01 spec/plan — executed as 14 subagent-driven tasks (Opus implementers, per-task spec+quality reviews, fix rounds, controller visual/browser gates on everything) + 2 systematic-debug chains + a whole-branch final review + one consolidated fix wave. Highlights: 32px HD art (palette 33 ramps; 6 packs redrawn in parallel; controller-reviewed sheets), 96×72 island relayout (campus + warehouse + brook + 15 ledge lips), hop/ledge system (pure `planHop`), welcome card, UI token pass, host dialogue + finger-posts, education/CGPA 9.63 (derived in dialogue), 4 mini-games + gag + wardrobe + 21 achievements/10 quests, fishing pass, save v2.
**Key decisions (full trail with costs in the SDD ledger):** engine direction tokens kept over plan's n/e/s/w; faces 24→32px; player recolored to a coral "visitor" distinct from Naman; ravi not duplicated outdoors; packets 20-requirement kept with Rush granting 5 alternates; voice-only greetings for rooms whose hosts live outdoors; binary quest steps credit only on wins; fish schedule deterministic (crown never luck-gates); full_house roster now includes professor+dockmaster; SDD workspace retained (uncommitted branch ⇒ ledger is the record).
**Bugs found & fixed beyond plan scope:** NPCs idled half of every walk cycle (v2 latent), Byte's portrait never existed (v2 latent), scene.restart() state accumulation, interior-exit→title race + WAKE-listener leak (new pure `transitions.ts`), sign-card same-press close race (armed-guard pattern + `module-graph` boundary tests), `?fresh=1` only clearing the v1 key, goldfish achievement having no trigger (v2.5 latent — 100% was silently impossible), duplicate meeting XP, climb quest quit-exploit (defused pre-release).
**Two controller false alarms honestly withdrawn** (campus door "unreachable"; a "movement freeze" that was probe-vs-cutscene timing) — both documented in the ledger; each still yielded stronger tests.
**Gates now:** 47 files / 719 tests / 0 skips · tsc clean · build: app 154.6 kB gzip, css 29.2 kB gzip, phaser 339.8 kB gzip.
**Uncommitted:** 41 paths (17 tracked modified + new dirs per Change inventory). **Nothing was committed or pushed.** Backups: none needed outside git's working tree — the only non-repo artifacts are gitignored (`scratch/`, `.playwright-mcp/`, `.superpowers/` ledger — retain the ledger until commit).
**Nothing is half-finished.** Next session: user feel-pass items in the Backlog, top 3 first.

### 2026-09-02 — Session 2 close — CHECKPOINT #3 (final)
Post-deploy doc refresh so this file reads true top-to-bottom for `/getcontext`: repository-state section rewritten for the committed world, redeploy command added to How-to-run, housekeeping unblocked. Gates re-verified on 2026-09-02: **47 files / 719 tests / 0 skips · tsc clean · build green** (css 29.21 kB gzip · app 154.64 kB gzip · phaser 339.84 kB gzip; bundle hash matches the deployed `gh-pages`). **Working tree clean — zero uncommitted paths; local `main` = `origin/main` = `redesign/lineage-isle`.** Nothing is at risk outside git: `scratch/`, `.playwright-mcp/`, and the `.superpowers/` ledger are gitignored disposables (their substance lives in git history and this doc). Nothing is in flight. **Resume:** `/getcontext`, then Backlog #1 (real-input feel pass — mini-game/fishing dials, live tab, not `?st=1`).

### 2026-09-01 — Session 2 addendum — COMMIT & DEPLOY
At the user's explicit request: history assembled from the retained tree snapshots into `c336964` (v2 rebuild, incl. v2.5 design docs) → `de6f21e` (v2.5 HD Isle) → `dc1f78b` (removed a stray reference screenshot that had slipped into the root). `main` fast-forwarded and pushed; `redesign/lineage-isle` pushed; `npm run build` + `npx gh-pages -d dist` published to `gh-pages` (`4ce6fe7`). Live URL verified serving the v2.5 title. Note: the deployed save schema is v2 — returning visitors with a v1 save get the friendly fresh-start toast. HANDOFF sections above that said "uncommitted" are superseded by this entry; the SDD ledger under `.superpowers/` may now be deleted at will (history is in git).
