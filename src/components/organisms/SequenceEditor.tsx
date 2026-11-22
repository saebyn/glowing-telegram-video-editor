import type { CutList } from "@saebyn/glowing-telegram-types";
import { useEffect, useId, useState } from "react";
import { useProjectFrameRate } from "@/context/ProjectContext";
import type { Sequence, SequenceSource, VideoClip } from "@/types";
import {
  evaluatePlacementFade,
  getFadeBounds,
  type PlacementFadeField,
} from "@/utils/fadePlacement";
import { getProjectFrameCount } from "@/utils/frames";
import {
  compileCutList,
  evaluatePlacementMove,
  getPlacementSourceRange,
  placeClipInGap,
} from "@/utils/sequence";
import {
  applyLeadingTrim,
  applyTrailingTrim,
  getMinimumTrimLength,
  getTrailingTrimBounds,
  type PlacementTrimEdge,
} from "@/utils/trimPlacement";
import ProjectClipPool from "./ProjectClipPool";
import SequenceTimeline from "./SequenceTimeline";
import { useSequenceTransport } from "./useSequenceTransport";

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

const fadeFields = [
  { field: "entryTransitionFrames", label: "Entry fade", button: "Apply entry fade" },
  { field: "revealTransitionFrames", label: "Reveal fade", button: "Apply reveal fade" },
] as const;

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
  const transport = useSequenceTransport(sequence.durationFrames, frameRate);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [poolClipId, setPoolClipId] = useState<string>();
  useEffect(() => {
    const endPoolDrag = () => setPoolClipId(undefined);
    window.addEventListener("dragend", endPoolDrag, true);
    return () => window.removeEventListener("dragend", endPoolDrag, true);
  }, []);
  const selectedTracks = sequence.tracks.flatMap((track) => {
    const placements = track.placements.filter(({ id }) => selection.includes(id));
    return placements.length > 0 ? [{ track, placements }] : [];
  });
  const selectedIds = selectedTracks.flatMap(({ placements }) => placements.map(({ id }) => id));
  const selectedTrack = selectedIds.length === 1 ? selectedTracks[0].track : undefined;
  const selectedPlacement = selectedIds.length === 1 ? selectedTracks[0].placements[0] : undefined;
  const selectedClip = clips.find(({ id }) => id === selectedPlacement?.clipId);
  const fadeBounds =
    onSequenceChange && selectedPlacement && selectedClip
      ? getFadeBounds(
          sequence,
          getProjectFrameCount(getPlacementSourceRange(selectedClip, selectedPlacement), frameRate),
        )
      : null;
  const trimBounds =
    onSequenceChange && selectedTrack && selectedPlacement && selectedClip
      ? getTrailingTrimBounds(selectedPlacement, selectedTrack, selectedClip, frameRate)
      : null;
  const minimumTrimLength = selectedPlacement ? getMinimumTrimLength(selectedPlacement) : 1;
  const trimHintId = useId();

  function selectPlacement(id: string | null, toggle: boolean) {
    if (id === null) setSelection([]);
    else if (!toggle) setSelection([id]);
    else if (selectedIds.includes(id)) setSelection(selectedIds.filter((other) => other !== id));
    else setSelection([...selectedIds, id]);
  }

  function commitEdit(next: Sequence) {
    onSequenceChange?.(next);
    onCutListChange?.(compileCutList(next, clips, sources, frameRate));
  }

  function dropClip(clipId: string, trackId: string, sequenceFrame: number) {
    const next = placeClipInGap(sequence, clips, frameRate, clipId, trackId, sequenceFrame);
    if (next) commitEdit(next);
  }

  function proposePlacementMove(
    placementId: string,
    trackIndex: number | null,
    sequenceFrame: number,
    placementIds: readonly string[],
  ) {
    return evaluatePlacementMove(
      sequence,
      clips,
      frameRate,
      placementId,
      trackIndex,
      sequenceFrame,
      placementIds,
    );
  }

  function proposePlacementFade(placementId: string, field: PlacementFadeField, duration: number) {
    return evaluatePlacementFade(sequence, clips, frameRate, placementId, field, duration);
  }

  function proposeTrim(placementId: string, edge: PlacementTrimEdge, sourceFrame: number) {
    const applyTrim = edge === "leading" ? applyLeadingTrim : applyTrailingTrim;
    return applyTrim(sequence, clips, frameRate, placementId, sourceFrame);
  }

  function trimPlacement(sourceOutFrame: number) {
    if (!onSequenceChange || !selectedPlacement) return;
    const next = proposeTrim(selectedPlacement.id, "trailing", sourceOutFrame);
    if (next) commitEdit(next);
  }

  return (
    <section
      className="space-y-4 bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      aria-label="Sequence editor"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="mr-3 text-xl font-semibold">Sequence editor</h1>
        <button
          type="button"
          disabled={transport.playheadFrame === 0}
          className="rounded border px-3 py-1 text-sm disabled:opacity-60"
          onClick={() => transport.play(-1)}
        >
          Play reverse
        </button>
        <button
          type="button"
          disabled={transport.playheadFrame === sequence.durationFrames}
          className="rounded border px-3 py-1 text-sm disabled:opacity-60"
          onClick={() => transport.play(1)}
        >
          Play forward
        </button>
        <button
          type="button"
          disabled={!transport.isPlaying}
          className="rounded border px-3 py-1 text-sm disabled:opacity-60"
          onClick={transport.pause}
        >
          Pause
        </button>
        <output
          aria-label="Sequence playhead position"
          aria-live="off"
          className="text-sm tabular-nums"
        >
          Sequence frame {transport.playheadFrame}
        </output>
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
          onDragStart={
            onSequenceChange
              ? (ids) => setPoolClipId(ids.length === 1 ? ids[0] : undefined)
              : undefined
          }
        />
        <section className="flex min-h-40 flex-col items-center justify-center rounded-lg bg-slate-900 p-4 text-center text-slate-100">
          <h2 className="text-lg font-semibold">Preview</h2>
          <p className="text-sm text-slate-300">Preview is not connected.</p>
        </section>
        <section
          aria-label="Selection inspector"
          className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800"
        >
          <h2 className="mb-2 text-lg font-semibold">Selection inspector</h2>
          {selectedIds.length > 1 && (
            <p className="text-sm">
              {selectedIds.length} placements selected
              <br />
              {selectedTracks.map(({ track }) => track.label).join(", ")}
            </p>
          )}
          {selectedClip && (
            <p className="mb-2 text-sm font-medium">
              {titles[selectedClip.id] ?? `Clip ${selectedClip.id}`}
            </p>
          )}
          {trimBounds && (
            <form
              key={`${selectedPlacement?.id}:${trimBounds.sourceOutFrame}`}
              className="mb-3 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                trimPlacement(Number(new FormData(event.currentTarget).get("sourceOutFrame")));
              }}
            >
              <label className="block space-y-1 text-sm">
                <span>Source out (exclusive frame)</span>
                <input
                  name="sourceOutFrame"
                  type="number"
                  required
                  min={trimBounds.min}
                  max={trimBounds.max}
                  step={1}
                  defaultValue={trimBounds.sourceOutFrame}
                  aria-describedby={minimumTrimLength > 1 ? trimHintId : undefined}
                  className="block w-full rounded border border-slate-400 bg-white px-2 py-1 dark:bg-slate-900"
                />
              </label>
              {minimumTrimLength > 1 && (
                <p id={trimHintId} className="text-sm">
                  Keep at least {minimumTrimLength} sequence frames for the fades.
                </p>
              )}
              <button
                type="submit"
                className="rounded bg-slate-800 px-3 py-1 text-sm text-white dark:bg-slate-600"
              >
                Trim placement
              </button>
            </form>
          )}
          {fadeBounds && selectedPlacement ? (
            <div className="space-y-3">
              {fadeFields.map(({ field, label, button }) => (
                <form
                  key={`${selectedPlacement.id}:${field}:${selectedPlacement[field]}`}
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const duration = Number(new FormData(event.currentTarget).get("duration"));
                    const next = proposePlacementFade(selectedPlacement.id, field, duration);
                    if (next) commitEdit(next);
                  }}
                >
                  <label className="block space-y-1 text-sm">
                    <span>{label} duration (sequence frames)</span>
                    <input
                      name="duration"
                      type="number"
                      required
                      min={fadeBounds.min}
                      max={fadeBounds.max}
                      step={1}
                      defaultValue={selectedPlacement[field]}
                      className="block w-full rounded border border-slate-400 bg-white px-2 py-1 dark:bg-slate-900"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded bg-slate-800 px-3 py-1 text-sm text-white dark:bg-slate-600"
                  >
                    {button}
                  </button>
                </form>
              ))}
            </div>
          ) : selectedIds.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {onSequenceChange
                ? "Select a placement to edit it."
                : "Placement and transition fields will appear here."}
            </p>
          ) : null}
        </section>
      </div>
      <SequenceTimeline
        playheadFrame={transport.playheadFrame}
        onSeek={transport.seek}
        sequence={sequence}
        clips={clips}
        titles={titles}
        poolClipId={poolClipId}
        onClipDrop={onSequenceChange ? dropClip : undefined}
        evaluateMove={onSequenceChange ? proposePlacementMove : undefined}
        onPlacementMove={onSequenceChange ? commitEdit : undefined}
        evaluateFade={onSequenceChange ? proposePlacementFade : undefined}
        onPlacementFade={onSequenceChange ? commitEdit : undefined}
        evaluateTrim={onSequenceChange ? proposeTrim : undefined}
        onPlacementTrim={onSequenceChange ? commitEdit : undefined}
        selectedPlacementIds={selectedIds}
        onPlacementSelect={onSequenceChange ? selectPlacement : undefined}
      />
    </section>
  );
}
