# 65 — Rename placement fields to `transitionIn` and `transitionOut`

Status: ready-for-agent

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
