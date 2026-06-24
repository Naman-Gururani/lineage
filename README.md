# Naman's World 🌴

**An explorable game-portfolio.**
[**naman-gururani.github.io/lineage**](https://naman-gururani.github.io/lineage/)

---

Naman Gururani's portfolio is a tiny cozy game. You walk a little character around an island and wander into landmarks to discover each part of his story — explore in any order, or skip the walking entirely.

- 🏠 **The Cottage** → About
- 🏢 **Barclays Tower** → Experience
- 🛠️ **The Workshop** → Skills
- ⚙️ **The Engine** · 🔒 **The Vault** · 💚 **Safe Stride** → Projects
- 🗼 **The Lighthouse** → Contact

It runs on a real game engine, so it feels like a game — a follow-camera, smooth movement, collisions, particles, and sound — not a website pretending to be one.

## Play

- **Move:** WASD / arrow keys, or the on-screen joystick on touch.
- **Interact:** walk into a glowing landmark and press **E** / tap **✦**.
- **🗺️ Map · Skip:** jump anywhere, read everything, or skip the walking entirely.
- Collect the data orbs **◈** scattered around the island.

## Built for everyone

- The **Map · Skip** menu opens any section's content directly — no walking required. This is also the accessibility path: content lives in focus-managed DOM panels (Esc to close), readable by keyboard and screen readers.
- Touch joystick + interact button on phones; full keyboard on desktop.

## Stack

Vite · TypeScript · **Phaser 3** · Web Audio (generated sound). Every sprite, tile, building, and the island itself is **drawn in code** — there are no image assets. Type: Fredoka · Press Start 2P (self-hosted).

## Develop

```bash
npm install
npm run dev        # dev server
npm run build      # production build → /dist
npm run preview    # preview the production build
npm run typecheck  # type-check only
```

## Deploy

Served by GitHub Pages from the `gh-pages` branch (the built `/dist`). To redeploy: `npm run build`, then publish `/dist` to `gh-pages`.

## License

[MIT](./LICENSE) © Naman Gururani
