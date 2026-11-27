# 39 — Add loop points with Keplar

Status: needs-info
Depends on: [06](06-control-the-playhead-without-media.md)

## Proposal

Let editors set and adjust loop in/out points on the sequence timeline
and enable looping for review, even with Preview disconnected. Evaluate
Keplar's `LoopZoneOverlay` for the draggable handles and range highlight.
Keep the range and playback in whole sequence frames; convert to and
from seconds at the widget interface. Use the editor's existing
transport clock rather than introducing a second one.

## Acceptance criteria

- The handles and highlight agree with the sequence range after zoom
  and pan. Test keyboard access as well as pointer dragging.
- With looping enabled, the playhead repeats the range without media.
  Setting or looping the range does not trim the sequence or emit
  `onSequenceChange` or `onCutListResult`.
- Verify the agreed behavior when the sequence endpoint shrinks,
  playback is reversed, or the playhead is moved outside the range.

## Comments

- Split from [26 — Sequence markers](26-add-sequence-markers-and-playback-ranges.md).
  Decide whether the range is session-only or persisted separately, and
  what happens to its endpoints when the sequence shortens.
