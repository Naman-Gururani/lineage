# Naman's World v2.5 — "HD Isle" redesign — Design Spec

**Date:** 2026-09-01 · **Status:** ✅ IMPLEMENTED (user-approved in-session; built same day; see `docs/HANDOFF.md` for as-built state — two spec amendments during build: faces 32×32 not 24×24, fish species deterministic per catch count rather than a live 5% roll) · **Base:** `redesign/lineage-isle` (v2 "Lineage Isle", feature-complete, uncommitted)

## 1. Goal

Evolve the existing open-world portfolio game so that it (a) looks modern — HD pixel art, not chunky retro; (b) plays faster — smaller island, quicker movement, jumping; (c) explains itself — a welcome card up front, NPC hosts that explain every building, signs that actually navigate; (d) is more game — four mini-games with unlocks and a playful "Hire me" retry gag; (e) surfaces education properly and fixes CGPA to **9.63**.

**Approach chosen:** evolve the current codebase in place. The architecture was built for regeneration (sprites from `SpriteDef`s, island from one designed blueprint, DOM UI layer). Rejected: v3 rebuild (wasteful; systems are sound), and smoothing/filtering the existing 16px art (reads mushy, not modern).

**Non-goals:** deploying; committing (user does both); new résumé facts beyond those listed here; naming the in-development product; expanding the approved skills set; vector/non-pixel art; analytics.

## 2. Core reshape (config)

| Constant | Old | New |
|---|---|---|
| `TILE` | 16 | **32** |
| `WORLD_TW × WORLD_TH` | 160 × 120 | **96 × 72** |
| `CHUNK` (bake raster px) | 512 | **1024** |
| `WALK_SPEED` (px/s) | 80 (5 t/s) | **144 (4.5 t/s)** |
| `RUN_SPEED` (px/s) | 136 (8.5 t/s) | **224 (7 t/s)** |
| `pickZoom` | 2 / 3 / 4 | **1 / 1.5 / 2** (≈ viewport min-dim <1400 → 1, <2400 → 1.5, else 2) |

- Camera: `roundPixels` on; non-integer 1.5 zoom is acceptable at 32px art density (Stardew ships the same tradeoff). Smooth lerped follow + slight facing look-ahead. Reduced-motion: no look-ahead.
- Net feel: apparent pixel size halves; edge-to-edge walk drops ~32s → ~13–21s before fast travel.
- **Settings gains "Always run" (default ON).** When on, Shift becomes "walk carefully".
- `WORLD_SEED` unchanged; determinism rules unchanged.

## 3. HD art pipeline (32px/tile)

Every pack redrawn at 2× resolution via the existing def pipeline (ASCII rows + legend, or procedural `paint`), palette-key-only rule intact, all packs registered in `atlas.ts allDefs()` (existing gotcha stands). Atlas budget grows to **4096×4096**, still one atlas.

**Style rules (binding for all packs, for cross-subagent consistency):**
- Palette ramps extend to 6–7 shades per hue (`palette.ts` regenerated; add campus-brick and warehouse-wood hues). Saturated midtones; unified cool shadow tint.
- Characters/props: 1px dark selective outline + top-left rim light; 2-step anti-aliasing on curves *within* a ramp; no pillow shading. Terrain: no outlines; soft dithered transitions; 3 variants per ground tile; autotile edges grass↔sand↔road.
- Drop shadows: unified 40%-alpha ellipse under characters/props.
- Character rig: 32×48 frames (body ≈20×30), 4-dir × 4-frame walk, idle, **2 airborne hop frames**, fishing pose. One shared rig template for all 11 NPCs + Naman; hats are overlay sprites aligned to the rig (existing system).
- Buildings/trees roughly double current pixel dims (trees ≈64×80). Water: 4-frame 32px anim + foam. Interiors: 32px tile sets + furniture.
- Verification: `npm run preview:art -- sheet <pack>` PNG review before trusting any pack (existing tool, unchanged).

## 4. Island relayout (96×72)

- All 8 regions survive, compressed: Harbor, Sunny Meadow (plaza), Tower Heights (cliff plateau), Stone Ridge, Whispering Woods, Engine Works, Willow Fields, The Point. **New 9th region: Campus Green** with the SRM campus building.
- Blueprint redesigned at new size: river + 2 bridges, A* roads, coves, ponds, tall grass, all landmark/NPC/chest/sign/packet/quest spots re-placed. Exact coordinates are a plan-time task; invariants (reachability, road connectivity, spot non-overlap) keep their tests.
- Interiors: 7 existing + **Campus study hall** + **Harbor warehouse** (small, for Cargo Cove) = 9 rooms.

## 5. Movement & jump

**Hop (Space; B on touch):** ~0.38s arc, body offsets up ~0.6 tile while a grounded shadow ellipse stays on the ground plane; squash-and-stretch landing (disabled under reduced motion).
- Travel: 1.5 tiles in the movement direction when moving; vertical hop in place when idle.
- **Low-solid pass:** new collision flag `LOW` on fences, small rocks, bushes, tall grass, crates, flower beds, and 1-wide stream tiles. Hop ignores `LOW` while airborne. Buildings, trees, cliffs, lamps, signs, NPCs, ocean/pond stay solid.
- Landing validation at takeoff: test landing point at 1.5, then 1.0, 0.5, 0 tiles along the path; land at the farthest valid point (not inside any solid/LOW/deep water).
- **Ledge hop-downs:** cliff-edge tiles carry `LEDGE_DOWN(dir)`; walking into the edge auto-hops down one level (one-way, Zelda-style). Placed at designed lips on the Tower Heights ring — deliberate shortcuts.
- Disabled during dialogue/cutscenes/modals/fishing. Indoors: cosmetic in-place hop only (furniture stays solid).
- Touch layout: B = jump (new), A = interact, existing stick + menu.

## 6. Welcome card (first screen)

Replaces the bare title menu; floats over the existing live drifting-island attract mode.
- **Identity:** HD pixel portrait (new dedicated sprite), name, "Software Development Engineer · Barclays · India" (PROFILE regains `location: 'India'`), one-line pitch, quick links: GitHub · LinkedIn · Email · **Reader Mode** (recruiter escape hatch, always visible).
- **How to play:** move (WASD/arrows or stick) · run · Space = jump · E = interact, plus the line "Everything on this island is my résumé."
- **Buttons:** ▶ Start (or **Continue** as primary when a save exists, with "New Game" secondary + wipe confirm) · Settings.
- Focus-trapped, keyboard navigable, aria-labelled; mobile stacks vertically and swaps the controls legend for touch.

## 7. Modern UI pass (DOM layer)

- Tokens: `Inter` (new `@fontsource/inter`) + system stack for body; Pixelify Sans demoted to headings/accents. Radius 14–16px, `backdrop-filter: blur(14px)` glass with solid rgba fallback, layered soft shadows, 160–220ms ease-out micro-transitions (none under reduced motion).
- HUD → minimal top-left chip cluster (XP pill, coins, packets, clock, region); minimap top-right (existing widget restyled).
- Dialogue → bottom-center card, max-width ~720px, portrait in a ring, typewriter kept.
- Toasts top-center slide+fade; all panels (map, journal, settings, pause, zone books, Reader Mode) restyled on the same tokens; loading screen rebranded to match.
- Reader Mode gains an **Education** section.

## 8. NPCs that explain places

- **Interior hosts:** every room has a host NPC (Cottage → Naman, Tower → Ada, Workshop, Engine, Vault, Safe Stride, Lighthouse keeper, Campus → Professor, Warehouse → Dockmaster). First visit auto-triggers a short skippable greeting: what the building is + what real thing it represents + a pointer ("try the elevator").
- **"Tell me more" branches:** deep-dive dialogue whose body text is **imported from `content.ts` at compile time** — facts stay single-sourced. Registry test asserts every referenced content key exists and every tree terminates.
- **Outdoor villagers:** each gains a "what's around here?" topic with real directions to the 1–2 nearest landmarks.
- Word budget: greetings ≤3 boxes; deep branches 2–4 boxes.

## 9. Signs that navigate

- `signs.ts` schema → finger posts: `{ tx, ty, arms: [{ dir: N|NE|E|SE|S|SW|W|NW, label, note? }] }`; junction set authored after blueprint relayout.
- Interact opens a small card listing arms: "← The Engine — a real-time payment lineage project".
- Test: every arm label resolves to a real landmark/region, and the target's actual bearing from the sign is within ±45° of the arm direction.

## 10. Campus & education content

- `content.ts`: fix About facts CGPA → **9.63**; add zone `id: 'education'`, `kind: 'campus'` (extend `LandmarkKind`): title "SRM Institute of Science and Technology", facts — B.Tech Computer Science & Engineering · 2020–2024 · CGPA 9.63/10. Flavor prose may add voice but **no new facts**.
- Campus building (collegiate brick + arch) on Campus Green; interior study hall: notice board (interact → education card), Professor NPC (degree dialogue + Study Hall quest), chalkboard (mini-game), desks/books props.
- Education appears in journal, full map, Reader Mode; explore-quest target becomes 8 landmarks.

## 11. Mini-games

**Shared framework** (`systems/Minigame.ts`): pauses the world, routes input, hosts a shared results/lose overlay, dispatches rewards via the event bus → GameState. Esc = pause/exit confirm. Reduced-motion honored. Win/lose jingle stingers (reuse audio engine; campus uses the interior music track — no new songs beyond 2 stingers).

**The gag (user-requested):** on lose (or on being stuck in the no-lose puzzles), the overlay offers **[Try again] · [🤝 Hire me — extra life] · [Exit]**. "Hire me" grants the same retry/hint plus a toast — "Excellent choice. HR will be in touch." — containing a real mailto link (no auto-open). Copy varies per game.

| Game | Venue | Type | Core rules | Lose condition | Unlock |
|---|---|---|---|---|---|
| **Tower Climb** | Tower stairwell (Phaser scene) | Side-view platformer, work-themed | 3 stages ≈20s each; left/right + jump with 80ms coyote + 100ms buffer; moving platforms + steam vents; checkpoints = career milestones (Intern 2023 → SDE 2024 → Lineage Engine) | 3 falls per run | Hard hat + **Tower Express** fast-travel node |
| **Packet Rush** | The Engine (seeded pure reducer + thin renderer) | Arcade sorter, work-themed | Packets fall tagged 1-of-3 jurisdictions (color+glyph); route ←/↓/→ (swipe on touch); speed ramps every 10; score 30 = win, then endless high score | 3 mis-routes/overflows | Goggles + **5 vault-packet credits** |
| **Cargo Cove** | Harbor warehouse (DOM grid) | Sokoban, pure puzzle | 6 handcrafted levels ≤8×8; undo (Z), reset (R), move counter | Can't lose; after 3 resets of a level, gag offers a hint | Captain's cap + 40 coins |
| **Study Hall** | Campus chalkboard (DOM grid) | Lights-out, pure puzzle | 5 boards 3×3→5×5, generated solvable (seeded random presses from solved); par shown | Can't lose; 12 moves over par → gag offers a hint | **Graduation cap 🎓** |

- Vault packets: the 20 world packets remain; requirement stays 20; Packet Rush's 5 credits create an alternate path (25 obtainable).
- Achievements: +4 (one per game) + **Arcade Legend** (all four) → 20 total; 100% definition updates.
- **Wardrobe:** pause menu gains a hat picker for unlocked hats (seashell, hardhat, crown, cat ears + goggles, captain's cap, grad cap).
- **Fishing pass (backlog folded in):** bite window 1.6s at 0 catches → 0.9s by 10; reel tolerance +15%; fish types Sardine (common), Parrotfish (new, medium), **Golden Koi** (5% rare, achievement "One in a Million"); per-type journal stats; debug `?fish=gold` forces the rare for testing.

## 12. Quests

New: Ada → Tower Climb; Engineer → Packet Rush; Dockmaster → Cargo Cove; Professor → Study Hall. Explore quest → 8 landmarks. Existing quests re-anchored to new blueprint spots.

## 13. Save & migration

Schema **v2** (`nw2.save.v2`): adds unlocked/equipped hats, per-game progress + high scores, fishing per-type counts, welcome-seen, campus flags. v1 saves are discarded with a friendly toast ("The island got a big upgrade — fresh start!"). Settings key unchanged.

## 14. Testing & verification

- Unit (vitest, target ≈260+): updated constants/blueprint invariants/sprite-pack dims; new — sokoban levels **solved by BFS solver in tests**, lights-out generator always-solvable, Packet Rush reducer (seeded), climb physics (arc/coyote/buffer), sign bearing test, dialogue registry content-key test, save v2 migration.
- Gates: `npm test` · `npx tsc --noEmit` · `npm run build` all green.
- Playwright flow (dev server `?st=1&fresh=1`, existing gotchas apply): welcome card → start → cutscene → hop over fence → ledge hop-down → sign card → campus → Professor → Study Hall win → grad cap equip → Tower Climb win → Packet Rush **lose once (verify Hire-me gag) then win** → Cargo level 1 → fishing catch → Reader Mode education → mobile 390×844 with jump button.
- Perf sanity on real hardware by the user (Playwright can't measure honestly).

## 15. Phasing (for the implementation plan)

1. Core reshape: config/tile/zoom/speeds/save-v2 skeleton; keep game booting at 32px with placeholder-scaled art.
2. HD art packs (parallel subagents per pack, style rules above, PNG previews).
3. Island relayout + collision flags + jump/ledges + signs.
4. Welcome card + modern UI pass.
5. Dialogue depth + campus + content fixes.
6. Mini-games + wardrobe + fishing pass.
7. Full verification sweep + HANDOFF update.
