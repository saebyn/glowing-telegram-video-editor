import type { CutList } from "@saebyn/glowing-telegram-types";
import { useState } from "react";
import { useProjectFrameRate } from "@/context/ProjectContext";
import type { Sequence, SequenceSource, VideoClip } from "@/types";
import { getProjectFrameCount } from "@/utils/frames";
import { compileCutList, getPlacementSourceRange, placeClipInGap } from "@/utils/sequence";
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
  const [selectedPlacementId, selectPlacement] = useState<string>();
  const editableTrack =
    onSequenceChange && sequence.tracks.length === 1 ? sequence.tracks[0] : null;
  const selectedPlacement = editableTrack?.placements.find(({ id }) => id === selectedPlacementId);
  const selectedClip = clips.find(({ id }) => id === selectedPlacement?.clipId);
  const maxEntryFrames =
    selectedPlacement && selectedClip
      ? getProjectFrameCount(getPlacementSourceRange(selectedClip, selectedPlacement), frameRate)
      : 0;

  function commitEdit(next: Sequence) {
    onSequenceChange?.(next);
    onCutListChange?.(compileCutList(next, clips, sources, frameRate));
  }

  function dropClip(clipId: string, sequenceFrame: number) {
    const next = placeClipInGap(sequence, clips, frameRate, clipId, sequenceFrame);
    if (next) commitEdit(next);
  }

  function applyEntryFade(duration: number) {
    if (
      !editableTrack ||
      !selectedPlacement ||
      !Number.isSafeInteger(duration) ||
      duration < 1 ||
      duration > maxEntryFrames ||
      duration === selectedPlacement.entryTransitionFrames
    ) {
      return;
    }
    commitEdit({
      ...sequence,
      tracks: [
        {
          ...editableTrack,
          placements: editableTrack.placements.map((placement) =>
            placement.id === selectedPlacement.id
              ? { ...placement, entryTransitionFrames: duration }
              : placement,
          ),
        },
      ],
    });
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
          {selectedPlacement && selectedClip && maxEntryFrames > 0 ? (
            <form
              key={`${selectedPlacement.id}:${selectedPlacement.entryTransitionFrames}`}
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                applyEntryFade(Number(new FormData(event.currentTarget).get("duration")));
              }}
            >
              <p className="text-sm font-medium">
                {titles[selectedClip.id] ?? `Clip ${selectedClip.id}`}
              </p>
              <label className="block space-y-1 text-sm">
                <span>Entry fade duration (sequence frames)</span>
                <input
                  name="duration"
                  type="number"
                  required
                  min={1}
                  max={maxEntryFrames}
                  step={1}
                  defaultValue={selectedPlacement.entryTransitionFrames}
                  className="block w-full rounded border border-slate-400 bg-white px-2 py-1 dark:bg-slate-900"
                />
              </label>
              <button
                type="submit"
                className="rounded bg-slate-800 px-3 py-1 text-sm text-white dark:bg-slate-600"
              >
                Apply
              </button>
            </form>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {editableTrack
                ? "Select a placement to edit its entry fade."
                : "Placement and transition fields will appear here."}
            </p>
          )}
        </section>
      </div>
      <SequenceTimeline
        sequence={sequence}
        clips={clips}
        titles={titles}
        onClipDrop={editableTrack ? dropClip : undefined}
        selectedPlacementId={selectedPlacement?.id}
        onPlacementSelect={editableTrack ? selectPlacement : undefined}
      />
    </section>
  );
}
