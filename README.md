# LINEAGE

**A portfolio built as a living data pipeline.**
[**naman-gururani.github.io/lineage**](https://naman-gururani.github.io/lineage/)

---

> *Follow one record's journey through a system built to trace the journey of everything.*

This site casts the visitor as a single data record entering the machine. One
continuous, **unbranching** thread of light — the *lineage* — draws itself down
the page as you scroll, lighting a node at each stage. That thread is the literal
translation of an engineering invariant: **each hop guarantees exactly one
upstream and one downstream**. Behind it, a field of particles streams past — the
~750 million records a day the real system reconstructs.

It is the work of a backend & streaming-data engineer turned into an experience.

## The journey (six stages)

1. **Ingress** — the record enters; the thread ignites.
2. **Origin** — the source of the record: who I am.
3. **Transform** — tokenized, classified by jurisdiction, mapped. The stack.
4. **Lineage** — the full path reconstructed across decoupled systems. The work.
5. **Scale** — one record, multiplied: ~750M/day.
6. **Egress** — the record reaches its destination. Let's connect.

## Craft notes

- **Motion that serves the story** — a single SVG thread drawn on scroll
  (GSAP ScrollTrigger), buttery smooth scrolling (Lenis), an adaptive Canvas 2D
  particle stream, count-ups, and magnetic micro-interactions.
- **Accessible by default** — full keyboard navigation, a skip link, visible
  focus, semantic landmarks, AA contrast, and a complete `prefers-reduced-motion`
  path (no pinning, no particles, the thread shown statically, all content
  present).
- **Fast** — a tiny hand-authored CSS system, latin-subset self-hosted fonts,
  lazy/​paused canvas work, and a capped device-pixel-ratio.

## Stack

Vite · TypeScript · GSAP (ScrollTrigger) · Lenis · Canvas 2D · hand-authored CSS
with design tokens · self-hosted type (Space Grotesk · JetBrains Mono · Inter).

## Develop

```bash
npm install
npm run dev        # start the dev server
npm run build      # production build to /dist
npm run preview    # preview the production build
npm run typecheck  # type-check only
```

## Deploy

Pushing to `main` triggers a GitHub Actions workflow that builds the site and
publishes `/dist` to GitHub Pages. Zero-config.

## License

[MIT](./LICENSE) © Naman Gururani
