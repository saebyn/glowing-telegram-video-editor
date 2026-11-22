# Sequence editor design

Build a React editor for describing a multi-track edit and compiling it to
`CutList` from `@saebyn/glowing-telegram-types`. Start with the component tree in
Storybook, then wire and test one editing action at a time. The host application
owns persistent state. The library provides the model, editing UI, and compiler;
it does not save projects or render video in this first phase.

## Component tree

```text
SequenceEditor                         controlled by the host
├─ EditToolbar                         split, undo (stub initially)
├─ Workspace
│  ├─ ProjectClipPool                  reuse the existing clip browser
│  ├─ PreviewPane                      placeholder, no player
│  └─ SelectionInspector               placement or transition fields
└─ SequenceTimeline                    our component; speaks sequence frames
   └─ Timeline                         @keplar-404/react-timeline-editor
      ├─ Shared ruler and playhead
      └─ Rows
         └─ Custom items               placements and transition regions
```

Use **one widget instance** for the whole sequence, so tracks share a time scale,
scroll position, and playhead. `SequenceTimeline` projects tracks and timed
items onto widget rows and actions, supplying the item visuals through
`getActionRender`. A transition may use a separate visual row for clarity
without creating an authored track. Convert sequence frames to widget seconds
and convert events such as seeking back to frames at this boundary.

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
- **Sequence duration:** The sequence has its own duration at the project
  frame rate. Moving the last placement earlier can leave a trailing gap;
  the sequence endpoint does not move with it. Moving a placement beyond
  the endpoint requires a separate duration change first. A group move
  preserves the placements' relative positions; if any destination overlaps
  an unselected placement on the same track, none of the group moves.
- **Track overlap:** Ordinary audiovisual placements can overlap across
  tracks, not within a track. Where they overlap, the upper active placement
  supplies picture and sound. When it ends, the placement underneath resumes
  at the source position corresponding to the current sequence frame; it
  does not resume from where it was covered. Future track roles may combine
  picture or sound from lower to higher tracks. Explicit overlay tracks are
  a possible follow-up, not part of the first pass; more flexible compositing
  would need a future `CutList` format.
- **Transitions:** Entry and reveal transitions belong to a placement's
  leading and trailing edges and move with that placement. Both regions fit
  inside the placement: entry starts at its leading edge and reveal ends at
  its trailing edge. Neither changes sequence duration or moves a cut. The
  surrounding sequence determines what the placement transitions from or
  reveals; neither transition stores the identity of another placement.
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
`onCutListChange(cutList: CutList | null)`. For example, a move proposes a
placement ID, destination track, and sequence frame. The editing operation
computes the next sequence; the host receives it and feeds it back as a prop.
The compiler is independent of React and takes that same next sequence, not
the widget data. An edit still reaches the host when it cannot be compiled;
emit `null` so the host does not mistake the previous `CutList` for the
current one. Selecting, seeking, or dragging without committing an edit
emits neither callback. Loading or replacing the sequence through props
does not emit `onCutListChange`.

Expose the compiler as a utility, but do not require hosts to call it as part
of normal editor integration. The editor handles compilation for its edits.

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
when the schema can carry them. Verifying how a downstream renderer
interprets those fields is out of scope.

The first compiler slice requires matching source and project rates; it does
not round mixed-rate cuts.
Do not silently remove uncovered gaps or other edits the compiler cannot
represent. An empty sequence has no `CutList`.

## Storybook-first sequence

1. **Visual shell.** Use the real timeline widget with drag disabled and local
   fixture data: multiple tracks, two uses of one clip, and a visible
   transition region. Reuse the clip pool and clip cards. Stub the preview,
   inspector, and unfinished toolbar actions.
2. **First edit end to end.** Drag a clip from `ProjectClipPool` and drop it
   into an existing gap on a single track without changing sequence duration.
   The story acts as the host: it feeds the updated sequence back into the
   editor and shows the emitted `CutList` JSON. Assert independently expected
   source ranges and ordered section references through the top-level callback.
3. **Ordinary overlap.** Add the straight-cut compiler test above to prove
   track priority and source alignment when an upper placement ends.
4. **Transitions.** Wire an inspector control and assert the emitted fade
   type and duration at the corresponding output section edge before investing
   in the full set of timeline gestures.

The existing source review and range export workflow stays separate. The
existing [`VideoPreview`](../VideoPreview.md) plays a host-rendered HLS stream
and is not part of this tree. A future live preview will render from source HLS
streams in a different component. The first stories verify authoring and
callback output, not decoded picture or sound.

Follow-up design can settle mixed-rate cuts, what happens when a trim makes
the transition regions intersect, and the details of split and undo. None of
these is required for the visual shell or the first drag-and-drop test.
