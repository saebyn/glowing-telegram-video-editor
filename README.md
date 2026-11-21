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
- **Audio Mixing**: Multi-channel audio control with per-channel muting and level adjustment
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

> **Note:** The library bundles `material-symbols/outlined.css` (Material Symbols icon font) as a side effect of importing styles. This affects network requests for the icon font files.

## Available Components

The library exports the following components:

- **`VideoSelectionPage`** - Main page component for video review and clip selection
- **`ProjectProvider`** - Supplies the project frame rate to sequence components without taking ownership of the edit
- **`VideoPreview`** - Preview component for rendering videos with audio mixing
- **`ProjectClipPool`** - Pool of available clips that can be added to a timeline
- **`ProjectClipTimeline`** - Interactive timeline for arranging and editing clips
- **`ProjectClipPreview`** - Visual preview of individual video clips with thumbnails
- **`AudioChannelNameEditor`** - Inline editor for audio channel names
- **`WaveformDisplay`** - Canvas-based waveform visualization with seek support

## Frame-based editing (breaking change)

- Pass integer frame positions and counts, not milliseconds or seconds. Frame zero is the start; clip in points are inclusive and out points are exclusive.
- A `FrameRate` is `{ numerator, denominator }`: use `{ numerator: 60, denominator: 1 }` for 60 fps or `{ numerator: 30_000, denominator: 1001 }` for NTSC 29.97 fps.
- `VideoSelectionPage` always uses the source metadata's rate, even inside a `ProjectProvider`. Its export contains native source ranges.
- Wrap `ProjectClipPool`, `ProjectClipTimeline`, `ProjectClipPreview`, and `VideoPreview` in a `ProjectProvider`. They use its rate for sequence positions and durations. If you change the provider's rate, supply frame values for the new grid.
- Use `layoutSequence(clips, frameRate)` to hand the same gapless layout to your renderer that the timeline uses. A nonempty clip gets the nearest output frame count (ties round up), with a minimum of one. At equal rates this is exactly `sourceOutFrame - sourceInFrame`. At 30 fps, 15 source frames at 60 fps occupy 8 sequence frames without changing either source cut.

`framesToSeconds` and `secondsToFrame` are available for adapters. HLS playback uses browser seeks and is not guaranteed to display the exact requested frame.

## Component Usage

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
- Timeline with color-coded markers for highlights, attentions, and transcription errors
- Live transcript and chat history display
- Shift-click a source timeline marker to add its range to the clip selection
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

### VideoPreview

Component for previewing a host-rendered HLS stream with an audio mixer and a sequence timeline.

**Props:**

```typescript
interface VideoPreviewProps {
  settings: PreviewSettings;           // Preview configuration
  previewVideoUrl: string;             // HLS stream URL
  playheadFrame?: number;              // Initial sequence playhead
  durationFrames: number;              // Length of the rendered stream in project frames
  onSettingsChange?: (settings: PreviewSettings) => void;
  onRegenerate?: (settings: PreviewSettings) => void;
  onSave?: (settings: PreviewSettings) => void;
  regenerating?: boolean;
  saving?: boolean;
}
```

**Example:**

```jsx
import { useState } from 'react';
import { layoutSequence, ProjectProvider, VideoPreview } from '@saebyn/glowing-telegram-video-editor';

const frameRate = { numerator: 30, denominator: 1 };
const source = { sourceId: 'stream', sourceFrameRate: { numerator: 60, denominator: 1 } };

function PreviewPage() {
  const [settings, setSettings] = useState({
    cutlist: [
      { ...source, id: '1', sourceInFrame: 0, sourceOutFrame: 1800 },
      { ...source, id: '2', sourceInFrame: 3600, sourceOutFrame: 7200 }
    ],
    audioChannels: [
      { id: 'ch1', name: 'Game Audio', level: 0.8, muted: false },
      { id: 'ch2', name: 'Microphone', level: 0.6, muted: false }
    ],
    waveformData: []
  });

  // The host's preview URL refers to a render of this sequence at frameRate.
  const { durationFrames } = layoutSequence(settings.cutlist, frameRate);
  return (
    <ProjectProvider frameRate={frameRate}>
      <VideoPreview
        settings={settings}
        previewVideoUrl="https://example.com/preview.m3u8"
        durationFrames={durationFrames}
        onSettingsChange={setSettings}
        onRegenerate={(settings) => console.log('Regenerate with:', settings)}
        onSave={(settings) => console.log('Save:', settings)}
      />
    </ProjectProvider>
  );
}
```

See [VideoPreview.md](VideoPreview.md) for the renderer handoff.
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

### ProjectClipTimeline

Interactive timeline for arranging clips in sequence with drag-and-drop reordering and trimming.

**Props:**

```typescript
interface ProjectClipTimelineProps {
  clips: VideoClip[];                    // Clips on the timeline
  thumbnails: Record<string, string>;
  keyframes: Record<string, string[]>;
  titles: Record<string, string>;
  playheadFrame?: number;
  height?: string;
  onClipsReorder?: (clips: VideoClip[]) => void;
  onClipRemove?: (clipId: string) => void;
  onTitleUpdate?: (clipId: string, newTitle: string) => void;
  onSeek?: (sequenceFrame: number) => void;
  onClipsAdd?: (clipIds: string[], insertionIndex: number) => void;
  onClipTrim?: (clipId: string, sourceInFrame: number, sourceOutFrame: number) => void;
  renderTransition?: (leftClipId: string, rightClipId: string) => React.ReactNode;
}
```

> `renderTransition` is called between each adjacent pair of clips and lets you render a custom transition indicator on the timeline.

The duration is derived from the ordered `clips`; there is no separate duration prop. Supply a distinct `id` for each timeline entry. Arrow keys on a trim handle adjust the native cut by one source frame; mouse trims snap a sequence offset before converting it to a native source offset.

**Example:**

```jsx
import { useState } from 'react';
import { ProjectClipTimeline, ProjectProvider } from '@saebyn/glowing-telegram-video-editor';

const frameRate = { numerator: 60, denominator: 1 };
const source = { sourceId: 'stream', sourceFrameRate: frameRate };

function Timeline() {
  const [clips, setClips] = useState([
    { ...source, id: 'clip1', sourceInFrame: 0, sourceOutFrame: 1800 },
    { ...source, id: 'clip2', sourceInFrame: 1800, sourceOutFrame: 3600 }
  ]);

  return (
    <ProjectProvider frameRate={frameRate}>
      <ProjectClipTimeline
        clips={clips}
        thumbnails={{}}
        keyframes={{}}
        titles={{}}
        onClipsReorder={setClips}
        onClipRemove={(id) => setClips(current => current.filter(c => c.id !== id))}
        onClipTrim={(id, sourceInFrame, sourceOutFrame) => {
          setClips(current => current.map(c => c.id === id ? { ...c, sourceInFrame, sourceOutFrame } : c));
        }}
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

## Development

### Getting Started

Clone the repository and install dependencies:

```bash
git clone https://github.com/saebyn/glowing-telegram-video-editor.git
cd glowing-telegram-video-editor
npm install
```

### Development Commands

**Watch build**:
```bash
npm run dev
```

**Run Storybook** (component development):
```bash
npm run storybook
```

Visit http://localhost:6006 to view components in isolation.

**Build Storybook** (static output):
```bash
npm run build-storybook
```

**Type checking**:
```bash
npm run typecheck
```

**Linting**:
```bash
npm run lint
```

**Auto-fix lint issues**:
```bash
npm run lint:fix
```

**Format code**:
```bash
npm run format
```

### Building

Build the library for production:

```bash
npm run build
```

This creates ES module output in `dist/` with TypeScript declarations.

### Testing

Run unit tests:

```bash
npm run test
```

Interactive test UI:

```bash
npm run test:ui
```

The Vitest UI server will print its URL (port is assigned dynamically).

### Project Structure

```
src/
├── app.tsx            # Dev harness entry point (renders VideoSelectionPage against local data)
├── data.json          # Sample data used by the dev harness
├── index.ts           # Main library entry point
├── index.css          # Base stylesheet
├── custom-only.css    # Custom-only stylesheet (no Tailwind utilities)
├── assets/            # Static assets
├── components/
│   ├── atoms/         # Basic UI elements (buttons, inputs, etc.)
│   ├── molecules/     # Composite components (video player, dialogs, etc.)
│   ├── organisms/     # Complex components (timeline, sidebar, etc.)
│   └── pages/         # Full page components
├── context/           # React context providers
├── hooks/             # Custom React hooks
├── types.ts           # TypeScript type definitions
└── utils/             # Utility functions
```

## License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.
