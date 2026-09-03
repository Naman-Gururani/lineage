# Naman's World Fair (v4) — Design Spec

Date: 2026-09-02 · Supersedes the world, story-venue and progression-data sections of the v3 spec (`2026-09-02-story-isle-design.md`). The mini-game framework (§6.0 there), the five games' rules, the card/lock model (§5), Reader Mode, the save/settings plumbing, hats, day/night, weather, hop and the UI token system carry over unless this document says otherwise.

## 1. Goal and user rulings (2026-09-02, after playing v3)

- "Instead of a city, make it a **big fair**" — the whole world becomes a fairground.
- The **career journey is a rollercoaster ride** animation; the fair has **multiple mini-games**; **the entry ticket is the Wordle**.
- The Barclays Tower felt **repetitive** (experience is already told at the gate and in the ride) — it goes.
- **Word Forge**: progress was lost on leaving and the tech stack never appeared — persist progress, show it, and finish with a **cumulative tech-stack popup**.
- Every game gets an option to **show all the answers**.
- User choices: a **new flat fairground map** (not a re-dress of the island); the coaster is **ridden in the world** as a **front-facing structure with real hills**; **rides are free** after the ticket, stalls pay cards and hats; v3 was committed as a checkpoint (`a94c31f`) before this rework; the name is **Naman's World Fair**.

## 2. The fair (world)

- **Size:** `WORLD_TW = 72`, `WORLD_TH = 56` (2304×1792 px). Flat: no sea, cliffs, plateaus, ramps, river, brook or ledges (the terrain kinds stay in `terrain.ts` for the tile painter; the fair blueprint simply never emits them). One **duck pond** (POND) for Hook-a-Duck.
- **Ground:** lawn (`GRASS`) everywhere; **avenues** (`PLAZA`, paving) from the gate to the coaster with the **Midway** as a wide paved strip; **gravel paths** (`PATH`) to the corners; **tarmac apron** outside the gate = `PLAZA` too (same paving); tall grass patches on the picnic lawns.
- **Boundary:** a perimeter **fence** (existing `fence_h/v/post` decor, solid) with hedges (`bush`) on the outside and a row of trees beyond; the only opening is the **Gate** at the bottom centre. Inside the fence the ground is walkable; outside it, a 4-tile strip of lawn where you arrive.
- **Regions** (for banners, ambience, map labels): `apron` "The Gate", `midway` "The Midway", `west` "Prize Row", `east` "Game Row", `hill` "Coaster Hill", `pond` "Duck Pond", `wheel` "Wheel Lawn", `picnic` "Picnic Lawn".
- **Attractions** replace landmarks and rooms. `Blueprint.attractions: Attraction[]` where `Attraction = { id, tx, ty, w, h, door: Vec2, sprite, interact: string, zones?: string[], discoverable?: boolean }`. `interact` is `booth:bo` (gate), `ride:coaster`, `minigame:<id>`, `panel:zone:<id>`, or `duckpond`. Discoverable attractions (8, the "n/8 found" set): `gate`, `coaster`, `prizetent`, `forge`, `flight`, `arcade`, `duckpond`, `guestbook`. `zones` maps an attraction to the chapters it delivers (gate → about; coaster → education, experience; prizetent → lineage, safestride, stealth; forge → skills; guestbook → contact). **No interiors**: `InteriorScene`, `data/rooms.ts`, `world/rooms.ts`, `scenes/transitions.ts` and the interior sprite pack are deleted.
- **Layout** (tiles, origin top-left; the plan fixes exact numbers):
  - South edge: arrival lawn (rows 52–55), the **Gate arch** with the **Ticket Booth** (Bo) at (36, 48–51), a **turnstile** across the gate opening (solid until the `ticket` flag).
  - Rows 40–47 centre: the **Midway** (paved), fountain in the middle; **Prize Tent** (claw) west of the midway, **Word Forge booth** east; **Chalk Flight booth** and the **Arcade tent** (Crew Drop) further along; food carts, a candy-floss cart, the **balloon cart** (Pip), benches, bins, lamps, bunting between lamp posts.
  - Rows 14–30: the **Career Coaster** — a front-facing structure spanning ~48 tiles wide along the north (rows 6–22), its **station** at the foot (door on the midway's north end); the structure's base row is solid.
  - West corner: the **Duck Pond** (Tomas, Hook-a-Duck) with reeds/lilies; east corner: the **Ferris wheel** (animated, lit at night; not rideable in v4) on the Wheel Lawn; south-east: the **Guestbook booth** (Ilse, Contact) by the exit lane; picnic lawns with tall grass, trees and the cat.
- **Collectibles:** 20 **lost tickets** (replace packets, same pickup mechanic, ids `t<n>`), 6 **prize boxes** (chests), 5 **stray balloons** (replace shells; Pip's quest). The cat companion stays (Tomas's quest reward).
- **Signs:** finger posts relabelled to fair destinations; bearing tests stay.
- **Night:** lamps, bunting lights, the coaster and the wheel get night overlays (`_night` defs like buildings); Ilse's quest "Lights on" flips the fair's string lights at dusk (replaces the beacon).
- **Map/minimap:** baked from the new grid; region labels from the new polygons; pins = discoverable attractions; the objective marker unchanged.
- **Arrival:** no boat. Fresh save: the player spawns on the arrival lawn facing the gate; Bo walks over from the booth; 3 lines → About card → "Tickets are one word each" → Wordle → **ticket** (flag `ticket`, story step) → the turnstile opens (prop removed / passable) → Bo's follow-up points to the coaster. Esc skips the walk, not the booth.

## 3. Chapters, games and rides (what shows where)

| Where | Host | What you do | Delivers | Prize |
|---|---|---|---|---|
| Ticket Booth (gate) | Bo | intro; **Wordle** (`?word=` debug; hints; **Show me the word**) | About card; `ticket` | entry |
| **Career Coaster** | Prof. Iyer (operator) | ride (§4) | Education + Experience (milestone cards, then the **Career** card) | badge *Front Seat* |
| Prize Tent | Sol | **claw** | one project card per prize | goggles |
| Word Forge booth | Ravi | letter wheel (§5) | Skills (cumulative tech-stack card) | hard hat |
| Chalk Flight booth | — (Arjun runs it) | Flappy | fun only | grad cap |
| Arcade tent | Mira | Crew Drop | fun only (quest `crew`) | captain |
| Duck Pond | Tomas | **Hook-a-Duck** (fishing re-skin) | fun; quest `ducks` → the cat | — |
| Guestbook booth | Ilse | read | Contact (always open) | — |

Every game panel gets a visible **"Show me the answers"** control (copy per game; a cheeky toast "Noted. HR sees everything."): Wordle reveals the word and grants the ticket; Forge fills every slot and opens the tech-stack card (Skills unlocked); Claw drops all three prize cards in sequence (projects unlocked); Chalk Flight / Crew Drop simply end the round (no hat — the hat is for playing). The mercy rule stays too.

## 4. The Career Coaster (ride)

- **Structure:** a front-facing coaster drawn as three procedural sprites `coaster_span_0..2` (each 512×320 px = 16×10 tiles) laid side by side along rows 6–15: lift hill → first drop → camelback → **loop** → final run → station. Supports every 3 tiles; rails 2 px; a `coaster_station` (192×128) at the right end with a queue rail; `_night` overlays with bulb lights along the rails. The base row of each span is solid; the player can walk in front of the structure (it is the backdrop of Coaster Hill).
- **Track path:** `data/coaster.ts` exports `COASTER_PATH: Vec2[]` (px, relative to the structure's left-bottom origin) — the cart's centre-line polyline along the visible profile — and `COASTER_STOPS: { at: number /* path index */, kicker: string, title: string, line: string }[]`, derived from `content.ts`: 
  1. `education.facts Years` start → "2020 · SRM IST — B.Tech CSE begins" (line from `education.body[0]`)
  2. `experience` intern role (the 🛠️ paragraph via the same split as the elevator used) → "2023 · Barclays — DevOps intern"
  3. `experience` SDE role (⭐ paragraph) → "2024 · Barclays — Software Development Engineer"
  4. `lineage.title` → "In production — Real-time Payment Lineage Engine" (line: the ~750M sentence)
  5. `stealth.title` → "Now — building a consumer product" (line: `stealth.body[0]`)
  A test asserts every kicker/title/line is a substring of content or a formatting of a content fact (no new facts).
- **Ride (`systems/Coaster.ts`, Phaser):** interact at the station → Prof. Iyer's one line → fade → the player sprite hides, a `coaster_cart` (2 frames, the hero visible in it) is placed at path index 0; the cart follows the polyline with a **speed profile**: lift 60 px/s, drops up to 520 px/s, loop 380, station approach 120 (constant-speed segments interpolated by arc length, no timers except the cutscene's). The camera follows the cart (`CameraRig.follow` on a followable proxy) with zoom ×1.25 and a light shake on drops; `sfx` clicks on the lift, a whoosh on drops. At each `COASTER_STOPS[i].at` the cart slows to 40 px/s for 1.6 s while a **milestone card** (DOM, `.ride-card`: kicker, title, one line) slides in and out; the world stays locked. At the end: the cart parks, the player reappears, and the **Career card** opens (a synthetic content block: title "Career", the two experience roles + education facts, chips from `experience.chips`), `unlockFacet('education', false)` + `unlockFacet('experience', false)` (announce off; the Career card is the announcement), badge `ride`, XP 120. Esc skips to the end (cards still granted). Reduced motion: shorter waits, no shake, no zoom.
- **Re-ride** any time from the station (no reward twice; the Career card re-opens).

## 5. Word Forge fixes

- **Persistence:** `save.minigames.forge.progress = { round, found: string[] }` written on every found word (through the host: `host.progress(data)` → `GameState.minigameProgress(id, data)`), restored on mount. Quitting keeps what was found.
- **Board:** the booth's **prize board** (`int` no longer — an outdoor prop `board_forge`, interact `panel:forgeboard`) lists the 10 tools with found ones lit; the Résumé row shows "6 / 10 forged" while in progress.
- **Cumulative popup:** finishing all rounds opens **"Naman's tech stack"** — the Skills card with an extra header block listing every forged word by group (Languages, Streaming, State & tooling) — then Skills is unlocked. "Show me the answers" fills the board and opens the same popup.

## 6. Story spine

Quest `story` (auto): `ticket` (Wordle at the booth) → `ride` (coaster) → `prizes` (×3) → `toolkit` (forge) → `guestbook` (Contact card opened at the booth). Bo waits: booth → coaster station → prize tent → forge booth → guestbook → booth. `STORY_HINTS` per zone: about "Bo introduces Naman at the ticket booth."; experience/education "Ride the Career Coaster."; projects "Win it at the Prize Tent."; skills "Spell the toolkit at the Word Forge booth."; contact "". The objective chip and map marker unchanged. Finale: fireworks over the midway + badge *The Whole Fair*.

## 7. Progression data

- **Quests (7):** `story`, `explore` ("See all eight attractions"), `tickets` ("Lost tickets", 20, reward XP + `goggles`? no — goggles are the claw's; reward: 150 XP + flag `vip` used by the Ferris wheel later), `balloons` (Pip, 5, seashell hat renamed **Party crown**), `ducks` (Tomas, hook 3 ducks, cat companion), `lights` (Ilse, flip the fair lights at dusk), `crew` (Mira).
- **Achievements (23):** re-themed titles: `first_steps` "Through the Gate", `sprinter`, `grass_whisperer`, `bonk`, `collector` "Ticket Stub" (10), `archivist` "Full Book" (20), `night_owl`, `rain_dancer`, `well_read`, `ride` "Front Seat" (replaces `summit`), `fisher` "Hook, Line" , `cat_person`, `full_house`, `keeper` "Lights On", `ach_wordle` … `ach_crew`, `arcade`, `goldfish` "Golden Duck", `story` "The Whole Fair", `complete`.
- **Hats (7)** unchanged in art; names: seashell → "Party crown".
- **Save v4** (`nw2.save.v4`): `packets`→`tickets`, `chests`→`prizes`, `discoveries` = attraction ids, `fish`→`ducks`, + `minigames[id].progress?: unknown`. v1–v3 dropped with the fresh-start toast.

## 8. Dialogue (re-theme, same budget rules)

Trees: `dockmaster`(Bo) `professor`(operator) `sol` `ravi` `arjun`(flight booth) `mira` `tomas`(pond) `pip`(balloons) `ilse`(guestbook/lights) `cat` + `gate`(turnstile, one line when locked) `telescope`→ removed. Naman does not appear as an NPC (his voice is the cards). ≤3 lines/node, no digits, no emoji; hosts' `intro` ≤2 lines. Bo's ladder: `story_done` → done; `notFlag ticket` → puzzle_again; `locked experience` → to_coaster; `locked lineage|safestride|stealth` → to_tent; `locked skills` → to_forge; default → to_guestbook. Bo's intro (verbatim): "Welcome to Naman's World Fair. I'm Bo — I run the gate." / "Everything in here is a chapter of Naman's résumé, and I know the way round." / "Here's the man himself." [About card] → "Tickets are one word each. Five letters, six tries — crack it and you're in."

## 9. Art (32 px, art-direction.md rules)

New pack `src/art/sprites/fair.ts` (`FAIR_DEFS`): `gate_arch` (256×160, sign "NAMAN'S WORLD FAIR"), `ticket_booth` (96×96), `turnstile` (64×48), `booth_forge` (128×112, board), `board_forge` (64×48), `booth_flight` (128×112, chalkboard), `booth_guestbook` (96×96), `cart_food` ×2 (64×64), `cart_balloons` (64×80), `duckpond_rim` decor via terrain + `duck_0..2` (16×16 pickups for Hook-a-Duck bobbers), `stringlight` (32×48 pole, `_night`); pack `rides.ts` (`RIDE_DEFS`): `ferris_wheel` (256×320 base+frame) + `ferris_rim_0..3` (rotation frames) + `_night`, `coaster_span_0..2` (512×320 each, + `_night`), `coaster_station` (192×128, + `_night`), `coaster_cart_0..1` (48×32). Existing reused: `bld_fair` (Prize Tent), `bld_warehouse` (Arcade, with a new marquee sprite `arcade_sign` 96×32), `stall` (food), `fountain`, `bench`, `lamp`, `fence_*`, `bunting`, `balloons`, `sign_finger`, trees/bushes/flowers. Deleted: the seven other `bld_*` defs, the interior pack.

## 10. Removed / kept

Removed: island terrain shapes and the boat arrival, interiors (scene, rooms, sprites, transitions), the tower/cottage/campus/workshop/vault/clinic/lighthouse/warehouse-as-room, fishing (→ Hook-a-Duck re-skin of `Fishing.ts` with duck art and `data/ducks.ts` renamed from fish), the telescope/viewpoint, the beacon cutscene (→ lights), packets/shells (→ tickets/balloons), `tower_express` fast travel (→ map travel to discovered attractions, unchanged mechanic). Kept: hop (fences and crates still hop-able), day/night, weather, wind, critters, cat, wardrobe, journal (Résumé tab), map travel, settings, Reader Mode, welcome card (pitch "…this fair is my résumé. Bo has your ticket."), the five games and the mini-game host, save/settings plumbing.

## 11. Testing and verification

- Unit: fair blueprint invariants (every attraction footprint on land and off paths, doors walkable, roads connect the gate to every attraction door, the fence is closed except the gate opening, all spots on land); registry (attractions ↔ zones: every zone delivered by exactly one attraction; 8 discoverable); coaster path (monotone arc length, stops in order, speed profile bounds, stop data derived from content); forge persistence/progress/cumulative; reveal options per game; hook-a-duck data; story stations on land; save v4 migration; dialogue re-theme budget; signs bearings; sprites (new packs pinned, atlas capacity).
- Gates: `npm test`, `npx tsc --noEmit`, `npm run build`.
- Browser (static preview, `?fresh=1&cheat=1&word=kafka`): arrival → Bo → About → Wordle → ticket → turnstile opens → coaster ride with five cards and the Career card → prize tent (claw) → forge (persistence: quit mid-way, return, board shows progress; finish → tech-stack popup) → flight/arcade fun stalls → duck pond → guestbook → finale → Résumé 8/8 → map → Reader Mode → mobile.

## 12. Out of scope

Riding the Ferris wheel, a ticket economy, new music, deploy (user-triggered), OG image.

## 13. Amendments

Appended after implementation; each line records where the shipped code deliberately
differs from the section above. The code is the authority; these lines say why.

- **Amendment 2026-09-03 · §2** — The perimeter is a **hard full-tile solid ring** (`boundarySolids(bp)`, derived from `bp.fence` and `bp.gateOpening`) that exists independently of the decorative fence. The `fence_h/v/post` and `bush` props stay **low** decor so §10's hop still works over them — but the ring itself is never hoppable, so the park cannot be left except through the gate. The first implementation made the decor *be* the boundary and left walk-through gaps on the south columns and a hop-out at the west.
- **Amendment 2026-09-03 · §2** — `Blueprint` gained a second placed-thing type alongside `attractions`: `structures: Structure[]` = `{ sprite, tx, ty, w, h, solid: Rect[], gate?: string }`, with `structureSolids(bp, flags)`. Even-tile-wide sprites (the 16-tile coaster spans, the 8-tile wheel, the 2-tile turnstiles) cannot be centred on a tile the way a prop is, and turnstiles needed a flag-gated solid. Structures and attractions are both drawn by the same footprint routine — centred on the footprint, standing on its bottom edge, depth = the bottom-edge y — and structures are built **first**, so overlap resolves by y alone.
- **Amendment 2026-09-03 · §2 / §4** — The three `coaster_span_*` are solid **over their whole footprint** (rows 6–15, x 12–59), not just their base row. The lattice is drawn across the full height, so a player who rounded either end stood *inside* the ride, under its own timbers and boxed in by the station and the wheel. You go round the coaster, not behind it. The ferris wheel keeps the base-row-only rule — the lawn behind it is meant to be walked on.
- **Amendment 2026-09-03 · §2 / §4** — The station's footprint is **(48, 12, 6, 4)** with its door at **(50, 16)**, flush with the spans' foot, not the (48, 16) the plan's layout table gave. At (48, 16) the parked cart floated roughly 140 px above the platform at the end of the ride. `professor` moved to (52, 17) and the `ride` story spot to (53, 18) with it. The overlap between the `coaster` attraction and `coaster_span_2` is deliberate and exempted from the no-overlap invariant.
- **Amendment 2026-09-03 · §5** — The cumulative popup renders the forged words as **body lines above the chip groups** of the Skills card, not as a separate header block. It is `openContent({ ...skills, title: "Naman's tech stack", body: forgedLines(found), points: undefined })` — the forged list replaces the body, the content's own chips follow underneath. Unforged rows on the prize board stay **blank** rather than showing greyed words: the board reports progress, it is not a cheat sheet (Wordscapes convention, and the reveal button already exists for anyone who wants the answers).
- **Amendment 2026-09-03 · §8** — Bo's `intro` is **3 lines**, one over the "hosts' `intro` ≤ 2 lines" budget. The three lines are the user's verbatim copy quoted in this same section; verbatim copy wins over the budget. `tests/dialogue-data.test.ts` carries the exemption for `dockmaster.intro` and holds every other host to two.
- **Amendment 2026-09-03 · §8** — `professor`'s `intro` is not dead copy: `WorldScene` runs it once as a first-visit greeting at the station (flag `greet_coaster`) before the ride starts, then falls through to his `talk` node.
- **Amendment 2026-09-03 · §9** — The **ferris defs live in `rides.ts`**, not `fair.ts` as this section says. `ferris_wheel` (+`_night`) and `ferris_rim_0..3` sit with the coaster in `RIDE_DEFS`, which is where the rest of the ride art is and where `tests/sprites/rides.test.ts` pins them.
- **Amendment 2026-09-03 · §9** — **Eight** `bld_*` defs were deleted, not seven; only `bld_fair` (Prize Tent) and `bld_warehouse` (Arcade) survive, each with its `_night` overlay. The count came from a grep of the real pack rather than the spec's arithmetic.
- **Amendment 2026-09-03 · §7** — The save's **field names are unchanged** (`packets`, `chests`, `fish`, `discoveries`); only their labels and their contents moved (tickets, prize boxes, ducks, attraction ids). Renaming the fields would have rippled through the whole scene for no user-visible gain. The schema key is `nw2.save.v4` and v1–v3 are dropped, as specified.
- **Amendment 2026-09-03 · §7 / §12** — The `vip` flag is set by the `tickets` quest and **read by nothing** in v4. Riding the Ferris wheel is out of scope (§12), so the flag is a deliberate hook left standing for whoever builds it, not dead code to remove.
- **Amendment 2026-09-03 · §11** — One test file beyond the list: `tests/coaster-run.test.ts`, twelve tests driving `Coaster.run()` against a fake scene/emitter. It is the ride runner's only regression net (nothing else in the repo instantiates a Phaser scene) and it is what proves the SHUTDOWN listener is armed before the first await.
- **Amendment 2026-09-03 · §2/§8 (user feedback):** Bo walks at 130 px/s in the arrival and 110 px/s between stations (villagers stay at 38); his arrival walk-on is animated through the cutscene tween's update hook.
- **Amendment 2026-09-03 · §3 (user feedback):** the ticket Wordle draws its answer at random from a pool of nine résumé words (five-letter tokens of every zone's chips/groups plus résumé prose words present in `content.ts`: kafka, flink, redis, linux, money, trust, event, stack, scale), never repeating the word just played; `?word=` still pins one.
- **Amendment 2026-09-03 · §3 (user feedback):** Hook-a-Duck casts toward the pond — the landing point is derived from `BLUEPRINT.ponds[0]` (centre pulled 0.35·ry toward the player) and the player faces it — not a fixed "down" as on the v3 pier.
- **Amendment 2026-09-03 · §4 (user feedback):** the Career Coaster stops at every milestone and waits for the rider: a "Next ▶" button on the card (also Enter / Space / E) emits `ride:next`; no timed hold remains, reduced motion included; Esc still skips to the end with the rewards intact.
- **Amendment 2026-09-03 · §3/§8 (user feedback):** the Contact card (guestbook) carries a short hiring line — backend, data or Java engineer, also open to full-stack and spec-driven work — and an "Open to" fact row, in `content.ts`.
- **Amendment 2026-09-03 · §10 (user feedback):** an always-visible mute toggle sits in the HUD's top-right cluster (🔊/🔇, `aria-pressed`), persisted as `Settings.muted`; it gates the audio engine's master bus so sfx, music and ambience all fall silent while the volume sliders keep their values; the Settings panel has the same "Sound" toggle.
- **Amendment 2026-09-03 · §3 Crew Drop (user feedback):** tiles no longer regrow — a hole is permanent (the v3 §6.5 regrow rule is withdrawn); the deck is 12×8, a tile holds 1400 ms once cracked, bots think every 450 ms and the arena bites every 3000 ms (measured over seeds 1..20 with a scripted player: min 16.4 s / median 23.4 s / max 28.9 s, 13 of 20 won); the player is always the coral bean, marked all round with a bobbing "YOU" tag and a white foot-ring, and the four bots carry the fair names Sol, Ravi, Pip and Mira.
