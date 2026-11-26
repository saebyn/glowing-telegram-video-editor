import type { FrameRate, MediaKind, SequencePreviewMedia } from "@/types";
import { framesToSeconds, secondsToFrame } from "./frames";
import { createPreviewRendition } from "./previewRendition";
import { previewWindowStarts } from "./previewWindows";
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

// Input disposal cancels decode work. Detach the preparation immediately
// rather than waiting for the adapter's async cancellation to reach us.
function untilClosed<T>(value: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const closed = () => reject(signal.reason);
    if (signal.aborted) closed();
    else signal.addEventListener("abort", closed, { once: true });
    void value.then(
      (result) => {
        signal.removeEventListener("abort", closed);
        resolve(result);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", closed);
        reject(error);
      },
    );
  });
}

export function createPreviewReader(
  media: SequencePreviewMedia,
  frameRate: FrameRate,
  openRendition = createPreviewRendition,
) {
  const { at, durationFrames } = createSequencePresentation(
    media.sequence,
    media.clips,
    media.sources,
    frameRate,
  );
  const frameSeconds = framesToSeconds(1, frameRate);
  const frameCacheSize = Math.ceil(secondsToFrame(0.25, frameRate)) + 8;
  const kinds = new Map<string, MediaKind>();
  type Rendition = ReturnType<typeof createPreviewRendition>;
  type Entry = {
    url: string;
    handle: Rendition;
    close: AbortController;
    readers: Set<Lease>;
  };
  type WindowKey = `${"picture" | "sound"}/${number}`;
  type Wanted = Map<string, Set<WindowKey> | null>;
  type Work = { key: string; wanted: Wanted; waitingForRendition: number; superseded?: true };
  type Lease = { work: Work; windows?: WindowKey[] };
  const renditions = new Map<string, Entry>();
  const slotChanged = changeSignal();
  const frameFinished = changeSignal();
  const active = new Set<Work>();
  const queued = new Set<Work>();
  let current: Work | undefined;
  let disposed = false;
  const superseded = new Error("Preview request was superseded.");
  function checkOpen(work: Work) {
    if (disposed) throw new Error("Preview was closed.");
    if (work.superseded) throw superseded;
  }
  function discard(work: Work) {
    work.superseded = true;
    if (requests.get(work.key)?.work === work) requests.delete(work.key);
  }
  function discardQueued() {
    for (const work of queued) if (work !== current) discard(work);
    frameFinished.notify();
  }
  function closeRendition(entry: Entry, reason: Error) {
    renditions.delete(entry.url);
    entry.close.abort(reason);
    entry.handle.dispose();
    slotChanged.notify();
  }
  function reclaim(entry: Entry) {
    for (const { work } of entry.readers) discard(work);
    closeRendition(entry, superseded);
  }
  async function withRendition<T>(
    work: Work,
    sourceId: string,
    use: (rendition: Awaited<Rendition["ready"]>) => T | Promise<T>,
    windows?: WindowKey[],
  ): Promise<T> {
    const url = getSource(media.sources, sourceId)?.previewHlsUrl;
    if (!url) throw new Error("No playback rendition was supplied.");
    while (true) {
      checkOpen(work);
      let entry = renditions.get(url);
      if (entry) renditions.delete(url);
      else {
        if (renditions.size === renditionLimit) {
          const entries = [...renditions.values()];
          const idle = entries.filter(({ readers }) => !readers.size);
          const unrelated = ({ url }: Entry) => !work.wanted.has(url);
          const spare = idle.find(unrelated) ?? idle[0];
          if (spare) closeRendition(spare, superseded);
          else if (work === current) {
            const obsolete = entries.find(unrelated);
            if (obsolete) {
              discardQueued();
              reclaim(obsolete);
            }
          }
          if (renditions.size === renditionLimit) {
            work.waitingForRendition++;
            try {
              await slotChanged.wait();
            } finally {
              work.waitingForRendition--;
            }
            continue;
          }
        }
        entry = {
          url,
          handle: openRendition(url),
          close: new AbortController(),
          readers: new Set(),
        };
      }
      renditions.set(url, entry);
      const lease: Lease = { work };
      entry.readers.add(lease);
      try {
        const signal = entry.close.signal;
        const rendition = await untilClosed(entry.handle.ready, signal);
        checkOpen(work);
        signal.throwIfAborted();
        lease.windows = windows;
        // An opening rendition is shared at every time. Once opened, the
        // current frame may be blocked only by unrelated windows.
        frameFinished.notify();
        const result = await untilClosed(Promise.resolve(use(rendition)), signal);
        checkOpen(work);
        signal.throwIfAborted();
        return result;
      } finally {
        entry.readers.delete(lease);
        frameFinished.notify();
        if (!entry.readers.size) slotChanged.notify();
      }
    }
  }
  function makeRoom(wanted: Wanted) {
    const heldBy = (entry: Entry, work: Work) =>
      [...entry.readers].some((lease) => lease.work === work);
    const sharesWindow = ({ url, readers }: Entry) => {
      const windows = wanted.get(url);
      return (
        windows === null ||
        (windows !== undefined &&
          [...readers].some(
            (lease) => !lease.windows || lease.windows.some((window) => windows.has(window)),
          ))
      );
    };
    // Retire a whole obsolete preparation first. With a mixed batch we
    // can cancel obsolete inputs, but its shared reads still count.
    // The decoder only cancels whole inputs, so never recycle an input
    // with a shared read. Prefer freeing unrelated URLs before reopening one.
    const held = [...renditions.values()].filter(({ readers }) => readers.size);
    const recyclable = held.filter((entry) => !sharesWindow(entry));
    let fallback: Entry | undefined;
    for (const candidates of [recyclable.filter(({ url }) => !wanted.has(url)), recyclable]) {
      for (const work of active) {
        const leases = held.filter((entry) => heldBy(entry, work));
        // No leases may mean a finished batch whose frame slot is about
        // to be released. Keep its result unless it's still waiting to open.
        if (!leases.length && !work.waitingForRendition) continue;
        const obsolete = leases.filter((entry) => candidates.includes(entry));
        if (obsolete.length === leases.length) {
          discardQueued();
          discard(work);
          for (const entry of obsolete) reclaim(entry);
          slotChanged.notify();
          return;
        }
        fallback ??= obsolete[0];
      }
    }
    if (fallback) {
      discardQueued();
      reclaim(fallback);
    }
  }
  function windowKeys(channel: "picture" | "sound", time: number, length?: number): WindowKey[] {
    return previewWindowStarts(
      time,
      channel === "sound" ? (length ?? frameSeconds) : 0,
    ).map<WindowKey>((start) => `${channel}/${start}`);
  }
  function updateWanted(work: Work, { probes, picture, sound }: ReturnType<typeof at>) {
    work.wanted.clear();
    for (const id of probes ?? []) {
      const url = getSource(media.sources, id)?.previewHlsUrl;
      if (url) work.wanted.set(url, null);
    }
    for (const [channel, samples] of [
      ["picture", picture],
      ["sound", sound],
    ] as const) {
      for (const { sourceId, time, length } of samples) {
        const url = getSource(media.sources, sourceId)?.previewHlsUrl;
        if (!url || work.wanted.get(url) === null) continue;
        const windows = work.wanted.get(url) ?? new Set<WindowKey>();
        for (const window of windowKeys(channel, time, length)) windows.add(window);
        work.wanted.set(url, windows);
      }
    }
  }
  async function read(work: Work, frame: number, audible: boolean) {
    checkOpen(work);
    if (!durationFrames || frame > durationFrames) return { picture: [], sound: [] };
    audible &&= frame !== durationFrames;
    const position = frame === durationFrames ? frame - 1 : frame;
    let presentation = at(position, kinds, audible);
    updateWanted(work, presentation);
    if (!presentation.probes) {
      if (presentation.problem) return presentation.problem;
      if (!presentation.picture.length && !presentation.sound.length)
        return { picture: [], sound: [] };
    }
    // An unfinished frame can retain decoded samples even after the request
    // cache drops it. Queue excess preparations before they start decoding.
    queued.add(work);
    try {
      while (active.size >= frameCacheSize) {
        checkOpen(work);
        if (work === current) {
          if (presentation.probes) {
            presentation = at(position, kinds, audible);
            updateWanted(work, presentation);
          }
          makeRoom(work.wanted);
        }
        await frameFinished.wait();
      }
    } finally {
      queued.delete(work);
    }
    checkOpen(work);
    active.add(work);
    let batch: Promise<unknown>[] = [];
    try {
      if (presentation.probes) {
        presentation = at(position, kinds, audible);
        updateWanted(work, presentation);
      }
      while (presentation.probes) {
        batch = presentation.probes.map(async (sourceId) => {
          await withRendition(work, sourceId, ({ kind }) => kinds.set(sourceId, kind));
        });
        await Promise.all(batch);
        checkOpen(work);
        presentation = at(position, kinds, audible);
        updateWanted(work, presentation);
      }
      if (presentation.problem) return presentation.problem;
      const pictures = presentation.picture.map(({ sourceId, time, weight, extension }) =>
        withRendition(
          work,
          sourceId,
          async ({ pictureAt }) => {
            const sample = await pictureAt(time, extension);
            return sample ? { picture: sample.canvas, weight } : null;
          },
          windowKeys("picture", time),
        ),
      );
      const sounds = presentation.sound.map((sample) =>
        withRendition(
          work,
          sample.sourceId,
          async ({ soundBetween }) => ({
            ...sample,
            buffers: await soundBetween(
              sample.time,
              sample.length ?? frameSeconds,
              sample.extension,
            ),
          }),
          windowKeys("sound", sample.time, sample.length),
        ),
      );
      batch = [...pictures, ...sounds];
      const [picture, sound] = await Promise.all([Promise.all(pictures), Promise.all(sounds)]);
      checkOpen(work);
      return { picture: picture.filter((sample) => sample !== null), sound };
    } finally {
      // Keep the frame slot until its whole batch settles, even if a failed
      // contribution has already caused prepare() to report the error.
      void Promise.allSettled(batch).then(() => {
        active.delete(work);
        frameFinished.notify();
      });
    }
  }
  type Pending = {
    work: Work;
    state: "loading" | "ready" | "failed";
    value: ReturnType<typeof read>;
    result?: Awaited<ReturnType<typeof read>>;
  };
  const requests = new Map<string, Pending>();
  function prioritize(work: Work) {
    if (work === current) return;
    current = work;
    // It may already be queued for either limit as a warm-up.
    frameFinished.notify();
    slotChanged.notify();
  }
  function prepare(frame: number, audible: boolean, priority?: "current") {
    const key = `${frame}/${audible}`;
    const prepared = requests.get(key);
    if (prepared) {
      requests.delete(key);
      requests.set(key, prepared);
      if (priority === "current") prioritize(prepared.work);
      return prepared;
    }
    const work: Work = { key, wanted: new Map(), waitingForRendition: 0 };
    if (priority === "current") prioritize(work);
    const pending: Pending = { work, state: "loading", value: read(work, frame, audible) };
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
    durationFrames,
    prepare,
    dispose() {
      disposed = true;
      const closed = new Error("Preview was closed.");
      for (const entry of renditions.values()) closeRendition(entry, closed);
      requests.clear();
      kinds.clear();
      slotChanged.notify();
      frameFinished.notify();
    },
  };
}
