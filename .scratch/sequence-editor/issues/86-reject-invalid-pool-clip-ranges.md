# 86 — Reject invalid source ranges before placing a pool clip

Status: ready-for-agent
Resolution: Share authored source-range validation between the default pool and the drop evaluator.
Review priority: P2
Related: [42 — Connect clip pool and Timeline edits](42-connect-clip-pool-and-timeline-edits.md),
[78 — Report invalid sequence inputs](78-report-invalid-sequence-inputs.md)

## Problem

An unplaced clip with source range `[100, 130)` and a known source end of 129
can appear in the default pool and preview as a valid drop. If the host
accepts it, the sequence fails input validation and editing, playback, and
Undo become unavailable. A replacement slot can also pass a fractional
source range to the drop evaluator, causing frame conversion to throw at
mixed rates.

## Acceptance criteria

- Check the same whole-frame source bounds and known source end as authored
  placement validation before calculating the duration of a pool candidate.
  The default pool doesn't offer an invalid candidate as a usable clip.
- Default and replacement slots cannot preview an invalid drop as valid or
  emit a proposal on release. Invalid unplaced clips don't invalidate the
  current sequence or block unrelated valid edits.
- Cover an out-of-bounds clip, a fractional mixed-rate range, and a valid
  clip whose exclusive out point equals its known source end.

## Comments

- Red: the evaluator offered an out-of-bounds clip as a valid drop and the
  Storybook pool displayed that clip. Both regressions passed after the fix.
- Verified with 187 unit tests, all 3 SequenceClipPool stories in Chromium,
  an isolated ticket-only typecheck, lint (only the existing VideoPlayer
  captions warning), changed-file formatting, and `git diff --check`.
- Four isolated mutants were caught: allowing an out-of-bounds out point,
  rejecting an out point equal to the known end, allowing a fractional out
  point to reach mixed-rate conversion, and bypassing the pool range filter.
