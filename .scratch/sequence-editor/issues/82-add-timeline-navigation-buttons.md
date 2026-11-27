# 82 — Add toolbar controls for timeline navigation

Status: ready-for-agent
Resolution: add accessible toolbar navigation from the mounted Timeline and remove the old Fit sequence control.
Depends on: [81 — Pan the sequence timeline directly](81-pan-the-sequence-timeline-directly.md)
Related: [45 — Prove both editor composition paths](45-prove-both-sequence-editor-composition-paths.md)

## Acceptance criteria

- Add keyboard-operable icon buttons named **Pan left**, **Pan right**, and
  **Fit to view**, with tooltips and accessible names. Replace the old Fit
  sequence control; leave the rest of the toolbar layout alone.
- Each pan button moves the viewport by half its visible time span at the
  current zoom. Neither direction stops at a sequence boundary. Fit to view
  brings frame zero to the left and shows the whole current edit, including after
  panning far away. On an empty sequence it returns to zero at a usable scale.
  These actions never move the playhead, change selection, or emit an edit.
- Make the optional navigation actions available through the existing toolbar
  and timeline slots to both the default page and host-built layouts. Omit
  actions the current Timeline doesn't provide. A hidden or unmounted Timeline
  must not leave buttons that act on stale viewport state.
- Verify half-view steps at more than one zoom, Fit to view after panning and
  with a zero-duration edit, and keyboard operation. Update the composition
  examples to exercise supported and omitted navigation actions.

See [Sequence timeline navigation](../../../docs/sequence-editor-design.md#sequence-timeline-navigation).

## Comments

- Red → green: the keyboard test initially found no Pan left control. It now
  checks half-view steps at two zoom levels, preserves selection and playhead,
  and fits after panning far away. The zero-duration test returns to frame zero
  at a four-second default scale. Both composition examples show supported and
  omitted actions; hiding the Timeline removes them.
- 257 Vitest tests and all 213 Playwright tests passed. The full run caught
  a replacement-pool drop test that still assumed a one-frame empty view;
  it now verifies the exact drop frame at the four-second scale. Typecheck,
  build, formatting, packed CSS, and `git diff --check` passed. Lint reported
  only the existing captions warning.
- Three isolated mutations were caught: panning by a whole view, fitting
  without resetting the origin, and retaining the toolbar controls after
  unmount.
