import type { Input, WrappedAudioBuffer, WrappedCanvas } from "mediabunny";
import { previewWindowEnd, previewWindowStart, previewWindowStarts } from "./previewWindows";

export const previewWidth = 480;
export const previewHeight = 270;

// A dissolve can read two distant positions in the same rendition. Keep
// room for the neighboring windows on both sides, including lookahead.
const decodedWindowLimit = 6;

async function selectPreviewVideo(input: Input) {
  const tracks = await input.getVideoTracks();
  if (tracks.length < 2) return tracks[0];
  const variants = await Promise.all(
    tracks.map(async (track) => {
      try {
        if (await track.hasOnlyKeyPackets()) return null;
        const [width, height] = await Promise.all([
          track.getDisplayWidth(),
          track.getDisplayHeight(),
        ]);
        return {
          track,
          pixels: width * height,
          fits: width <= previewWidth && height <= previewHeight,
        };
      } catch {
        // Some masters advertise variants whose metadata cannot be read.
        return null;
      }
    }),
  );
  const ranked = variants
    .filter((variant) => variant !== null)
    .sort((a, b) =>
      a.fits === b.fits
        ? a.fits
          ? b.pixels - a.pixels
          : a.pixels - b.pixels
        : Number(b.fits) - Number(a.fits),
    );
  for (const { track } of ranked) {
    if (await track.canDecode().catch(() => false)) return track;
  }
  // Preserve the useful codec error if none of the candidates can be decoded.
  return ranked[0]?.track ?? input.getPrimaryVideoTrack();
}

function cachedWindows<T>(read: (start: number, end: number) => Promise<T>) {
  const windows = new Map<number, Promise<T>>();
  return (time: number) => {
    const start = previewWindowStart(time);
    let window = windows.get(start);
    if (window) windows.delete(start);
    else window = read(start, previewWindowEnd(start));
    windows.set(start, window);
    if (windows.size > decodedWindowLimit) windows.delete(windows.keys().next().value!);
    return window;
  };
}

async function open(
  input: Input,
  { CanvasSink, AudioBufferSink, desc, prefer }: typeof import("mediabunny"),
) {
  const video = await selectPreviewVideo(input);
  // Rank audio within the chosen variant. getPrimaryPairableAudioTrack also
  // ranks unrelated video variants, which may themselves be unavailable.
  const [audio] = await input.getAudioTracks({
    filter: (track) => !video || video.canBePairedWith(track),
    sortBy: async (track) => [
      prefer((await track.getDisposition()).default),
      desc(await track.getBitrate()),
    ],
  });
  if (!video && !audio) throw new Error("The rendition contains no picture or sound.");
  if ((await video?.isLive()) || (await audio?.isLive())) {
    throw new Error("Sequence Preview requires seekable, finite HLS.");
  }
  // Mediabunny normalizes MPEG-TS segment timestamps to the playlist timeline.
  // Use one origin for both tracks; AAC preroll may precede the first picture.
  const origin = video ? await video.getFirstTimestamp() : await audio!.getFirstTimestamp();
  const pictureSink = video
    ? new CanvasSink(video, { width: previewWidth, height: previewHeight, fit: "contain" })
    : undefined;
  const soundSink = audio ? new AudioBufferSink(audio) : undefined;
  let pictureCodec: Promise<boolean> | undefined;
  let soundCodec: Promise<boolean> | undefined;
  let pictureEnd: Promise<number> | undefined;
  let soundEnd: Promise<number> | undefined;
  const pictures = cachedWindows(async (start, end) => {
    const result: WrappedCanvas[] = [];
    if (pictureSink) {
      try {
        for await (const picture of pictureSink.canvases(origin + start, origin + end)) {
          result.push(picture);
          // A proxy with unusual cadence must not grow the decoded cache without bound.
          if (result.length === 32) break;
        }
      } catch (error) {
        // A later segment can fail after earlier pictures in this window have decoded.
        // pictureAt still checks coverage and will try an exact read for a miss.
        if (!result.length) throw error;
      }
    }
    return result;
  });
  async function pictureAt(time: number, extension = false): Promise<WrappedCanvas | null> {
    if (!video || !pictureSink) throw new Error("The rendition is missing the expected picture.");
    if (!(await (pictureCodec ??= video.canDecode())))
      throw new Error("This browser cannot decode the rendition picture.");
    const request = origin + time + 1e-7;
    const covers = ({ timestamp, duration }: WrappedCanvas) =>
      timestamp <= request && origin + time < timestamp + duration + 1e-7;
    const picture =
      (await pictures(time)).findLast(covers) ?? (await pictureSink.getCanvas(request));
    if (!picture || !covers(picture)) {
      if (extension && origin + time >= (await (pictureEnd ??= video.computeDuration())) - 1e-7)
        return null;
      throw new Error("The rendition has no picture at the requested source time.");
    }
    return picture;
  }
  const audioBlocks = cachedWindows(async (start, end) => {
    const blocks: WrappedAudioBuffer[] = [];
    if (soundSink) {
      try {
        for await (const block of soundSink.buffers(origin + start, origin + end)) {
          blocks.push({ ...block, timestamp: block.timestamp - origin });
        }
      } catch (error) {
        return { blocks, failure: { error } };
      }
    }
    return { blocks };
  });
  async function soundBetween(
    time: number,
    duration: number,
    extension = false,
  ): Promise<WrappedAudioBuffer[]> {
    if (!audio || !soundSink) throw new Error("The rendition is missing the expected sound.");
    if (!(await (soundCodec ??= audio.canDecode())))
      throw new Error("This browser cannot decode the rendition sound.");
    const end = time + duration;
    const decoded = await Promise.all(previewWindowStarts(time, duration).map(audioBlocks));
    const blocks = decoded.flatMap((window) => window.blocks);
    const buffers = [...new Map(blocks.map((block) => [block.timestamp, block])).values()].filter(
      ({ timestamp, buffer }) => timestamp < end && time < timestamp + buffer.duration,
    );
    const failure = decoded.find((window) => window.failure)?.failure;
    if (failure) {
      // A failed window can still serve requests covered by the decoded buffers.
      let coveredUntil = time;
      for (const { timestamp, buffer } of buffers.sort((a, b) => a.timestamp - b.timestamp)) {
        if (timestamp > coveredUntil + 1e-9) break;
        coveredUntil = Math.max(coveredUntil, timestamp + buffer.duration);
      }
      if (coveredUntil >= end - 1e-9) return buffers;
      // Only the portion beyond the recorded sound is allowed to be silent.
      if (
        extension &&
        origin + coveredUntil >= (await (soundEnd ??= audio.computeDuration())) - 1e-7
      ) {
        return buffers;
      }
      throw failure.error;
    }
    if (
      !buffers.length &&
      !(extension && origin + time >= (await (soundEnd ??= audio.computeDuration())) - 1e-7)
    ) {
      throw new Error("The rendition has no sound at the requested source time.");
    }
    return buffers;
  }
  const kind = video ? (audio ? "audio-video" : "video-only") : "audio-only";
  return { pictureAt, soundBetween, kind } as const;
}

export function createPreviewRendition(url: string) {
  let input: Input | undefined;
  let disposed = false;
  const ready = import("mediabunny").then((library) => {
    if (disposed) throw new Error("Preview was closed.");
    input = new library.Input({
      source: new library.UrlSource(new URL(url, document.baseURI), {
        getRetryDelay: (attempt) => (attempt < 2 ? 0.15 : null),
        maxCacheSize: 8 * 1024 * 1024,
      }),
      formats: library.HLS_FORMATS,
      formatOptions: { hls: { offsetTimestampsByDateTime: false } },
    });
    return open(input, library);
  });
  return {
    ready,
    dispose: () => {
      disposed = true;
      input?.dispose();
    },
  };
}
