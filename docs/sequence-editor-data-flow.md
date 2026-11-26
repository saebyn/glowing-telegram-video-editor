# Sequence editor data flow

This guide shows which inputs each part of the editor owns and where the
[review follow-ups](../.scratch/sequence-editor/TRIAGE.md#branch-review-follow-ups)
would change the current flow. See the [sequence editor design](sequence-editor-design.md)
for the behavior contract.

## What flows where

```mermaid
flowchart LR
    Host["Host: accepted sequence, clips, project frame rate"]
    Sources["Host: sources keyed by source ID"]
    Geometry["Placement geometry: effective source ranges, track positions, duration"]
    Session["Editor session: selection, playhead, history"]
    Timeline["Timeline: viewport, pointer gestures, drafts"]
    Presentation["Presentation: source times and visible picture / sound"]
    Decoder["Preview reader: playlist, decode, readiness"]
    Compiler["CutList compiler: flattened output and export issues"]

    Host --> Geometry
    Geometry --> Session
    Session -->|Slot props| Timeline
    Timeline -->|Frame-based intent| Session
    Session -->|Edit proposal| Host
    Session -->|Playhead and play intent| Presentation
    Geometry --> Presentation
    Sources -->|Media kind| Presentation
    Presentation -->|Requested contributions| Decoder
    Sources -->|Preview HLS URL| Decoder
    Decoder -->|Readiness for current frame| Session
    Geometry --> Compiler
    Sources -->|Opaque render source reference| Compiler
    Compiler -->|Result for the proposed sequence| Host
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

## From a gesture to a host-accepted edit

```mermaid
sequenceDiagram
    participant Host
    participant Session as Editor session
    participant Timeline
    Host->>Session: Supply sequence A and current clip/source inputs
    Session->>Timeline: Supply actions and data for A
    Note over Timeline: Gesture starts and retains a callback from A
    Host->>Session: Supply sequence B (for example, lock the destination)
    alt Current stale callback path
        Timeline->>Session: Release through callback captured at A
        Session-->>Host: Propose A plus the edit, losing the lock in B if accepted
    else Intended path, already used by Move and Trim
        Timeline->>Session: Release or click with IDs and frame positions
        Session->>Session: Check the action against B and current inputs
        alt Invalid or cancelled
            Note over Session: No proposal or compilation callback
        else Valid proposal C, based on B
            Session-->>Host: onSequenceChange(C) and onCutListResult for C
            opt Host accepts C
                Host->>Session: Feed back the exact C object
                Note over Session: Acknowledge C and update history
            end
        end
    end
```

- A callback or drag draft is not a copy of the host's persistent state. See
  [retained Timeline actions](../.scratch/sequence-editor/issues/83-revalidate-remaining-timeline-actions.md).
- Invalid authored inputs are reported to the host. An invalid **candidate**
  (for example, a pool drop beyond the source end) should be rejected before an
  edit proposal. A valid edit with an export issue still produces both callbacks.
- Undo and Redo currently store accepted **sequence** snapshots, not clip or
  source snapshots. If the host removes a clip, a history target that references
  it may no longer be valid. The
  [history ticket](../.scratch/sequence-editor/issues/87-define-history-after-clip-changes.md)
  leaves the history policy open; it should not silently restore a dangling
  placement or take ownership of changing the host's clip pool.

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
