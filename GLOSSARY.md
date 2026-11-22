# Video review and editing

**Source review** is for inspecting source media and selecting ranges. **Sequence editing** is for arranging and trimming clip placements across tracks.

## Language

**Source**:
Media used for review or editing. A source with video has a native **source frame rate**.
_Avoid_: “Video” when it could also mean the preview or rendered output.

**Source frame**:
Zero-based frame index within a specific video source.
_Avoid_: Unqualified “frame” when both source and sequence positions are in play.

**Frame thumbnail**:
A still image representing a video source at a particular source frame. It need not come from a codec keyframe.

**Source range**:
The span within a source from the inclusive **in point** to the exclusive **out point**. Video in and out points are boundaries on the source frame grid.
_Avoid_: Unqualified “start” and “end” when they could mean placement in the sequence.

**Source annotation**:
A point or span marked for review within a source, such as a highlight or a transcription flag. It can suggest a clip but is not a clip selection.

**Clip**:
A reusable selection of audio, video, or both from one source range, independent of any sequence position. Audio-only clips have an expected duration without needing video frames, whether or not the source contains video.
_Avoid_: “Highlight” as a synonym. A highlight can suggest a clip, but it isn’t itself a selection.

**Clip pool**:
The collection of clips available to place in a sequence.

**Sequence**:
An edit assembled from clip placements across one or more tracks.
_Avoid_: “Timeline” for the edit itself.

**Sequence duration**:
The full length of the edit in sequence frames, including any uncovered frames. It can extend beyond the last placement.
_Avoid_: “Timeline duration” for the length of the edit.

**`CutList`**:
A render description derived from a sequence. It is distinct from the editable sequence and the rendered media.

**Track**:
A layer of a sequence that spans its full duration and may be empty or contain non-overlapping clip placements.
_Avoid_: “Audio channel” or “audio stream” for a sequence track.

**Clip placement**:
One use of a clip on a specific track at a specific sequence position. Its effective source range can extend beyond the clip’s in or out point, within the same source.
_Avoid_: Unqualified “clip” when referring to a particular placement rather than the reusable source selection.

**Placement selection**:
The clip placements currently selected in the editor, which may span tracks. It is not a saved group in the sequence.

**Group move**:
An edit that moves all placements in a selection together, preserving their relative sequence positions and track spacing. Either every selected placement moves or none does.

**Track overlap**:
Two or more placements on different tracks cover the same sequence frames. Overlap describes their positions, not whether they are combined in the output.
_Avoid_: “Playing simultaneously” when only placement positions are known.

**Clip trim** and **placement trim**:
A clip trim changes the reusable range for new placements without changing what existing placements play. A placement trim changes the effective source range of one placement without changing the reusable clip or other placements.

**Timeline**:
A time-based view of a source or sequence.

**Source timeline**:
A view of the positions and ranges within one source for review and clip selection.

**Sequence timeline**:
A view of a sequence’s tracks showing each clip placement’s position and duration in sequence time.

**Transition**:
A change from one presentation of picture or sound to another over a span of the sequence. A **transition indicator** marks it in the timeline; it is not the change itself.

**Entry transition**:
A transition toward a placement’s picture or sound, attached to its leading edge.

**Reveal transition**:
A transition from a placement’s picture or sound toward what would play without it, attached to its trailing edge.

**Host application**:
The application that uses the library and owns the persistent clips and sequences.

**Editor UI state**:
Transient state used to show or interact with the editor, such as a drag in progress. It is distinct from the clip and placement state owned by the host.

**Sequence frame**:
Zero-based position in the sequence, measured at the **project frame rate**.
_Avoid_: “Timeline frame”; a timeline can show either a source or a sequence.

**Playhead**:
The current position in a source or sequence. Qualify it as a **source playhead** or **sequence playhead** when both are in use.

**Frame count**:
A duration in frames at a specified rate. A **frame offset** is a signed displacement, not a position.
_Avoid_: “Frame count” for a frame position, or “offset” for a duration.

**Timecode**:
A display label that identifies a frame at a specified frame rate.
_Avoid_: “Timecode” for an elapsed-time label such as `01:30`, or for a stored frame position.

### Audio

**Monitoring**:
Listening to audio while reviewing or editing. Monitoring adjustments only affect what the editor hears.

**Output audio adjustment**:
An adjustment to the audio the sequence produces, rather than to monitoring.

**Source audio stream**:
One independently selectable audio signal or group of signals in a source, such as the main mix or commentary. A media container can hold multiple audio streams, each with its own channel layout.
_Avoid_: “Audio track” for a source stream when discussing a sequence.

**Audio channel**:
One signal within a stream’s channel layout, such as the left channel of a stereo stream.
_Avoid_: “Channel” for an entire stereo or surround stream.

**Channel layout**:
The number and roles of the channels in an audio stream. Mono has one channel, stereo has left and right, and 5.1 has five main channels plus a low-frequency effects channel.

**Audio routing**:
Where an audio stream or channel’s signal is sent. Routing a signal is distinct from placing a clip on a sequence track.
