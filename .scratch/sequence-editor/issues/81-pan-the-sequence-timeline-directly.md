# 81 — Pan the sequence timeline directly in both directions

Status: ready-for-agent
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
