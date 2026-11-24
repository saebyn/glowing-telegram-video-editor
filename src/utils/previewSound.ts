import type { PreviewSample } from "./sequencePresentation";

export interface PreviewSoundBlock extends PreviewSample {
  buffers: { buffer: AudioBuffer; timestamp: number }[];
}

export function createPreviewSound() {
  let context: AudioContext | undefined;
  let previousFrame: number | undefined;
  let previousEnd = 0;
  let unlockState: "loading" | "ready" | "failed" = "loading";
  let unlocking: Promise<void> | undefined;
  const playing = new Set<AudioBufferSourceNode>();

  return {
    unlock() {
      unlocking ??= (async () => {
        if (typeof AudioContext !== "function")
          throw new Error("This browser does not support preview sound.");
        context ??= new AudioContext();
        if (context.state !== "running") await context.resume();
      })().then(
        () => {
          unlockState = "ready";
        },
        () => {
          unlockState = "failed";
        },
      );
      return unlocking;
    },
    get readiness() {
      return unlockState;
    },
    play(frame: number, delay: number, duration: number, blocks: PreviewSoundBlock[]) {
      if (
        !context ||
        context.state !== "running" ||
        (previousFrame !== undefined && frame <= previousFrame)
      )
        return;
      const now = context.currentTime;
      // Web Audio's currentTime reads in render-quantum increments. Once a
      // run is queued, anchor each contiguous block to the previous one
      // instead of re-estimating the wall-clock offset every animation tick.
      const start = previousFrame === frame - 1 && previousEnd >= now ? previousEnd : now + delay;
      const endTime = start + duration;
      if (endTime <= now) return;
      previousFrame = frame;
      previousEnd = endTime;
      for (const {
        buffers,
        time,
        weight,
        endWeight = weight,
        delay: padding = 0,
        length = duration,
      } of blocks) {
        const gain = context.createGain();
        gain.connect(context.destination);
        const late = Math.max(0, now - start);
        gain.gain.setValueAtTime(
          weight + ((endWeight - weight) * late) / duration,
          Math.max(now, start),
        );
        gain.gain.linearRampToValueAtTime(endWeight, endTime);
        let remaining = 0;
        for (const { buffer, timestamp } of buffers) {
          const inPoint = Math.max(time + Math.max(0, late - padding), timestamp);
          const outPoint = Math.min(time + length, timestamp + buffer.duration);
          if (outPoint <= inPoint) continue;
          const node = context.createBufferSource();
          node.buffer = buffer;
          node.connect(gain);
          playing.add(node);
          remaining += 1;
          node.onended = () => {
            playing.delete(node);
            node.disconnect();
            if (--remaining === 0) gain.disconnect();
          };
          node.start(start + padding + inPoint - time, inPoint - timestamp, outPoint - inPoint);
        }
        if (!remaining) gain.disconnect();
      }
    },
    stop() {
      previousFrame = undefined;
      for (const node of playing) node.stop();
      playing.clear();
    },
    dispose() {
      if (context) void context.close().catch(() => {});
    },
  };
}
