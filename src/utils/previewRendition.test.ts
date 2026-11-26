import type { WrappedAudioBuffer, WrappedCanvas } from "mediabunny";
import { beforeEach, expect, it, vi } from "vitest";
import { createPreviewRendition } from "./previewRendition";

const { buffers, canvases, computeDuration, getCanvas } = vi.hoisted(() => ({
  buffers: vi.fn<(start: number) => AsyncGenerator<WrappedAudioBuffer>>(),
  canvases: vi.fn<() => AsyncGenerator<WrappedCanvas>>(),
  computeDuration: vi.fn<() => Promise<number>>(),
  getCanvas: vi.fn<() => Promise<WrappedCanvas | null>>(),
}));

beforeEach(() => {
  computeDuration.mockResolvedValue(6);
});

vi.mock("mediabunny", async (original) => ({
  ...(await original<typeof import("mediabunny")>()),
  Input: class {
    async getVideoTracks() {
      return [
        {
          isLive: async () => false,
          getFirstTimestamp: async () => 5,
          canDecode: async () => true,
        },
      ];
    }

    async getAudioTracks() {
      return [
        {
          isLive: async () => false,
          canDecode: async () => true,
          computeDuration,
        },
      ];
    }

    dispose() {}
  },
  UrlSource: class {},
  AudioBufferSink: class {
    buffers = buffers;
  },
  CanvasSink: class {
    canvases = canvases;
    getCanvas = getCanvas;
  },
}));

function sampleBeforeFailure(): WrappedCanvas {
  const sample = {
    timestamp: 5,
    duration: 0.25,
    canvas: document.createElement("canvas"),
  };
  canvases.mockImplementation(async function* () {
    yield sample;
    throw new Error("The next segment failed to load.");
  });
  getCanvas.mockResolvedValue(sample);
  return sample;
}

it("returns the picture covering the request even if a later segment in the window fails", async () => {
  const sample = sampleBeforeFailure();
  const rendition = createPreviewRendition("https://example.test/local.m3u8");
  try {
    const { pictureAt } = await rendition.ready;
    await expect(pictureAt(0.125)).resolves.toBe(sample);
  } finally {
    rendition.dispose();
  }
});

it("does not reuse a decoded picture that ends before the requested source time", async () => {
  sampleBeforeFailure();
  const rendition = createPreviewRendition("https://example.test/local.m3u8");
  try {
    const { pictureAt } = await rendition.ready;
    await expect(pictureAt(0.375)).rejects.toThrow("no picture at the requested source time");
  } finally {
    rendition.dispose();
  }
});

function soundBlock(timestamp: number, duration: number): WrappedAudioBuffer {
  return { timestamp, duration, buffer: { duration } as AudioBuffer };
}

function soundBeforeFailure(...decoded: WrappedAudioBuffer[]) {
  const failure = new Error("The next audio segment failed to load.");
  buffers.mockImplementation(async function* () {
    yield* decoded;
    throw failure;
  });
  return failure;
}

it("returns sound covering an earlier source interval even if a later segment in the window fails", async () => {
  const sample = soundBlock(5, 0.25);
  soundBeforeFailure(sample);
  const rendition = createPreviewRendition("https://example.test/local.m3u8");
  try {
    const { soundBetween } = await rendition.ready;
    await expect(soundBetween(0.1, 0.1)).resolves.toEqual([
      { timestamp: 0, duration: 0.25, buffer: sample.buffer },
    ]);
  } finally {
    rendition.dispose();
  }
});

it("reports the segment failure for a later uncovered request in the same decode window", async () => {
  const failure = soundBeforeFailure(soundBlock(5, 0.25));
  const rendition = createPreviewRendition("https://example.test/local.m3u8");
  try {
    const { soundBetween } = await rendition.ready;
    await soundBetween(0.1, 0.1);
    await expect(soundBetween(0.3, 0.1)).rejects.toBe(failure);
  } finally {
    rendition.dispose();
  }
});

it("reports the segment failure if decoded sound covers only the start of the requested interval", async () => {
  const failure = soundBeforeFailure(soundBlock(5, 0.25));
  const rendition = createPreviewRendition("https://example.test/local.m3u8");
  try {
    const { soundBetween } = await rendition.ready;
    await expect(soundBetween(0.2, 0.2)).rejects.toBe(failure);
  } finally {
    rendition.dispose();
  }
});

it("reports a gap between decoded buffers within the recorded sound of a transition", async () => {
  const failure = soundBeforeFailure(soundBlock(5, 0.125), soundBlock(5.25, 0.125));
  const rendition = createPreviewRendition("https://example.test/local.m3u8");
  try {
    const { soundBetween } = await rendition.ready;
    await expect(soundBetween(0.0625, 0.25, true)).rejects.toBe(failure);
  } finally {
    rendition.dispose();
  }
});

it("combines covering sound from adjacent decode windows when one ends with a segment failure", async () => {
  const first = soundBlock(5.25, 0.25);
  const second = soundBlock(5.5, 0.125);
  buffers.mockImplementation(async function* (start) {
    if (start < 5.5) {
      yield first;
    } else {
      yield second;
      throw new Error("The next audio segment failed to load.");
    }
  });
  const rendition = createPreviewRendition("https://example.test/local.m3u8");
  try {
    const { soundBetween } = await rendition.ready;
    await expect(soundBetween(0.45, 0.1)).resolves.toEqual([
      { timestamp: 0.25, duration: 0.25, buffer: first.buffer },
      { timestamp: 0.5, duration: 0.125, buffer: second.buffer },
    ]);
  } finally {
    rendition.dispose();
  }
});

it("keeps intentional silence when a transition requests time after recorded sound ends", async () => {
  computeDuration.mockResolvedValue(5.25);
  soundBeforeFailure(soundBlock(5, 0.25));
  const rendition = createPreviewRendition("https://example.test/local.m3u8");
  try {
    const { soundBetween } = await rendition.ready;
    await expect(soundBetween(0.3, 0.1, true)).resolves.toEqual([]);
  } finally {
    rendition.dispose();
  }
});

it("returns a transition's recorded sound when only its silent tail is uncovered", async () => {
  computeDuration.mockResolvedValue(5.25);
  const sample = soundBlock(5, 0.25);
  soundBeforeFailure(sample);
  const rendition = createPreviewRendition("https://example.test/local.m3u8");
  try {
    const { soundBetween } = await rendition.ready;
    await expect(soundBetween(0.2, 0.2, true)).resolves.toEqual([
      { timestamp: 0, duration: 0.25, buffer: sample.buffer },
    ]);
  } finally {
    rendition.dispose();
  }
});
