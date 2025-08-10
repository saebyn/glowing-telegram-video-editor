import { action } from "@storybook/addon-actions";
import WaveformDisplay from "./WaveformDisplay";
import type { WaveformData } from "@/types";

export default {
  title: "Atoms/WaveformDisplay",
  component: WaveformDisplay,
  tags: ["atoms"],
};

// Generate sample waveform data
const generateWaveformData = (samples: number = 200): WaveformData => {
  const amplitudes: number[] = [];
  for (let i = 0; i < samples; i++) {
    // Generate a mix of sine waves for realistic waveform
    const freq1 = Math.sin((i / samples) * Math.PI * 4) * 0.5;
    const freq2 = Math.sin((i / samples) * Math.PI * 8) * 0.3;
    const noise = (Math.random() - 0.5) * 0.2;
    amplitudes.push(Math.abs(freq1 + freq2 + noise));
  }
  return {
    channelId: "channel-1",
    amplitudes,
    duration: 60000, // 1 minute
    sampleRate: 44100,
  };
};

const mockWaveformData = generateWaveformData();

export const Default = {
  args: {
    waveformData: mockWaveformData,
    width: 400,
    height: 80,
    playheadPosition: 15000, // 15 seconds
    onSeek: action("onSeek"),
  },
};

export const Large = {
  args: {
    waveformData: mockWaveformData,
    width: 800,
    height: 120,
    playheadPosition: 30000, // 30 seconds
    onSeek: action("onSeek"),
  },
};

export const CustomColors = {
  args: {
    waveformData: mockWaveformData,
    width: 600,
    height: 100,
    playheadPosition: 45000, // 45 seconds
    color: "#10b981", // emerald
    playheadColor: "#f59e0b", // amber
    onSeek: action("onSeek"),
  },
};

export const Interactive = {
  args: {
    waveformData: mockWaveformData,
    width: 500,
    height: 80,
    playheadPosition: 0,
    onSeek: action("onSeek"),
  },
};

export const NoPlayhead = {
  args: {
    waveformData: mockWaveformData,
    width: 400,
    height: 80,
    // No playheadPosition provided - should default to 0
    onSeek: action("onSeek"),
  },
};

export const ReadOnly = {
  args: {
    waveformData: mockWaveformData,
    width: 400,
    height: 80,
    playheadPosition: 20000,
    // No onSeek callback - should be read-only
  },
};