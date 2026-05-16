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
- **`VideoPreview`** - Preview component for rendering videos with audio mixing
- **`ProjectClipPool`** - Pool of available clips that can be added to a timeline
- **`ProjectClipTimeline`** - Interactive timeline for arranging and editing clips
- **`ProjectClipPreview`** - Visual preview of individual video clips with thumbnails
- **`AudioChannelNameEditor`** - Inline editor for audio channel names
- **`WaveformDisplay`** - Canvas-based waveform visualization with seek support

All TypeScript types are also exported for use in your application.

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
    title: "My Gaming Stream",
    video_url: "https://example.com/video.m3u8",
    length: 3600000, // 1 hour in milliseconds
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
- Click-to-add clip selection from timeline
- "Clip Silences" button — automatically selects clips from gaps in silence data
- Export selected clips for rendering
- Keyboard shortcuts for playback control (see table below)

**Keyboard Shortcuts:**

| Key | Action |
|-----|--------|
| `1` | Seek to beginning (0:00) |
| `Space` | Toggle play/pause |
| `ArrowLeft` | Seek back 250ms |
| `ArrowRight` | Seek forward 250ms |
| `Shift+ArrowLeft` | Seek back 1000ms |
| `Shift+ArrowRight` | Seek forward 1000ms |

### VideoPreview

Component for previewing rendered videos with audio mixing controls and timeline editing.

**Props:**

```typescript
interface VideoPreviewProps {
  settings: PreviewSettings;           // Preview configuration
  previewVideoUrl: string;             // HLS stream URL
  playheadPosition?: number;           // Current playhead in ms
  duration: number;                    // Total duration in ms
  onSettingsChange?: (settings: PreviewSettings) => void;
  onRegenerate?: (settings: PreviewSettings) => void;
  onSave?: (settings: PreviewSettings) => void;
  regenerating?: boolean;
  saving?: boolean;
}
```

**Example:**

```jsx
import { VideoPreview } from '@saebyn/glowing-telegram-video-editor';

function PreviewPage() {
  const [settings, setSettings] = useState({
    cutlist: [
      { id: '1', start: 0, end: 30000 },
      { id: '2', start: 60000, end: 120000 }
    ],
    audioChannels: [
      { id: 'ch1', name: 'Game Audio', level: 0.8, muted: false },
      { id: 'ch2', name: 'Microphone', level: 0.6, muted: false }
    ],
    waveformData: []
  });

  return (
    <VideoPreview
      settings={settings}
      previewVideoUrl="https://example.com/preview.m3u8"
      duration={180000}
      onSettingsChange={setSettings}
      onRegenerate={(settings) => console.log('Regenerate with:', settings)}
      onSave={(settings) => console.log('Save:', settings)}
    />
  );
}
```

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
import { ProjectClipPool } from '@saebyn/glowing-telegram-video-editor';

function ClipManager() {
  const clips = [
    { id: 'clip1', start: 0, end: 30000 },
    { id: 'clip2', start: 60000, end: 90000 }
  ];

  const thumbnails = {
    'clip1': 'https://example.com/thumb1.jpg',
    'clip2': 'https://example.com/thumb2.jpg'
  };

  return (
    <ProjectClipPool
      clips={clips}
      thumbnails={thumbnails}
      keyframes={{}}
      titles={{ 'clip1': 'Introduction', 'clip2': 'Highlights' }}
      showCheckboxes={true}
      onClipSelect={(id, selected) => console.log(`Clip ${id} ${selected ? 'selected' : 'deselected'}`)}
    />
  );
}
```

### ProjectClipTimeline

Interactive timeline for arranging clips in sequence with drag-and-drop reordering and trimming.

**Props:**

```typescript
interface ProjectClipTimelineProps {
  clips: VideoClip[];                    // Clips on the timeline
  duration: number;                      // Total timeline duration in ms
  thumbnails: Record<string, string>;
  keyframes: Record<string, string[]>;
  titles: Record<string, string>;
  playheadPosition?: number;
  height?: string;
  onClipsReorder?: (clips: VideoClip[]) => void;
  onClipRemove?: (clipId: string) => void;
  onTitleUpdate?: (clipId: string, newTitle: string) => void;
  onSeek?: (milliseconds: number) => void;
  onClipsAdd?: (clipIds: string[], position: number) => void;
  onClipTrim?: (clipId: string, newStart: number, newEnd: number) => void;
  renderTransition?: (leftClipId: string, rightClipId: string) => React.ReactNode;
}
```

> `renderTransition` is called between each adjacent pair of clips and lets you render a custom transition indicator on the timeline.

**Example:**

```jsx
import { ProjectClipTimeline } from '@saebyn/glowing-telegram-video-editor';

function Timeline() {
  const [clips, setClips] = useState([
    { id: 'clip1', start: 0, end: 30000 },
    { id: 'clip2', start: 30000, end: 60000 }
  ]);

  return (
    <ProjectClipTimeline
      clips={clips}
      duration={180000}
      thumbnails={{}}
      keyframes={{}}
      titles={{}}
      onClipsReorder={setClips}
      onClipRemove={(id) => setClips(clips.filter(c => c.id !== id))}
      onClipTrim={(id, start, end) => {
        setClips(clips.map(c => c.id === id ? { ...c, start, end } : c));
      }}
    />
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
  durationSeconds: number;
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
import { ProjectClipPreview } from '@saebyn/glowing-telegram-video-editor';

function ClipCard() {
  return (
    <ProjectClipPreview
      id="clip1"
      thumbnailUrl="https://example.com/thumb.jpg"
      keyframeUrls={[]}
      title="Epic Moment"
      durationSeconds={45}
      width="200px"
      height="150px"
      showCheckbox={false}
    />
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
  playheadPosition?: number;           // Current playhead in ms
  color?: string;                      // Waveform color, default: "#3b82f6"
  playheadColor?: string;              // Playhead color, default: "#ef4444"
  onSeek?: (milliseconds: number) => void;
}
```

When `onSeek` is provided, the component is focusable and supports keyboard navigation: `ArrowLeft`/`ArrowRight` seek by 5% of the total duration.

## TypeScript Types

The library exports all TypeScript types for use in your application:

```typescript
import type {
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
- `title`: Video title
- `video_url`: HLS stream URL
- `length`: Video duration in **milliseconds** (`number`)
- `highlights`, `attentions`, `transcription_errors`, `silences`: Arrays of `Section`
- `chat_history`: Array of `ChatMessage`
- `transcript`: Array of `TranscriptSegment`

**`RawVideoMetadata`**: Raw video metadata as received from the API. Fields differ from `VideoMetadata`:
- `length` is an ISO 8601 duration **string** (not milliseconds)
- Sections are `RawSection[]`, chat is `RawChatMessage[]`, transcript is `RawTranscriptSegment[]`

Convert `RawVideoMetadata` to `VideoMetadata` before passing data to components.

**`Section`**: A time range within a video.
- `timestamp`: Start time in **milliseconds** (not `start`)
- `timestamp_end?`: End time in **milliseconds** (not `end`), optional
- `category?`, `description?`, `reasoning?`: Optional metadata

**`VideoClip`**: A selected clip within a video.
- `id`: Unique identifier
- `start`: Start time in milliseconds
- `end`: End time in milliseconds
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
