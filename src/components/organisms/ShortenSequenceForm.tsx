import { useState } from "react";
import type { FrameRate, Sequence, VideoClip } from "@/types";
import { shortenSequence } from "@/utils/shortenSequence";

interface ShortenSequenceFormProps {
  sequence: Sequence;
  clips: readonly VideoClip[];
  frameRate: FrameRate;
  onCommit: (next: Sequence) => void;
}

export default function ShortenSequenceForm({
  sequence,
  clips,
  frameRate,
  onCommit,
}: ShortenSequenceFormProps) {
  const [blocked, setBlocked] = useState(false);
  return (
    <details className="relative text-sm">
      <summary className="cursor-pointer rounded border px-3 py-1">Sequence endpoint</summary>
      <form
        key={sequence.durationFrames}
        className="absolute z-30 mt-1 grid w-60 gap-2 rounded border bg-white p-3 shadow dark:bg-slate-900"
        onSubmit={(event) => {
          event.preventDefault();
          const field = event.currentTarget.elements.namedItem("endFrame") as HTMLInputElement;
          const next = shortenSequence(sequence, clips, frameRate, field.valueAsNumber);
          if (next) onCommit(next);
          setBlocked(!next);
        }}
      >
        <label className="grid gap-1">
          Sequence end (exclusive frame)
          <input
            type="number"
            name="endFrame"
            required
            min={0}
            max={sequence.durationFrames}
            step={1}
            defaultValue={sequence.durationFrames}
            onChange={() => setBlocked(false)}
            className="rounded border px-2 py-1"
          />
        </label>
        <button type="submit" className="rounded border px-3 py-1">
          Shorten sequence
        </button>
        {blocked && (
          <p role="alert">Enter a shorter endpoint that leaves every placement intact.</p>
        )}
      </form>
    </details>
  );
}
