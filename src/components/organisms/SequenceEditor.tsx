import type { CutList } from "@saebyn/glowing-telegram-types";
import { useProjectFrameRate } from "@/context/ProjectContext";
import type { Sequence, SequenceSource, VideoClip } from "@/types";
import { compileCutList, placeClipInGap } from "@/utils/sequence";
import ProjectClipPool from "./ProjectClipPool";
import SequenceTimeline from "./SequenceTimeline";

export interface SequenceEditorProps {
  sequence: Sequence;
  clips: VideoClip[];
  sources: readonly SequenceSource[];
  thumbnails?: Record<string, string>;
  keyframes?: Record<string, string[]>;
  titles?: Record<string, string>;
  /** The host owns the sequence and feeds accepted edits back as props. Omit for read-only. */
  onSequenceChange?: (sequence: Sequence) => void;
  /** Emits null when a committed edit cannot be represented as a CutList. */
  onCutListChange?: (cutList: CutList | null) => void;
}

export default function SequenceEditor({
  sequence,
  clips,
  sources,
  thumbnails = {},
  keyframes = {},
  titles = {},
  onSequenceChange,
  onCutListChange,
}: SequenceEditorProps) {
  const frameRate = useProjectFrameRate();

  function dropClip(clipId: string, sequenceFrame: number) {
    const next = placeClipInGap(sequence, clips, frameRate, clipId, sequenceFrame);
    if (!next) return;
    onSequenceChange?.(next);
    onCutListChange?.(compileCutList(next, clips, sources, frameRate));
  }

  return (
    <section
      className="space-y-4 bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      aria-label="Sequence editor"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="mr-3 text-xl font-semibold">Sequence editor</h1>
        {["Split", "Undo"].map((label) => (
          <button
            type="button"
            key={label}
            disabled
            className="rounded border px-3 py-1 text-sm opacity-60"
          >
            {label}
          </button>
        ))}
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <ProjectClipPool
          clips={clips}
          thumbnails={thumbnails}
          keyframes={keyframes}
          titles={titles}
          clipWidth="136px"
          clipHeight="76px"
        />
        <section className="flex min-h-40 flex-col items-center justify-center rounded-lg bg-slate-900 p-4 text-center text-slate-100">
          <h2 className="text-lg font-semibold">Preview</h2>
          <p className="text-sm text-slate-300">Preview is not connected.</p>
        </section>
        <section className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
          <h2 className="mb-2 text-lg font-semibold">Selection inspector</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Placement and transition fields will appear here.
          </p>
        </section>
      </div>
      <SequenceTimeline
        sequence={sequence}
        clips={clips}
        titles={titles}
        onClipDrop={onSequenceChange && sequence.tracks.length === 1 ? dropClip : undefined}
      />
    </section>
  );
}
