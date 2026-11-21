# Video Preview Component

`VideoPreview` plays a host-rendered HLS stream and displays audio waveforms on the project frame grid. The Selected Clips row shows each range at its original elapsed time in its source, rather than showing placements in the rendered edit. `ProjectProvider` supplies the project frame rate; it does not own the settings or render the video.

## Basic Usage

```tsx
import { useState } from 'react';
import { ProjectProvider, VideoPreview } from '@saebyn/glowing-telegram-video-editor';
import type { PreviewSettings } from '@saebyn/glowing-telegram-video-editor';

const frameRate = { numerator: 30, denominator: 1 };
const source = { sourceId: 'stream-a', sourceFrameRate: { numerator: 60, denominator: 1 } };
const durationFrames = 120 * 30; // Two-minute preview supplied by the host.

// Example preview settings
const settings: PreviewSettings = {
  cutlist: [
    { ...source, id: '1', sourceInFrame: 600, sourceOutFrame: 1800 },
    { ...source, id: '2', sourceInFrame: 2700, sourceOutFrame: 4500 },
  ],
  audioChannels: [
    { id: '1', name: 'Main Audio', level: 0.8, muted: false },
    { id: '2', name: 'Background Music', level: 0.3, muted: false },
  ],
  waveformData: [
    {
      channelId: '1',
      amplitudes: [/* amplitude data */],
      durationFrames,
      sampleRate: 44100,
    },
  ],
};

function MyVideoPreview() {
  const [previewSettings, setPreviewSettings] = useState(settings);

  const handleRegenerate = (newSettings: PreviewSettings) => {
    // Send the cutlist and audio settings to the host renderer.
    console.log('Regenerating preview with:', newSettings);
  };

  const handleSave = (newSettings: PreviewSettings) => {
    // Save audio settings to backend
    console.log('Saving settings:', newSettings);
  };

  return (
    <ProjectProvider frameRate={frameRate}>
      <VideoPreview
        settings={previewSettings}
        previewVideoUrl="https://example.com/preview.m3u8"
        durationFrames={durationFrames}
        onSettingsChange={setPreviewSettings}
        onRegenerate={handleRegenerate}
        onSave={handleSave}
      />
    </ProjectProvider>
  );
}
```

## Features

- **HLS Video Playback**: Uses existing VideoPlayer component with HLS.js support
- **Audio Mixer**: Configurable audio levels and mute controls for each channel
- **Waveform Timeline**: Visual representation of audio with clickable seeking
- **Cutlist Visualization**: Shows selected clips on the timeline
- **Real-time Updates**: Changes to audio settings are reflected immediately
- **Keyboard Accessibility**: Waveform supports keyboard navigation

## Component Architecture

The VideoPreview component follows the atomic design pattern:

### Atoms
- `AudioLevelSlider`: Individual volume control slider
- `AudioChannelControl`: Complete control for a single audio channel
- `WaveformDisplay`: Canvas-based waveform visualization

### Molecules  
- `AudioMixerPanel`: Panel containing all audio channel controls
- `PreviewTimeline`: Timeline with waveforms and cutlist visualization

### Organisms
- `VideoPreview`: Complete preview interface composing all subcomponents

## Types

```tsx
interface AudioChannel {
  id: string;
  name: string;
  level: number; // 0.0 to 1.0
  muted: boolean;
}

interface WaveformData {
  channelId: string;
  amplitudes: number[];
  durationFrames: number; // project frames, measured from sequence frame zero
  sampleRate: number; // audio sample rate in Hz
}

interface PreviewSettings {
  cutlist: VideoClip[];
  audioChannels: AudioChannel[];
  waveformData: WaveformData[];
}
```

## Backend Integration

To render the gapless edit shown in `ProjectClipTimeline`, use `layoutSequence(cutlist, frameRate)` with the same rate as `ProjectProvider`. It returns `frameRate`, total `durationFrames`, and an ordered list of `placements`. Each placement has a `sequenceStartFrame`, a `durationFrames` count at the project rate, and the original `clip`, including its `sourceId`, `sourceFrameRate`, and inclusive in/exclusive out points. Render that source range into the assigned frame count; do not derive a new source out point from the rounded duration.

Each nonempty clip gets the nearest project frame count (ties round up), with a minimum of one frame. For example, a 15-frame range from a 60 fps source occupies 8 frames in a 30 fps project, without changing either native cut.

When the HLS preview is ready, supply its URL, `durationFrames`, and waveforms for that render. The optional `playheadFrame` and waveform seeks are sequence positions, not native source positions. Browser seeks translate frames to seconds; HLS playback is not a guarantee that the exact requested frame is decoded or displayed.

## Accessibility

- Keyboard navigation support for waveform seeking (arrow keys)
- Proper ARIA labels and roles
- Screen reader compatible controls
- Focus management for interactive elements
