# Naman's World — Lineage Isle 🏝️

**An open-world pixel-art game that happens to be a portfolio.**
[**naman-gururani.github.io/lineage**](https://naman-gururani.github.io/lineage/)

---

Naman Gururani's portfolio is a small open-world game. You arrive on Lineage Isle by boat, and everything a résumé would tell you is something you *find*: talk to Naman at his desk in the Cottage, ride the Barclays Tower elevator through his career, read the Workshop's tool wall, watch the Engine stitch payment lineage live, and light the Lighthouse to reach him.

## The island

| Place | What it holds |
|---|---|
| 🏡 **The Cottage** (Sunny Meadow) | About — Naman himself is inside, talk to him |
| 🏢 **Barclays Tower** (Tower Heights) | Experience — the elevator floors are the timeline |
| 🛠️ **The Workshop** (Whispering Woods) | Skills — hung as tools on pegboards |
| ⚙️ **The Engine** (Engine Works) | The real-time payment-lineage project, with a live console |
| 🔐 **The Vault** (Stone Ridge) | An unnamed product in development — sealed until you recover all 20 lost packets |
| 💚 **Safe Stride** (Willow Fields) | An elderly-safety project, told by the people it helps |
| 🎓 **SRM Campus** (Campus Green) | Education — B.Tech CSE, and the professor keeps the notice board honest |
| 🗼 **The Lighthouse** (The Point) | Contact — climb up and light the lens |
| 📦 **Cargo Warehouse** (Harbor) | Not on the résumé — just puzzles inside |

## An actual game

- **A living island** — day/night with lamplight and lit windows, weather (wind, rain), animated sea and shore foam, drifting cloud shadows, butterflies, gulls, crabs, fireflies, jumping fish, and the Stream: a river of glowing packets flowing from the Tower to the Engine.
- **Villagers** — thirteen islanders with portraits, typewriter dialogue, and quests; every building has a host who'll explain what it really is, and finger-post signs point the way. A cat called Byte will follow you home if you earn her.
- **Four arcade cabinets** — a lights-out chalkboard, a sokoban warehouse, a Kafka-flavoured packet-sorting arcade, and a platformer up the Tower's scaffolding. Lose one and you'll meet the island's hiring policy: **🤝 Hire me — extra life**.
- **Jumping** — Space hops fences, crates and the brook; cliff lips are one-way shortcuts down.
- **Progression** — XP and levels, 20 lost packets, chests, tall grass to cut (with a wrench), a journal of quests, achievements and fishing stats, a wardrobe of seven unlockable hats, a 100 % celebration.
- **Real game furniture** — title screen, arrival cutscene, interiors for every landmark, location banners, a full map with fast travel, a minimap, pause menu, autosave (Continue where you left off).
- **Generated everything** — every sprite, tile, building and villager is drawn in code (an ASCII/procedural pixel pipeline); all music, ambience and sound effects are synthesised with Web Audio. The repo ships **zero image or audio assets**.

## Controls

- **Move** WASD / arrows — running is automatic (hold **Shift** to stroll) · on touch: joystick, **A** interact, **B** hop
- **Space** jump · **E** talk · read · open · fish — or swing the wrench (cut grass, bonk signs)
- **M** map & fast travel · **J** journal · **Esc** pause

## Built for everyone

**Reader Mode** (title screen or pause menu) presents every section as a plain, accessible page — no walking required. Panels are focus-managed DOM dialogs, reduced motion is respected (and toggleable), and the whole HUD is keyboard-first.

## Stack

Vite · TypeScript (strict) · **Phaser 3** · Web Audio. Pure logic (terrain, collision, day cycle, quests, dialogue, saves) is unit-tested with **vitest**; the world is deterministic from a single seed.

## Develop

```bash
npm install
npm run dev        # dev server
npm test           # unit tests
npm run typecheck  # type-check only
npm run build      # production build → /dist
npm run preview    # preview the production build
npm run preview:art -- sheet hero 3   # render any sprite pack to scratch/*.png
```

Debug flags: `?fresh=1` starts with a cleared save · `?st=1` forces timer-based stepping (useful for automated tests) · `?fish=gold` forces the rare catch.

## Deploy

Served by GitHub Pages from the `gh-pages` branch (the built `/dist`). To redeploy: `npm run build`, then publish `/dist` to `gh-pages`.

## License

[MIT](./LICENSE) © Naman Gururani
