import { action } from "storybook/actions";
import { sampleFrameRate, sampleSource, withSampleProject } from "@/fixtures/video";
import type { VideoClip, WaveformData } from "@/types";
import { secondsToFrame } from "@/utils/frames";
import PreviewTimeline from "./PreviewTimeline";

const durationFrames = secondsToFrame(2 * 60, sampleFrameRate);

export default {
  title: "Molecules/PreviewTimeline",
  component: PreviewTimeline,
  tags: ["molecules"],
  decorators: [
    withSampleProject,
    (story: () => React.ReactNode) => (
      <div className="h-[70vh] flex justify-center items-start p-4 overflow-x-auto">{story()}</div>
    ),
  ],
};

// Generate sample waveform data
const generateWaveformData = (channelId: string, samples = 400): WaveformData => {
  const amplitudes: number[] = [];
  for (let i = 0; i < samples; i++) {
    // Generate different patterns for different channels
    let amplitude = 0;
    if (channelId === "channel-1") {
      // Game audio - more complex waveform
      amplitude =
        Math.sin((i / samples) * Math.PI * 6) * 0.6 + Math.sin((i / samples) * Math.PI * 12) * 0.3;
    } else if (channelId === "channel-2") {
      // Microphone - speech-like pattern
      // Use deterministic pseudo-noise based on position instead of Math.random()
      amplitude =
        Math.sin((i / samples) * Math.PI * 3) * 0.4 +
        Math.sin((i / samples) * Math.PI * 23.5) * 0.2;
    } else {
      // Desktop audio - more uniform
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

const mockWaveformData: WaveformData[] = [
  generateWaveformData("channel-1"),
  generateWaveformData("channel-2"),
  generateWaveformData("channel-3"),
];

const mockCutlist: VideoClip[] = [
  {
    id: "clip-1",
    ...sampleSource,
    sourceInFrame: 300,
    sourceOutFrame: 1500,
  },
  {
    id: "clip-2",
    ...sampleSource,
    sourceInFrame: 2400,
    sourceOutFrame: 4200,
  },
  {
    id: "clip-3",
    ...sampleSource,
    sourceInFrame: 5400,
    sourceOutFrame: 6600,
  },
];

export const Default = {
  args: {
    waveformData: mockWaveformData,
    playheadFrame: 1800, // 30 seconds
    cutlist: mockCutlist,
    durationFrames,
    width: 800,
    waveformHeight: 60,
    onSeek: action("onSeek"),
  },
};

export const SingleChannel = {
  args: {
    waveformData: [mockWaveformData[0]],
    playheadFrame: 900,
    cutlist: mockCutlist,
    durationFrames,
    width: 800,
    waveformHeight: 80,
    onSeek: action("onSeek"),
  },
};

export const LongTimeline = {
  args: {
    waveformData: mockWaveformData,
    playheadFrame: secondsToFrame(3 * 60, sampleFrameRate),
    cutlist: [
      ...mockCutlist,
      {
        id: "clip-4",
        ...sampleSource,
        sourceInFrame: 9000,
        sourceOutFrame: 12_600,
      },
      {
        id: "clip-5",
        ...sampleSource,
        sourceInFrame: 14_400,
        sourceOutFrame: 16_800,
      },
    ],
    durationFrames: secondsToFrame(5 * 60, sampleFrameRate),
    width: 1200,
    waveformHeight: 50,
    onSeek: action("onSeek"),
  },
};

export const EmptyCutlist = {
  args: {
    waveformData: mockWaveformData,
    playheadFrame: 2700,
    cutlist: [],
    durationFrames,
    width: 800,
    waveformHeight: 60,
    onSeek: action("onSeek"),
  },
};

export const ReadOnly = {
  args: {
    waveformData: mockWaveformData,
    playheadFrame: 3600,
    cutlist: mockCutlist,
    durationFrames,
    width: 800,
    waveformHeight: 60,
    // No callbacks provided - should be read-only
  },
};

export const CompactView = {
  args: {
    waveformData: mockWaveformData,
    playheadFrame: 1800,
    cutlist: mockCutlist,
    durationFrames,
    width: 600,
    waveformHeight: 40,
    onSeek: action("onSeek"),
  },
};
