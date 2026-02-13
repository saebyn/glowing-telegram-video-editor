# Glowing Telegram Video Editor

A React TypeScript component library for reviewing and editing video highlights, moments requiring attention, and transcription errors. Provides synchronized video/audio playback while reviewing AI-generated information.

This is part of the larger glowing-telegram tool: https://github.com/saebyn/glowing-telegram

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

Don't forget to import the CSS file in your application:

```javascript
import '@saebyn/glowing-telegram-video-editor/styles.css';
```

## Available Components

The library exports the following components:

- **`VideoSelectionPage`** - Main page component for video review and clip selection
- **`VideoPreview`** - Preview component for rendering videos with audio mixing
- **`ProjectClipPool`** - Pool of available clips that can be added to a timeline
- **`ProjectClipTimeline`** - Interactive timeline for arranging and editing clips
- **`ProjectClipPreview`** - Visual preview of individual video clips with thumbnails
- **`AudioChannelNameEditor`** - Inline editor for audio channel names

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
- Export selected clips for rendering
- Keyboard shortcuts for playback control

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
}
```

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

**Props:**

```typescript
interface ProjectClipPreviewProps {
  id: string;
  thumbnailUrl: string;
  keyframeUrls: string[];              // URLs for hover animation
  title?: string;
  durationSeconds: number;
  width: string;
  height: string;
  onTitleUpdate?: (id: string, newTitle: string) => void;
  showCheckbox?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
}
```

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

## TypeScript Types

The library exports all TypeScript types for use in your application:

```typescript
import type {
  VideoMetadata,
  VideoClip,
  Section,
  AudioChannel,
  PreviewSettings,
  WaveformData,
  TranscriptSegment,
  ChatMessage
} from '@saebyn/glowing-telegram-video-editor';
```

### Key Types

**VideoMetadata**: Parsed video metadata for the frontend
- `title`: Video title
- `video_url`: HLS stream URL
- `length`: Video duration in milliseconds
- `highlights`, `attentions`, `transcription_errors`, `silences`: Arrays of `Section`
- `chat_history`: Array of `ChatMessage`
- `transcript`: Array of `TranscriptSegment`

**VideoClip**: A selection within a video
- `id`: Unique identifier
- `start`: Start time in milliseconds
- `end`: End time in milliseconds
- `keyframeSrc`: Optional thumbnail URL

**AudioChannel**: Audio channel configuration
- `id`: Channel identifier
- `name`: Display name
- `level`: Audio level (0.0 to 1.0)
- `muted`: Whether channel is muted

## Overview

The Glowing Telegram Video Editor is a web-based Single Page Application (SPA) designed to review and edit video highlights, moments that require additional attention, and possible transcription errors, and select clips for rendering. This application aims to provide an intuitive interface for vetting and correcting data to feed into an automated pipeline that posts edited stream VODs to YouTube.

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

## Development

This project uses modern web development tools:

- [Vite](https://vitejs.dev) - Build tool and dev server
- [React](https://reactjs.org) - UI framework (v19)
- [TypeScript](https://www.typescriptlang.org) - Type safety
- [Vitest](https://vitest.dev) - Unit testing
- [Testing Library](https://testing-library.com) - Component testing
- [Tailwind CSS](https://tailwindcss.com) - Styling (v4)
- [Biome](https://biomejs.dev) - Linting and formatting
- [Storybook](https://storybook.js.org) - Component development
- [HLS.js](https://github.com/video-dev/hls.js) - Video streaming

### Getting Started

Clone the repository and install dependencies:

```bash
git clone https://github.com/saebyn/glowing-telegram-video-editor.git
cd glowing-telegram-video-editor
npm install
```

### Development Commands

**Start development mode** (rebuild on changes):
```bash
npm run dev
```

**Run Storybook** (component development):
```bash
npm run storybook
```

Visit http://localhost:6006 to view components in isolation.

**Type checking**:
```bash
npm run typecheck
```

**Linting**:
```bash
npm run lint
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

Visit http://localhost:51204/__vitest__/ to interact with tests.

### Project Structure

```
src/
├── components/
│   ├── atoms/         # Basic UI elements (buttons, inputs, etc.)
│   ├── molecules/     # Composite components (video player, dialogs, etc.)
│   ├── organisms/     # Complex components (timeline, sidebar, etc.)
│   └── pages/         # Full page components
├── context/           # React context providers
├── hooks/             # Custom React hooks
├── types.ts           # TypeScript type definitions
├── utils/             # Utility functions
└── index.ts           # Main library entry point
```

## License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.
