import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AudioChannelControl from "@/components/atoms/AudioChannelControl";
import AudioLevelSlider from "@/components/atoms/AudioLevelSlider";
import WaveformDisplay from "@/components/atoms/WaveformDisplay";
import AudioMixerPanel from "@/components/molecules/AudioMixerPanel";
import PreviewTimeline from "@/components/molecules/PreviewTimeline";
import VideoPreview from "@/components/organisms/VideoPreview";

import type {
  AudioChannel,
  PreviewSettings,
  VideoClip,
  WaveformData,
} from "@/types";

describe("Video Preview Components", () => {
  const sampleAudioChannel: AudioChannel = {
    id: "1",
    name: "Test Channel",
    level: 0.5,
    muted: false,
  };

  const sampleWaveformData: WaveformData = {
    channelId: "1",
    amplitudes: [0.1, 0.2, 0.3, 0.2, 0.1],
    duration: 5000,
    sampleRate: 44100,
  };

  const sampleClips: VideoClip[] = [
    {
      id: "1",
      start: 1000,
      end: 2000,
    },
  ];

  const sampleSettings: PreviewSettings = {
    cutlist: sampleClips,
    audioChannels: [sampleAudioChannel],
    waveformData: [sampleWaveformData],
  };

  it("renders AudioLevelSlider", () => {
    const onChange = vi.fn();
    const { container } = render(
      <AudioLevelSlider level={0.5} onChange={onChange} label="Test" />,
    );
    expect(container.querySelector("input[type='range']")).toBeTruthy();
  });

  it("renders AudioChannelControl", () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <AudioChannelControl channel={sampleAudioChannel} onChange={onChange} />,
    );
    expect(getByText("Test Channel")).toBeTruthy();
  });

  it("renders WaveformDisplay", () => {
    const { container } = render(
      <WaveformDisplay waveformData={sampleWaveformData} />,
    );
    expect(container.querySelector("canvas")).toBeTruthy();
  });

  it("renders AudioMixerPanel", () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <AudioMixerPanel channels={[sampleAudioChannel]} onChange={onChange} />,
    );
    expect(getByText("Audio Mixer")).toBeTruthy();
  });

  it("renders PreviewTimeline", () => {
    const { getByText } = render(
      <PreviewTimeline
        waveformData={[sampleWaveformData]}
        playheadPosition={1500}
        cutlist={sampleClips}
        duration={5000}
      />,
    );
    expect(getByText("Preview Timeline")).toBeTruthy();
  });

  it("renders VideoPreview", () => {
    const { getByText } = render(
      <VideoPreview
        settings={sampleSettings}
        previewVideoUrl="test-url"
        duration={5000}
      />,
    );
    expect(getByText("Video Preview")).toBeTruthy();
  });
});
