# 89 — Omit fully hidden fades from the CutList after a trim

Status: ready-for-agent
Resolution: Omit fully hidden fades from the CutList while retaining authored fades and visible interruption diagnostics.
Review priority: P2
Related: [28 — Keep empty tracks neutral for fades](28-keep-empty-tracks-neutral-for-fades.md),
[31 — Protect fades during moves and trims](31-protect-fades-during-moves-and-trims.md)

## Problem

Use three audiovisual tracks: a top placement at `[0, 10)`, the middle
placement at `[0, 20)` with a 15-frame entry fade, and a bottom bed at
`[0, 20)`. Trim the middle placement to `[0, 10)`, keeping its authored fade.
The top track now covers the anchor and the entire owner. Preview shows only
the top and bottom placements, but the compiler reports `fade-interrupted`
because the lower bed shows through under the overhanging window.

## Acceptance criteria

- The example compiles as a straight cut from the top track to the bed with
  no fade fields; the authored fade remains on its placement.
- Preserve existing diagnostics when an actually visible fade crosses a
  cut. Decide visibility before rejecting interruptions; don't use compiler
  success as a condition for editing or Preview.

## Comments

- Observed the false `fade-interrupted` issue before the fix. Regressions cover
  hidden entry and reveal fades after trims, and keep the diagnostic when an
  owner or source-continuous split remains visible.
- Verified 68 focused tests, 196 unit tests in isolation, typecheck,
  formatting, lint (existing captions warning only), and `git diff --check`.
- All 11 targeted mutations were caught, including treating lower footage as
  visible fade, dropping interruption diagnostics, and ignoring split continuity.
