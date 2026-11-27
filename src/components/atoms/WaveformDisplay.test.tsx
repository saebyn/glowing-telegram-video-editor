import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { WaveformData } from "@/types";
import WaveformDisplay from "./WaveformDisplay";

afterEach(cleanup);

describe("WaveformDisplay", () => {
  const sampleWaveformData: WaveformData = {
    channelId: "1",
    amplitudes: [0.1, 0.2, 0.3, 0.2, 0.1],
    durationFrames: 300,
    sampleRate: 44100,
  };

  it("renders WaveformDisplay", () => {
    const { container } = render(<WaveformDisplay waveformData={sampleWaveformData} />);
    expect(container.querySelector("canvas")).toBeTruthy();
  });
});
