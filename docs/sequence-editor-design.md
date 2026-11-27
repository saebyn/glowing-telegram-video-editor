# Sequence editor design

Build a React editor for describing a multi-track edit and compiling it to
`CutList` from `@saebyn/glowing-telegram-types`. Start with the component tree in
Storybook, then wire and test one editing action at a time. The host application
owns persistent state. The library provides the model, editing UI, and `CutList`
compiler. Saving projects and final rendering are outside its scope.

This document describes the intended behavior, not a checklist of what the
current Storybook stories already support.

**Agreed, not implemented:** The session-owned sequence described below replaces
the current controlled `sequence` prop and exact-object acknowledgement. See
[ADR 0002](adr/0002-own-the-working-sequence-in-the-editor.md) for the decision
and the [README](../README.md#sequenceeditorpage) for today's interface.

See [Sequence editor data flow](sequence-editor-data-flow.md) for the
relationships between host inputs, committed edits, Preview, and compilation.

## Component tree

`SequenceEditorPage` is the default assembly, analogous to `VideoSelectionPage`.
It lives under `components/pages` and replaces the unpublished `SequenceEditor`
export without an alias. Use the page as-is, replace individual slot components,
or build a different page using the same editing hook and UI components.

```text
SequenceEditorPage                     default layout; calls useSequenceEditor
├─ toolbar slot → SequenceToolbar      transport, edit actions, timeline navigation, and pane toggles
├─ SequenceWorkspace                   responsive layout and accessible splitters
│  ├─ clipPool slot → SequenceClipPool  adapts ProjectClipPool
│  ├─ preview slot → SequencePreview
│  └─ inspector slot → SequenceInspector (empty, PlacementProperties, or TransitionProperties)
└─ timeline slot → SequenceTimeline    adapter that speaks sequence frames
   └─ Timeline                         one @keplar-404/react-timeline-editor widget
```

### Composition interfaces

The page's `slots` prop accepts React component types with region-specific
props. An unspecified slot uses its default; `null` omits it, leaving no empty
pane or visibility toggle for that slot. A wrapper can add UI around a default
component and forward the props it received, without wiring editing behavior
again.

One call to `useSequenceEditor` provides one editing session. The hook and
`SequenceEditorPage` both take `initialSequence`, clip and source inputs, and
optional callbacks. The hook reads the project frame rate from `ProjectProvider`
and passes it to components that need it. It returns `toolbarProps`, `clipPoolProps`,
`previewProps`, `inspectorProps`, and `timelineProps`, plus notices and an opt-in
root keyboard handler. The default page renders notices independently of the
Toolbar and binds shortcuts to its root, including Escape to dismiss Split or
placement paste drop mode. A host-built page can do the same in its own layout.

| Slot | Props from the editing session |
| --- | --- |
| Toolbar | Transport state and actions; availability and actions for Split at playhead, Split mode, Undo/Redo, deleting the selection, and adding or renaming tracks. Optional timeline navigation actions are available when the Timeline supports them. The default page supplies pane toggles separately. |
| Clip Pool | Clips and their presentation data, plus callbacks to begin and end a drag for a clip ID. `SequenceClipPool` adapts `ProjectClipPool` without changing its separate uses. |
| Preview | Transport snapshot, the working sequence, and current clip and source inputs. The default `SequencePreview` registers readiness while mounted; the session still owns the clock and play intent. |
| Inspector | A discriminated `inspection` value: empty, placement (selection summary and chooser, effective ranges, trim bounds and action, one action per edge), or transition (authored `PlacementTransition`, owner, edge, resolved details, duration bounds by kind, and actions to apply type and duration together or remove the transition). The Inspector owns labels, drafts, and form rendering. |
| Timeline | Ordered tracks and placements, derived sequence duration, clip and source presentation, transport and seek, selection and Split mode, and named actions to edit placements, transitions, and tracks. The Timeline can register viewport navigation actions with the session. Gesture evaluators report fitted positions or blocked reasons without committing an edit. For either transition kind, `previewTransitionResize` and `resizeTransition` take `{ transitionId, durationFrames }`; release revalidates the duration against the current transition and cannot create, remove, or change its kind. |

Export the library-owned UI components and their props from the package root,
including `SequenceWorkspace`, pane toggles, and individual controls. Exports
do not create additional page slots. Standalone components render from supplied
props; they do not create or look up an editing session. Keep the lower-level
history and validation helpers and the Keplar widget itself out of these exports.

### Default layout and timeline

`SequenceWorkspace` takes rendered Clip Pool, Preview, and Inspector nodes.
It does not depend on the editing hook. Keep the responsive stacking and
workspace resizing. The default assembly owns pane visibility and preferred
widths; it does not expose controlled layout props. Hiding a configured pane
unmounts its component while retaining its preferred width and shared editing
state. Cancel any drag involving the hidden pane without committing it. Local
drafts or zoom may reset on remount; unmounting does not emit an edit or stop
transport. A host-built page can choose its own layout and lifecycle. An
Inspector height cap is a separate change.

The default `SequenceTimeline` uses **one widget instance** for the whole
sequence, so tracks share a time scale, scroll position, and playhead. It
projects authored tracks onto widget rows and placements onto actions, supplying the item visuals
  through `getActionRender`. Draw entry fades, reveal fades, and dissolves
  over roughly the top 80% of their track. Keep each indicator at
its true projected position and width, including windows that extend past
the owning edge or overlap, and draw the selected indicator on top in the
same lane. The bottom strip remains available for selecting and moving the
placement, with trim grips in its corners. In Split mode the indicators are
visible but don't intercept the blade or prevent inspection from the Inspector.
Convert sequence frames to widget seconds and convert events such as seeking
back to frames inside the adapter. The slot interface does not expose widget
rows, seconds, or pointer coordinates. Source ranges and trim bounds on the
source grid remain in source frames.

As in [`SourceTimeline`](../src/components/organisms/SourceTimeline.tsx), one
widget displays multiple rows. `SequenceTimeline` renders placement contents
and trim controls at explicit positions rather than deriving positions from
clip order. The widget displays the edit and reports interaction input; its
rows are not editor state or compiler input.

### Sequence timeline navigation

- **Pan directly.** Drag empty track space horizontally to pan once the
  pointer moves past a drag threshold. A click still clears the placement
  selection in normal mode; ruler clicks still seek, and placement drags and
  grips keep their editing behavior. Horizontal trackpad scrolling and
  Shift+wheel pan without grabbing anything. In Split or Paste drop mode,
  panning doesn't split or place anything; a click retains its mode-specific
  behavior. An armed paste preview follows the position under the pointer as
  the viewport pans.
- **Pan without sequence bounds.** The viewport can move left of frame zero
  or beyond the latest placement at any zoom, even in an empty sequence.
  Use a bounded widget window that can move along the time axis; shifting
  that window must not change what frame a pointer, placement, or playhead
  refers to. The frame at the viewport's left edge is independent of the
  widget's scroll offset. Frame zero never moves. Edits cannot place
  material before zero, and a ruler seek there lands at zero. An edit to the
  right can extend the sequence; seeking there lands at the current end.
- **Toolbar navigation.** **Pan left** and **Pan right** move the viewport
  by half its visible time span at the current zoom. **Zoom out** and **Zoom in**
  step the scale; they stay visible but are disabled at their respective limits
  and during placement or clip pool drags and placement trims. **Fit to view**
  brings frame zero to the left and shows the whole sequence. For an empty
  sequence it returns to zero at a usable default scale. Use icon buttons with
  accessible names and tooltips. Host-built layouts can use the same actions
  through the toolbar and timeline slots; omit actions an absent, hidden, or
  replacement Timeline doesn't provide. The sequence timeline keeps its
  accessible region name and duration readout without a visible heading.
- **Keep navigation separate from authoring.** Panning, zooming, and fitting leave
  the selection and playhead alone, emit no edit callbacks, and don't join
  Undo history. An ordinary placement edit doesn't change viewport position
  or scale just because sequence duration changed. Edge auto-pan can still
  reveal a proposed placement or trailing trim without changing scale. Zoom
  anchors the visible playhead, or the viewport center when the playhead is
  offscreen.

## Model and ownership

- **Source and clip:** A source identifies the media. A clip is a reusable
  range within a source, available in the clip pool. The editor's clip pool and
  timeline share each source's `frameThumbnails`. The pool uses the clip's
  reusable range; the timeline uses the placement's effective range, including
  its trim. Both use inclusive in and exclusive out on the native source grid.
  These thumbnails are presentation only and do not affect compilation.
- **Sequence and placement:** A sequence has ordered tracks. A placement has
  its own identity, references a clip, and has a track, a sequence position,
  and signed source-frame trim offsets from the clip's in and out points.
  Two placements can be trimmed independently, including extending beyond
  the clip's range within the same source. If the host re-trims a clip, it
  prepares a new initial sequence with adjusted offsets to preserve existing
  effective source ranges before reopening. New placements start at the new
  clip bounds.
- **Track management:** Add an empty track at the top. Remove only empty
  tracks, and do not offer Remove track for the last track. The host may
  supply a sequence with no tracks; show a track empty state with a prompt
  to add the first track rather than creating one on load. Undo can
  restore a zero-track sequence after the first track is added.
  Drag to reorder tracks, changing priority without moving or trimming
  placements. Preserve the authored reorder and transitions even if the
  resulting output cannot be compiled.
- **Track locks:** Store the lock on the track in the sequence. The Timeline
  calls `setTrackLocked(trackId, locked)` with the requested state, not a toggle.
  Each actual change takes one Undo step. A lock prevents placement edits,
  including moves into or out of the track, clip-pool drops, trims, splits,
  deletes, and transition edits.
  A blocked explicit group edit makes no changes. Split at the playhead
  skips locked tracks; Split mode cannot cut a locked placement.
  Selection, inspection, and playback still work. Renaming, reordering,
  and removing an empty track still follow the usual rules. Undo and Redo
  restore sequence snapshots, including their locks, without being blocked by
  the current locks. If Undo restores a removed locked track, it comes
  back locked. Another track can still cover a locked placement; toggling
  a lock does not change the `CutList` result.
- **Sequence duration:** Frame zero is fixed. Duration is the latest exclusive
  placement end across all tracks, including locked tracks, using each
  placement's effective source range converted to project frames. With no
  placements the duration is zero. A placement edit can grow or shrink the
  sequence; leading and internal gaps are still possible. There is no stored
  duration, shortening action, toolbar endpoint control, or end marker.
  The timeline, preview, and transport use the same derived duration.
  See [ADR 0001](adr/0001-derive-sequence-duration-from-placements.md).
- **Track overlap:** Placements can overlap across tracks, not within a
  track. Resolve picture and sound separately: the uppermost active
  placement that supplies each contribution wins. Audio-only over
  audiovisual takes over sound but not picture; video-only over audiovisual
  does the opposite. Lower sound is not mixed under the winning sound.
  When a lower contribution is uncovered, resume it at the source position
  corresponding to the current sequence time, not where it was covered.
  Explicit overlay roles and more flexible compositing are follow-up work.
- **Transition objects:** A transition has its own
  identity and can be selected separately. It is anchored to one edge of one
  placement. Start with at most one transition per placement edge. The
  surrounding visible sequence determines what it transitions from or to;
  the transition is not pinned to a particular counterpart. Creating or
  resizing a transition does not change placement positions, placement
  trims, or sequence duration. Hard cuts stay implicit. First represent
  existing entry and reveal fades as objects, preserving the way their
  windows are anchored. A dissolve is a separate feature.
  Replace the old fade fields directly and update the Storybook stories
  and test fixtures. There is no legacy sequence load path.
  Splitting a placement keeps each transition on the split piece that
  retains its original edge, with the same identity and duration. The new
  split does not create a transition. Deleting a placement removes its
  transitions in the same undoable edit. A transition on a surviving
  placement stays even if its counterpart was deleted.
- **Covered transitions:** A fully covered transition stays authored
  and selectable, but does not affect playback or prevent export.
  Evaluate playback coverage and conflicts separately for picture and sound.
  If a transition is partially covered but otherwise valid, preserve its
  original blend phase when the contribution becomes visible or audible
  again. These rules apply to both fades and dissolves.
- **Dissolve:** Center the transition on the cut. It can be
  attached to either the trailing edge of the outgoing placement or the
  leading edge of the incoming placement, but not to both. Show the owning
  placement and edge when the dissolve is selected.
  An odd duration puts the extra frame after the cut, regardless of
  which edge owns it. Use a linear picture blend and linear audio
  crossfade over the same window, with no curve controls.
  At the sequence boundary, use only the part of the window inside the
  sequence without shortening or retiming the authored blend. Dissolve
  authoring can ship before faithful `CutList` export is available.
  Separate audio effects, audio controls, and routing are follow-up work.
- **Transition contributions:** A dissolve can use recorded
  material beyond either placement trim. Show these transition source
  extensions in the transition indicator, without changing the trims. The
  other side can come from a different track if it is visible at the cut.
  If a higher track hides the cut, the dissolve stays authored and
  selectable but does not affect output. If a different visible cut
  interrupts the blend window, preserve the object and report the
  arrangement as unsupported. A split that preserves continuous
  playback of the same source does not interrupt the blend.
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
  leading edge; reveal ends at its trailing edge. Use the preceding
  contribution at the leading edge for an entry fade and the following
  contribution at the trailing edge for a reveal fade, independently for
  picture and sound. For example, if B ends over A as C starts on top,
  B reveals C, not A. Resolve the counterpart at the edge, then sample it
  at the corresponding sequence time, using a transition source extension
  where needed. If there is no counterpart at the edge, blend with black
  or silence; do not search past a gap. If a trim makes the placement
  shorter than its fade, keep the anchored duration and use available
  recorded material beyond the trim. Report a visible cut that interrupts
  the window rather than shortening the fade or hiding the cut.
- **Blend phase:** Both fades and dissolves blend picture and sound
  linearly. Evaluate the picture weight at the center of the sequence
  frame and the audio weight continuously across the same window. A
  one-frame transition therefore shows a half blend. Clipping a window
  at sequence bounds or hiding part of it does not retime it. Where a
  needed extension runs past the recorded source, only the absent portion
  contributes black or silence.
- **Time:** Source in/out points are zero-based whole frames on the native
  source grid, inclusive in and exclusive out. Sequence positions use the
  project frame rate. Keep both distinct from physical-media timestamps. See
  the [glossary](../GLOSSARY.md) for terminology.

### Session lifetime and live inputs

The editor session owns the working sequence and its Undo/Redo history. It
initializes from `initialSequence` on mount. Rerendering the same session does
not reopen it, even if `initialSequence` changes. To switch sequences, reload,
or discard local work, the host changes the React `key` and supplies the
snapshot to open. This remount resets history, selection, clipboard, transport,
and UI state inside the editor, including open dialogs and drafts. For a custom
layout, key the component that calls `useSequenceEditor`, not an individual slot.
Monitoring is session-only, unlike authored output audio adjustments.

The host still owns clips and sources. It can add clips and refresh metadata
for the same media (such as thumbnails or an aligned Preview URL) during a
session. Equivalent clip arrays should not cancel a gesture. Removing or
re-trimming an existing clip, changing the media it refers to, or changing the
project frame rate requires reopening with a suitable `initialSequence`.
The session does not rebase the working sequence or history on those changes.

Treat `initialSequence` and emitted snapshots as immutable. The editor may
share unchanged data and does not promise to clone or freeze it. The host can
store or serialize a snapshot; it makes a copy before modifying one.

### Committing and observing edits

A successful edit, Undo, or Redo advances the working sequence and history
before notifying listeners. Each action that changes the sequence emits once
in commit order, even if React batches the renders. If supplied,
`onSequenceChange(nextSequence)` receives only the resulting snapshot, followed
by the separate `onCutListResult(result: CutListResult)` for the same snapshot
when that listener is supplied. Either callback can be used on its own.
Mounting or reopening, selection, playhead changes, drag previews, and blocked,
cancelled, or unchanged actions emit neither callback.

There is no read-only mode. Editing and history work the same without either
listener. The host decides when to save, how to retry or order saves, and how
to report errors. The editor does not await save results or require the host
to echo a snapshot back. Save results do not affect editing or notifications.

The compiler is independent of React and takes the committed sequence, not
widget data. `ok: true` includes a `CutList`; `ok: false` has no `CutList` and
includes at least one issue. Either branch can carry issues; no issues implies
success. An export failure never rejects a valid edit or history step. Hosts
can also call the compiler directly.

The page and editing hook expose a separate typed `onSequenceInputError`
callback for invalid inputs, including a missing referenced clip, invalid
placement start or effective source range, an unusable frame rate, an unsafe
end frame, or same-track overlap. Notify on initial invalid input or when its
diagnostics change, not on each render. Show the diagnostic and block editing
and playback while invalid, without throwing, inferring a partial duration,
discarding placements, or emitting a sequence change. Correcting live inputs
restores the session without a recovery callback. To replace an invalid
initial sequence, reopen. A valid mixed-rate edit, a sequence gap, or missing
render media may make export unavailable without invalidating the input.

### Action intent and history

Built-in and host-provided UI own interaction state, such as a gesture draft
or a rename dialog's text and the track ID captured when it opened. Toolbar
controls, gestures, and shortcuts use the same editor action for the same
operation. Actions take named intents with IDs and whole frames where
applicable, not a modified `Sequence`. Slot props provide derived information
such as edit availability and trim bounds, but the session validates each
action against the current working sequence and inputs before applying it.

For example, `renameTrack(trackId, label)` looks up that ID when submitted, not
the current selection or a track object held by the dialog. It preserves
intervening edits. If Undo restored the track, its ID still identifies it;
if the ID is absent or the label is unchanged, there is no edit. Likewise,
a retained **Lock track** action does not unlock an already locked track.
A generic public command interface and configurable keybindings are out of scope.

Each committed edit is one Undo step; a new edit after Undo clears Redo.
Undo and Redo restore sequence snapshots, not the host's clip pool or source
metadata. If the next snapshot in either direction is invalid against the
current inputs (for example, it references a clip the host removed without
reopening), refuse that step without consuming or skipping it, changing the
working sequence, or notifying either edit listener. A valid snapshot with
an export issue is still eligible. Session-only actions do not enter history.

## Selection and atomic moves

- Click a placement to select only that placement. Shift-click toggles
  individual placements across tracks. Click empty track space to clear the
  selection; click the ruler to seek instead. Drag a selected placement to
  move the selection, or drag an unselected placement to move only that
  placement. Marquee selection is a follow-up.
- Delete removes the selected placements together in one edit. It does not
  close leading or internal gaps, remove tracks, or remove reusable clips
  from the clip pool. If the latest placement end changes, duration follows
  the remaining placements. Delete is unavailable without a placement selection.
- With focus in an editable editor and outside text fields, use Ctrl/⌘+C to
  copy placement selection, Ctrl/⌘+D to duplicate it, or Ctrl/⌘+V to paste the
  copy. Copy snapshots relative sequence positions and track spacing, effective
  source ranges, and authored transitions. The clipboard belongs to the session,
  survives committed edits, and clears when a new session opens. It does not
  use the system clipboard or copy across editors.
- Duplicate puts the earliest new placement at the latest selected exclusive
  end and keeps the original tracks. Paste maps the earliest copied sequence
  frame and topmost copied track to the pointer's frame and track respectively,
  without snapping or fitting to a gap. If Paste cannot place the group there,
  it enters drop mode: move the pointer to preview, click on a valid track
  position to place, or press Escape to cancel. A blocked click leaves drop
  mode active. The optional `placementPaste` prop reports frame-and-track
  targets (or `null`) to the session; when it supplies a drop preview, the
  Timeline renders it and reports the clicked target for revalidation.
- Duplicate and Paste reuse clips and assign new placement and transition IDs.
  Same-track overlap and missing or locked destination tracks block the whole
  edit. Touching edges are allowed. The group insertion is one Undo step;
  duration is derived from the resulting placements. Copy, preview,
  and cancel emit nothing; a committed edit need not produce a successful
  `CutList`.
- Placement Properties shows the source and sequence ranges and applicable trim
  controls for one selected placement. For multiple selected placements,
  it shows the count and tracks and lets the editor choose which placement to
  inspect without changing membership or emitting an edit. If that placement
  leaves the selection, inspect another selected placement, if any. Group
  edits still use the whole selection. Each occupied edge offers **Inspect
  transition**, equivalent to selecting its timeline indicator: highlight the
  transition, clear the entire placement selection, and show Transition
  Properties instead of Placement Properties without committing an edit.
- Each editable empty edge offers **Add transition**, which adds one entry
  or reveal fade. Use half a second rounded to whole sequence frames, at least
  one frame and capped at the placement's duration. A conflict leaves the
  selection intact and explains why the edit is blocked; do not shorten the
  default to fit. Select the new transition on commit. Add is one Undo step.
- Transition Properties identifies the owner, edge, and authored kind, and
  shows resolved details such as dissolve contributions. **Apply** commits
  the draft type and duration together, retaining the transition's ID and
  edge. Changing the type does not change the draft duration. Both kinds
  require positive whole sequence frames; a fade cannot be longer than the
  placement when authored or resized. Apply, Add, and timeline resizing
  use the same evaluator and reject competition at the same cut or over
  visible frames.
- **Remove transition** clears the owned edge without moving or trimming its
  placement. On commit, it selects just the owning placement; Undo
  restores the transition without changing that selection. Zero duration is
  not removal. Locked tracks allow inspection, but not transition edits.
  Timeline placement edges still trim; separate resize grips adjust authored
  fades and dissolves. A dissolve resize changes both sides about the same cut
  and clips the displayed window at sequence bounds
  without limiting the authored duration. Canceling the drag leaves the
  transition unchanged. Empty edges have no transition grips; creation starts
  only in Placement Properties. Short or obscured transitions can still be
  inspected from their owning edges.
- A move intent specifies the IDs of the placements being moved and the
  grabbed placement's destination track and sequence frame. Every placement
  gets the same signed sequence-frame offset and the same shift in track
  order. Source ranges and entry and reveal transitions stay unchanged.
- Check the final layout with all moving placements' old positions vacated.
  Block the whole move if any placement would start before sequence frame
  zero, land outside the existing tracks, or overlap a stationary placement
  on its destination track. Touching edges and overlap across tracks are allowed.

Use one move evaluator for both the drag preview and the edit on release,
rather than applying a series of single-placement moves. Show each proposed
placement on its destination track at its exact position, with a sequence
position readout for the grabbed placement. If blocked, show why the whole
drop is invalid. Keep the scale steady during the drag and allow panning
past the current end to preview the move. Draft positions do not affect
sequence duration.

Hovering a clip from the pool over an existing track previews the fitted
placement using the same rules as release. In a bounded gap the placement
can start before the pointer to fit; the preview shows that actual start.
Invalid drops show a blocked preview and do not change the sequence.
The shared session carries the active clip ID for the lifetime of the drag.
Native events and payloads remain in the adapters. A replacement Clip Pool can
report that ID while using native drag with the default Timeline. A replacement
Timeline can also use a non-drag interaction to preview or place a clip by ID,
destination track ID, and sequence frame.

For example, if a group move would extend a 160-frame sequence to 190 frames
but would also cause a same-track collision, neither the placements nor the
duration change. Once the collision clears, a valid drop makes the
sequence 190 frames. Undo restores the placements and therefore the original
duration in one action.

Destinations are always on whole sequence frames. The **Snap** toolbar
toggle starts off and belongs to the editor session. When enabled for a
placement drag, either effective edge of any moving placement can align with
the playhead or a stationary placement edge on any track (even a locked
track) within 8 CSS pixels at the current zoom. Use the nearest alignment
that passes the whole-group move rules. On ties, prefer the earlier
resulting start of the grabbed placement, then the earlier target frame.
Show a guide at the winning target and commit the previewed group offset
without changing the requested track shift. If no alignment is valid,
keep the unsnapped destination and its usual feedback. Ruler ticks, nudges,
trims, and clip-pool drops do not snap.

## Playhead without a media preview

Click the ruler or drag the playhead to seek. Play forward, play in reverse,
and pause the sequence playhead even when the Preview slot is omitted or
`SequencePreview` has no media playback.
The editing session owns the playback clock and the playhead in sequence
frames. When the Preview slot is hidden or omitted, transport does not wait
for media. Split at playhead acts on all eligible placements at the
playhead, regardless of selection.

If a duration change puts the playhead beyond the sequence end, leave it
parked at that frame and stop playback if it was running. Undo and Redo do
not reposition it. For Play or a relative playhead step, first use the
nearest in-range position; for an explicit seek, clamp the requested
position to `[0, duration]`. With a playhead parked at 110 and an end at 100,
one step back lands on 99, reverse starts from 100, and Play forward lands
at 100 and stays stopped. Pause does not seek.

Split mode is separate: clicking a placement splits only that placement
at the pointer's sequence frame, without requiring selection. It does
not seek or change the placement selection. Split mode stays active
after a cut until toggled off or dismissed with Escape inside the editor.
The Timeline reports a placement activation with its ID and, for a pointer
activation, the sequence frame under the pointer. The shared session decides
whether to select or split. The Timeline reads Split mode to change affordances
and suppress move and trim gestures. Ruler seeking, playhead dragging, pan,
and zoom remain available. An empty-track click does nothing.

## Sequence preview target

The default `SequencePreview` simulates the working sequence at the current
playhead, without a custom slot, pre-rendered sequence, or successful
`CutList` compile. Match the authored timing and picture and sound
contributions, not the downstream render's pixels or audio samples.

- **Resolve the edit before decoding.** Keep presentation rules in a
  browser-independent module. Given the Sequence, clips, project rate, and
  resolved source metadata, determine the contributors, source times,
  blend weights, and undefined spans. The player consumes that result;
  neither an HLS playlist nor a `CutList` defines the edit. Media fetching,
  compositing, and audio scheduling are separate from resolving the edit.
- **Playback renditions.** The target host supplies a direct, finite, seekable
  HLS media playlist with MPEG-TS segments covering the whole source, including
  material outside current trims. Multivariant playlists are not required
  inputs for Sequence Preview. Normalize media timestamps to
  source elapsed time; playlist and container timestamps need not start
  at zero. The browser must be able to fetch the playlist and referenced
  resources. Never derive a playback URL from `s3Location`.
- **Source contributions.** A declared media kind determines whether a
  source supplies picture, sound, or both. Probe the rendition when the
  kind is unknown; do not prematurely fall through to a lower track.
  A declared contribution missing from the rendition is a media error,
  not permission to substitute a lower contribution. Playback delivery
  and timing metadata for audio-only sources remain follow-up work.
- **Time and samples.** Map sequence elapsed time from the placement's
  own start, not from the beginning of its visible span, and add it to
  the effective source in point in native seconds. Seek and step at the
  authored frame position and use the rendition picture covering the
  resulting source time. In a lower-cadence rendition, adjacent sequence
  frames may display the same picture. If mixed-rate duration rounding
  leaves a fractional tail beyond the trim, hold the last in-range
  picture and emit silence there; only transitions use source extensions.
- **Transport.** The session keeps ownership of the clock and playhead.
  While Preview is active and required media is loading, hold the
  playhead and resume automatically when ready if the play intent is
  still current. A pause, seek, or direction change supersedes the old
  intent. Edits and rendition URL replacements invalidate stale results
  and resolve again at the current playhead without resetting transport.
  Reverse playback is picture-only; seeking, stepping, and pausing at
  the same frame show the same picture. At the exclusive sequence end,
  hold the last authored frame without sound, even if it is black. A
  playhead parked beyond the end shows black and stops any queued sound;
  it doesn't sample the last frame.
- **Gaps and failures.** Uncovered time contributes black and silence
  except where an authored transition contributes. A missing expected
  rendition or terminal media failure shows the No media placeholder.
  An undefined transition span shows a distinct diagnostic. In either
  case playback stops at the affected position, the edit is intact, and
  the user can seek elsewhere. Diagnose unsupported browser or codec
  combinations explicitly rather than substituting an approximation.
- **Preview cache budget.** Each mounted reader keeps at most four open or
  opening playback renditions, keyed by URL. A dissolve can use two picture
  and two sound contributors. Reads, including media-kind probes, lease
  their rendition until finished; if all four are leased, another URL
  waits. The least recently used idle rendition is disposed to make room,
  and revisiting it can reopen it. Each retained rendition caches up to six
  half-second windows per channel, with at most 32 pictures per picture
  window (768 cached picture entries across four renditions).
  Separately, the reader caches up to `round(project fps × 0.25) + 8`
  prepared-frame entries (23 at 60 fps), each with at most two picture
  references and two sound contributions. It admits at most that many
  unfinished preparations at a time, so partially decoded frames cannot
  accumulate behind a slow read. Queued preparations do not hold decoded
  samples. Closing the reader disposes its inputs, drops cached results,
  and prevents queued or late reads from publishing results. These are
  cache and concurrency limits, not measurements of browser heap or of
  media already handed to the compositor or Web Audio.

## `CutList` boundary

The published [`@saebyn/glowing-telegram-types@0.14.0`](https://registry.npmjs.org/@saebyn%2fglowing-telegram-types/0.14.0)
defines schema version `"1.0.0"`:

| Field | What the schema carries |
| --- | --- |
| `inputMedia` | Media identified by the host's opaque render source reference (`s3Location`), with source-frame sections and exclusive out points |
| `outputTrack` | A nonempty ordered list of references into those sections, with optional `fade` or `cut` transitions at section edges |
| `overlayTracks` | Media-section references with an explicit start frame, `alpha` or `colorkey` type, and optional X/Y position |
| `audioMixing` | Optional channel routing and volume keyframes; no controls planned in the first slice |

The main output track has no explicit placement starts or general track stack,
so `CutList` is a compiled result, not the editable sequence. The current
compiler flattens straight cuts to the upper active placement; it does not
resolve picture and sound independently. That limitation does not define
Preview behavior. At matching frame rates, if lower placement A covers
sequence `[0, 100)` using source
`[100, 200)`, and upper placement B covers sequence `[40, 60)` using source
`[500, 520)`, emit A `[100, 140)`, B `[500, 520)`, then A `[160, 200)`.
Express authored entry and reveal fades using `transitionIn` and
`transitionOut`, respectively, on the corresponding output section edges
when the schema can carry them. Final export stops at the emitted `CutList`:
verify section order, source-frame ranges, and transition fields and durations.
Downstream renderer behavior and rendered-media verification are outside this
project's scope.

The compiler ends output at the latest exclusive placement end. It requires
matching source and project rates; it does not round mixed-rate cuts.
Intersecting entry and reveal regions within a placement, uncovered leading or
internal gaps, and empty sequences produce no `CutList`.
The transition model's black fallback is a desired output behavior, not a
capability of the current compiler. If the format cannot represent an
active dissolve, keep the authored edit, report export as unavailable,
and report an issue instead of approximating. See the
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
visible fade can still block compilation, even if its
anchoring edge is covered.

Compilation collects independent issues, including the inclusive start and
exclusive end of each sequence gap and IDs for affected placements or
transitions. If a missing clip prevents the compiler from resolving the layout,
it does not infer gaps from the placements it could resolve. The default editor
explains issues for the working sequence without emitting edit callbacks.
It can seek to the first reported gap or select an affected placement for
inspection, including on locked tracks. Neither changes the sequence or history.

## Storybook editing setups

Keep the two default-page workflows as the baseline, not one story per
gesture. Both should offer the same interactions wherever they apply,
including playhead controls.

| Setup | What to explore |
| --- | --- |
| **Assemble a rough cut** | Fill a gap on a single track, extend the sequence with a clip-pool drop or trailing trim, then shorten the last placement without leaving a trailing gap. Adjust trims and entry/reveal transitions from both the timeline and the Inspector. |
| **Rearrange a layered edit** | Select placements across tracks, preserve their spacing, see an invalid drop, then move the group past the current sequence end. Pan before zero and beyond the edit, and return with Fit to view. |

The stories supply an initial snapshot and can expose notifications in
Storybook’s Actions panel without feeding snapshots back. Check that a proposed
move previews the final destination without emitting edits, a blocked drop
changes nothing, and a valid extending drop emits one sequence change and one
`CutList` result. Verify that panning doesn't seek, that a placement cannot be
moved before zero, and that a shortening edit parks an over-end playhead
until the next playhead action. Keep focused compiler tests for source
ranges, ordered sections, track priority and source alignment, and fade
type and duration without creating a separate story for each case.

Keep a composition example that wraps a default slot component and
replaces the Timeline on `SequenceEditorPage`, and one that calls
`useSequenceEditor` directly and rearranges public components without the
default page. Across those examples, verify through the public interfaces
that seeking emits no edit, a valid edit uses the same commit and Undo flow as
the defaults, and blocked or cancelled edits emit nothing. Also exercise local
edit, Undo, and Redo without a listener, a host rerender with a different
`initialSequence` under the same key, and a new key reopening that snapshot
with empty history. Verify that two actions before a rerender build on each
other and deliver both notification pairs in order, without save feedback.
In a retained-action example, change another track while the rename draft is
open and check that submitting preserves that edit and still targets the
original track. A custom Preview slot can display the transport snapshot
to verify that it receives the same sequence playhead as the Timeline
without a player.
**Resize a transition** uses a replacement Timeline to preview and resize both
Fade and Dissolve by ID without depending on the default pointer adapter.

The source review and range export workflow stays separate. These editing
stories verify authoring and callback output. The separate Preview stories
exercise browser playback without validating downstream rendered media.

Follow-up design can settle mixed-rate cuts.
