---
description: Full end-of-session handoff — run the /checkpoint procedure, verify all gates incl. build, and make docs/HANDOFF.md self-sufficient for a fresh session
---

Perform a **full handoff** — everything a brand-new context window needs must end up in `docs/HANDOFF.md`. This is `/checkpoint` plus finalisation:

1. **Run the entire /checkpoint procedure** (read `.claude/commands/checkpoint.md` and do all of it), with one upgrade: also run the full gate `npm run build` and record bundle sizes.
2. **Make the doc self-sufficient**: re-read the final `docs/HANDOFF.md` top to bottom pretending you have no memory of this session. Anything you'd be unable to reconstruct — in-flight work, tricky context, "why" behind decisions, exact resume commands, environment quirks (ports, debug flags, tooling pitfalls) — must be written in. Fix every gap.
3. **Rewrite these sections completely** (they must reflect *now*, not history): **How to run / resume**, **Backlog** (ordered, with enough detail that each item is actionable cold), and the header **Status** line.
4. **Uncommitted-work safety**: list in the new checkpoint-log entry exactly what is uncommitted (`git status --short` summary) and state plainly that nothing was committed. If there is any risk of loss (e.g. work outside git), say where backups are.
5. **Update persistent memory** (the memory directory from your system prompt): refresh the project memory file so a session in a *different* working directory context still knows the project state; keep it short — HANDOFF.md holds the detail.
6. **Report** to the user: a compact handoff summary — state, gates, uncommitted-changes count, the one file to read next time (`docs/HANDOFF.md`), and how to resume (`/getcontext`).

Never commit or push. Never delete user files during cleanup — only tidy generated artifacts already covered by `.gitignore`.
