# 65 — Rename placement fields to `transitionIn` and `transitionOut`

Resolution: renamed placement fields to `transitionIn` and `transitionOut` without changing `CutList` output

## Proposal

Rename `ClipPlacement.entryTransition` to `transitionIn` (leading edge) and
`ClipPlacement.revealTransition` to `transitionOut` (trailing edge). The names
describe which edge owns the transition, whether it is a fade or a dissolve.

## Acceptance criteria

- Update the public `ClipPlacement` type, sequence edit payloads, and
  in-repo callers, fixtures, stories, tests, and documentation. Do not keep
  aliases for the old fields.
- Preserve transition IDs, kinds, durations, and edge ownership. Verify
  that a split keeps `transitionIn` on the first placement and
  `transitionOut` on the second.
- Leave `CutList` output unchanged. Its existing `transitionIn` and
  `transitionOut` fields describe compiled output, not placement data.

## Comments

- The maintainer approved this public field rename for `ClipPlacement`,
  including the editor's `sequence` prop, `onSequenceChange` payload,
  `compileCutList` sequence input, and standalone timeline's `tracks` prop.
- Red → green: the public types initially rejected the new fields, the
  compiler omitted both fades, and Split emitted both transitions on both
  pieces. The split callback now retains each full transition only on the
  piece that owns its original edge. Exact `CutList` assertions verify both
  output edges still carry `{ type, duration }`, not the authored objects.
- Passed typecheck, packed package type checks, 201 Vitest checks, all 158
  Chromium checks, formatting, library and Storybook builds, and diff
  checks. Lint reported only the existing `VideoPlayer` captions warning.
- All five targeted mutations were caught: wrong edge mapping, duplicate
  split ownership, a legacy type alias, authored fields leaking into the
  `CutList`, and a missed leading dissolve. Logs: `/tmp/opencode/gtve-65-mutations.NW1zoz`.
