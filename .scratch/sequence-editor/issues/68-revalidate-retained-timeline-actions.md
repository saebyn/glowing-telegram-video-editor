# 68 — Revalidate retained Timeline actions on release

Status: ready-for-agent
Resolution: pool drop, placement move, and placement trim releases use the latest host inputs without changing slot interfaces.
Review priority: P1
Related: [43 — Timeline slot interface](43-finish-the-timeline-slot-interface.md),
[62 — Dissolve resize](62-rename-dissolve-and-add-timeline-handle.md)

## Problem

A replacement Timeline can capture `placeClip` when a drag begins. If the host
locks the destination track before release, the retained callback still checks
the old, unlocked sequence. Accepting the proposal inserts the placement and
silently removes the lock. Retained move and trim callbacks can likewise
propose edits against stale inputs.

The [editing session callbacks](../../../src/components/organisms/useSequenceEditor.ts)
already revalidate retained transition resize callbacks against current props.

## Acceptance criteria

- A retained pool drop, placement move, or placement trim callback must not
  emit an edit based on superseded sequence or clip inputs.
- Cover a host lock added during a gesture and a host edit unrelated to the
  gesture. A blocked release emits neither host callback; any allowed release
  preserves the unrelated edit and emits one proposal and one `CutList` result.
- Verify with a replacement Timeline that deliberately retains the original
  release callbacks. Keep the existing slot interfaces unless a change is
  separately approved.

## Comments

- Triage: fix first because a stale release can overwrite newer host state.
  The documented contract already requires applying intents against current
  state; this does not need a new slot interface.
- Red → green with a replacement Timeline that deliberately retains release
  callbacks. A host lock initially failed to block a pool drop, a move dropped
  a host-added track, and a trim used offsets from the old clip bounds. The
  blocked drop now emits neither callback; the accepted move and trim each
  preserve the intervening host change and emit one proposal and one matching
  successful `CutList` result.
- Verified 69 Playwright checks in Chromium 158 across composition, placement
  gestures, locks, keyboard, and transitions; 232 Vitest checks passed.
  Typecheck, formatting, library build, and `git diff --check` passed. Lint
  reported only the existing `VideoPlayer` captions warning.
- Three isolated mutations independently restored the stale callback for drop,
  move, and trim. The matching browser regression caught each one.
