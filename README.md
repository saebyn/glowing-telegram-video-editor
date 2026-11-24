# Glowing Telegram Video Editor

## Overview

A React TypeScript component library for reviewing and editing video highlights, moments requiring attention, and transcription errors. Provides synchronized video/audio playback while reviewing AI-generated information.

This is part of the larger glowing-telegram tool: https://github.com/saebyn/glowing-telegram. This aims to provide an intuitive interface for vetting and correcting data to feed into an automated pipeline that posts edited stream VODs to YouTube.

### Goals

- Enable users to review, edit, and manage video highlights, attentions, and transcription errors efficiently
- Provide synchronized video/audio playback while reviewing AI-generated information
- Integrate seamlessly into the larger glowing-telegram tool ecosystem
- Ensure usability on various screen sizes, with a primary focus on desktop use

### Key Features

- **Video Review and Clip Selection**: Browse AI-generated highlights, attentions, and transcription errors with synchronized video playback
- **Interactive Timeline**: Color-coded markers for different event types with zoom/pan functionality
- **Clip Management**: Select, reorder, and trim video clips with drag-and-drop interface
- **Standalone Audio Controls**: Inline audio channel renaming and waveform visualization with optional seeking
- **Live Transcript**: Real-time transcript and chat history display synchronized with video playback
- **Keyboard Shortcuts**: Efficient navigation with keyboard controls for playback and seeking
- **HLS Video Support**: Built-in support for HLS streaming with HLS.js

### Design Decisions

- **Component-Based Architecture**: Modular design following atomic design principles (atoms, molecules, organisms, pages)
- **TypeScript First**: Full TypeScript support with exported types for all components
- **Integrated Workflow**: Designed to integrate directly into larger applications
- **Responsive Layout**: Primarily desktop-focused but adaptable to various screen sizes


## Installation

Install the package via npm:

```bash
npm install @saebyn/glowing-telegram-video-editor
```

Or via yarn:

```bash
yarn add @saebyn/glowing-telegram-video-editor
```

### Peer Dependencies

This library requires React 19.x as a peer dependency:

```bash
npm install react react-dom
```

### Importing Styles

Import the full CSS bundle (includes Tailwind utilities and custom styles):

```javascript
import '@saebyn/glowing-telegram-video-editor/styles.css';
```

If you manage Tailwind yourself and only need the custom (non-utility) styles:

```javascript
import '@saebyn/glowing-telegram-video-editor/custom-only.css';
```

Both stylesheets include the source timeline styles and `material-symbols/outlined.css` (Material Symbols icon font).

## Available Components

The library exports the following components:

- **`VideoSelectionPage`** - Main page component for video review and clip selection
- **`ProjectProvider`** - Supplies the project frame rate to sequence components without taking ownership of the edit
- **`ProjectClipPool`** - Pool of available clips that can be added to a timeline
- **`SequenceEditorPage`** - Controlled editor for explicit clip placements, with `CutList` output
- **`ProjectClipPreview`** - Visual preview of individual video clips with thumbnails
- **`AudioChannelNameEditor`** - Inline editor for audio channel names
- **`WaveformDisplay`** - Canvas-based waveform visualization with seek support

## Component Usage

Pass positions and durations as whole frames. Positions are zero-based. Source review uses the source’s native frame rate. Wrap `SequenceEditorPage`, `useSequenceEditor` consumers, `ProjectClipPool`, and `ProjectClipPreview` in a `ProjectProvider` to supply the project frame rate. If that rate changes, pass sequence positions and durations at the new rate.

### SequenceEditorPage

The host supplies `sequence`, `clips`, and one `SequenceSource` record per source ID.
Each record includes its render `s3Location`. Before mounting the editor, supply
`previewHlsUrl` for `video-only`, `audio-video`, and sources with no declared
`mediaKind`. An explicitly `audio-only` source does not require a preview URL;
its streaming contract is not defined yet. The HLS playback rendition can use
a different resolution or encoding, but it must contain the same content at
time zero and at every elapsed time as the render source. The library does not
derive the URL from `s3Location`.

On an edit, feed `onSequenceChange` back into `sequence`. `onCutListResult` receives the
compilation result for that same edit. Check `result.ok` before reading `result.cutList`.
Both branches have an `issues` list: it can be empty on success and is nonempty on failure.
A compilation failure does not reject the edit. Loading a sequence does not emit a
compilation result. To keep Undo history, feed the same sequence object
received by `onSequenceChange` back into `sequence` when accepting an edit. Passing a
different sequence object is an independent host replacement and clears history.
The default editor explains why output is unavailable and lets you jump to the
first reported gap or inspect a placement with a source issue, without editing
the sequence.

Hosts can also call `compileCutList(sequence, clips, sources, frameRate)` directly
with a readonly list of `CutListSource` records (`id` and `s3Location` only).
Full `SequenceSource` records work too; preview metadata does not affect the
`CutList`. The compiler describes the edit; final rendering is outside the
library’s scope.

The page has five typed `slots`: `toolbar`, `clipPool`, `preview`, `inspector`, and
`timeline`. Unspecified slots use the defaults; `null` omits a slot and its pane
toggle. The default `SequencePreview` currently shows transport state without
playing media. Sequence media playback is planned for this component; hosts
won’t need to supply a custom preview to use it. You can wrap any default by
forwarding its props:

```tsx
import {
  PlacementProperties,
  SequenceEditorPage,
  SequenceInspector,
  type SequenceInspectorProps,
} from "@saebyn/glowing-telegram-video-editor";

function CustomInspector({ inspection }: SequenceInspectorProps) {
  return (
    <aside>
      <p>Project notes</p>
      {inspection.kind === "placement" && inspection.selection.length === 1
        ? <PlacementProperties {...inspection.properties} />
        : <SequenceInspector inspection={inspection} />}
    </aside>
  );
}

<SequenceEditorPage
  sequence={sequence}
  clips={clips}
  sources={sources}
  onSequenceChange={setSequence}
  slots={{ inspector: CustomInspector, preview: null }}
/>;
```

For a custom layout, call `useSequenceEditor` once and give the exported
components their corresponding props (`toolbarProps`, `clipPoolProps`,
`previewProps`, `inspectorProps`, and `timelineProps`). `SequenceWorkspace`
accepts rendered pane nodes. Render `notices` where appropriate and bind
`handleEditorKeyDown` on a focusable editor root to opt in to shortcuts.

Click a placement to select it, Shift-click to toggle it in the selection, or click empty
track space to clear the selection. Drag a placement to preview its exact destination.
Dragging a selected placement moves the selection together, or none of it if any
destination is blocked. A valid move can grow the sequence but never shortens it.
Use **Delete** to remove the selected placements in one edit. It leaves gaps in place
without shortening the sequence or removing tracks or reusable clips from the pool.
Use **Split** to divide all placements that strictly span the playhead when
their source and project rates match. Use **Split mode** to cut only the placement
under the pointer without seeking or changing the selection. Escape exits the mode.
Use **Sequence endpoint** to remove uncovered time at the end without cutting any placement.
**Undo** and **Redo** navigate accepted edits.
**Rename track** edits a track’s display name without changing its placements or order.
**Add track** creates an empty top track. Remove is offered only for an empty track
when another track remains. A sequence can start with no tracks.
Drag a track's reorder grip to change its output priority. **Lock** protects the
track's placements from edits without changing their output or preventing inspection,
renaming, or reordering.
Drag a clip from the pool to preview where it would land. Drop it onto an existing track
to fill a gap or extend the sequence.

The **Inspector** shows one selected placement’s effective source in/out and
sequence start/end in **Placement Properties**. With multiple placements selected,
use **Inspect placement** to switch which placement the fields show and edit without
changing the selection. At matching frame rates, drag
either placement edge to trim it in place, or enter a precise trailing trim in the
Inspector’s **Source out** field. Trim handles remain available after
adding fades: fades stay attached to their edges at the same duration, even if the
trim makes them overlap or leaves a placement shorter than its fade. A valid trailing
trim can grow the sequence but never shortens it. In Placement Properties, use
**Add transition** on an empty edge to add an entry or reveal fade of half a
second (rounded to sequence frames and capped at the placement's duration).
Use **Inspect transition** on an occupied edge or click its timeline indicator
to see **Transition Properties**. Choose **Fade** or **Centered dissolve**
and enter the duration in sequence frames; **Apply** submits both together.
**Remove transition** clears that edge and returns to Placement Properties
once the host accepts the edit. On the timeline, transition indicators cover
the top of the track at their actual time span. Click or drag the strip below
to select or move the placement. Separate timeline grips adjust authored
fades; there are no grips on empty edges or dissolves. Use the owning edge in
**Placement Properties** to inspect a short or obscured transition.
Hosts store transitions on placements as
`entryTransition` or `revealTransition`, with `{ id, kind, durationFrames }`.
Split keeps each transition's ID and duration at its original edge, even if that split
makes it unrepresentable in the `CutList`.
The compiler gives the upper active placement precedence and omits fully covered fades.
If an authored fade crosses a visible cut or overlaps another visible fade on
its placement, the editor keeps the edit and explains why the `CutList` is unavailable.
For a centered dissolve, the timeline shows its centered
window and Transition Properties shows the contributing footage
beyond each placement trim. An active dissolve is retained and reported as a
compilation issue; the published format cannot carry its timing and contributions.

Supply `frameThumbnails: [{ sourceFrame, url }]` on a source to show the same
collection in clip pool hover previews and timeline strips. Use zero-based frames
at the source’s native rate. The pool shows the frames in the reusable clip’s range,
in source order, or keeps its static thumbnail when none qualify. The timeline uses
the placement’s effective range, including trims beyond the reusable clip’s bounds.
Both ranges include the in point and exclude the out point. Thumbnails do not
affect compilation.
Optional source `mediaKind` values (`video-only`, `audio-only`, `audio-video`) label
clips in the pool and on the timeline. Omit `mediaKind` for a neutral appearance.

Drag the workspace separators to resize panes. Use the toolbar toggles to hide or show
the pool, Preview, Inspector, or timeline. These changes are session-only.

Click the ruler or drag the playhead to seek. Forward, reverse, and pause work even while
the media preview is disconnected. Transport and selection do not emit edits.
The timeline’s **Zoom in**, **Zoom out**, **Fit sequence**, and **Pan timeline** controls
change the view without changing the edit or seeking.
With focus in the editor (outside text and number fields), Left and Right Arrow step the
playhead one sequence frame. The `[` and `]` keys nudge selected placements earlier or later.

In Storybook, try **Assemble a rough cut** for single-track edits and **Rearrange a layered edit**
for cross-track moves and deletion.

### VideoSelectionPage

The main component for reviewing video content with AI-generated highlights, attentions, and transcription errors. Provides synchronized playback, timeline visualization, and clip selection.

**Props:**

```typescript
interface VideoSelectionPageProps {
  content: VideoMetadata;     // Video metadata including highlights, attentions, etc.
  onExport?: (clips: VideoClip[]) => void;  // Callback when clips are exported
}
```

**Example:**

```jsx
import { VideoSelectionPage } from '@saebyn/glowing-telegram-video-editor';
import '@saebyn/glowing-telegram-video-editor/styles.css';

function App() {
  const videoData = {
    sourceId: "my-stream",
    frameRate: { numerator: 60, denominator: 1 },
    title: "My Gaming Stream",
    video_url: "https://example.com/video.m3u8",
    durationFrames: 216_000, // 1 hour at 60 fps
    highlights: [],
    attentions: [],
    transcription_errors: [],
    silences: [],
    chat_history: [],
    transcript: []
  };

  const handleExport = (clips) => {
    console.log('Exporting clips:', clips);
    // Send clips to your backend
  };

  return (
    <VideoSelectionPage 
      content={videoData}
      onExport={handleExport}
    />
  );
}
```

**Features:**
- Synchronized video player with HLS support
- Source timeline with labeled lanes for highlights, attention flags, silence, transcription errors, and chat activity
- Scroll or use the zoom controls to zoom; drag a lane to pan, or choose **Fit full source** to reset
- Live transcript and chat history display
- Shift-click a source timeline marker to add its range to the clip selection
- **Follow playback** scrolls the chat and transcript logs, not the source timeline
- "Clip Silences" button — automatically selects clips from gaps in silence data
- Export selected clips for rendering
- Keyboard shortcuts for playback control (see table below)

**Keyboard Shortcuts:**

| Key | Action |
|-----|--------|
| `1` | Seek to beginning (0:00) |
| `Space` | Toggle play/pause |
| `ArrowLeft` | Seek back one source frame |
| `ArrowRight` | Seek forward one source frame |
| `Shift+ArrowLeft` | Seek back about one second on the source grid |
| `Shift+ArrowRight` | Seek forward about one second on the source grid |

### ProjectClipPool

A pool of available video clips that can be dragged to a timeline.

**Props:**

```typescript
interface ProjectClipPoolProps {
  clips: VideoClip[];                    // Available clips
  thumbnails: Record<string, string>;    // Thumbnail URLs by clip ID
  keyframes: Record<string, string[]>;   // Keyframe URLs for hover animation
  titles: Record<string, string>;        // Custom titles by clip ID
  clipWidth?: string;                    // Width of each clip preview
  clipHeight?: string;                   // Height of each clip preview
  onClipSelect?: (clipId: string, selected: boolean) => void;
  onTitleUpdate?: (clipId: string, newTitle: string) => void;
  onDragStart?: (clipIds: string[]) => void;
  showCheckboxes?: boolean;
}
```

**Example:**

```jsx
import { ProjectClipPool, ProjectProvider } from '@saebyn/glowing-telegram-video-editor';

function ClipManager() {
  const frameRate = { numerator: 60, denominator: 1 };
  const source = { sourceId: 'stream', sourceFrameRate: frameRate };
  const clips = [
    { ...source, id: 'clip1', sourceInFrame: 0, sourceOutFrame: 1800 },
    { ...source, id: 'clip2', sourceInFrame: 3600, sourceOutFrame: 5400 }
  ];

  const thumbnails = {
    'clip1': 'https://example.com/thumb1.jpg',
    'clip2': 'https://example.com/thumb2.jpg'
  };

  return (
    <ProjectProvider frameRate={frameRate}>
      <ProjectClipPool
        clips={clips}
        thumbnails={thumbnails}
        keyframes={{}}
        titles={{ 'clip1': 'Introduction', 'clip2': 'Highlights' }}
        showCheckboxes
        onClipSelect={(id, selected) => console.log(id, selected)}
      />
    </ProjectProvider>
  );
}
```

### ProjectClipPreview

Visual preview component for individual video clips with thumbnail and duration display.

The `onSelect` prop and `showCheckbox` use a discriminated union — `onSelect` is required when `showCheckbox: true` and unavailable otherwise.

**Props:**

```typescript
type ProjectClipPreviewProps = {
  id: string;
  thumbnailUrl: string;
  keyframeUrls: string[];              // URLs for hover animation
  title?: string;
  durationFrames: number;              // Clip length in project frames
  width: string;
  height: string;
  onTitleUpdate?: (id: string, newTitle: string) => void;
  forceShowOverlay?: boolean;          // Force the overlay to be visible
} & (
  | { showCheckbox: true; onSelect: (id: string, selected: boolean) => void }
  | { showCheckbox?: false }
)
```

> **Note:** Title editing is triggered via `window.prompt()` (a native browser dialog), not inline editing.

**Example:**

```jsx
import { ProjectClipPreview, ProjectProvider } from '@saebyn/glowing-telegram-video-editor';

function ClipCard() {
  return (
    <ProjectProvider frameRate={{ numerator: 60, denominator: 1 }}>
      <ProjectClipPreview
        id="clip1"
        thumbnailUrl="https://example.com/thumb.jpg"
        keyframeUrls={[]}
        title="Epic Moment"
        durationFrames={2700}
        width="200px"
        height="150px"
        showCheckbox={false}
      />
    </ProjectProvider>
  );
}
```

### AudioChannelNameEditor

Inline editable component for audio channel names with click-to-edit functionality.

**Props:**

```typescript
interface AudioChannelNameEditorProps {
  name: string;                        // Current channel name
  onNameChange: (name: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;                  // Default: 50
}
```

**Example:**

```jsx
import { AudioChannelNameEditor } from '@saebyn/glowing-telegram-video-editor';

function AudioChannelRow() {
  const [channelName, setChannelName] = useState('Game Audio');

  return (
    <AudioChannelNameEditor
      name={channelName}
      onNameChange={setChannelName}
      placeholder="Channel Name"
    />
  );
}
```

### WaveformDisplay

Canvas-based waveform visualization with an optional interactive playhead and keyboard navigation.

**Props:**

```typescript
interface WaveformDisplayProps {
  waveformData: WaveformData;
  width?: number;                      // Default: 400
  height?: number;                     // Default: 80
  playheadFrame?: number;              // Current sequence frame
  color?: string;                      // Waveform color, default: "#3b82f6"
  playheadColor?: string;              // Playhead color, default: "#ef4444"
  onSeek?: (sequenceFrame: number) => void;
}
```

When `onSeek` is provided, the component is focusable and supports keyboard navigation: `ArrowLeft`/`ArrowRight` move by about 5% of `waveformData.durationFrames`, snapped to whole frames with a minimum step of one. Standalone waveforms do not need a provider; they only use frame counts and positions, not elapsed-time labels.

## TypeScript Types

The library exports all TypeScript types for use in your application:

```typescript
import type {
  FrameRate,
  SequenceLayout,
  SequenceClipPlacement,
  VideoMetadata,
  RawVideoMetadata,
  VideoClip,
  Section,
  RawSection,
  AudioChannel,
  PreviewSettings,
  WaveformData,
  TranscriptSegment,
  RawTranscriptSegment,
  ChatMessage,
  RawChatMessage,
  LogEvent
} from '@saebyn/glowing-telegram-video-editor';
```

### Key Types

**`FrameRate`**: Frames per second as a ratio. Use `{ numerator: 60, denominator: 1 }` for 60 fps or `{ numerator: 30_000, denominator: 1001 }` for NTSC 29.97 fps.

**`VideoMetadata`**: Parsed video metadata for frontend components.
- `sourceId`: Host-defined identity of the source
- `frameRate`: Native source frame rate
- `title`: Video title
- `video_url`: HLS stream URL
- `durationFrames`: Number of native frames in the source
- `highlights`, `attentions`, `transcription_errors`, `silences`: Arrays of `Section`
- `chat_history`: Array of `ChatMessage`
- `transcript`: Array of `TranscriptSegment`

**`RawVideoMetadata`**: Raw video metadata as received from the API. Fields differ from `VideoMetadata`:
- `sourceId` and `frameRate` identify the source and its native grid, just as in `VideoMetadata`
- `length` and raw event timestamps are ISO 8601 duration strings
- Sections are `RawSection[]`, chat is `RawChatMessage[]`, transcript is `RawTranscriptSegment[]`

Use `parseContent(rawMetadata)` from the package to convert ISO durations to the nearest source frame before passing data to components.

**`Section`**: A native range or point event within a source.
- `sourceFrame`: Inclusive first frame. Chat and transcript events also use `sourceFrame`.
- `sourceOutFrame?`: Exclusive out point, omitted for point events
- `category?`, `description?`, `reasoning?`: Optional metadata

**`VideoClip`**: A selection within one source.
- `id`: Unique identifier
- `sourceId`, `sourceFrameRate`: Source identity and native rate
- `sourceInFrame`, `sourceOutFrame`: Inclusive in point and exclusive out point on the native grid
- `sourceDurationFrames?`: Native source length, if available, to limit out-point extensions
- `keyframeSrc?`: Optional thumbnail URL

**`AudioChannel`**: Audio channel configuration.
- `id`: Channel identifier
- `name`: Display name
- `level`: Audio level (`0.0` to `1.0`)
- `muted`: Whether channel is muted

## Upgrading from 0.5.x

When upgrading to 0.6.0, pass editor positions and durations as whole frames instead of milliseconds or seconds.

- **Removed components (breaking):** `ProjectClipTimeline` and `VideoPreview` are no longer exported. Use `SequenceEditorPage` to edit explicit clip placements. `SequencePreview` does not play a host-rendered HLS stream; provide that playback UI in the host. `AudioChannelNameEditor` and `WaveformDisplay` remain available independently.

- **Source review:** Supply `sourceId` and the native `frameRate` in the metadata. If you build `VideoMetadata` directly, replace `length` with `durationFrames` and parsed event timestamps with `sourceFrame` and, for ranges, `sourceOutFrame`. Raw ISO 8601 durations still work with `parseContent`.
- **Clips:** Replace `start` and `end` with `sourceInFrame` and `sourceOutFrame`. Include `sourceId` and `sourceFrameRate`, and keep these bounds at the source rate even when the project uses a different rate.
- **Sequence and waveforms:** Supply the project rate through `ProjectProvider` for the sequence editor. Replace waveform `playheadPosition` with `playheadFrame` and `waveformData.duration` with `waveformData.durationFrames`. `ProjectClipPreview` takes `durationFrames` instead of `durationSeconds`.

To migrate a whole-millisecond value, use `millisecondsToFrame(milliseconds, frameRate)` with the rate for that field. It rounds to the nearest frame, with ties toward the higher frame, like `parseContent`. For exact timestamps with sub-millisecond precision, retain the original ISO 8601 duration when using `parseContent`.

For an ordered, gapless edit, `layoutSequence(clips, frameRate)` returns the project rate, total `durationFrames`, and each placement's `sequenceStartFrame`, project `durationFrames`, and original clip. Preserve the original source in and out points rather than recalculating them from rounded project durations. For an explicit multi-track sequence, use `compileCutList` instead.

## Development

See the [development guide](docs/development.md) for setup, repository layout, commands, Storybook, packaging, and releases.

## License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.
