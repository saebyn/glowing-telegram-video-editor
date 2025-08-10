# Video Preview Component

The VideoPreview component provides a complete interface for previewing rendered video with audio mixing capabilities.

## Basic Usage

```tsx
import { VideoPreview } from '@saebyn/glowing-telegram-video-editor';
import type { PreviewSettings } from '@saebyn/glowing-telegram-video-editor';

// Example preview settings
const settings: PreviewSettings = {
  cutlist: [
    { id: '1', start: 10000, end: 30000 },
    { id: '2', start: 45000, end: 75000 },
  ],
  audioChannels: [
    { id: '1', name: 'Main Audio', level: 0.8, muted: false },
    { id: '2', name: 'Background Music', level: 0.3, muted: false },
  ],
  waveformData: [
    {
      channelId: '1',
      amplitudes: [/* amplitude data */],
      duration: 120000,
      sampleRate: 44100,
    },
  ],
};

function MyVideoPreview() {
  const [previewSettings, setPreviewSettings] = useState(settings);

  const handleRegenerate = (newSettings: PreviewSettings) => {
    // Send settings to backend to regenerate preview
    console.log('Regenerating preview with:', newSettings);
  };

  const handleSave = (newSettings: PreviewSettings) => {
    // Save audio settings to backend
    console.log('Saving settings:', newSettings);
  };

  return (
    <VideoPreview
      settings={previewSettings}
      previewVideoUrl="https://example.com/preview.m3u8"
      duration={120000}
      onSettingsChange={setPreviewSettings}
      onRegenerate={handleRegenerate}
      onSave={handleSave}
    />
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
  duration: number;
  sampleRate: number;
}

interface PreviewSettings {
  cutlist: VideoClip[];
  audioChannels: AudioChannel[];
  waveformData: WaveformData[];
}
```

## Backend Integration

The component is designed to work with a backend that can:

1. **Generate Preview Videos**: When `onRegenerate` is called, send the cutlist and audio settings to generate an HLS preview
2. **Provide Waveform Data**: Extract audio waveform data for visualization
3. **Detect Audio Channels**: Analyze source video to determine available audio channels
4. **Save Settings**: Persist audio mixing settings for final render

## Accessibility

- Keyboard navigation support for waveform seeking (arrow keys)
- Proper ARIA labels and roles
- Screen reader compatible controls
- Focus management for interactive elements