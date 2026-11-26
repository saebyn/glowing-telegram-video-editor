import type { FrameRate, MediaKind, SequencePreviewMedia } from "@/types";
import { framesToSeconds, secondsToFrame } from "./frames";
import { createPreviewRendition } from "./previewRendition";
import { createSequencePresentation } from "./sequencePresentation";
import { getSource } from "./sourcesById";

// Picture and sound can have different contributors on each side of a dissolve.
const renditionLimit = 4;

function changeSignal() {
  let change: Promise<void> | undefined;
  let wake: (() => void) | undefined;
  return {
    wait: () =>
      (change ??= new Promise<void>((resolve) => {
        wake = resolve;
      })),
    notify() {
      wake?.();
      change = undefined;
      wake = undefined;
    },
  };
}

export function createPreviewReader(
  media: SequencePreviewMedia,
  frameRate: FrameRate,
  openRendition = createPreviewRendition,
) {
  const at = createSequencePresentation(media.sequence, media.clips, media.sources, frameRate);
  const frameSeconds = framesToSeconds(1, frameRate);
  const frameCacheSize = Math.ceil(secondsToFrame(0.25, frameRate)) + 8;
  const kinds = new Map<string, MediaKind>();
  type Rendition = ReturnType<typeof createPreviewRendition>;
  type Entry = { handle: Rendition; readers: number };
  const renditions = new Map<string, Entry>();
  const slotChanged = changeSignal();
  const frameFinished = changeSignal();
  let activeFrames = 0;
  let disposed = false;
  function checkOpen() {
    if (disposed) throw new Error("Preview was closed.");
  }
  async function withRendition<T>(
    sourceId: string,
    use: (rendition: Awaited<Rendition["ready"]>) => T | Promise<T>,
  ): Promise<T> {
    const url = getSource(media.sources, sourceId)?.previewHlsUrl;
    if (!url) throw new Error("No playback rendition was supplied.");
    while (!disposed) {
      let entry = renditions.get(url);
      if (entry) renditions.delete(url);
      else {
        if (renditions.size === renditionLimit) {
          for (const [cachedUrl, cached] of renditions) {
            if (cached.readers) continue;
            renditions.delete(cachedUrl);
            cached.handle.dispose();
            break;
          }
          if (renditions.size === renditionLimit) {
            await slotChanged.wait();
            continue;
          }
        }
        entry = { handle: openRendition(url), readers: 0 };
      }
      renditions.set(url, entry);
      entry.readers++;
      try {
        const rendition = await entry.handle.ready;
        checkOpen();
        const result = await use(rendition);
        checkOpen();
        return result;
      } finally {
        if (--entry.readers === 0) slotChanged.notify();
      }
    }
    throw new Error("Preview was closed.");
  }
  async function read(frame: number, audible: boolean) {
    // An unfinished frame can retain decoded samples even after the request
    // cache drops it. Queue excess preparations before they start decoding.
    while (!disposed && activeFrames >= frameCacheSize) await frameFinished.wait();
    checkOpen();
    activeFrames++;
    let batch: Promise<unknown>[] = [];
    try {
      audible &&= frame < media.sequence.durationFrames;
      const position = Math.min(frame, media.sequence.durationFrames - 1);
      let presentation = at(position, kinds, audible);
      while (presentation.probes) {
        batch = presentation.probes.map(async (sourceId) => {
          await withRendition(sourceId, ({ kind }) => kinds.set(sourceId, kind));
        });
        await Promise.all(batch);
        checkOpen();
        presentation = at(position, kinds, audible);
      }
      if (presentation.problem) return presentation.problem;
      const pictures = presentation.picture.map(({ sourceId, time, weight, extension }) =>
        withRendition(sourceId, async ({ pictureAt }) => {
          const sample = await pictureAt(time, extension);
          return sample ? { picture: sample.canvas, weight } : null;
        }),
      );
      const sounds = presentation.sound.map((sample) =>
        withRendition(sample.sourceId, async ({ soundBetween }) => ({
          ...sample,
          buffers: await soundBetween(sample.time, sample.length ?? frameSeconds, sample.extension),
        })),
      );
      batch = [...pictures, ...sounds];
      const [picture, sound] = await Promise.all([Promise.all(pictures), Promise.all(sounds)]);
      checkOpen();
      return { picture: picture.filter((sample) => sample !== null), sound };
    } finally {
      // Keep the frame slot until its whole batch settles, even if a failed
      // contribution has already caused prepare() to report the error.
      void Promise.allSettled(batch).then(() => {
        activeFrames--;
        frameFinished.notify();
      });
    }
  }
  type Pending = {
    state: "loading" | "ready" | "failed";
    value: ReturnType<typeof read>;
    result?: Awaited<ReturnType<typeof read>>;
  };
  const requests = new Map<string, Pending>();
  function prepare(frame: number, audible: boolean) {
    const key = `${frame}/${audible}`;
    const prepared = requests.get(key);
    if (prepared) {
      requests.delete(key);
      requests.set(key, prepared);
      return prepared;
    }
    const pending: Pending = { state: "loading", value: read(frame, audible) };
    if (!disposed) requests.set(key, pending);
    if (requests.size > frameCacheSize) requests.delete(requests.keys().next().value!);
    void pending.value.then(
      (value) => {
        pending.result = value;
        pending.state = typeof value === "string" ? "failed" : "ready";
      },
      () => {
        pending.state = "failed";
      },
    );
    return pending;
  }
  return {
    prepare,
    dispose() {
      disposed = true;
      for (const { handle } of renditions.values()) handle.dispose();
      renditions.clear();
      requests.clear();
      kinds.clear();
      slotChanged.notify();
      frameFinished.notify();
    },
  };
}
