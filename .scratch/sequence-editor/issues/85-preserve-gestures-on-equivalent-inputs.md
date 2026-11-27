# 85 — Preserve gestures when host clip inputs are equivalent

Status: ready-for-agent
Resolution: Keep Move and Trim drafts on equivalent clip inputs and cancel when clip geometry changes.
Review priority: P2
Related: [43 — Finish the Timeline slot interface](43-finish-the-timeline-slot-interface.md),
[82 — Add toolbar controls for timeline navigation](82-add-timeline-navigation-buttons.md)

## Problem

In a host-built layout, pass `clips: allClips.filter(...)` to
`useSequenceEditor`. Starting a Move or Trim draft updates toolbar navigation,
which rerenders the host component. Its equivalent but newly allocated clips
array then triggers the cancellation effect in
[`SequenceTimeline`](../../../src/components/organisms/SequenceTimeline.tsx).
A valid move preview disappears before release.

## Acceptance criteria

- In the host-built Storybook example, derive an equivalent clips array on
  each render. Move and Trim previews survive the rerender and valid releases
  still emit exactly one proposal and one matching compiler result.
- A change that invalidates the gesture's frame mapping, source geometry, or
  destination still cancels or blocks release. Test at least one actual
  geometry change rather than weakening the guard unconditionally.
- Do not require callers to memoize an equivalent array for correctness.

## Comments

- Red: a host rerender with fresh filtered clip inputs discarded a valid
  move preview. Move and Trim now survive and emit one proposal and one
  exact CutList each. Shifting the clip’s source range without changing its
  duration still cancels and emits neither callback.
- Four focused Chromium cases, typecheck, formatting, and `git diff --check`
  passed. Lint reported only the existing VideoPlayer captions warning.
  Both isolated mutations were caught: cancelling on array identity alone
  and ignoring changed source range boundaries.
