# 32 — Show cut-spanning dissolves and source extensions

Status: ready-for-agent
Depends on: [37](37-represent-entry-and-reveal-fades-as-transition-objects.md), [31](31-protect-fades-during-moves-and-trims.md)

The current entry and reveal indicators sit inside one placement.
For an ordinary cut between adjacent placements, explore a distinct visible
dissolve that shows which footage it uses from both sides.

## Proposed acceptance criteria

- Start with two adjacent placements on one track. Show a selectable
  transition region centered on their cut. Add it from the edge that
  should own it, and show that owner when selected. Show the extra source
  range each side contributes without moving or overlapping placement
  blocks, changing trims, or changing sequence duration.
- Use a linear picture blend and linear audio crossfade over the same
  window. Separate audio effects and routing are out of scope. An odd
  duration puts the extra frame after the cut. At a sequence boundary,
  use only the portion inside the sequence without changing the authored
  duration or retiming the blend.
- Reject authoring changes that make two transitions compete for one cut
  or the same visible frames. A placement move or trim that causes a
  conflict preserves both transitions and reports unsupported output.
- If a higher track hides the cut, keep the dissolve selectable without
  affecting output. If a different visible cut interrupts the blend
  window, preserve the dissolve and report the arrangement as unsupported.
  A split that preserves continuous playback does not interrupt it.
- Blend against black where a side has no picture and against silence
  where an audio transition has no audio on one side. Use the same
  result whether a gap was already present or a move or trim opened it,
  as described in [31](31-protect-fades-during-moves-and-trims.md).
- Authoring does not depend on proving a supported `CutList` case. If
  the current format cannot express the dissolve faithfully, keep the
  authored edit, explain why export is unavailable, and emit `null`
  instead of approximating it.

## Comments

- Inspired by Streamosaic's [visible transition decision](https://github.com/saebyn/streamosaic/issues/219#issuecomment-6965844172)
  and [source footage validation decision](https://github.com/saebyn/streamosaic/issues/219#issuecomment-6965920172).
- The design distinguishes genuinely absent footage from a source load
  failure, which should show a “No media” placeholder in preview and
  fail final output. This ticket ends at authoring and the `CutList`
  boundary; decoded output belongs to the host and renderer. A visible
  counterpart can come from a different track. Start with a same-track
  cut when investigating faithful export. See the
  [`CutList` change requests](../../../docs/cutlist-change-requests.md).
