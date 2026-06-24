# NAMAN.SYS

**A playable portfolio.**
[**naman-gururani.github.io/lineage**](https://naman-gururani.github.io/lineage/)

---

Naman Gururani's portfolio is a small arcade. His real content is **locked** — you unlock each part by beating a distinct, hand-built mini-game.

- **ROUTE** — a pipe-routing logic puzzle → unlocks **Experience**
- **SORT** — a real-time stream classifier (route falling tokens into the right pipeline lane) → unlocks **Skills**
- **DECRYPT** — a live cipher dial you rotate to decode an intercepted string → unlocks **Projects**
- Clear all three → the **Contact / "ACCESS GRANTED"** finale

His real-time streaming-data work inspires the *mechanics* (routing packets, sorting streams, decrypting tokens) — not the theme. The payment-lineage engine is one project card, not the brand.

## Built for everyone

- **Reveal All (recruiter mode)** — one click skips every game and shows all content instantly. This is also the accessibility path.
- Games are keyboard-playable; modals trap focus and close on `Esc`; there's a skip link.
- Full `prefers-reduced-motion` support — no particles, and SORT becomes a calm, static classifier.
- Generated **Web-Audio** sound (mutable), pixel-particle juice, and progress that persists (localStorage).

## Stack

Vite · TypeScript · Canvas 2D · Web Audio · hand-authored CSS with design tokens.
Type: Press Start 2P · Space Grotesk · JetBrains Mono · Inter (self-hosted).

## Develop

```bash
npm install
npm run dev        # dev server
npm run build      # production build → /dist
npm run preview    # preview the production build
npm run typecheck  # type-check only
```

## Deploy

Pushing to `main` triggers a GitHub Actions workflow that builds and publishes to GitHub Pages. The currently-served source is the `gh-pages` branch (the built `/dist`).

## License

[MIT](./LICENSE) © Naman Gururani
