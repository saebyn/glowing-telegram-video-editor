import type { FrameRate } from "@/types";

export interface SequencePreviewProps {
  readonly playheadFrame: number;
  readonly frameRate: Readonly<FrameRate>;
  readonly durationFrames: number;
  readonly playback: "paused" | "forward" | "reverse";
}

export default function SequencePreview({
  playheadFrame,
  durationFrames,
  playback,
}: SequencePreviewProps) {
  const status =
    playback === "forward"
      ? "Playing forward"
      : playback === "reverse"
        ? "Playing reverse"
        : "Paused";

  return (
    <>
      <h2 className="text-lg font-semibold">Preview</h2>
      <p className="text-sm text-slate-300">Preview is not connected.</p>
      <p className="text-sm text-slate-300">
        {status} · Sequence frame {playheadFrame} of {durationFrames}
      </p>
    </>
  );
}
