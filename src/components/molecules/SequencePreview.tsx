import { useLayoutEffect, useRef, useState } from "react";
import type { SequencePreviewGate, SequencePreviewMedia, SequenceTransportSnapshot } from "@/types";
import { framesToSeconds, secondsToFrame } from "@/utils/frames";
import { createPreviewReader } from "@/utils/previewReader";
import { previewHeight, previewWidth } from "@/utils/previewRendition";
import { createPreviewSound } from "@/utils/previewSound";
import { previewSoundStops } from "@/utils/previewSoundStops";

export interface SequencePreviewProps extends SequenceTransportSnapshot {
  readonly media?: SequencePreviewMedia;
  readonly registerPreview?: (preview: SequencePreviewGate) => () => void;
  readonly stoppedOnSound?: boolean;
}

export default function SequencePreview({
  media,
  frameRate,
  playheadFrame,
  durationFrames,
  playback,
  registerPreview,
  stoppedOnSound,
}: SequencePreviewProps) {
  const reader = useRef<ReturnType<typeof createPreviewReader>>(null);
  const sound = useRef<ReturnType<typeof createPreviewSound>>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState<string>();

  const { sequence, clips, sources } = media ?? {};
  useLayoutEffect(() => {
    const output = createPreviewSound();
    sound.current = output;
    return () => {
      output.stop();
      output.dispose();
      sound.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!sequence || !clips || !sources) return;
    const instance = createPreviewReader({ sequence, clips, sources }, frameRate);
    const endFrame = instance.durationFrames ?? 0;
    reader.current = instance;
    const lookahead = Math.max(1, secondsToFrame(0.5, frameRate));
    const lookaheadStep = Math.max(1, secondsToFrame(0.125, frameRate));
    const nearbyCount = Math.max(1, secondsToFrame(0.1, frameRate));
    const gate: SequencePreviewGate = {
      readiness: (frame, direction) => {
        const audible = direction === 1;
        const prepared = instance.prepare(frame, audible);
        if (prepared.state === "ready") {
          // One display tick can cross several sequence frames. Prepare a
          // contiguous run so the clock and audio queue need not stop at each
          // intervening frame even when its decoded samples are already warm.
          for (let n = 1; n <= nearbyCount; n++) {
            const next = frame + direction * n;
            if (next < 0 || next > endFrame) break;
            instance.prepare(next, audible);
          }
          if (audible) {
            // Warm upcoming decode windows and cuts before the clock reaches
            // them. A speculative read cannot hold or stop current playback.
            const ahead = frame - (frame % lookaheadStep) + lookahead;
            if (ahead > frame + nearbyCount && ahead < endFrame) instance.prepare(ahead, true);
          }
        }
        if (
          audible &&
          prepared.result &&
          typeof prepared.result !== "string" &&
          prepared.result.sound.length
        ) {
          void sound.current?.unlock();
          return sound.current?.readiness ?? "failed";
        }
        return prepared.state;
      },
      unlockSound: () => {
        void sound.current?.unlock();
      },
      presentSound: (frame, delay) => {
        const { result } = instance.prepare(frame, true);
        if (result && typeof result !== "string") {
          sound.current?.play(frame, delay, framesToSeconds(1, frameRate), result.sound);
        }
      },
    };
    if (registerPreview) previewSoundStops.set(gate, () => sound.current?.stop());
    const unregister = registerPreview?.(gate);
    return () => {
      reader.current = null;
      sound.current?.stop();
      previewSoundStops.delete(gate);
      unregister?.();
      instance.dispose();
    };
  }, [sequence, clips, sources, frameRate, registerPreview]);

  useLayoutEffect(() => {
    // A snapshot alone can't distinguish an endpoint seek from completion.
    // The session cancels explicit transport actions through the mounted gate.
    if (playback !== "forward" && playheadFrame !== durationFrames) sound.current?.stop();
  }, [playback, playheadFrame, durationFrames]);

  useLayoutEffect(() => {
    let current = true;
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const clear = () => {
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 1;
      context.fillStyle = "black";
      context.fillRect(0, 0, previewWidth, previewHeight);
    };
    // Gate polling also checks future sound. Only the displayed frame can
    // displace work, including a warm-up request now reached by the playhead.
    const prepared = reader.current?.prepare(
      playheadFrame,
      playback === "forward" || !!stoppedOnSound,
      "current",
    );
    if (prepared?.state === "loading") setMessage("Loading preview…");
    void prepared?.value.then(
      (result) => {
        if (!current) return;
        clear();
        if (result === "undefined-transition") {
          setMessage("Undefined transition");
          return;
        }
        context.globalCompositeOperation = "lighter";
        for (const { picture, weight } of result.picture) {
          context.globalAlpha = weight;
          context.drawImage(picture, 0, 0);
        }
        if (stoppedOnSound && result.sound.length && sound.current?.readiness === "failed") {
          clear();
          setMessage("No media · Audio output could not start in this browser.");
          return;
        }
        setMessage(undefined);
      },
      (error: unknown) => {
        if (!current) return;
        clear();
        setMessage(
          `No media · ${error instanceof Error ? error.message : "Unable to load rendition."}`,
        );
      },
    );
    return () => {
      current = false;
    };
  }, [sequence, clips, sources, frameRate, playheadFrame, playback, stoppedOnSound]);

  const status =
    playback === "forward"
      ? "Playing forward"
      : playback === "reverse"
        ? "Playing reverse"
        : "Paused";
  return (
    <>
      <h2 className="text-lg font-semibold">Preview</h2>
      {media ? (
        <div className="relative bg-black text-white">
          <canvas
            ref={canvas}
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- The decoded picture is drawn on the canvas.
            role="img"
            aria-label="Sequence picture"
            width={previewWidth}
            height={previewHeight}
            className="mx-auto block h-auto max-w-full"
          />
          {message && (
            <output className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-center">
              {message}
            </output>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-300">Preview is not connected.</p>
      )}
      <p className="text-sm text-slate-300">
        {status} · Sequence frame {playheadFrame} of {durationFrames}
      </p>
    </>
  );
}
