import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AudioChannelControl from "@/components/atoms/AudioChannelControl";
import AudioLevelSlider from "@/components/atoms/AudioLevelSlider";
import WaveformDisplay from "@/components/atoms/WaveformDisplay";
import AudioMixerPanel from "@/components/molecules/AudioMixerPanel";
import PreviewTimeline from "@/components/molecules/PreviewTimeline";
import VideoPreview from "@/components/organisms/VideoPreview";
import { ProjectProvider } from "@/context/ProjectContext";

import type { AudioChannel, PreviewSettings, VideoClip, WaveformData } from "@/types";

afterEach(cleanup);

vi.mock("hls.js", () => ({
  default: class {
    static Events = { ERROR: "error" };
    static isSupported = () => true;
    on() {}
    loadSource() {}
    attachMedia() {}
    detachMedia() {}
    destroy() {}
  },
}));

describe("Video Preview Components", () => {
  const frameRate = { numerator: 60, denominator: 1 };
  const sampleAudioChannel: AudioChannel = {
    id: "1",
    name: "Test Channel",
    level: 0.5,
    muted: false,
  };

  const sampleWaveformData: WaveformData = {
    channelId: "1",
    amplitudes: [0.1, 0.2, 0.3, 0.2, 0.1],
    durationFrames: 300,
    sampleRate: 44100,
  };

  const sampleClips: VideoClip[] = [
    {
      id: "1",
      sourceId: "test-source",
      sourceFrameRate: frameRate,
      sourceInFrame: 60,
      sourceOutFrame: 360,
    },
  ];

  const sampleSettings: PreviewSettings = {
    cutlist: sampleClips,
    audioChannels: [sampleAudioChannel],
    waveformData: [sampleWaveformData],
  };

  it("renders AudioLevelSlider", () => {
    const onChange = vi.fn();
    const { container } = render(<AudioLevelSlider level={0.5} onChange={onChange} label="Test" />);
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
    const { container } = render(<WaveformDisplay waveformData={sampleWaveformData} />);
    expect(container.querySelector("canvas")).toBeTruthy();
  });

  it("renders AudioMixerPanel", () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <AudioMixerPanel channels={[sampleAudioChannel]} onChange={onChange} />,
    );
    expect(getByText("Audio Mixer")).toBeTruthy();
  });

  it("shows selected ranges at their source times even when their frame rates differ", () => {
    const { getByTitle } = render(
      <ProjectProvider frameRate={{ numerator: 30, denominator: 1 }}>
        <PreviewTimeline
          waveformData={[]}
          playheadFrame={90}
          cutlist={[
            {
              id: "later",
              sourceId: "source-a",
              sourceFrameRate: { numerator: 25, denominator: 1 },
              sourceInFrame: 150,
              sourceOutFrame: 200,
            },
            {
              id: "earlier",
              sourceId: "source-b",
              sourceFrameRate: frameRate,
              sourceInFrame: 153,
              sourceOutFrame: 216,
            },
          ]}
          durationFrames={300}
        />
      </ProjectProvider>,
    );

    // In a 10-second view, the 6–8 second range starts at 60% and spans 20%.
    const later = getByTitle("Clip 1: 00:06 - 00:08");
    expect(later).toHaveTextContent("1");
    expect(later).toHaveStyle({ left: "60%", width: "20%" });

    // The 2.55–3.6 second range keeps its source bounds, not rounded preview frames.
    const earlier = getByTitle("Clip 2: 00:02.55 - 00:03.6");
    expect(earlier).toHaveTextContent("2");
    expect(earlier).toHaveStyle({ left: "25.5%" });
    expect(parseFloat(earlier.style.width)).toBeCloseTo(10.5);
  });

  it("renders VideoPreview", () => {
    const { getByText } = render(
      <ProjectProvider frameRate={frameRate}>
        <VideoPreview settings={sampleSettings} previewVideoUrl="test-url" durationFrames={300} />
      </ProjectProvider>,
    );
    expect(getByText("Video Preview")).toBeTruthy();
  });

  it("keeps the paused preview at the same playback position when the project rate changes", () => {
    const preview = (fps: number) => (
      <ProjectProvider frameRate={{ numerator: fps, denominator: 1 }}>
        <VideoPreview
          previewVideoUrl="/preview.m3u8"
          playheadFrame={fps}
          durationFrames={fps * 5}
          settings={{
            ...sampleSettings,
            waveformData: [{ ...sampleWaveformData, durationFrames: fps * 5 }],
          }}
        />
      </ProjectProvider>
    );
    const { container, getByRole, rerender } = render(preview(30));
    const video = container.querySelector("video")!;
    const playhead = () => getByRole("slider", { name: "Waveform timeline" });
    expect(playhead()).toHaveAttribute("aria-valuenow", "30");
    video.currentTime = 2;
    fireEvent.timeUpdate(video);
    expect(playhead()).toHaveAttribute("aria-valuenow", "60");

    rerender(preview(60));
    expect(video.currentTime).toBe(2);
    expect(playhead()).toHaveAttribute("aria-valuenow", "120");

    video.currentTime = 3;
    fireEvent.timeUpdate(video);
    expect(playhead()).toHaveAttribute("aria-valuenow", "180");
  });
});
