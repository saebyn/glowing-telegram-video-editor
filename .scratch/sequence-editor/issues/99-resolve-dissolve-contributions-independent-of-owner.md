# 99 — Resolve dissolve picture and sound independently of the owning edge

Status: needs-triage
Review priority: P2
Related: [32 — Show cut-spanning dissolves and source extensions](32-show-cut-spanning-dissolves-and-source-extensions.md)

## Problem

The [presentation resolver](../../../src/utils/sequencePresentation.ts#L141)
requires the dissolve owner to win each contribution at its anchor. Put a
video-only placement immediately before an audio-only placement on one
track, with no other placements. A dissolve on the outgoing edge fades
picture but hard-cuts sound. The same dissolve on the incoming edge fades
sound but hard-cuts picture.

## Acceptance criteria

- Either owning edge produces the same picture and sound over the same
  dissolve window. The absent side contributes black picture or silence;
  it does not prevent blending the present side.
- Preserve per-contribution coverage by higher tracks and the distinction
  between absent contributions and missing required media.
- Compare samples from both ownership arrangements at several sequence
  frames in a deterministic presentation test.
