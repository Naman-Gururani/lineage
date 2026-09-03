# Naman's World v3 — "Story Isle" — Design Spec

Date: 2026-09-02 · Supersedes the mini-game, NPC-dialogue and quest sections of the v2.5 spec (`2026-09-01-naman-world-hd-redesign-design.md`). Everything not mentioned here (HD art, island layout, movement, hop, welcome card, UI tokens, fishing, save/settings plumbing) carries over unchanged.

## 1. Goal

Turn the island from "an open world with chatty villagers and four custom mini-games" into **a story-mode résumé**: a guide meets you at the pier, introduces Naman, and walks you station to station. Each résumé chapter is **locked behind a game everyone already knows**, and every fact is delivered as **one complete card popup**, never as a chain of dialogue boxes. Free exploration (fishing, shells, packets, chests, hats, the cat, day/night) stays as side content.

User rulings that drive this spec (2026-09-02):

- Greeter at the pier introduces Naman "like the intro of a résumé", then gates **Experience** behind **Wordle** (proper site format + a hint button), and guides the player through the whole game while leaving them free to roam.
- **Projects** are won at a **fair stall**; each win shows one project as a complete popup. Game choice delegated: **claw machine**.
- **Education** is gated by **Flappy Bird**.
- **Skills** are gated by a **letter-wheel word game** (Wordscapes style): spell Naman's tech stack from a ring of letters.
- The **Among Us disappearing-tile challenge vs bots** is also wanted → it becomes the island's bonus game (no chapter left to gate; see §3).
- Cargo, Packet Rush, Tower Climb, Lights Out and the Engine concept are gone. Games must be **smooth, not jittery**. NPCs get **few, fixed lines**.

## 2. What the game shows (the eight chapters)

All from `src/data/content.ts` (`ZONES`), unchanged in substance:

| Zone id | Chapter | Landmark (venue) |
|---|---|---|
| `about` | Who Naman is | The Cottage (re-read); delivered by Bo at the pier |
| `experience` | Barclays SDE + DevOps intern | Barclays Tower (elevator re-read); unlocked by Bo's Wordle |
| `education` | SRM IST, B.Tech CSE, CGPA 9.63 | SRM Campus |
| `skills` | 3 tool groups + how I work | The Workshop |
| `lineage` | Project: Payment Lineage Engine | **Sol's Prize Tent** (was The Engine) |
| `stealth` | Project: unnamed consumer product | The Vault (re-read) |
| `safestride` | Project: Safe Stride | Safe Stride clinic (re-read) |
| `contact` | Email / GitHub / LinkedIn | The Lighthouse |

Content rules stand: facts only from `content.ts`; the stealth product stays unnamed; skills are the approved set.

## 3. Games → chapters (final mapping)

| Game (id) | Everyone knows it as | Venue · host | Unlocks | Hat |
|---|---|---|---|---|
| `wordle` "Bo's Word Puzzle" | Wordle | Pier · **Bo** (Dockmaster) | `experience` + `tower_express` flag | — (XP) |
| `claw` "Prize Grab" | Claw machine | Sol's Prize Tent · **Sol** | `lineage`, `safestride`, `stealth` (one per prize) | goggles |
| `flappy` "Chalk Flight" | Flappy Bird | Campus chalkboard · **Prof. Iyer** | `education` | grad cap |
| `forge` "Word Forge" | Wordscapes letter wheel | Workshop bench · **Ravi** | `skills` | hard hat |
| `crew` "Crew Drop" | Among Us beans on Hex-A-Gone tiles | Harbor Arcade (old warehouse) · **Mira** | bonus: quest + badge | captain's cap |

`about` is given, not won (Bo's introduction). `contact` is never gated — the ability to reach Naman is always one interaction away. **Reader Mode stays fully ungated** as the accessibility and "no time" path.

Decision (mine): the tile challenge gates nothing because the four chapters are already spoken for; it lives in the emptied warehouse as Mira's crew game and counts toward *Arcade Legend* and 100%.

## 4. Story spine

### 4.1 The guide

**Bo** (existing NPC id `dockmaster`, display name "Bo", art already exists) replaces Captain Mira as greeter. Mira moves indoors to host the arcade.

### 4.2 Quest `story` (auto-started, main quest, journal top)

| Step | Target | Completed by |
|---|---|---|
| `meet` | 1 | Bo's introduction finishes → `about` unlocked |
| `experience` | 1 | Wordle won |
| `projects` | 3 | each claw prize caught |
| `education` | 1 | Chalk Flight won |
| `skills` | 1 | Word Forge won |
| `contact` | 1 | Contact card opened (lighthouse lens) |

Order is **suggested, not enforced**: every venue works whenever you reach it. "Next objective" = first incomplete step in this order. Reward: 200 XP, flag `story_done`, achievement `story`, fireworks (`celebrate`). 100% (`complete`) keeps its definition (all discoveries + all quests + all badges).

### 4.3 Where Bo stands (`data/story.ts` + `BLUEPRINT.storySpots`)

| Next objective | Bo waits at | Objective chip text |
|---|---|---|
| meet / experience | pier `(47,57)` | "Talk to Bo at the pier" |
| projects | outside the Prize Tent `(21,53)` | "Sol's Prize Tent — west along the shore" |
| education | outside the campus door `(62,31)` | "SRM Campus — north, on the green" |
| skills | outside the Workshop `(69,21)` | "The Workshop — north-east, past the woods" |
| contact | outside the lighthouse `(86,63)` | "The Lighthouse — east, on the Point" |
| done | pier | (chip hidden) |

Relocation rule: Bo's station changes when the objective changes. If Bo is **off-camera** (view rect + 2 tiles) he snaps to the new station. If on-camera, he walks a few tiles toward the station (patrol target) and snaps once off-camera. He is never seen teleporting.

### 4.4 Arrival (replaces Mira's tutorial)

Boat → hop onto the pier (existing) → Bo walks over → `intro` dialogue (3 lines) → **About card auto-opens** (`panel: 'zone:about'`, effectsAtEnd) → `unlockFacet('about')` → Bo's `puzzle` node offers the Wordle: **[Let's solve it]** / **[Maybe later]**. The arrival routine awaits the game's close, then Bo speaks his follow-up (won → points west to the fair; not won → "it'll keep"). Skipping the cutscene (Esc) still unlocks `about` and leaves Bo at the pier with the puzzle on offer. `tutorialDone` set as before; the controls hint line shows once.

### 4.5 Guidance surfaces

- **HUD objective chip** (`.hud-objective`, left cluster): "➜ Next: …" with a compass arrow rotated to the bearing from the player to the station (recomputed ≤ 2×/s from `uiState.player`); click/tap opens the map. Hidden when the story is done.
- **Map**: the objective's pin pulses (`.map-lm.objective`) even when undiscovered ("?" pin) — the guide told you where it is. Locked cards offer **[Show on map]** which opens the map with that pin selected.
- **Bo** at every station: one or two lines, no topics.

## 5. Cards and locking

- `save.unlocked: string[]` (zone ids). `GameState.isUnlocked(id)` → true for `contact` always, else membership.
- `openZone(id)` on a locked chapter renders a **locked card**: lock icon, chapter label (not the title), one hint line from `STORY_HINTS[id]` (e.g. "Solve Bo's word puzzle at the pier."), buttons **[Show on map]** **[Close]**. Never leaks content. *Ruling 2026-09-02:* the **venue name** (`zone.name`, e.g. "Sol's Prize Tent") is a place, not résumé content — locked cards and locked list rows may show it, which is what keeps the three project rows distinguishable. Locked lift floors show "Floor ?" (no role names or dates).
- `GameState.unlockFacet(id, announce = true)`: records, credits the story step, emits `facet:unlocked {id, first, announce}`, toast "📖 New chapter: <label>" on first unlock. Panels listen: when `announce` and the unlock arrives while a modal is open (a mini-game closing), the card opens right after that modal's `ui:closed`; otherwise immediately. The claw opens each prize's card itself mid-game (`announce:false`) and pauses until it closes.
- **Re-read spots** (all use `panel:zone:<id>`, locked card until won): cottage desk (`about`), tower elevator (`experience` — the elevator panel shows a locked lobby message otherwise), vault crate (`stealth`), Safe Stride map screen (`safestride`), campus notice board (`education`), workshop tool walls (`skills` — locked view shows tool **silhouettes** and a pin note "Spell them out at the bench"), prize shelf in the tent (`panel:prizes` → chooser of the three project cards with lock state).
- **Journal gains a "Résumé" tab**: the eight chapters in Reader order with ✓ / 🔒 and the hint; click opens the card. Quests tab shows the `story` quest with its six steps.

## 6. The games

### 6.0 Shared: smoothness and framework

- `src/games/loop.ts` (pure): `createStepper(hz)` → `advance(dtMs)` returns `{steps, alpha}` with a 50 ms frame clamp and an accumulator (unit-tested). `src/ui/minigames/loop.ts`: rAF driver over it, pauses on `document.hidden`/blur, `destroy()`.
- `src/ui/minigames/canvas.ts`: `makeCanvas(root, w, h, {pixelated})` sizes the backing store by `devicePixelRatio`, CSS size in logical px, returns `{canvas, ctx, scale}`.
- Canvas games simulate at **120 Hz fixed step**, draw at rAF with interpolation; no per-frame DOM writes (score text updates only on change); no layout reads in the frame; `image-rendering: pixelated` only for pixel-art canvases (claw, crew).
- Reduced motion: no shake/particles/flip animations; inherently moving games still move (the Hire-me mercy and Reader Mode are the fallbacks).
- `MinigameId = 'wordle' | 'claw' | 'flappy' | 'forge' | 'crew'`; renderers register from `src/ui/minigames/index.ts`. Host API additions: `host.unlockFacet(id, announce)`; `host.state` unchanged; rewards still funnel through `teardown()`.
- The **gag** stays on every game: `[Try again] [🤝 Hire me — extra life] [Exit]` + pinned mailto. Per-game copy in §6.1–6.5. **Mercy rule:** the third "Hire me" inside one game session unlocks that game's chapter outright ("HR fast-tracked you") — accessibility over gatekeeping.
- Debug: `?cheat=1` shows a small "Skip (dev)" button in every game panel that closes the round as a win; `?word=<answer>` forces the Wordle answer. Both undocumented in UI.
- Input: renderers attach their own listeners to the modal root (established pattern); **never import `core/keys`** (module-graph test). Touch: every game is playable with taps; Crew Drop gets the on-screen d-pad (moved from Cargo into a shared `ui/minigames/pad.ts`).

### 6.1 Wordle — "Bo's Word Puzzle" (`games/wordle.ts`, `ui/minigames/wordle.ts`)

- Exact Wordle format: 6 rows × 5 tiles, on-screen QWERTY keyboard (Enter, ⌫), physical keys, tile flip reveal (green/yellow/grey with correct duplicate-letter handling), row shake + in-panel "Not in word list", key colouring, aria-live announcements.
- **Answers derive from content**: the 5-letter alphabetic tokens of the approved skills — `kafka`, `flink`, `redis`, `linux` (test pins derivation, not the list). Answer for attempt *n* = `ANSWERS[n % 4]`; `?word=` overrides.
- **Dictionary**: `src/data/wordlist.ts` — 14,854 valid guesses (public Wordle allowed-guess list, fetched to `scratch/wordle-words.txt`), stored as one space-joined lowercase string, **dynamic-imported** when the game opens (no cost to initial load). Answers are always accepted.
- **Hint button** (💡, max 3): each press reveals one correct letter in place in a hint row above the grid; Bo's one-liner changes with hint count. Hints are free.
- Lose (6 rows): gag — Try again = new word; Hire me = a 7th row (once per word); Exit.
- Win → `close({won:true, score: 7 − rowsUsed})`; XP 90; `experience` unlocks; `tower_express` flag set (Bo: "the lift's yours").

### 6.2 Claw machine — "Prize Grab" (`games/claw.ts`, `ui/minigames/claw.ts`)

- Three prize boxes on the shelf, labelled: **Lineage Engine** (💳), **Safe Stride** (🚶), **???** mystery box (🔒 → `stealth`). Two decoy plushies fill the shelf.
- The claw sweeps left↔right on its own (triangle wave, 0.55 widths/s rising +15% per catch). One input (Space/Enter/click/tap) = drop. Catch if |claw − prize centre| ≤ prize width × tolerance (0.45 → 0.35 → 0.28 per catch); miss rises empty. Deterministic, no slip RNG.
- 6 tokens; each drop costs one; out of tokens with prizes left → gag (Try again = 6 fresh tokens, caught prizes stay; Hire me = +2 tokens). Won when all three caught → `close({won:true, score: 3})`, goggles.
- Each catch: the box rides to the chute, then that project's **full card opens over the game** (Sol's kicker line on the card foot); the game pauses until the card closes. `host.unlockFacet(zone, false)` credits `projects` +1.
- Canvas 640×400 logical, procedural pixel art (cabinet, glass glare, cable, claw, boxes), pixelated scaling.

### 6.3 Flappy Bird — "Chalk Flight" (`games/flappy.ts`, `ui/minigames/flappy.ts`)

- Classic rules: tap to flap, gravity, columns with gaps, +1 per column passed. **Win at `FLAPPY.WIN = 10`**. Constants at the top of `games/flappy.ts`: gravity 1500 px/s², flap −420 px/s, scroll 150 px/s (+5% every 5 columns), gap 130 px, spacing 220 px, bird radius 10.
- Aesthetic: everything drawn as **chalk on the lecture-hall board** (dark green, off-white strokes, a static chalk-grain texture, a grad-cap bird, columns as stacked books). Fits the chalkboard prop the game is launched from.
- Death (column/ground/ceiling) → gag: Try again = restart at 0; Hire me = **continue from the current score** (bird recentred, nearest column cleared, 1 s grace). Win → `education` unlocked, grad cap.
- 120 Hz fixed step, interpolated draw, 480×360 logical canvas, DPR-aware, crisp lines.

### 6.4 Letter wheel — "Word Forge" (`games/forge.ts`, `ui/minigames/forge.ts`)

- Wordscapes format: a ring of letter tiles; drag across letters (pointer), click them in sequence, or type; Enter submits, ⌫ removes, shuffle button. Word slots above show blank tiles with the **skill group as clue** ("Streaming · 5 letters"). Spelling a skill fills its slot and shows a chip toast ("KAFKA — Apache Kafka · Streaming & Messaging"). A non-skill word shakes: "Not one of Naman's tools." Only skill words count; no dictionary needed.
- **Five rounds**, letters cover every word of the round (Wordscapes rule: each ring letter once per word). Curated in `FORGE_ROUNDS`; a test asserts every playable word maps to an approved skill in `content.ts` and every ring covers its words:

  | Round | Ring | Words (skill) |
  |---|---|---|
  | 1 | J A A V K K F | JAVA (Java), KAFKA (Apache Kafka) |
  | 2 | F L I N K U X | FLINK (Apache Flink), LINUX (Linux) |
  | 3 | R E D I S O C K | REDIS (Redis), DOCKER (Docker) |
  | 4 | G I T S P R N | GIT (Git), SPRING (Spring Boot) |
  | 5 | P Y T H O N S Q L | PYTHON (Python), SQL (SQL) |

- Hint (💡, 2/round): reveals the first unrevealed letter of an unfound slot. Six wrong submissions in a round → gag (Hire me = reveal a whole word; Try again = clear the round's attempts).
- Win (all rounds) → `skills` unlocked, hard hat; the workshop tool walls fill in.
- DOM renderer (no continuous motion); CSS transitions ≤ 150 ms; pointer-drag path drawn with an SVG polyline.

### 6.5 Among Us tiles — "Crew Drop" (`games/crew.ts`, `ui/minigames/crew.ts`)

- Grid 10×7 of floor tiles; you (the coral visitor bean) vs **4 bot crewmates** (red, blue, green, yellow). A tile you stand on starts cracking; **0.9 s** later it drops — if you're still on it, you fall. Movement is tile-to-tile (160 ms hop, 4-way).
- **Amended 2026-09-02 (implementation finding):** five beans consuming a single 70-tile layer at hop rate emptied it in 2–5 s, so: a dropped tile **regrows** after **1.8 s** (`REGROW_MS`; 5 s and 3.5 s were measured and rejected — the player walls itself in with its own trail and the median round stays at 5 s; nothing may stand on a tile while gone); the **shrink is permanent** — from 15 s a random edge-adjacent tile becomes `void` (never regrows, never enterable) every 2.5 s, the interval shrinking 10% per step down to 0.6 s; an occupied (or claimed-by-a-hop) shrink target cracks instead of voiding. Measured seeds 1..20: 15.8 s min / 34.2 s median / 51.1 s max.
- **Amended 2026-09-03 (v4 user feedback):** the regrow rule above is withdrawn — holes are permanent; the v4 spec (docs/superpowers/specs/2026-09-02-fair-design.md, §13) records the retuned deck (12×8, crack 1400 ms, think 450 ms, bite every 3000 ms) and the YOU tag / named bots.
- Bots think every 350 ms but **hold their nerve**: they move only when their own tile is within one think-plus-hop of dropping, then to the neighbouring intact tile with the most intact neighbours; error rate ε grows 0.10 → 0.40 over 30 s (they blunder onto cracking tiles). A bean whose tile cracks with no intact neighbour falls when it drops. While a bean is frozen (after a revive) its tile neither ages nor starts cracking. Seeded RNG; a test proves every seed 1..20 terminates within 90 s under a trivial survival policy and that no round ends before the shrink starts, and that no bean ever stands on a gone or void tile.
- Win = last bean standing → captain's cap, `crew` quest done. Fall → gag: Try again = new round; Hire me = respawn on a random intact tile, bots frozen 1 s. Copy: "You were ejected." / "Naman was not the impostor."
- Canvas 640×420, top-down tiles with a lip, procedural beans (body, visor, backpack), fall = shrink+fade. Keys: WASD/arrows; touch: d-pad.

## 7. Dialogue (data/npcs.ts rewritten)

Rules, enforced by `tests/dialogue-data.test.ts` (rewritten):

1. Trees: `dockmaster` (Bo), `naman`, `ada`, `sol`, `professor`, `ravi`, `mira`, `ilse`, `tomas`, `pip`, `arjun`, `cat`, `bed`, `lens`, `telescope`, `vault_door`. Nothing else — all seventeen talking objects and the Lou/Devi villagers are gone.
2. Every node ≤ 3 lines, every line ≤ 120 chars. `intro` (auto-greet) nodes ≤ 2 lines.
3. **No digit characters in any line** — figures live on cards only. No emoji; no unapproved skills.
4. No "tell me more / what's nearby" topics; `NEARBY` is deleted. Hosts keep `intro` + `talk`; hosts of game rooms point at the game prop.
5. All trees terminate; effects reference real quests/steps/flags (existing checks stay).

Bo's script (verbatim; effects in brackets):

- `intro` (arrival): "Welcome to Lineage Isle. I'm Bo — I run the docks." / "This whole island is Naman's résumé. Every building is a chapter, and I know the way round." / "Here's the man himself." [panel zone:about, effectsAtEnd] → `puzzle`
- `puzzle`: "Now, a favour. I've been stuck on this word puzzle all morning — five letters, six tries." / "Crack it and I'll tell you what he actually does at the bank." → choices **Let's solve it** [minigame wordle] · **Maybe later** → "It'll keep. I'm not going anywhere."
- entry when `experience` not done: "Puzzle's still open whenever you want it." → **Try the puzzle** [minigame wordle] · **Not now**
- entry `experience` done, `projects` not: "The lift in Barclays Tower is yours now — every floor's a year he worked there." / "Next: west along the shore. Sol's prize tent on the fairground has his projects, three of them."
- `projects` done, `education` not: "North to the campus, on the green. The professor's got a flight test for you."
- `education` done, `skills` not: "Ravi's workshop is north-east, past the woods. Spell out what Naman knows."
- `skills` done, `contact` not: "Last stop: the lighthouse on the Point, east along the fields. Send him a signal."
- story done: "That's the whole story. Explore all you like — Mira's crew has a game going in the old warehouse."

Other hosts (one node each unless noted): Naman ("You found my place. Bo's given you the headlines — the desk has the rest."), Ada (lift working / "needs a visitor pass — Bo hands them out at the pier"), Sol (barker line + **What are the prizes?** → "The big one's his day job. The small one's a college project that shipped. The mystery box is a secret."), Prof. Iyer ("Naman's transcript is on the notice board — but first, my flight test." / "Fly the chalkboard course and the board is yours."), Ravi ("Every tool on these walls is something Naman actually uses. Spell them out at the bench and I'll hang them up."), Mira ("Welcome to the arcade. My crew built this one — last bean standing wins." + starts `crew`), Ilse (beacon quest, trimmed), Tomas (fishing, trimmed), Pip (shells, trimmed), Arjun ("This clinic is Safe Stride — his college project. The full story's a prize at Sol's tent; the screen shows it once you've won it."), cat ("Mrrp."), bed (sleep choice), telescope (`summit`), vault_door ("Sealed. The lock wants twenty packets." — spelled out).

## 8. World and rooms

- `blueprint.ts`: landmark `lineage` → `sprite: 'bld_fair'`, `room: 'fair'` (same 6×4 footprint, door unchanged). Region `engine` renamed "The Fairground". Fair dressing near the tent: `bunting` ×3, `balloons` ×2, two `stall` props — on land, off roads and doors (blueprint tests). `npcSpots`: drop `lou`, `devi`, `mira`; `dockmaster` → `(47,57)`. New `storySpots` (the five Bo stations) forced to land like other spots.
- `WorldScene` cast: remove Mira/Lou/Devi; add Bo (`dockmaster`, idle, facing down). Bo relocation per §4.3. Arrival per §4.4. `Effect.minigame` handler.
- `rooms.ts` (ids unchanged except `lineage`→`fair`): about (desk → about card; only bed keeps a tree), experience (stairs become decor; elevator gated), **fair** (Sol, `int_claw` → `minigame:claw`, `int_prizeshelf` → `panel:prizes`, bunting/balloons), stealth (crate → stealth card), safestride (map screen → card; SOS decor), campus (chalkboard → `minigame:flappy`; notice board → card), skills (bench → `minigame:forge`; walls gated), **warehouse → "Harbor Arcade"** (`int_cabinet` → `minigame:crew`, Mira inside), contact (lens tree → beacon → contact card).
- `signs.ts`: "Cargo Warehouse" → "Harbor Arcade" (note "Mira's crew game"); "The Engine — payment lineage project" → "The Fairground — Sol's Prize Tent" (note "his projects, as prizes"); "Engine Works" → "The Fairground". Coordinates unchanged; bearing tests keep passing.
- `content.ts`: `lineage.name` → "Sol's Prize Tent"; `LandmarkKind` `engine` → `fair`. No fact changes.
- Welcome pitch: "I build real-time systems that move money — this island is my résumé. Bo will show you around."

## 9. Art (new sprites; art-direction.md rules apply)

- buildings: `bld_fair` + `bld_fair_night` 192×128, striped big-top tent, bottom-centre anchor, outline (pins in `tests/sprites/buildings.test.ts`; `bld_lineage` stays defined — rename guard).
- props: `bunting` (96×24, flat), `balloons` (32×56).
- interior: `int_claw` (64×96, 2 frames), `int_prizeshelf` (96×48, wall), `int_cabinet` (48×80, 2 frames, light), `int_bunting` (96×16, wall), `int_balloons` (32×48).
- All registered via the existing pack arrays (atlas `allDefs()` picks them up); `npm run preview:art -- sheet <pack> 3` inspected before acceptance; `tests/atlas-capacity.test.ts` must still pass.

## 10. Progression data

- **Quests (8)**: `explore` (8), `packets` (20 → Vault door), `shells`, `fishing`, `beacon`, **`story`** (auto, §4.2), **`crew`** (giver Mira, "Mira's Dare", reward captain + 100 XP). Removed: `gear`, `studyhall`, `cargo`, `packetrush`, `climb`.
- **Achievements (22)**: drop the four cabinet badges; add `ach_wordle` "Five Letters" 🔤, `ach_claw` "Prize Winner" 🧸, `ach_flappy` "Frequent Flyer" 🪶, `ach_forge` "Full Stack" 🔧, `ach_crew` "Last Bean Standing" 🫘, `story` "The Whole Story" 🗺️; `arcade` = all five games. `full_house` roster: bo(dockmaster), tomas, pip, ada, ravi, sol, arjun, ilse, naman, professor, mira.
- **Hats** unchanged (7). `MINIGAME_HATS = { claw: goggles, flappy: grad, forge: hardhat, crew: captain }`.
- **Save v3** (`nw2.save.v3`): + `unlocked: string[]`; v1 and v2 keys are dropped on load with the fresh-start toast; `?fresh=1` clears all three keys.
- Removed code: `games/{lightsout,sokoban,packetrush,climb}`, `ui/minigames/{studyhall,cargo,packetrush,climb}`, `ui/lineage.ts` (Engine console), Packet Rush synthetic packets, cargo coins, their tests and `tests/helpers/climb-plan.ts`.

## 11. Testing and verification

- Unit (vitest): reducers for all five games (scoring, termination, determinism, hint rules); `loop.ts` stepper; wordlist shape + answer derivation; forge word↔skill drift; story `nextStep`/stations on land; GameState `unlockFacet`/story credit/mercy/arcade; save v3 migration + legacy drop; registry (fair room, 8/8/9/9 counts hold); signs; dialogue-data (new budget rules); sprites (new defs pinned); minigame host e2e for each game (open, gag paths, win payout, cheat button); UI: locked card, Résumé tab, objective chip, map pulse, elevator/toolwall lock views.
- Gates: `npm test` · `npx tsc --noEmit` · `npm run build` green; module-graph rules intact.
- Browser (Playwright, `?st=1&fresh=1&cheat=1` plus a live tab for feel): welcome → arrival → Bo intro → About card → Wordle (`?word=kafka`) → Experience card → objective chip/map pulse → Bo at the tent → claw ×3 with cards → campus → Chalk Flight (cheat + a real short play) → workshop → Word Forge round → lighthouse → contact → story fireworks → arcade Crew Drop → Résumé tab → Reader Mode ungated → mobile 390×844.

## 12. Out of scope

Deploy/commit (user-triggered), new music, OG image, audio pass, Fish odds. Vault/Safe Stride buildings stay (re-read spots) — removing them was considered and rejected as layout risk for no story gain.
