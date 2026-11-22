import type { CutList } from "@saebyn/glowing-telegram-types";
import { type KeyboardEvent, useEffect, useId, useState } from "react";
import { useProjectFrameRate } from "@/context/ProjectContext";
import type { ClipPlacement, Sequence, SequenceSource, VideoClip } from "@/types";
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
import { canSplitPlacementsAtPlayhead, splitPlacementsAtPlayhead } from "@/utils/splitPlacement";
import {
  applyLeadingTrim,
  applyTrailingTrim,
  getMinimumTrimLength,
  getTrailingTrimBounds,
  type PlacementTrimEdge,
} from "@/utils/trimPlacement";
import ProjectClipPool from "./ProjectClipPool";
import RenameSequenceTrack from "./RenameSequenceTrack";
import SequenceTimeline from "./SequenceTimeline";
import SequenceWorkspace from "./SequenceWorkspace";
import ShortenSequenceForm from "./ShortenSequenceForm";
import { useSequenceHistory } from "./useSequenceHistory";
import { useSequenceTransport } from "./useSequenceTransport";
import WorkspacePaneToggles, { type WorkspacePane } from "./WorkspacePaneToggles";

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
  { field: "entryTransition", label: "Entry fade", button: "Apply entry fade" },
  { field: "revealTransition", label: "Reveal fade", button: "Apply reveal fade" },
] as const;

function findTransition(sequence: Sequence, id: string | undefined) {
  if (id === undefined) return undefined;
  for (const track of sequence.tracks) {
    for (const placement of track.placements) {
      for (const { field, label } of fadeFields) {
        const transition = placement[field];
        if (transition?.id === id) return { track, placement, field, label, transition };
      }
    }
  }
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
  const transport = useSequenceTransport(sequence.durationFrames, frameRate);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [transitionId, setTransitionId] = useState<string>();
  const [poolClipId, setPoolClipId] = useState<string>();
  const [hiddenPanes, setHiddenPanes] = useState<ReadonlySet<WorkspacePane>>(() => new Set());
  const { commitEdit, undo, redo } = useSequenceHistory(sequence, emitEdit);
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
  const splitArgs = [sequence, clips, frameRate, selectedIds, transport.playheadFrame] as const;
  const canSplit = !!onSequenceChange && canSplitPlacementsAtPlayhead(...splitArgs);
  const selectedTrack = selectedIds.length === 1 ? selectedTracks[0].track : undefined;
  const selectedPlacement = selectedIds.length === 1 ? selectedTracks[0].placements[0] : undefined;
  const selectedTransition = findTransition(sequence, transitionId);
  const fadeOwner: ClipPlacement | undefined = selectedTransition?.placement ?? selectedPlacement;
  const fadeClip = clips.find(({ id }) => id === fadeOwner?.clipId);
  const selectedClip = clips.find(({ id }) => id === selectedPlacement?.clipId);
  const selectedSourceRange =
    selectedClip && selectedPlacement
      ? getPlacementSourceRange(selectedClip, selectedPlacement)
      : null;
  const selectedFrameCount = selectedSourceRange
    ? getProjectFrameCount(selectedSourceRange, frameRate)
    : null;
  const fadeBounds =
    onSequenceChange && fadeOwner && fadeClip
      ? getFadeBounds(
          sequence,
          getProjectFrameCount(getPlacementSourceRange(fadeClip, fadeOwner), frameRate),
        )
      : null;
  const trimBounds =
    onSequenceChange && selectedTrack && selectedPlacement && selectedClip
      ? getTrailingTrimBounds(selectedPlacement, selectedTrack, selectedClip, frameRate)
      : null;
  const minimumTrimLength = selectedPlacement ? getMinimumTrimLength(selectedPlacement) : 1;
  const trimHintId = useId();
  const shortcutsHintId = useId();

  function selectPlacement(id: string | null, toggle: boolean) {
    setTransitionId(undefined);
    if (id === null) setSelection([]);
    else if (!toggle) setSelection([id]);
    else if (selectedIds.includes(id)) setSelection(selectedIds.filter((other) => other !== id));
    else setSelection([...selectedIds, id]);
  }

  function selectTransition(id: string) {
    setSelection([]);
    setTransitionId(id);
  }

  function togglePane(pane: WorkspacePane) {
    setHiddenPanes((hidden) => {
      const next = new Set(hidden);
      if (!next.delete(pane)) next.add(pane);
      return next;
    });
  }

  function emitEdit(next: Sequence) {
    onSequenceChange?.(next);
    onCutListChange?.(compileCutList(next, clips, sources, frameRate));
  }

  function splitSelection() {
    const next = splitPlacementsAtPlayhead(...splitArgs, () => crypto.randomUUID());
    if (next) commitEdit(next);
  }

  function deleteSelection() {
    commitEdit({
      ...sequence,
      tracks: sequence.tracks.map((track) => ({
        ...track,
        placements: track.placements.filter(({ id }) => !selectedIds.includes(id)),
      })),
    });
  }

  function dropClip(clipId: string, trackId: string, sequenceFrame: number) {
    const next = placeClipInGap(sequence, clips, frameRate, clipId, trackId, sequenceFrame);
    if (next) commitEdit(next);
  }

  function proposePlacementMove(
    placementId: string,
    destinationTrack: string | number | null,
    sequenceFrame: number,
    placementIds: readonly string[],
  ) {
    return evaluatePlacementMove(
      sequence,
      clips,
      frameRate,
      placementId,
      destinationTrack,
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

  function handleEditorKeyDown(event: KeyboardEvent<HTMLElement>) {
    const { target } = event;
    if (
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !(target instanceof Element) ||
      !event.currentTarget.contains(target) ||
      target.closest("input, textarea, select, [contenteditable]")
    ) {
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      transport.seek(transport.playheadFrame + (event.key === "ArrowLeft" ? -1 : 1));
    } else if (event.key === "[" || event.key === "]") {
      const anchor = selectedTracks[0];
      if (!onSequenceChange || !anchor) return;
      event.preventDefault();
      const placement = anchor.placements[0];
      const move = proposePlacementMove(
        placement.id,
        anchor.track.id,
        placement.sequenceStartFrame + (event.key === "[" ? -1 : 1),
        selectedIds,
      );
      if (move.kind === "move") commitEdit(move.sequence);
    }
  }

  return (
    // The region owns editor shortcuts and is focusable without selecting a placement.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section
      className="space-y-4 bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      aria-label="Sequence editor"
      aria-describedby={shortcutsHintId}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      onKeyDown={handleEditorKeyDown}
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
        <button
          type="button"
          disabled={!canSplit}
          className="rounded border px-3 py-1 text-sm disabled:opacity-60"
          onClick={splitSelection}
        >
          Split
        </button>
        <button
          type="button"
          disabled={!onSequenceChange || !undo}
          className="rounded border px-3 py-1 text-sm disabled:opacity-60"
          onClick={undo}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!onSequenceChange || !redo}
          className="rounded border px-3 py-1 text-sm disabled:opacity-60"
          onClick={redo}
        >
          Redo
        </button>
        <button
          type="button"
          disabled={!onSequenceChange || selectedIds.length === 0}
          className="rounded border px-3 py-1 text-sm disabled:opacity-60"
          onClick={deleteSelection}
        >
          Delete
        </button>
        {onSequenceChange && (
          <ShortenSequenceForm
            sequence={sequence}
            clips={clips}
            frameRate={frameRate}
            onCommit={commitEdit}
          />
        )}
        {onSequenceChange && <RenameSequenceTrack sequence={sequence} onCommit={commitEdit} />}
        <WorkspacePaneToggles hiddenPanes={hiddenPanes} onToggle={togglePane} />
        <p id={shortcutsHintId} className="basis-full text-sm text-slate-600 dark:text-slate-300">
          Left/Right Arrow: step the playhead.
          {onSequenceChange && " [ and ]: nudge selection earlier or later."}
        </p>
      </header>
      <SequenceWorkspace
        hiddenPanes={hiddenPanes}
        clipPool={
          <ProjectClipPool
            clips={clips}
            sources={sources}
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
        }
        inspector={
          <>
            {selectedTransition && (
              <div className="mb-3 space-y-1 text-sm">
                <p className="font-medium">{selectedTransition.label}</p>
                <p>
                  Owner:{" "}
                  {titles[selectedTransition.placement.clipId] ??
                    `Clip ${selectedTransition.placement.clipId}`}{" "}
                  — {selectedTransition.track.label}, sequence frame{" "}
                  {selectedTransition.placement.sequenceStartFrame}
                </p>
                <p>{selectedTransition.transition.durationFrames} sequence frames</p>
              </div>
            )}
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
            {selectedSourceRange && selectedPlacement && selectedFrameCount !== null && (
              <div className="mb-3 space-y-1 text-sm tabular-nums">
                <p>
                  Source in/out (source frames): {selectedSourceRange.sourceInFrame} inclusive –{" "}
                  {selectedSourceRange.sourceOutFrame} exclusive
                </p>
                <p>
                  Sequence start/end (sequence frames): {selectedPlacement.sequenceStartFrame}{" "}
                  inclusive – {selectedPlacement.sequenceStartFrame + selectedFrameCount} exclusive
                </p>
              </div>
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
            {fadeBounds && fadeOwner ? (
              <div className="space-y-3">
                {fadeFields
                  .filter(({ field }) => !selectedTransition || field === selectedTransition.field)
                  .map(({ field, label, button }) => (
                    <form
                      key={`${fadeOwner.id}:${field}:${fadeOwner[field]?.id}:${fadeOwner[field]?.durationFrames}`}
                      className="space-y-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const duration = Number(new FormData(event.currentTarget).get("duration"));
                        const next = proposePlacementFade(fadeOwner.id, field, duration);
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
                          defaultValue={fadeOwner[field]?.durationFrames}
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
            ) : selectedIds.length === 0 && !selectedTransition ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {onSequenceChange
                  ? "Select a placement to edit it."
                  : "Placement and transition fields will appear here."}
              </p>
            ) : null}
          </>
        }
      />
      {!hiddenPanes.has("timeline") && (
        <SequenceTimeline
          playheadFrame={transport.playheadFrame}
          onSeek={transport.seek}
          sequence={sequence}
          sources={sources}
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
          selectedTransitionId={selectedTransition?.transition.id}
          onTransitionSelect={selectTransition}
        />
      )}
    </section>
  );
}
