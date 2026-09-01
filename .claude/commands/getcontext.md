---
description: Load full project context in a fresh session from docs/HANDOFF.md and verify it against reality
---

You are (probably) in a fresh context window. Rebuild full working context for this project before doing anything else:

1. **Read `docs/HANDOFF.md` in full** — it is the living state document (TL;DR, architecture map, conventions & gotchas, verification gates, change inventory, backlog, checkpoint log). Treat its **Conventions & critical gotchas** section as binding working rules for this repo.
2. **Verify it against reality** (the doc may be stale):
   - `git status --short`, `git branch --show-current`, `git log --oneline -5`
   - `npx vitest run 2>&1 | grep -E "Test Files|Tests "` and `npx tsc --noEmit`
   - Note every discrepancy between the doc and reality explicitly.
3. **Skim supporting docs only as needed**: `README.md`; the spec/plan under `docs/superpowers/` for design intent; the latest entries of the Checkpoint log for recent history. Don't re-read the whole codebase — the architecture map tells you where things live; open files on demand.
4. **Report** to the user, concisely:
   - Where the project stands (1–2 lines) and gate status (tests/tsc; mention build only if the doc's info is stale),
   - Any doc-vs-reality drift found,
   - The in-flight work item (if the log marks one) and the top 3 backlog items,
   - Then ask what to work on — unless the newest checkpoint entry explicitly says to continue something, in which case state that you're continuing it and proceed.

Remember the repo's standing rules from the handoff doc — especially: never commit/push unless asked, résumé facts only from `src/data/content.ts`, keyboard input via `src/core/keys.ts`, new sprite packs must be registered in `src/art/atlas.ts`, and browser tests use `http://localhost:5173/lineage/?st=1&fresh=1`.
