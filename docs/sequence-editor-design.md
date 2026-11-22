# Sequence editor design

Build a React editor for describing a multi-track edit and compiling it to
`CutList` from `@saebyn/glowing-telegram-types`. Start with the component tree in
Storybook, then wire and test one editing action at a time. The host application
owns persistent state. The library provides the model, editing UI, and `CutList`
compiler. Saving projects and rendering the authored sequence are outside its scope.

This document describes the intended behavior, not a checklist of what the
current Storybook stories already support.

## Component tree

```text
SequenceEditor                         controlled by the host
├─ EditToolbar                         playhead transport and edit actions
├─ Workspace
│  ├─ ProjectClipPool                  reuse the existing clip browser
│  ├─ PreviewPane                      placeholder, no player
│  └─ SelectionInspector               selection summary and inspected placement or transition
└─ SequenceTimeline                    our component; speaks sequence frames
   └─ Timeline                         @keplar-404/react-timeline-editor
      ├─ Shared ruler and playhead
      └─ Rows
         └─ Custom items               placements and transition regions
```

Use **one widget instance** for the whole sequence, so tracks share a time scale,
scroll position, and playhead. `SequenceTimeline` projects authored tracks
onto widget rows and placements onto actions, supplying the item visuals
through `getActionRender`. Like the seam markers in `ProjectClipTimeline`,
transition indicators are anchored at placement edges. Draw the existing
entry and reveal fade indicators within the placement, spanning their
authored duration, without a separate row.
Convert sequence frames to widget seconds and convert events such as seeking
back to frames at this boundary.

Reuse the patterns in [`SourceTimeline`](../src/components/organisms/SourceTimeline.tsx)
for multiple rows and in [`ProjectClipTimeline`](../src/components/organisms/ProjectClipTimeline.tsx)
for custom clip rendering and trim controls. Do not carry over the latter's
gapless layout: it calculates start positions from clip order, while the new
timeline displays explicit placement positions. The widget displays the edit
and reports interaction input; its rows are not editor state or compiler input.

## Model and ownership

- **Source and clip:** A source identifies the media. A clip is a reusable
  range within a source, available in the clip pool.
- **Sequence and placement:** A sequence has ordered tracks. A placement has
  its own identity, references a clip, and has a track, a sequence position,
  and signed source-frame trim offsets from the clip's in and out points.
  Two placements can be trimmed independently, including extending beyond
  the clip's range within the same source. Re-trimming a clip adjusts existing
  placements' offsets to preserve their effective source ranges. New
  placements start at the new clip bounds.
- **Track management:** Add an empty track at the top. Remove only empty
  tracks, and do not offer Remove track for the last track. The host may
  supply a sequence with no tracks; show a track empty state with a prompt
  to add the first track rather than creating one on load. Undo can
  restore a zero-track sequence after the first track is added.
  Drag to reorder tracks, changing priority without moving or trimming
  placements. Preserve the authored reorder and transitions even if the
  resulting output cannot be compiled.
- **Track locks:** Store the lock on the track in the host-owned
  sequence. Lock and Unlock use the existing sequence edit flow and
  each take one Undo step when accepted. A lock
  prevents placement edits, including moves into or out of the track,
  clip-pool drops, trims, splits, deletes, and transition edits.
  A blocked explicit group edit makes no changes. Split at the playhead
  skips locked tracks; Split mode cannot cut a locked placement.
  Selection, inspection, and playback still work. Renaming, reordering,
  and removing an empty track still follow the usual rules. Undo and Redo
  restore accepted states, including their locks, without being blocked
  by the current locks. If Undo restores a removed locked track, it comes
  back locked. Another track can still cover a locked placement; toggling
  a lock does not change the `CutList` result.
- **Sequence duration:** The sequence has its own duration at the project
  frame rate. A valid move (single or group), trailing placement trim, or
  drop from the clip pool onto a track extends the duration just enough to
  fit the resulting placements. The placement change and any duration
  increase commit as one edit. Moving or trimming a placement earlier can
  leave a trailing gap; these edits never shorten the sequence. Duration
  growth does not bypass same-track collision checks or source bounds for
  trims.
- **Track overlap:** Ordinary audiovisual placements can overlap across
  tracks, not within a track. Where they overlap, the upper active placement
  supplies picture and sound. When it ends, the placement underneath resumes
  at the source position corresponding to the current sequence frame; it
  does not resume from where it was covered. Future track roles may combine
  picture or sound from lower to higher tracks. Explicit overlay tracks are
  a possible follow-up, not part of the first pass; more flexible compositing
  would need a future `CutList` format.
- **Transition objects:** A transition has its own
  identity and can be selected separately. It is anchored to one edge of one
  placement. Start with at most one transition per placement edge. The
  surrounding visible sequence determines what it transitions from or to;
  the transition is not pinned to a particular counterpart. Creating or
  resizing a transition does not change placement positions, placement
  trims, or sequence duration. Hard cuts stay implicit. First represent
  existing entry and reveal fades as objects, preserving the way their
  windows are anchored. A cut-spanning dissolve is a separate feature.
  Replace the old fade fields directly and update the Storybook stories
  and test fixtures. There is no legacy sequence load path.
  Splitting a placement keeps each transition on the split piece that
  retains its original edge, with the same identity and duration. The new
  split does not create a transition. Deleting a placement removes its
  transitions in the same undoable edit. A transition on a surviving
  placement stays even if its counterpart was deleted.
- **Covered transitions:** A fully covered transition stays authored
  and selectable, but does not affect playback or prevent export.
  This applies to entry fades, reveal fades, and dissolves.
- **Cut-spanning dissolve:** Center the transition on the cut. It can be
  attached to either the trailing edge of the outgoing placement or the
  leading edge of the incoming placement, but not to both. Add it from the
  edge that should own it, and show the owner when the dissolve is selected.
  An odd duration puts the extra frame after the cut, regardless of
  which edge owns it. Use a linear picture blend and linear audio
  crossfade over the same window, with no curve controls.
  At the sequence boundary, use only the part of the window inside the
  sequence without shortening or retiming the authored blend. Dissolve
  authoring can ship before faithful `CutList` export is available.
  Separate audio effects, audio controls, and routing are follow-up work.
- **Transition contributions:** A cut-spanning dissolve can use recorded
  material beyond either placement trim. Show these transition source
  extensions in the transition indicator, without changing the trims. The
  other side can come from a different track if it is visible at the cut.
  If a higher track hides the cut, the dissolve stays authored and
  selectable but does not affect output. If a different visible cut
  interrupts the blend window, the first version preserves the object
  and reports the arrangement as unsupported. A split that preserves
  continuous playback of the same source does not interrupt the blend.
  Where a side has no picture, it contributes black; where an audio
  transition has no audio on a side, that side contributes silence. A gap
  behaves the same whether it was already there when the transition was
  added or was opened by a move or trim. Do not shorten or remove a
  transition just because one of its contributions is absent.
- **Transition conflicts:** Explain and reject a new or resized
  transition that competes with another at the same cut or over the same
  visible frames. If a placement move or trim causes a conflict, keep both
  transitions and report the result as unsupported rather than choosing
  one silently.
- **Media load failures:** If source media is expected but fails to load,
  keep the edit intact and display a distinct “No media” placeholder
  in preview instead of treating the failure as a gap. Final export
  reports a media error rather than baking in the placeholder.
- **Entry and reveal fade windows:** Entry starts at the placement's
  leading edge; reveal ends at its trailing edge. If a trim makes the
  placement shorter than its fade, keep the anchored duration and use
  available footage beyond the trim. Report a visible cut that interrupts
  the window rather than shortening the fade or hiding the cut.
- **Time:** Source in/out points are zero-based whole frames on the native
  source grid, inclusive in and exclusive out. Sequence positions use the
  project frame rate. Keep both distinct from physical-media timestamps. See
  the [glossary](../GLOSSARY.md) for terminology.
- **Host vs. session:** The host supplies the editable sequence and media
  metadata, and decides what to persist. The library manages transient UI
  state such as the playhead, selection, zoom, and drag drafts. Monitoring is
  also session-only, unlike authored output audio adjustments.

```text
Host sequence + media → SequenceEditor → timeline and inspector
Timeline or inspector → edit intent → apply edit → next sequence
                                                       ├─→ host
                                                       └─→ CutList compiler → host
```

The top-level callbacks are `onSequenceChange(nextSequence)` and
`onCutListChange(cutList: CutList | null)`. Each committed edit emits one next
sequence and one `CutList` result. The host feeds the next sequence back as a
prop. The compiler is independent of React and takes that same next sequence,
not the widget data. An edit still reaches the host when it cannot be
compiled; emit `null` so the host does not mistake the previous `CutList`
for the current one. Selection, playhead changes, drag previews, and
blocked, cancelled, or unchanged drops emit neither callback. Loading or
replacing the sequence through props does not emit `onCutListChange`.

Toolbar controls, drag gestures, and future keybindings call the same
editor action for the same operation. Keep validation, availability, and
undo behavior with that action rather than in each input handler. Start
with an internal interface; a public command interface and configurable
keybindings are out of scope.

Undo and Redo step through host-accepted sequences. Feeding back the exact
proposed sequence object acknowledges the edit. Replacing it with a
different sequence object clears local history; no history entry is added
for a rejected proposal or a session-only action.

Expose the compiler as a utility, but do not require hosts to call it as part
of normal editor integration. The editor handles compilation for its edits.

## Selection and atomic moves

- Click a placement to select only that placement. Shift-click toggles
  individual placements across tracks. Click empty track space to clear the
  selection; click the ruler to seek instead. Drag a selected placement to
  move the selection, or drag an unselected placement to move only that
  placement. Marquee selection is a follow-up.
- Delete removes the selected placements together in one edit. It does not
  close gaps, shorten the sequence, remove tracks, or remove reusable clips
  from the clip pool. Delete is unavailable without a placement selection.
- The Inspector shows the source and sequence ranges and applicable trim and
  fade controls for one selected placement. For multiple selected placements,
  it shows the count and tracks and lets the editor choose which placement to
  inspect without changing membership or emitting an edit. If that placement
  leaves the selection, inspect another selected placement, if any. Group
  edits still use the whole selection. Use placement
  edges for direct timeline trimming and separate handles for adjusting entry
  and reveal transitions. Timeline gestures and Inspector controls use the
  same edit rules.
- A move proposes the IDs of the placements being moved and the grabbed placement's
  destination track and sequence frame. Every placement gets the same signed
  sequence-frame offset and the same shift in track order. Source ranges and
  entry and reveal transitions stay unchanged.
- Check the final layout with all moving placements' old positions vacated.
  Block the whole move if any placement would start before sequence frame
  zero, land outside the existing tracks, or overlap a stationary placement
  on its destination track. Touching edges and overlap across tracks are allowed.

Use one move evaluator for both the drag preview and the edit on release,
rather than applying a series of single-placement moves. Show each proposed
placement on its destination track at its exact position, with a sequence
position readout for the grabbed placement. If blocked, show why the whole
drop is invalid. Keep the scale steady during the drag and make space to the
right to preview a move past the current endpoint without changing authored
duration before a valid drop.

Hovering a clip from the pool over an existing track previews the fitted
placement using the same rules as release. In a bounded gap the placement
can start before the pointer to fit; the preview shows that actual start.
Invalid drops show a blocked preview and do not change the sequence.

For example, if a group move would extend a 160-frame sequence to 190 frames
but would also cause a same-track collision, neither the placements nor the
duration change. Once the collision clears, a valid drop commits the placements
and any duration increase together. Undo restores both in one action.

Start with destinations on whole sequence frames. Future optional snap targets
can include placement edges, the playhead, and the ruler grid. Snapping adjusts
the group offset, not individual placements.

## Playhead without a media preview

Click the ruler or drag the playhead to seek. Play forward, play in reverse,
and pause the sequence playhead even while the preview pane is disconnected.
The playhead position is session state in sequence frames. Split acts on
all eligible placements at the playhead, regardless of selection.
Split mode is separate: clicking a placement splits only that placement
at the pointer's sequence frame, without requiring selection. It does
not seek or change the placement selection. Split mode stays active
after a cut until toggled off or dismissed with Escape.
While active, it takes over placement gestures so they cannot start a
move or trim. Ruler seeking, playhead dragging, pan, and zoom remain
available. An empty-track click does nothing.

## `CutList` boundary

The published [`@saebyn/glowing-telegram-types@0.14.0`](https://registry.npmjs.org/@saebyn%2fglowing-telegram-types/0.14.0)
defines schema version `"1.0.0"`:

| Field | What the schema carries |
| --- | --- |
| `inputMedia` | Media identified by `s3Location`, with source-frame sections and exclusive out points |
| `outputTrack` | A nonempty ordered list of references into those sections, with optional `fade` or `cut` transitions at section edges |
| `overlayTracks` | Media-section references with an explicit start frame, `alpha` or `colorkey` type, and optional X/Y position |
| `audioMixing` | Optional channel routing and volume keyframes; no controls planned in the first slice |

The main output track has no explicit placement starts or general track stack,
so `CutList` is a compiled result, not the editable sequence. For straight
cuts, flatten covered intervals to the upper active placement. At matching
frame rates, if lower placement A covers sequence `[0, 100)` using source
`[100, 200)`, and upper placement B covers sequence `[40, 60)` using source
`[500, 520)`, emit A `[100, 140)`, B `[500, 520)`, then A `[160, 200)`.
Express authored entry and reveal fades using `transitionIn` and
`transitionOut`, respectively, on the corresponding output section edges
when the schema can carry them. The library contract ends at the emitted
`CutList`: verify section order, source-frame ranges, and transition fields
and durations. Downstream renderer behavior and rendered-media verification
are outside this project's scope.

The compiler requires matching source and project rates; it does not round
mixed-rate cuts. Intersecting entry and reveal regions within a placement,
uncovered gaps, and empty sequences produce no `CutList`.
The transition model's black fallback is a desired output behavior, not a
capability of the current compiler. If the format cannot represent an
active dissolve, keep the authored edit, report export as unavailable,
and emit `null` instead of approximating. See the
[CutList change requests](cutlist-change-requests.md) for format needs to
verify and discuss with downstream maintainers.

Resolve fade neighbors while flattening the authored tracks into the existing
ordered `outputTrack`; do not copy the authored tracks to the `CutList`.
For a reveal fade, emit the outgoing section with `transitionOut`,
then the section from the uppermost placement active at the outgoing
placement's exclusive end. In the A → B → A example, B's `transitionOut`
is followed by the resumed section of A, which starts at source frame 160
at sequence frame 60. Entry fades use the preceding section in flattened
order. Empty tracks do not affect this ordering. The compiler omits a
fully covered fade without removing it from the sequence. A partially
visible fade can still make the compiler return `null`, even if its
anchoring edge is covered.

## Storybook editing setups

Use a small number of editable stories set up for workflows, not one story
per gesture. Both should offer the same interactions wherever they apply,
including playhead controls.

| Setup | What to explore |
| --- | --- |
| **Assemble a rough cut** | Fill an existing gap on a single track, extend the sequence with a drop from the clip pool or a trailing trim, and adjust trims and entry/reveal transitions from both the timeline and the Inspector. |
| **Rearrange a layered edit** | Use several tracks with room to move and a placement that can block a drop. Select placements across tracks, preserve their spacing, see an invalid drop, then move the group past the sequence endpoint. |

The stories act as the host: they feed accepted sequences back to the editor
and expose the callbacks in Storybook’s Actions panel. Check that a proposed
move previews the final destination without emitting edits, a blocked drop
changes nothing, and a valid extending drop emits one sequence change and one
`CutList` result. Keep focused compiler tests for source ranges, ordered
sections, track priority and source alignment, and fade type and duration
without creating a separate story for each case.

The existing source review and range export workflow stays separate. The
existing [`VideoPreview`](../VideoPreview.md) plays a host-rendered HLS stream
and is not part of this tree. A future live preview will render from source HLS
streams in a different component. These stories verify authoring and
callback output, not decoded picture or sound.

Follow-up design can settle mixed-rate cuts and the remaining details of
split and undo.
