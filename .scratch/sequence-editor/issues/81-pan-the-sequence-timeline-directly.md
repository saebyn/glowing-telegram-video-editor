# 81 — Pan the sequence timeline directly in both directions

Status: ready-for-agent
Resolution: implemented with empty-track drag, horizontal wheel, and Shift+wheel.
Depends on: [80 — Park the playhead when the sequence shrinks](80-park-the-playhead-past-the-sequence-end.md)
Related: [19 — Pan and zoom the sequence timeline](19-pan-and-zoom-the-sequence-timeline.md)

## Acceptance criteria

- Replace the pan slider with horizontal dragging on empty track space,
  horizontal trackpad scrolling, and Shift+wheel. Only start a pan after a
  drag threshold. A click on empty track space can still clear selection; a
  ruler click still seeks. Placement drags and grips still edit.
- Allow panning left of frame zero and right of the edit at any zoom, even
  when duration is zero. Keep a logical time origin separate from the widget's
  bounded scroll window. Moving that window doesn't jump or drift in frame
  coordinates. Ordinary placement edits don't reset viewport position or scale
  when duration changes.
- Frame zero does not move. A ruler seek left of zero lands at zero; a seek
  past the end lands at the end. Edits that would put a placement before zero
  are blocked. Edits to the right can extend the sequence. Keep edge auto-pan
  and gesture previews accurate across widget window shifts.
- Panning doesn't seek, clear selection, edit, or add history. In Split and
  Paste drop mode a pan doesn't cut or paste, and a click keeps its existing
  behavior. An active paste preview retargets as the content scrolls under
  the pointer.
- Verify both pan directions beyond the edit, including on an empty sequence,
  through real browser gestures. Check frame accuracy for ruler seek, Split,
  moves, trims, and drop targets in a panned view, including a window shift
  during a gesture.

See [Sequence timeline navigation](../../../docs/sequence-editor-design.md#sequence-timeline-navigation).
Toolbar actions are covered by [82](82-add-timeline-navigation-buttons.md).

## Comments

- The adapter keeps the signed sequence frame at the left edge separate from
  Keplar's physical scroll offset. It projects placements and ruler ticks into
  a fixed-size widget window, and recenters the window on the same ruler grid.
  Gesture hit tests, the playhead, and drag previews use sequence frames, not
  the widget's scroll notifications. The initial fit scale stays in place
  across edits; **Fit sequence** explicitly refits the current duration.
- Browser red/green evidence: the empty-space drag initially left frame zero
  at the viewport edge (`/tmp/opencode/sequence-81-red-pan.log`). Against
  `9d2d3a5`, the zero-duration ruler could not pan, and duration-changing
  moves and trims did not preserve viewport geometry
  (`/tmp/opencode/sequence-81-red-gain.log`). The implemented browser suite
  also exercises ruler and grip seeking, Split and armed paste, both sides
  of the edit, and native pool drops. The move regression crosses a widget
  window boundary with the pointer held down and checks the committed host
  callbacks as well as the preview position.
- The older move and transport regressions now use the unchanged frame grid
  after a trim or move changes the sequence duration. Stories document the
  new gestures. Toolbar composition and navigation buttons remain in #82.
- Verification: 211 Playwright tests and 257 Vitest tests (including
  Storybook) passed. A focused dark-mode Playwright run passed 31 tests.
  Typecheck, formatting, library build, and the packed `custom-only.css`
  browser check passed. Lint only reports the existing missing-captions
  warning in `VideoPlayer.tsx`. Logs:
  `/tmp/opencode/sequence-81-latest-browser.log`,
  `/tmp/opencode/sequence-81-latest-vitest.log`, and
  `/tmp/opencode/sequence-81-packed-css.log`; dark-mode results are in
  `/tmp/opencode/sequence-81-dark.log`.
- Targeted browser mutations in an isolated copy removed recentering and
  Shift+wheel, ignored pan in move and Split/cursor/pool frame mapping,
  restored the auto-refit on edits, and disabled stationary paste retargeting.
  The gesture assertions killed all eight
  (`/tmp/opencode/sequence-81-mutations-summary.log`). A ninth mutant
  clamped pan moves before zero but corrected the view on mouse-up; asserting
  frame zero's position before release killed it on rerun
  (`/tmp/opencode/sequence-81-clamp-rerun.log`).
