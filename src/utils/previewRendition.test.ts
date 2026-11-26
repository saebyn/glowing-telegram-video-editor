import type { WrappedCanvas } from "mediabunny";
import { expect, it, vi } from "vitest";
import { createPreviewRendition } from "./previewRendition";

const { canvases, getCanvas } = vi.hoisted(() => ({
  canvases: vi.fn<() => AsyncGenerator<WrappedCanvas>>(),
  getCanvas: vi.fn<() => Promise<WrappedCanvas | null>>(),
}));

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
      return [];
    }

    dispose() {}
  },
  UrlSource: class {},
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
