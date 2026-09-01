# Naman's World 2 — "Lineage Isle" — Design Spec

Date: 2026-08-30 · Status: approved-by-default (built autonomously; review welcome)

## 1. Goal

Rebuild the game-portfolio so it reads instantly as *an actual game in the browser*, not a
website with a mascot: a title screen, an arrival cutscene, a hand-designed pixel-art island
with day/night, weather and wildlife, villagers to talk to, quests, collectibles, mini-games,
interiors to enter, a journal, a map, achievements, a save file — with the portfolio content
(About, Experience, Skills, three Projects, Contact) delivered *through* those mechanics.

Non-goals: multiplayer, combat/enemies, 3D, external image assets (everything stays generated
in code so the repo remains asset-free and tiny), changing the résumé content.

Content rules carried forward (from `content.ts` + commit history): skills shown are only the
approved set (no React/Node/JS); the in-development product stays abstract and unnamed; facts
about Naman come only from the existing content — NPC dialogue never invents new facts.

## 2. What we learned from reference implementations

| Reference | Borrowed | Avoided |
|---|---|---|
| Bruno Simon (3D car) | consistent art style, physical playfulness (things react), easter eggs, districts | slow load w/o progress, hidden controls, heavy CPU |
| Chase Naidoo / JSLegendDev (Kaboom, top-down) | objectives checklist, typewriter dialogue, completion rewards | tiny single-room world |
| Endigo (Pixi) | biomes group content, NPC hints, visited markers, "traditional site" fallback | drag-only controls |
| Thibault Introvigne | hidden collectibles that reveal story | — |
| Jay Ransijn / Worapat | real gameplay loops (fetch, riding), cozy Zelda/AC world | — |
| Jordan Breton | ambient life (butterflies, grass, water) | — |
| "Juice it or lose it" | shake, squash/stretch, hit-stop, particles, sound on every action | — |

## 3. Pillars

1. **Looks like a game**: crisp 16 px pixel art at integer zoom, title screen, cutscene bars,
   RPG dialogue boxes with portraits, location banners, HUD with level/XP/clock, minimap.
2. **Feels alive**: day/night lighting, weather (rain, wind, cloud shadows), critters, NPC
   schedules, animated water/foam, lamps and windows that light at night, lighthouse beam.
3. **Rewards exploration**: 20 lost packets, chests, signs, quests, achievements, hats, XP,
   a sealed Vault, 100 % celebration — all optional; content is never gated for readers.
4. **Content through mechanics**: Naman himself is an NPC in the Cottage; the Tower has an
   elevator whose floors are the career timeline; the Workshop displays skills as tools on a
   wall; the Engine is a running machine with a live lineage visualisation; the Lighthouse
   beacon *is* the contact action.
5. **Everyone can read it**: Reader Mode (plain accessible page), keyboard-first, focus-managed
   panels, reduced-motion respected, mobile touch controls, fast load with progress.

## 4. Art direction

- **Style**: 16 px tiles, 16×24 hero, SNES/GBA-era "cozy island" (Stardew / Link's Awakening
  / Pokémon proportions). Warm greens, sandy beige, teal-blue sea, saturated accents.
- **Palette**: a fixed ~48-colour palette in `src/art/palette.ts` (named keys). Every sprite
  uses only palette keys, so the world is coherent by construction.
- **Sprites** are authored as ASCII pixel maps (`src/art/sprites/*.ts`) with per-sprite legends
  mapping characters → palette keys; a painter (`src/art/pixel.ts`) rasterises them, adds an
  automatic 1 px dark outline where requested, and packs them into Phaser textures at boot.
- **Terrain** is painted procedurally per tile from a seeded RNG (grass speckle variants,
  sand grain, water frames, cliff faces, path edges) using autotile bitmasks for transitions.
- **Rendering**: `pixelArt: true`, integer camera zoom chosen from viewport (2/3/4),
  `roundPixels`. Depth-sorted by feet y. Camera post-FX: soft vignette; night uses a
  RenderTexture darkness overlay with erased light circles (works on Canvas + WebGL).

## 5. The island (blueprint)

World: 160 × 120 tiles (2560 × 1920 px). Deterministic from a fixed seed so every visitor
sees the same island (and saves stay valid). Built from a *designed* blueprint (shape
primitives + splines + noise-jittered edges), not pure noise.

Regions (each shows a location banner on first entry):

| Region | Where | Landmark | Notable |
|---|---|---|---|
| Harbor | south centre | spawn dock + boat | Captain Mira (tutorial), fisherman Tomas, fishing spot, crabs, shells |
| Sunny Meadow / village plaza | centre | **The Cottage** (About) — Naman NPC inside | fountain, signpost, baker stall, lamps, benches, NPC wanderers |
| Tower Heights | north-west plateau | **Barclays Tower** (Experience) | elevator lobby, the Stream's source, viewpoint telescope (secret) |
| The Stream | NW → SW river | — | glowing motes flow along it; two bridges; packets are "lost" motes |
| Engine Works | south-west pier | **The Engine** (Lineage project) | pipes, tanks, chimneys, Operator Sol, spare gear |
| Whispering Woods | north-east forest | **The Workshop** (Skills) | windmill, fireflies at night, Tinker Ravi |
| Stone Ridge | north centre cliffs | **The Vault** (unnamed product) | sealed door with packet counter |
| Willow Fields | south-east meadow | **Safe Stride** (project) | Nana Devi + Arjun, garden, lily pond |
| The Point | far south-east rocks | **The Lighthouse** (Contact) | long wooden walkway, Keeper Ilse, beacon |

Paths: dirt roads (A* on the tile grid between landmarks with a curviness bias), fences,
signposts at junctions with real directions.

## 6. Player & controls

- Move: WASD / arrows / left stick / touch joystick. Hold Shift / B / joystick-outer-ring to run.
- Action: E / Space / A / ✦ — talk / open / read / enter; with nothing nearby: a swing
  (cuts tall grass → coins/packet chance, bonks signs, rings bells).
- Esc: pause menu. M: map (fast-travel to discovered landmarks). J: journal. Gamepad supported.
- Animation: 4 dirs × 4-frame walk, idle breathing, 2-frame swing; squash on landing after a
  ledge hop; dust when running; splash ring in shallows; footstep sound by surface.
- Collision: solid tile grid + small AABB solids; sliding along walls; ledges hop-down only.

## 7. Living world systems

- **Day/night**: 8-minute cycle (dawn 40 s → day 4 min → dusk 50 s → night 2 min). Starts at
  morning on first visit; persisted in save. HUD dial. Bed in the Cottage skips to night/morning.
  Lighting = ambient tint (colour-graded per phase) + darkness RT with lamp/window/beam lights,
  fireflies in the woods at night, stars over the sea, the lighthouse beam sweeping when lit.
- **Weather**: clear / breezy / rain (with puddle ripples, darker ambient, rain audio,
  rainbow after). Cloud shadows drift across the ground always. Wind gusts sway grass, flowers
  and tree canopies (staggered sine); leaves blow in the woods.
- **Water**: scrolling two-layer ocean texture with 4-frame animated shore foam; sparkles at
  noon; motes flowing along the Stream on a spline.
- **Critters**: butterflies (meadow, day), seagulls (harbor, fly-bys), crabs (beach, scuttle),
  fish jumps (pond/harbor), fireflies (woods, night). Only simulated near the camera.
- **NPCs**: idle/wander/patrol behaviours, face the player when talked to, day/night spots.

## 8. Content delivery (per landmark)

| Landmark | Exterior | Interior / mechanic | Content |
|---|---|---|---|
| Cottage | door + mailbox | cosy room; **Naman NPC** at desk delivers About as dialogue; bookshelf → education facts; bed → sleep | About |
| Barclays Tower | tall building, flag | lobby + receptionist; **elevator** panel: floors = timeline (Intern 2023 · SDE 2024–now · Rooftop: stack) — window view changes per floor | Experience |
| Workshop | slanted roof, gear sign | **tool wall**: each skill is a hanging tool grouped by category; inspecting a group opens its chips; Ravi talks about spec-driven work | Skills |
| Engine | pipes, chimneys, glowing core | machine hall; console → live **lineage visualisation** (packets hopping through systems, stitched into a path); packet counter | Project: Lineage Engine |
| Vault | sealed cliff door | opens at 20/20 packets (or read via Map/Reader anytime) → small vault room with a covered prototype | Project: unnamed |
| Safe Stride | clinic cottage | room with a wall map screen and SOS button prop; Nana Devi tells the story | Project: Safe Stride |
| Lighthouse | on the Point | lamp room; **light the beacon** → cutscene (beam sweeps, fireworks) → contact panel | Contact |

Reading content = a "Discovery" (7 total). Panels are DOM (accessible), restyled as RPG
scroll/book frames with the landmark's accent; typewritten title.

## 9. Progression

- **XP & levels** (Explorer Lv 1→10): steps, discoveries, packets, quests, achievements.
- **Packets** 20 hidden (grass, chests, cliff nooks, behind buildings). Counter in HUD.
- **Quests** (journal, J): Explore Lineage Isle (7 discoveries) · Lost Packets (20) · Shell
  Seeker (5 shells for Pip → seashell hat) · Gone Fishing (3 fish → cat companion "Byte") ·
  Spare Parts (gear → Ravi → hard hat) · Light the Beacon.
- **Achievements** (~14) with toasts: First Steps, Sprinter, Grass Whisperer (50 grass), Bonk
  (sign ×10), Collector, Night Owl, Rain Dancer, Well-Read (Reader Mode), Summit (viewpoint),
  Fisher, Cat Person, Full House (all NPCs), Keeper, 100 %.
- **Hats** cosmetic overlay on the hero (none / seashell / hard hat / cat ears / crown at 100 %).
- **100 %** → fireworks over the plaza, crown hat, credits scroll.

## 10. Presentation & flow

Loading (progress bar, generation staged with real step labels) → **Title** (live island
behind the logo, slow pan; New Game / Continue / Reader Mode / Settings; press any key) →
**Arrival cutscene** (letterbox; boat sails in; hero hops onto the dock; Captain Mira teaches
move/run/talk; skippable) → free play. Pause menu: Resume / Map / Journal / Settings /
Reader Mode / Controls / Credits. Location banners on region entry. Toasts for XP, quests,
achievements. Discovery fanfare with camera zoom-pulse.

## 11. Audio (all generated, Web Audio)

Music: title (dreamy), day (cozy, ~104 BPM), night (soft variant), interior (music-box),
beacon fanfare. 4-voice sequencer (lead, bass, pad, percussion) with filters and envelopes,
crossfades between tracks. Ambience: waves (louder near coast), gulls/birds by day, crickets
by night, wind in the woods, rain. SFX: footsteps by surface, swing, grass cut, coin, packet,
chest, door, dialogue blips, elevator, bell, fishing splash, level-up, discover, error bonk.
Master/music/sfx sliders persisted. Unlocks on the title screen's first input.

## 12. Save & settings

`localStorage['nw2.save.v1']`: position, map, time-of-day, weather, discoveries, packets,
quests, achievements, XP, hat, NPC flags, tutorial flags. `nw2.settings.v1`: volumes, text
speed, screen shake, reduced motion (defaults from `prefers-reduced-motion`), touch controls.
Title "Continue" only when a save exists. Version field + migration hook.

## 13. Accessibility & mobile

Reader Mode = full content as a plain page (also what screen readers and no-JS users get via
`<noscript>`), reachable from Title, pause, HUD. All panels: role=dialog, focus trap, Esc.
Reduced motion: no shake/flash/weather particles, banners fade only. Touch: joystick + A/B +
menu; integer zoom 2 on phones. Canvas is `aria-hidden`.

## 14. Performance budget

First playable < 1.5 s on a laptop: generation is chunked across frames with progress. Ground
baked into 512² chunk textures (culled by camera). Decor sprites grouped per chunk and toggled.
Critters/NPCs update only within 1.5 screens. Particle caps. Render loop paused when the tab
is hidden. Target 60 fps on integrated GPUs, ≥ 30 fps on mid phones.

## 15. Architecture

```
src/
  main.ts                    boot: fonts → Phaser (Boot → Title → World/Interior) + DOM UI
  core/    rng, events (typed bus), save, settings, time (pure day-cycle model), math
  art/     palette, pixel (painter + ASCII), sprites/* (ASCII sheets), tiles (terrain painters), atlas (→ Phaser textures)
  world/   blueprint (designed island), terrain (rasterise + autotile, pure), bake (chunks), scatter (pure decor list), collision (pure), regions, paths (A*)
  entities/ Player, Npc, Critters, Companion, Packet, Chest, Grass, Sign, Door, Lamp
  systems/ DayNight, Weather, Wind, CameraRig, Quests (pure), Achievements (pure), Xp, Dialogue (pure runner), Fishing, Cutscene
  audio/   engine (buses), sfx, music (sequencer + songs), ambience
  scenes/  BootScene, TitleScene, WorldScene, InteriorScene
  data/    content (kept), npcs (dialogue trees), quests, rooms (interior ASCII), signs, achievements, regions
  ui/      hud, dialogue, panels, map, journal, settings, toasts, reader, touch, pause, banner
  styles/  ui.css
tests/     vitest for the pure modules (terrain/autotile, collision, time, quests, save, dialogue, rng)
```

Boundaries: pure modules never import Phaser; scenes never contain content strings (data/);
DOM UI talks to scenes only via the typed event bus.

## 16. Testing & verification

- Unit (vitest): autotile bitmasks, terrain rasterisation invariants (landmarks on land, paths
  connected), collision sliding, day-cycle phases, quest/achievement state machines, save
  migrations, dialogue runner, seeded RNG determinism.
- Browser (Playwright): boot without console errors, title → new game → walk → talk → open
  panel → Esc; screenshots at 1280×800, 1920×1080, 390×844 for visual review; fps sample.
- `npm run typecheck` + `npm run build` clean.
