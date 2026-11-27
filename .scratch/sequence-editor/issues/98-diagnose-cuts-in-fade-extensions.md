# 98 — Diagnose visible cuts inside fade extensions

Status: needs-triage
Review priority: P2
Related: [31 — Protect fades during moves and trims](31-protect-fades-during-moves-and-trims.md),
[72 — Preserve Preview fades across source-continuous splits](72-preserve-preview-fades-across-splits.md)

## Problem

In [presentation continuity](../../../src/utils/sequencePresentation.ts#L240),
footage above a fade's counterpart counts as harmless coverage even when it
is below the fade owner. For example, trim a top placement to `[10, 12)`
while retaining an entry fade through sequence frame 16. Put a bed at
`[0, 20)` on the bottom track and start a middle-track placement at frame 12.
Preview blends the top placement's source extension with the bed, hiding the
middle placement. The compiler reports `fade-interrupted`.

## Acceptance criteria

- Preview diagnoses the interrupted fade instead of hiding the visible cut.
  Use consistent coverage rules for activity and continuity.
- Preserve the authored fade, its phase under genuine coverage, and
  existing support for source-continuous splits.
- Add a deterministic presentation regression with a trimmed placement,
  an overhanging fade, and an intervening track.
