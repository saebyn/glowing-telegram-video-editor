import type {
  AudioChannel,
  PreviewSettings,
  VideoClip,
  WaveformData,
} from "@/types";
import { action } from "@storybook/addon-actions";
import VideoPreview from "./VideoPreview";

export default {
  title: "Organisms/VideoPreview",
  component: VideoPreview,
  tags: ["organisms"],
  decorators: [
    (story: () => React.ReactNode) => (
      <div className="h-screen w-screen">{story()}</div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
};

// Generate sample waveform data
const generateWaveformData = (
  channelId: string,
  samples = 400,
): WaveformData => {
  const amplitudes: number[] = [];
  for (let i = 0; i < samples; i++) {
    let amplitude = 0;
    if (channelId === "channel-1") {
      amplitude =
        Math.sin((i / samples) * Math.PI * 6) * 0.6 +
        Math.sin((i / samples) * Math.PI * 12) * 0.3;
    } else if (channelId === "channel-2") {
      amplitude =
        Math.sin((i / samples) * Math.PI * 3) * 0.4 +
        (Math.random() - 0.5) * 0.2;
    } else {
      amplitude = Math.sin((i / samples) * Math.PI * 4) * 0.5;
    }
    amplitudes.push(Math.abs(amplitude));
  }
  return {
    channelId,
    amplitudes,
    duration: 180000, // 3 minutes
    sampleRate: 44100,
  };
};

const mockAudioChannels: AudioChannel[] = [
  {
    id: "channel-1",
    name: "Game Audio",
    level: 0.8,
    muted: false,
  },
  {
    id: "channel-2",
    name: "Microphone",
    level: 0.6,
    muted: false,
  },
  {
    id: "channel-3",
    name: "Desktop Audio",
    level: 0.4,
    muted: true,
  },
];

const mockWaveformData: WaveformData[] = [
  generateWaveformData("channel-1"),
  generateWaveformData("channel-2"),
  generateWaveformData("channel-3"),
];

const mockCutlist: VideoClip[] = [
  {
    id: "clip-1",
    start: 10000, // 10 seconds
    end: 45000, // 45 seconds
  },
  {
    id: "clip-2",
    start: 60000, // 1 minute
    end: 120000, // 2 minutes
  },
  {
    id: "clip-3",
    start: 140000, // 2:20
    end: 170000, // 2:50
  },
];

const mockPreviewSettings: PreviewSettings = {
  cutlist: mockCutlist,
  audioChannels: mockAudioChannels,
  waveformData: mockWaveformData,
};

export const Default = {
  args: {
    settings: mockPreviewSettings,
    previewVideoUrl:
      "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    playheadPosition: 30000, // 30 seconds
    duration: 180000, // 3 minutes
    onSettingsChange: action("onSettingsChange"),
    onRegenerate: action("onRegenerate"),
    onSave: action("onSave"),
    regenerating: false,
    saving: false,
  },
};

export const Regenerating = {
  args: {
    settings: mockPreviewSettings,
    previewVideoUrl:
      "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    playheadPosition: 60000,
    duration: 180000,
    onSettingsChange: action("onSettingsChange"),
    onRegenerate: action("onRegenerate"),
    onSave: action("onSave"),
    regenerating: true,
    saving: false,
  },
};

export const Saving = {
  args: {
    settings: mockPreviewSettings,
    previewVideoUrl:
      "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    playheadPosition: 90000,
    duration: 180000,
    onSettingsChange: action("onSettingsChange"),
    onRegenerate: action("onRegenerate"),
    onSave: action("onSave"),
    regenerating: false,
    saving: true,
  },
};

export const SingleChannel = {
  args: {
    settings: {
      ...mockPreviewSettings,
      audioChannels: [mockAudioChannels[0]],
      waveformData: [mockWaveformData[0]],
    },
    previewVideoUrl:
      "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    playheadPosition: 45000,
    duration: 180000,
    onSettingsChange: action("onSettingsChange"),
    onRegenerate: action("onRegenerate"),
    onSave: action("onSave"),
    regenerating: false,
    saving: false,
  },
};

export const EmptyCutlist = {
  args: {
    settings: {
      ...mockPreviewSettings,
      cutlist: [],
    },
    previewVideoUrl:
      "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    playheadPosition: 0,
    duration: 180000,
    onSettingsChange: action("onSettingsChange"),
    onRegenerate: action("onRegenerate"),
    onSave: action("onSave"),
    regenerating: false,
    saving: false,
  },
};

export const AllMuted = {
  args: {
    settings: {
      ...mockPreviewSettings,
      audioChannels: mockAudioChannels.map((channel) => ({
        ...channel,
        muted: true,
      })),
    },
    previewVideoUrl:
      "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    playheadPosition: 75000,
    duration: 180000,
    onSettingsChange: action("onSettingsChange"),
    onRegenerate: action("onRegenerate"),
    onSave: action("onSave"),
    regenerating: false,
    saving: false,
  },
};
