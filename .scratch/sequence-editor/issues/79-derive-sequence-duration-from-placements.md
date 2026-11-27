# 79 — Derive sequence duration from placements

Status: ready-for-agent
Resolution: derive the exclusive sequence end from validated placements and remove the stored duration and shortening controls.
Depends on: [78 — Report invalid sequence inputs](78-report-invalid-sequence-inputs.md)
Related: [24 — Shorten the sequence explicitly](24-shorten-the-sequence-explicitly.md)

## Problem

Placement edits grow the stored sequence duration, but moving, trimming, or
deleting the last placement can leave an uncovered tail that prevents export.
This editor doesn't need to author that tail separately.

## Acceptance criteria

- For valid inputs, derive duration from the latest exclusive placement end
  across all tracks, including locked tracks. Use effective source ranges,
  trims, and the existing project-frame conversion. No placements means zero
  duration, even if there are tracks. Transition windows don't extend it.
- Remove `Sequence.durationFrames`, the shortening action, and the exported
  shortening form and props without a compatibility layer. Update repository
  callers, examples, fixtures, and public API docs. Do not add an end marker.
  The timeline, preview, transport, and compiler continue to receive or resolve
  the same derived duration.
- Moves, trims, clip-pool drops, paste, duplicate, nudges, and deletion no
  longer maintain a separate duration. An accepted placement edit can extend
  or shorten the sequence, with the ordinary edit and Undo/Redo flow. Preview
  drafts, invalid edits, and rejected proposals don't change the host sequence.
  Keep frame zero fixed and do not relax track locks, same-track collision
  rules, or source bounds.
- For a continuous edit, end the compiled output at the derived exclusive end.
  Leading or internal gaps and empty sequences still block `CutList` export.
  Verify the exact output ranges before and after removing or trimming the last
  placement. Cover growth, shrinkage, zero duration, and Undo/Redo in the
  existing editing stories and tests.

See [ADR 0001](../../../docs/adr/0001-derive-sequence-duration-from-placements.md).
Playhead recovery is covered by [80](80-park-the-playhead-past-the-sequence-end.md);
viewport stability is covered by [81](81-pan-the-sequence-timeline-directly.md).

## Comments

- Red → green: a continuous sequence with no stored endpoint initially failed
  compilation, and deleting the last placement initially left the Timeline
  duration unchanged. Tests now verify exact source sections before and after
  trailing trim or removal; real editing workflows verify growth, shrinkage,
  zero duration, Undo/Redo, and the host payload.
- 256 Vitest tests and 202 Chromium Playwright tests passed. Typecheck, build,
  packed CSS, formatting, and `git diff --check` passed. Lint reported only
  the existing `VideoPlayer` captions warning.
- Eight isolated mutations were caught: ignoring locked tracks, using
  untrimmed ranges or native frame counts, extending through transitions,
  publishing a partial duration for invalid input, treating the `CutList` end
  as inclusive, serializing duration in host proposals, and sampling the
  exclusive Preview endpoint instead of holding the final picture.
