# Video review and editing

The library’s main page today is for **source review and clip selection** (`VideoSelectionPage`). A separate **sequence editor** page is planned for arranging and trimming clips across tracks.

## Language

**Source**:
Original media used for review or editing. A **video source** has a native **source frame rate**; an audio-only source has no video frames.
_Avoid_: “Video” when it could also mean the preview or rendered output.

**Source frame**:
Zero-based frame index within a specific video source.
_Avoid_: Unqualified “frame” when both source and sequence positions are in play.

**Source range**:
The span within a source from the inclusive **in point** to the exclusive **out point**. For video, these points are expressed in source frames.
_Avoid_: Unqualified “start” and “end” when they could mean placement in the sequence.

**Clip**:
A selection from one source. Its source range says what to use, not where to place it.
_Avoid_: “Highlight” as a synonym. A highlight can suggest a clip, but it isn’t itself a selection.

**Clip pool**:
The collection of clips available to place in a sequence.

**Sequence**:
The assembled edit, laid out and rendered at the **project frame rate**.
_Avoid_: “Timeline” for the edit itself.

**Track**:
A lane in a sequence. Placements on different tracks can overlap in time. Use **sequence audio track** for a lane that carries audio.
_Avoid_: “Audio channel” or “audio stream” for a sequence track.

**Clip placement**:
One use of a clip on a specific track at a specific sequence position. The same clip can have multiple placements on the same track or across tracks.
_Avoid_: Unqualified “clip” when referring to a particular placement rather than the reusable source selection.

**Clip trim** and **placement trim**:
A clip trim changes the reusable clip’s source range. A placement trim changes the range used by one placement without changing the reusable clip or other placements.

**Timeline**:
A view that shows positions in a source or sequence. Use **source timeline** for review and **sequence timeline** for the assembled edit.

**Sequence frame**:
Zero-based position in the sequence, measured at the project frame rate.
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
