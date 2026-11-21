import { action } from "storybook/actions";
import { sampleFrameRate, sampleSource, withSampleProject } from "@/fixtures/video";
import type { AudioChannel, PreviewSettings, VideoClip, WaveformData } from "@/types";
import { secondsToFrame } from "@/utils/frames";
import VideoPreview from "./VideoPreview";

const durationFrames = secondsToFrame(3 * 60, sampleFrameRate);

export default {
  title: "Organisms/VideoPreview",
  component: VideoPreview,
  tags: ["organisms"],
  decorators: [
    withSampleProject,
    (story: () => React.ReactNode) => <div className="h-screen w-screen">{story()}</div>,
  ],
  parameters: {
    layout: "fullscreen",
  },
};

// Generate sample waveform data
const generateWaveformData = (channelId: string, samples = 400): WaveformData => {
  const amplitudes: number[] = [];
  for (let i = 0; i < samples; i++) {
    let amplitude = 0;
    if (channelId === "channel-1") {
      amplitude =
        Math.sin((i / samples) * Math.PI * 6) * 0.6 + Math.sin((i / samples) * Math.PI * 12) * 0.3;
    } else if (channelId === "channel-2") {
      // Use deterministic pseudo-noise based on position instead of Math.random()
      amplitude =
        Math.sin((i / samples) * Math.PI * 3) * 0.4 +
        Math.sin((i / samples) * Math.PI * 23.5) * 0.2;
    } else {
      amplitude = Math.sin((i / samples) * Math.PI * 4) * 0.5;
    }
    amplitudes.push(Math.abs(amplitude));
  }
  return {
    channelId,
    amplitudes,
    durationFrames,
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

const mockCutlist: VideoClip[] = [
  {
    id: "clip-1",
    ...sampleSource,
    sourceInFrame: 600,
    sourceOutFrame: 2700,
  },
  {
    id: "clip-2",
    ...sampleSource,
    sourceInFrame: 3600,
    sourceOutFrame: 7200,
  },
  {
    id: "clip-3",
    ...sampleSource,
    sourceInFrame: 8400,
    sourceOutFrame: 10_200,
  },
];

const mockWaveformData = mockAudioChannels.map(({ id }) => generateWaveformData(id));

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
    playheadFrame: 1800, // 30 seconds
    durationFrames,
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
    playheadFrame: 3600,
    durationFrames,
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
    playheadFrame: 5400,
    durationFrames,
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
    playheadFrame: 2700,
    durationFrames,
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
    playheadFrame: 0,
    durationFrames,
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
    playheadFrame: 4500,
    durationFrames,
    onSettingsChange: action("onSettingsChange"),
    onRegenerate: action("onRegenerate"),
    onSave: action("onSave"),
    regenerating: false,
    saving: false,
  },
};
