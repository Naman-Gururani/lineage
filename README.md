# Naman's World Fair 🎪

**An open-world pixel-art game that happens to be a portfolio.**
[**naman-gururani.github.io/lineage**](https://naman-gururani.github.io/lineage/)

---

Naman Gururani's portfolio is a small open-world game. You arrive at the gate of a fairground, and everything a résumé would tell you is something you *win*: Bo hands you a word puzzle for a ticket, the career timeline is a rollercoaster you actually ride, the projects come out of a claw machine, and the tech stack has to be spelled out at the Word Forge.

## The fair

| Where | What it holds |
|---|---|
| 🎟️ **Ticket Booth** (The Gate) | About — Bo introduces Naman, then sells you a ticket for one five-letter word |
| 🎢 **Career Coaster** (Coaster Hill) | Education + Experience — ride the timeline, one milestone card per stop |
| 🧸 **Prize Tent** (Prize Row) | The projects — one card per prize you pull out of the claw |
| 🔧 **Word Forge** (Game Row) | Skills — spell out the toolkit and the whole stack pops up at the end |
| ✏️ **Chalk Flight** (Prize Row) | A chalkboard flapper. No résumé, just a graduation cap |
| 🕹️ **Arcade** (Game Row) | Crew Drop — out-last four bots on a floor that keeps vanishing |
| 🦆 **Duck Pond** (west corner) | Hook-a-Duck. Hook three for Old Tomas and the cat comes home with you |
| 📖 **Guestbook** (by the exit) | Contact — always open, no ticket required |
| 🎡 **The Ferris wheel** (Wheel Lawn) | Turns, lights up at night, and is nobody's résumé |

## An actual game

- **A living fairground** — day/night with lamplight, lit bulbs along the coaster and the wheel, and a string-light switch you can throw at dusk; weather, wind, drifting cloud shadows, butterflies, fireflies, a duck pond, and bunting the whole length of the midway.
- **The ride is a real ride** — the player climbs into a cart and the camera goes with it: lift hill, first drop, camelback, a loop, and five stops where the cart slows and a milestone card slides in. Every word on those cards is drawn from the same content file the rest of the site reads.
- **A cast of ten** — the gate-keeper, the coaster operator, the stallholders, the balloon kid, the keeper of the lights, and a cat called Byte who'll follow you home if you earn her. Fixed, short lines; the facts live on the cards.
- **Five games everyone already knows** — a real-format Wordle, a claw machine, a chalk flapper, a letter-wheel word game and a disappearing-floor party game. Lose one and you'll meet the fair's hiring policy: **🤝 Hire me — extra life**. Every one of them also has a **"show me the answers"** button, because a résumé you have to be good at Wordle to read is not a résumé.
- **Progression** — XP and levels, 20 lost tickets, prize boxes, stray balloons, tall grass to cut, a journal of quests, achievements and stats, a wardrobe of unlockable hats, and a 100 % celebration over the midway.
- **Real game furniture** — title screen, arrival, location banners, a full map with fast travel to anywhere you've found, a minimap, pause menu, autosave (Continue where you left off).
- **Generated everything** — every sprite, tile, booth, ride and villager is drawn in code (an ASCII/procedural pixel pipeline); all music, ambience and sound effects are synthesised with Web Audio. The repo ships **zero image or audio assets**.

## Controls

- **Move** WASD / arrows — running is automatic (hold **Shift** to stroll) · on touch: joystick, **A** interact, **B** hop
- **Space** jump · **E** (or Enter) talk · read · play · ride — or swing the wrench (cut grass, bonk signs)
- **M** map & fast travel · **J** journal · **Esc** pause

## Built for everyone

**Reader Mode** (title screen or pause menu) presents every section as a plain, accessible page — no walking, no ticket, no games. Panels are focus-managed DOM dialogs, the ride announces each card through a live region, reduced motion is respected (and toggleable), and the whole HUD is keyboard-first.

## Stack

Vite · TypeScript (strict) · **Phaser 3** · Web Audio. Pure logic (the fair layout, collision, the coaster's path and speed profile, quests, dialogue, saves, all five game reducers) is unit-tested with **vitest**; the world is deterministic from a single seed.

## Develop

```bash
npm install
npm run dev        # dev server
npm test           # unit tests
npm run typecheck  # type-check only
npm run build      # production build → /dist
npm run preview    # preview the production build (use this for browser checks)
npm run preview:art -- sheet fair 3   # render any sprite pack to scratch/*.png
```

Debug flags: `?fresh=1` starts with a cleared save · `?cheat=1` puts a Skip button in every game · `?word=kafka` forces the Wordle answer · `?duck=gold` forces the rare catch · `?st=1` forces timer-based stepping (useful for automated tests).

## Deploy

Served by GitHub Pages from the `gh-pages` branch (the built `/dist`). To redeploy: `npm run build`, then publish `/dist` to `gh-pages`.

## License

[MIT](./LICENSE) © Naman Gururani
