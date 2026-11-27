# 83 — Revalidate retained Split, Reorder, and Paste actions

Status: ready-for-agent
Resolution: Revalidate retained Split and Reorder on the current host inputs, and scope Paste confirmation to the active drop session.
Review priority: P1
Related: [68 — Revalidate retained Timeline actions on release](68-revalidate-retained-timeline-actions.md),
[71 — Hit-test Split mode at click time](71-split-current-placement-at-click.md)

## Problem

A replacement Timeline can retain `activatePlacement`, `reorderTrack`, or
Paste `confirm` from the start of an interaction. In
[`useSequenceEditor`](../../../src/components/organisms/useSequenceEditor.ts),
those callbacks can still use the earlier sequence. For example, a host lock
added between pointerdown and release can disappear from a Split or Paste
proposal; a stale Reorder can replace a track list that the host just extended.

See the [edit proposal sequence diagram](../../../docs/sequence-editor-data-flow.md#from-a-gesture-to-a-host-accepted-edit).

## Acceptance criteria

- Retained Split and Reorder actions revalidate IDs, editability, and the
  applicable lock or mode rules against the latest committed inputs. If the
  action remains valid, it preserves unrelated host changes and compiles the
  exact proposed sequence. Track locks still do not prevent track reordering.
- A retained Paste confirmation is inert once its drop session is cancelled
  or superseded. It cannot revive a clipboard cleared by a host replacement.
  If the same drop session is still active, validate against current inputs.
- Use a replacement Timeline that deliberately retains callbacks. Cover a
  blocked split on a newly locked track, a reorder that preserves an added
  track, and a stale Paste confirmation after cancellation or replacement.
  Blocked or cancelled actions emit neither edit callback.
- Keep slot interfaces and the host's edit acknowledgement contract unchanged.

## Comments

- Observed a failing Playwright regression before each action fix. Added nine
  replacement-Timeline cases covering latest inputs, newly locked tracks,
  preservation of host changes, and invalidated or superseded Paste sessions.
- Verified 48 focused Chromium browser tests, 23 focused unit tests,
  typecheck, formatting, and `git diff --check`. Lint reported only the
  existing VideoPlayer captions warning.
- All six isolated mutations were caught: stale Split, stale Reorder,
  unchecked Paste, wrong Paste session, stale active Paste, and clipboard
  retention after host replacement.
- Follow-up review added two red → green cases: synchronous host acceptance
  cannot make an already consumed session usable again, and an old pointer
  press cannot confirm a new Paste session. Verified 30 Playwright tests,
  the focused Storybook test, and both isolated mutants.
