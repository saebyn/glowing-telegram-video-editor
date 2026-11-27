import { setImmediate } from "node:timers/promises";
import { expect, test } from "vitest";
import type { MediaKind, SequencePreviewMedia } from "@/types";
import { createPreviewReader } from "./previewReader";

const projectRate = { numerator: 10, denominator: 1 };
const url = (id: string) => `/${id}.m3u8`;

function consecutiveRenditions(count: number): SequencePreviewMedia {
  const ids = Array.from({ length: count }, (_, i) => `source-${i}`);
  return {
    sources: Object.fromEntries(ids.map((id) => [id, { s3Location: id, previewHlsUrl: url(id) }])),
    clips: ids.map((id) => ({
      id,
      sourceId: id,
      sourceFrameRate: projectRate,
      sourceInFrame: 0,
      sourceOutFrame: 10,
    })),
    sequence: {
      tracks: [
        {
          id: "picture",
          label: "Picture",
          placements: ids.map((id, i) => ({ id, clipId: id, sequenceStartFrame: i * 10 })),
        },
      ],
    },
  };
}

function controlledDecoder({
  kinds = {},
  beforeReady,
  beforeRead,
}: {
  kinds?: Record<string, MediaKind>;
  beforeReady?: (renditionUrl: string) => Promise<void> | undefined;
  beforeRead?: (
    renditionUrl: string,
    channel: "picture" | "sound",
    time: number,
  ) => Promise<void> | undefined;
} = {}) {
  const live = new Set<string>();
  const opened: string[] = [];
  let peak = 0;
  function open(renditionUrl: string) {
    if (live.has(renditionUrl)) throw new Error("The rendition is already open.");
    live.add(renditionUrl);
    opened.push(renditionUrl);
    peak = Math.max(peak, live.size);
    let closed = false;
    const kind = kinds[renditionUrl] ?? "video-only";
    const ready = Promise.resolve(beforeReady?.(renditionUrl)).then(() => ({
      kind,
      async pictureAt(time: number) {
        if (closed) throw new Error("Read used a closed rendition.");
        if (kind === "audio-only") throw new Error("The rendition has no picture.");
        await beforeRead?.(renditionUrl, "picture", time);
        const canvas = document.createElement("canvas");
        canvas.dataset.url = renditionUrl;
        canvas.dataset.time = String(time);
        return { canvas, timestamp: time, duration: 0.1 };
      },
      async soundBetween(time: number) {
        if (closed) throw new Error("Read used a closed rendition.");
        if (kind === "video-only") throw new Error("The rendition has no sound.");
        await beforeRead?.(renditionUrl, "sound", time);
        return [{ timestamp: time, duration: 0.1, buffer: { duration: 0.1 } as AudioBuffer }];
      },
    }));
    return {
      ready,
      dispose() {
        if (closed) throw new Error("The rendition was closed twice.");
        closed = true;
        live.delete(renditionUrl);
      },
    };
  }
  return {
    open,
    live,
    opened,
    get peak() {
      return peak;
    },
  };
}

test("a parked playhead returns black and silence without opening a rendition", async () => {
  const decoder = controlledDecoder();
  const reader = createPreviewReader(consecutiveRenditions(1), projectRate, decoder.open);
  try {
    await expect(reader.prepare(11, true).value).resolves.toEqual({ picture: [], sound: [] });
    expect(decoder.opened).toEqual([]);
    await expect(reader.prepare(10, true).value).resolves.toMatchObject({
      picture: [{ picture: { dataset: { time: "0.9" } } }],
      sound: [],
    });
  } finally {
    reader.dispose();
  }
});

test("visiting many renditions releases evicted handles and can reopen them", async () => {
  const decoder = controlledDecoder();
  const reader = createPreviewReader(consecutiveRenditions(12), projectRate, decoder.open);
  try {
    for (let i = 0; i < 12; i++) {
      await expect(reader.prepare(i * 10, false).value).resolves.toMatchObject({
        picture: [{ picture: { dataset: { url: url(`source-${i}`) } } }],
      });
    }
    expect(decoder.peak).toBeLessThanOrEqual(4);
    expect(decoder.live.has(url("source-0"))).toBe(false);
    // Different frame: the result can't come from an already prepared frame.
    await expect(reader.prepare(5, false).value).resolves.toMatchObject({
      picture: [{ picture: { dataset: { url: url("source-0"), time: "0.5" } } }],
    });
    expect(decoder.opened.filter((entry) => entry === url("source-0"))).toHaveLength(2);
  } finally {
    reader.dispose();
  }
  expect(decoder.live.size).toBe(0);
});

test("closing Preview frees active renditions and rejects queued and late reads", async () => {
  const started = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  let active = 0;
  const decoder = controlledDecoder({
    beforeRead() {
      if (++active === 4) started.resolve();
      return finish.promise;
    },
  });
  const reader = createPreviewReader(consecutiveRenditions(5), projectRate, decoder.open);
  const reads = [0, 10, 20, 30].map((frame) => reader.prepare(frame, false));
  await started.promise;

  const queued = reader.prepare(40, false);
  const cancelled = expect(queued.value).rejects.toThrow("Preview was closed.");
  reader.dispose();
  try {
    expect(decoder.live.size).toBe(0);
    await cancelled;
    expect(decoder.opened).toHaveLength(4);
  } finally {
    finish.resolve();
  }
  const completed = await Promise.allSettled(reads.map(({ value }) => value));
  expect(completed.map(({ status }) => status)).toEqual([
    "rejected",
    "rejected",
    "rejected",
    "rejected",
  ]);
  expect(reads.every(({ state, result }) => state === "failed" && result === undefined)).toBe(true);
  await expect(reader.prepare(0, false).value).rejects.toThrow("Preview was closed.");
});

test("a late media-kind probe cannot open a fallback rendition after Preview closes", async () => {
  const probe = Promise.withResolvers<void>();
  const media: SequencePreviewMedia = {
    sequence: {
      tracks: [
        {
          id: "voice",
          label: "Voice",
          placements: [{ id: "a", clipId: "a", sequenceStartFrame: 0 }],
        },
        {
          id: "picture",
          label: "Picture",
          placements: [{ id: "v", clipId: "v", sequenceStartFrame: 0 }],
        },
      ],
    },
    clips: ["a", "v"].map((id) => ({
      id,
      sourceId: id,
      sourceFrameRate: projectRate,
      sourceInFrame: 0,
      sourceOutFrame: 10,
    })),
    sources: {
      a: { s3Location: "a", previewHlsUrl: url("a") },
      v: { s3Location: "v", previewHlsUrl: url("v") },
    },
  };
  const decoder = controlledDecoder({
    kinds: { [url("a")]: "audio-only" },
    beforeReady: (renditionUrl) => (renditionUrl === url("a") ? probe.promise : undefined),
  });
  const reader = createPreviewReader(media, projectRate, decoder.open);
  const prepared = reader.prepare(0, false);
  expect(decoder.opened).toEqual([url("a")]);

  reader.dispose();
  expect(decoder.live.size).toBe(0);
  probe.resolve();
  await expect(prepared.value).rejects.toThrow("Preview was closed.");
  expect(decoder.opened).toEqual([url("a")]);
});

test("rapid seeks cannot accumulate decoded pictures behind a slow sound read", async () => {
  const finishSound = Promise.withResolvers<void>();
  const media = consecutiveRenditions(8);
  let picturesBeforeSound = 0;
  const decoder = controlledDecoder({
    kinds: Object.fromEntries(Object.keys(media.sources).map((id) => [url(id), "audio-video"])),
    beforeRead(_, channel) {
      if (channel === "sound") return finishSound.promise;
      picturesBeforeSound++;
    },
  });
  const reader = createPreviewReader(media, projectRate, decoder.open);
  try {
    const burst = Array.from({ length: 80 }, (_, frame) => reader.prepare(frame, true));
    // Let every preparation that can run before sound completes finish its picture.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(picturesBeforeSound).toBeGreaterThan(0);
    expect(picturesBeforeSound).toBeLessThanOrEqual(11);
    finishSound.resolve();
    await expect(Promise.all(burst.map(({ value }) => value))).resolves.toHaveLength(80);
  } finally {
    finishSound.resolve();
    reader.dispose();
  }
});

const scrubRate = { numerator: 60, denominator: 1 };

function separatedRenditions(): SequencePreviewMedia {
  const { sources, clips } = consecutiveRenditions(2);
  return {
    sources,
    clips: clips.map((clip) => ({ ...clip, sourceFrameRate: scrubRate, sourceOutFrame: 60 })),
    sequence: {
      tracks: [
        {
          id: "picture",
          label: "Picture",
          placements: [
            { id: "stalled", clipId: "source-0", sequenceStartFrame: 0 },
            { id: "available", clipId: "source-1", sequenceStartFrame: 90 },
          ],
        },
      ],
    },
  };
}

test("a seek into a sequence gap is ready while preparation slots are stalled", async () => {
  const finishPlaylist = Promise.withResolvers<void>();
  const decoder = controlledDecoder({ beforeReady: () => finishPlaylist.promise });
  const reader = createPreviewReader(separatedRenditions(), scrubRate, decoder.open);
  try {
    for (let frame = 0; frame < 23; frame++) reader.prepare(frame, false);
    const gap = reader.prepare(70, true);

    await setImmediate();
    expect(gap.state).toBe("ready");
    expect(gap.result).toEqual({ picture: [], sound: [] });
    expect(decoder.opened).toEqual([url("source-0")]);
  } finally {
    reader.dispose();
    finishPlaylist.resolve();
  }
});

test("a seek can prepare available picture and sound before obsolete playlists settle", async () => {
  const finishPlaylist = Promise.withResolvers<void>();
  const decoder = controlledDecoder({
    kinds: { [url("source-1")]: "audio-video" },
    beforeReady: (renditionUrl) =>
      renditionUrl === url("source-0") ? finishPlaylist.promise : undefined,
  });
  const reader = createPreviewReader(separatedRenditions(), scrubRate, decoder.open);
  try {
    const old = Array.from({ length: 23 }, (_, frame) => reader.prepare(frame, false, "current"));
    const gap = reader.prepare(70, true, "current");
    const seek = reader.prepare(90, true, "current");

    await setImmediate();
    expect(seek.state).toBe("ready");
    const expected = {
      picture: [{ picture: { dataset: { url: url("source-1"), time: "0" } } }],
      sound: [{ sourceId: "source-1", buffers: [{ timestamp: 0 }] }],
    };
    expect(seek.result).toMatchObject(expected);
    expect(gap.result).toEqual({ picture: [], sound: [] });

    finishPlaylist.resolve();
    await Promise.allSettled(old.map(({ value }) => value));
    await setImmediate();
    expect(old.every(({ result }) => result === undefined)).toBe(true);
    expect(reader.prepare(90, true, "current")).toBe(seek);
    expect(seek.state).toBe("ready");
    expect(seek.result).toMatchObject(expected);
    await expect(reader.prepare(22, false, "current").value).resolves.toMatchObject({
      picture: [{ picture: { dataset: { url: url("source-0") } } }],
    });
  } finally {
    reader.dispose();
    finishPlaylist.resolve();
  }
});

test("promoting a warm-up frame can reclaim one of four leased rendition slots", async () => {
  const finishReads = Promise.withResolvers<void>();
  const decoder = controlledDecoder({
    kinds: soundKinds,
    beforeRead: (renditionUrl) => (renditionUrl === url("later") ? undefined : finishReads.promise),
  });
  const reader = createPreviewReader(staggeredDissolves(false), projectRate, decoder.open);
  try {
    const old = reader.prepare(10, true, "current");
    await setImmediate();
    expect(decoder.live.size).toBe(4);
    const warmup = reader.prepare(25, false);
    const current = reader.prepare(25, false, "current");
    await setImmediate();
    expect(warmup.state).toBe("ready");
    expect(current.result).toMatchObject({
      picture: [{ picture: { dataset: { url: url("later"), time: "0.5" } } }],
      sound: [],
    });
    expect(decoder.peak).toBe(4);

    finishReads.resolve();
    await Promise.allSettled([old.value]);
    expect(current.state).toBe("ready");
  } finally {
    reader.dispose();
    finishReads.resolve();
  }
});

test("a seek under preparation pressure keeps a still-needed rendition and its active read", async () => {
  const finishRead = Promise.withResolvers<void>();
  const decoder = controlledDecoder({
    beforeReady: (renditionUrl) =>
      renditionUrl === url("source-0") ? finishRead.promise : undefined,
    beforeRead: (renditionUrl, _, time) =>
      renditionUrl === url("source-1") && time > 0 ? finishRead.promise : undefined,
  });
  const reader = createPreviewReader(separatedRenditions(), scrubRate, decoder.open);
  try {
    const neighbor = reader.prepare(105, false);
    for (let frame = 0; frame < 22; frame++) reader.prepare(frame, false, "current");
    await setImmediate();
    const seek = reader.prepare(90, false, "current");
    await setImmediate();
    expect(seek.state).toBe("ready");
    expect(decoder.opened).toEqual([url("source-1"), url("source-0")]);

    finishRead.resolve();
    await expect(neighbor.value).resolves.toMatchObject({
      picture: [{ picture: { dataset: { url: url("source-1"), time: "0.25" } } }],
    });
  } finally {
    reader.dispose();
    finishRead.resolve();
  }
});

test("scrubbing a single stalled playlist at capacity does not restart its shared load", async () => {
  const finishPlaylist = Promise.withResolvers<void>();
  const decoder = controlledDecoder({ beforeReady: () => finishPlaylist.promise });
  const reader = createPreviewReader(separatedRenditions(), scrubRate, decoder.open);
  try {
    for (let frame = 0; frame < 23; frame++) reader.prepare(frame, false, "current");
    const seek = reader.prepare(23, false, "current");
    await setImmediate();
    expect(decoder.opened).toEqual([url("source-0")]);

    finishPlaylist.resolve();
    await expect(seek.value).resolves.toMatchObject({
      picture: [{ picture: { dataset: { url: url("source-0") } } }],
    });
  } finally {
    reader.dispose();
    finishPlaylist.resolve();
  }
});

test("a seek to an available window can pass stalled reads of an old window of the same rendition", async () => {
  const finishOldWindow = Promise.withResolvers<void>();
  let startedOldReads = 0;
  const decoder = controlledDecoder({
    beforeRead: (_, _channel, time) => {
      if (time >= 0.5) return;
      startedOldReads++;
      return finishOldWindow.promise;
    },
  });
  const reader = createPreviewReader(separatedRenditions(), scrubRate, decoder.open);
  try {
    const old = Array.from({ length: 23 }, (_, frame) => reader.prepare(frame, false, "current"));
    await setImmediate();
    expect(startedOldReads).toBeGreaterThan(0);
    const warmup = reader.prepare(45, false);
    await setImmediate();
    expect(warmup.state).toBe("loading");
    expect(decoder.opened).toEqual([url("source-0")]);

    const seek = reader.prepare(45, false, "current");
    await setImmediate();
    expect(seek).toBe(warmup);
    const expected = {
      picture: [{ picture: { dataset: { url: url("source-0"), time: "0.75" } } }],
    };
    expect(seek.result).toMatchObject(expected);
    expect(decoder.peak).toBe(1);

    finishOldWindow.resolve();
    await Promise.allSettled(old.map(({ value }) => value));
    await setImmediate();
    expect(old.every(({ result }) => result === undefined)).toBe(true);
    expect(reader.prepare(45, false, "current")).toBe(seek);
    expect(seek.result).toMatchObject(expected);
  } finally {
    reader.dispose();
    finishOldWindow.resolve();
  }
});

test("a seek preserves a pending sound read that crosses into the required window", async () => {
  const finishSound = Promise.withResolvers<void>();
  const base = separatedRenditions();
  const media = {
    ...base,
    clips: base.clips.map((clip) => ({
      ...clip,
      sourceFrameRate: { numerator: 120, denominator: 1 },
      sourceInFrame: 1,
      sourceOutFrame: 121,
    })),
  };
  const decoder = controlledDecoder({
    kinds: { [url("source-0")]: "audio-video" },
    beforeRead: (_rendition, channel) => (channel === "sound" ? finishSound.promise : undefined),
  });
  const reader = createPreviewReader(media, scrubRate, decoder.open);
  try {
    // Frame 29 starts before the half-second boundary, but its sound spans it.
    const old = Array.from({ length: 23 }, (_, i) => reader.prepare(i + 7, true, "current"));
    await setImmediate();
    const seek = reader.prepare(30, true, "current");
    await setImmediate();
    expect(decoder.opened).toEqual([url("source-0")]);

    finishSound.resolve();
    await expect(Promise.all(old.map(({ value }) => value))).resolves.toHaveLength(23);
    await expect(seek.value).resolves.toMatchObject({ sound: [{ sourceId: "source-0" }] });
  } finally {
    reader.dispose();
    finishSound.resolve();
  }
});

function staggeredDissolves(reuseSources: boolean): SequencePreviewMedia {
  const picture = reuseSources ? "picture-out" : "picture-in";
  const sound = reuseSources ? "sound-out" : "sound-in";
  const clip = (id: string, sourceId: string, sourceInFrame: number, frames: number) => ({
    id,
    sourceId,
    sourceFrameRate: projectRate,
    sourceInFrame,
    sourceOutFrame: sourceInFrame + frames,
    sourceDurationFrames: 100,
  });
  return {
    sources: {
      "picture-out": {
        s3Location: "a",
        previewHlsUrl: url("picture-out"),
        mediaKind: "video-only",
      },
      "picture-in": { s3Location: "b", previewHlsUrl: url("picture-in"), mediaKind: "video-only" },
      "sound-out": { s3Location: "c", previewHlsUrl: url("sound-out"), mediaKind: "audio-only" },
      "sound-in": { s3Location: "d", previewHlsUrl: url("sound-in"), mediaKind: "audio-only" },
      later: { s3Location: "e", previewHlsUrl: url("later"), mediaKind: "video-only" },
    },
    clips: [
      clip("p1", "picture-out", 0, 10),
      clip("p2", picture, 20, 10),
      clip("s1", "sound-out", 20, 12),
      clip("s2", sound, 40, 8),
      clip("p3", "later", 0, 10),
    ],
    sequence: {
      tracks: [
        {
          id: "picture",
          label: "Picture",
          placements: [
            { id: "p1", clipId: "p1", sequenceStartFrame: 0 },
            {
              id: "p2",
              clipId: "p2",
              sequenceStartFrame: 10,
              transitionIn: { id: "picture-dissolve", kind: "dissolve", durationFrames: 6 },
            },
            { id: "p3", clipId: "p3", sequenceStartFrame: 20 },
          ],
        },
        {
          id: "sound",
          label: "Sound",
          placements: [
            { id: "s1", clipId: "s1", sequenceStartFrame: 0 },
            {
              id: "s2",
              clipId: "s2",
              sequenceStartFrame: 12,
              transitionIn: { id: "sound-dissolve", kind: "dissolve", durationFrames: 6 },
            },
          ],
        },
      ],
    },
  };
}

const soundKinds = { [url("sound-out")]: "audio-only", [url("sound-in")]: "audio-only" } as const;

function dissolveSamples(pictureIn: string, soundIn: string) {
  return {
    picture: [
      { picture: { dataset: { url: url("picture-out"), time: "1" } } },
      { picture: { dataset: { url: url(pictureIn), time: "2" } } },
    ],
    sound: [
      { sourceId: "sound-out", buffers: [{ timestamp: 3 }] },
      { sourceId: soundIn, buffers: [{ timestamp: 3.8 }] },
    ],
  };
}

test("separate picture and sound dissolves keep four reads live while a fifth rendition waits", async () => {
  const started = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  let active = 0;
  const decoder = controlledDecoder({
    kinds: soundKinds,
    beforeRead() {
      if (++active === 4) started.resolve();
      return finish.promise;
    },
  });
  const reader = createPreviewReader(staggeredDissolves(false), projectRate, decoder.open);
  try {
    const transition = reader.prepare(10, true);
    await started.promise;
    const seek = reader.prepare(25, false);
    expect(seek.state).toBe("loading");
    expect(decoder.live.has(url("later"))).toBe(false);
    finish.resolve();
    await expect(transition.value).resolves.toMatchObject(
      dissolveSamples("picture-in", "sound-in"),
    );
    await expect(seek.value).resolves.toMatchObject({
      picture: [{ picture: { dataset: { url: url("later"), time: "0.5" } } }],
    });
    expect(decoder.peak).toBe(4);
  } finally {
    finish.resolve();
    reader.dispose();
  }
});

test("a dissolve reads both source times when adjacent placements share their renditions", async () => {
  const decoder = controlledDecoder({ kinds: soundKinds });
  const reader = createPreviewReader(staggeredDissolves(true), projectRate, decoder.open);
  try {
    await expect(reader.prepare(10, true).value).resolves.toMatchObject(
      dissolveSamples("picture-out", "sound-out"),
    );
    expect(decoder.opened).toHaveLength(2);
  } finally {
    reader.dispose();
  }
});
