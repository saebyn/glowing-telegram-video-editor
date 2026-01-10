import { action } from "@storybook/addon-actions";
import type { VideoClip, WaveformData } from "@/types";
import PreviewTimeline from "./PreviewTimeline";

export default {
  title: "Molecules/PreviewTimeline",
  component: PreviewTimeline,
  tags: ["molecules"],
  decorators: [
    (story: () => React.ReactNode) => (
      <div className="h-[70vh] flex justify-center items-start p-4 overflow-x-auto">
        {story()}
      </div>
    ),
  ],
};

// Generate sample waveform data
const generateWaveformData = (
  channelId: string,
  samples = 400,
): WaveformData => {
  const amplitudes: number[] = [];
  for (let i = 0; i < samples; i++) {
    // Generate different patterns for different channels
    let amplitude = 0;
    if (channelId === "channel-1") {
      // Game audio - more complex waveform
      amplitude =
        Math.sin((i / samples) * Math.PI * 6) * 0.6 +
        Math.sin((i / samples) * Math.PI * 12) * 0.3;
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
    duration: 120000, // 2 minutes
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
    start: 5000, // 5 seconds
    end: 25000, // 25 seconds
  },
  {
    id: "clip-2",
    start: 40000, // 40 seconds
    end: 70000, // 70 seconds
  },
  {
    id: "clip-3",
    start: 90000, // 90 seconds
    end: 110000, // 110 seconds
  },
];

export const Default = {
  args: {
    waveformData: mockWaveformData,
    playheadPosition: 30000, // 30 seconds
    cutlist: mockCutlist,
    duration: 120000, // 2 minutes
    width: 800,
    waveformHeight: 60,
    onSeek: action("onSeek"),
    onCutlistChange: action("onCutlistChange"),
  },
};

export const SingleChannel = {
  args: {
    waveformData: [mockWaveformData[0]],
    playheadPosition: 15000,
    cutlist: mockCutlist,
    duration: 120000,
    width: 800,
    waveformHeight: 80,
    onSeek: action("onSeek"),
    onCutlistChange: action("onCutlistChange"),
  },
};

export const LongTimeline = {
  args: {
    waveformData: mockWaveformData,
    playheadPosition: 180000, // 3 minutes
    cutlist: [
      ...mockCutlist,
      {
        id: "clip-4",
        start: 150000, // 2.5 minutes
        end: 210000, // 3.5 minutes
      },
      {
        id: "clip-5",
        start: 240000, // 4 minutes
        end: 280000, // 4:40
      },
    ],
    duration: 300000, // 5 minutes
    width: 1200,
    waveformHeight: 50,
    onSeek: action("onSeek"),
    onCutlistChange: action("onCutlistChange"),
  },
};

export const EmptyCutlist = {
  args: {
    waveformData: mockWaveformData,
    playheadPosition: 45000,
    cutlist: [],
    duration: 120000,
    width: 800,
    waveformHeight: 60,
    onSeek: action("onSeek"),
    onCutlistChange: action("onCutlistChange"),
  },
};

export const ReadOnly = {
  args: {
    waveformData: mockWaveformData,
    playheadPosition: 60000,
    cutlist: mockCutlist,
    duration: 120000,
    width: 800,
    waveformHeight: 60,
    // No callbacks provided - should be read-only
  },
};

export const CompactView = {
  args: {
    waveformData: mockWaveformData,
    playheadPosition: 30000,
    cutlist: mockCutlist,
    duration: 120000,
    width: 600,
    waveformHeight: 40,
    onSeek: action("onSeek"),
    onCutlistChange: action("onCutlistChange"),
  },
};
