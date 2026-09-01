---
description: Save session progress into docs/HANDOFF.md (state refresh + dated log entry) without committing
---

Perform a **checkpoint**: bring `docs/HANDOFF.md` up to date with everything done since its last checkpoint entry, so any future session can continue seamlessly.

Steps:

1. **Gather reality** (run, don't assume):
   - `git status --short` and `git diff --stat HEAD | tail -2`
   - `npx vitest run 2>&1 | grep -E "Test Files|Tests "` and `npx tsc --noEmit` (summarise; if red, say so honestly — a checkpoint records reality, it never hides failures)
2. **Read `docs/HANDOFF.md`** and compare it against reality and against what happened in this session (features added/changed, bugs fixed, decisions made, files touched, anything in flight).
3. **Update `docs/HANDOFF.md`**:
   - Refresh the header status line, **TL;DR**, **What exists**, **Architecture map**, **Conventions & gotchas**, **Verification gates**, **Change inventory** (new snapshot + date), and **Backlog** sections wherever they drifted from reality.
   - **Append** (never rewrite) a new dated entry under **Checkpoint log**, numbered sequentially: what was done since the last entry, key decisions + why, bugs fixed, current gate status, and anything half-finished with exact next steps.
4. **Sync any other drifted docs**: `README.md` (features/controls/scripts), the spec/plan under `docs/superpowers/` (add a short status note at the top if reality diverged — don't rewrite history), `CLAUDE.md` if it exists.
5. **Do NOT commit or push** — this project's rule is that the user commits. Do not create files outside `docs/`, the drifted docs above, and this command's own updates.
6. **Report** in ≤6 lines: what changed since the last checkpoint, gate status, and where the log entry landed.

If the session also produced durable cross-session facts (new conventions, environment quirks, user preferences), update the persistent memory directory per your memory instructions.
