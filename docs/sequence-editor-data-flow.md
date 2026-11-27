# Sequence editor data flow

The first two diagrams describe the agreed session ownership design, which
replaces the current controlled sequence flow when implemented. See the
[sequence editor design](sequence-editor-design.md) for the contract and
[branch review follow-ups](../.scratch/sequence-editor/TRIAGE.md#branch-review-follow-ups)
for outstanding work.

## What flows where

```mermaid
flowchart LR
    Host["Host: initial snapshot and persistence"]
    Clips["Host: clips and project frame rate"]
    Sources["Host: sources keyed by source ID"]
    Geometry["Placement geometry: effective source ranges, track positions, duration"]
    Session["Editor session: working sequence, history, selection, playhead"]
    UI["Built-in or host-provided UI: gestures and drafts"]
    Presentation["Presentation: source times and visible picture / sound"]
    Decoder["Preview reader: playlist, decode, readiness"]
    Compiler["CutList compiler: flattened output and export issues"]

    Host -->|Initial sequence at mount| Session
    Clips --> Geometry
    Session -->|Working sequence| Geometry
    Geometry --> Session
    Session -->|Slot props| UI
    UI -->|Named edit intent| Session
    Session -->|Optional committed snapshot| Host
    Session -->|Playhead and play intent| Presentation
    Geometry --> Presentation
    Sources -->|Media kind| Presentation
    Presentation -->|Requested contributions| Decoder
    Sources -->|Preview HLS URL| Decoder
    Decoder -->|Readiness for current frame| Session
    Geometry --> Compiler
    Sources -->|Opaque render source reference| Compiler
    Compiler -->|Optional result for the committed snapshot| Host
```

The arrows describe responsibilities, not required shared functions. The
compiler and Preview can reach different conclusions about the same valid edit:
a gap or dissolve can be previewable even when the output format cannot express
it. The Inspector describes the authored edit and its resolved contributions,
not whether the whole sequence can export. Neither Preview nor authoring
should use compiler success as a prerequisite for valid placement geometry.

`VideoClip.sourceId` selects a source record; it isn't a render reference.
`previewHlsUrl` tells the browser where to fetch Preview media. `s3Location`
is the current field for the opaque reference passed to the renderer; the
host decides what its value means. The compiler should preserve any supplied
string, including `""`, and report a missing value instead of substituting
the source ID or the Preview URL. The
[render reference ticket](../.scratch/sequence-editor/issues/91-require-a-render-source-reference.md)
tracks the missing-value case without renaming the field.

## From UI intent to a committed edit

```mermaid
sequenceDiagram
    participant Host
    participant Session as Editor session
    participant UI as Toolbar or custom UI
    Host->>Session: Mount with initialSequence
    Session->>UI: Supply data and actions
    Note over UI: Open rename dialog for track A
    Note over Session: Another edit commits while the dialog is open
    UI->>Session: renameTrack(A, label)
    Session->>Session: Look up A in the current working sequence
    alt Missing track or unchanged label
        Note over Session: No history step or edit notification
    else Valid change
        Session->>Session: Commit next sequence and update history
        opt Sequence listener supplied
            Session-->>Host: onSequenceChange(nextSequence)
        end
        opt Compiler listener supplied
            Session-->>Host: onCutListResult for nextSequence
        end
    end
```

- The host can save a snapshot immediately, later, or not at all. The session
  keeps editing without save feedback. A rerender is not a reload; changing
  the React key mounts a new session and clears editor state.
- Release revalidates a gesture against current state, even if its preview
  was valid. Invalid inputs to the current sequence have a separate diagnostic
  callback. An invalid action or history target produces no edit notification.
  A valid edit with an export issue still notifies both listeners if supplied.
- Undo and Redo restore sequence snapshots, not clips or sources. Refuse an
  invalid history target without consuming it. See the
  [history policy](sequence-editor-design.md#action-intent-and-history).

### From a gesture to a host-accepted edit

In the current controlled implementation, actions propose a new sequence and
the host echoes the exact object to advance history. The closed
[retained Timeline actions ticket](../.scratch/sequence-editor/issues/83-revalidate-remaining-timeline-actions.md)
describes revalidation when a host replacement lands during a gesture.
In the agreed design, an intervening local edit exercises the same rule.

## From the playhead to decoded media

```mermaid
sequenceDiagram
    participant Transport
    participant Reader as Preview reader
    participant Presentation
    participant HLS as HLS fetch and decode
    Transport->>Reader: Request current sequence frame and direction
    alt Current path with all slots occupied
        Reader->>Reader: Wait for a preparation slot
        Reader-->>Transport: Loading, even if the new frame is a gap
    else Intended path for a new seek
        Reader->>Presentation: Resolve what the frame needs
        Presentation-->>Reader: Contributions at source times, gap, or diagnostic
        alt No contributions required
            Reader-->>Transport: Ready with black picture and silence
        else Undefined transition
            Reader-->>Transport: Failed with a transition diagnostic
        else Current frame requires media
            Reader->>HLS: Prioritize required source samples over obsolete work
            HLS-->>Reader: Samples or a failure affecting the requested interval
            Reader-->>Transport: Readiness for the current frame only
        end
    end
```

Presentation resolves *what* to play; the reader fetches and decodes it. The
session still owns *when* to advance. The
[seek scheduling ticket](../.scratch/sequence-editor/issues/92-prioritize-the-current-preview-seek.md)
tracks queue behavior without changing the cache budget or the session clock.
The target host supplies a direct HLS media playlist for each playback
rendition. A [multivariant playlist](../GLOSSARY.md#language) lists alternative
streams rather than media segments; choosing among those streams is
[out of scope](../.scratch/sequence-editor/issues/93-clarify-hls-variant-contributions.md).
