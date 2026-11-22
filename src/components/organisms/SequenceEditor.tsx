import { TransportBar } from "@keplar-404/react-timeline-editor";
import type { CutList } from "@saebyn/glowing-telegram-types";
import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import { useProjectFrameRate } from "@/context/ProjectContext";
import type { ClipPlacement, Sequence, SequenceSource, VideoClip } from "@/types";
import { evaluatePlacementDissolve } from "@/utils/dissolvePlacement";
import {
  evaluatePlacementFade,
  getFadeBounds,
  getFadeSourceExtension,
  type PlacementFadeField,
} from "@/utils/fadePlacement";
import {
  formatTimecode,
  framesToSeconds,
  getProjectFrameCount,
  secondsToFrame,
} from "@/utils/frames";
import {
  compileCutList,
  evaluatePlacementMove,
  getFadeOutputIssue,
  getSequenceDissolves,
  hasTransitionAuthoringConflict,
  getPlacementSourceRange,
  placeClipInGap,
} from "@/utils/sequence";
import { canSplitPlacementsAtPlayhead, splitPlacementsAtPlayhead } from "@/utils/splitPlacement";
import { findPlacementTrack } from "@/utils/sequenceTracks";
import {
  applyLeadingTrim,
  applyTrailingTrim,
  getTrailingTrimBounds,
  type PlacementTrimEdge,
} from "@/utils/trimPlacement";
import ProjectClipPool from "./ProjectClipPool";
import RenameSequenceTrack from "./RenameSequenceTrack";
import SequenceTimeline from "./SequenceTimeline";
import { AddSequenceTrack } from "./SequenceTrackActions";
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
const fadeOutputMessages = {
  overlap: "CutList unavailable: authored fades overlap.",
  interrupted: "CutList unavailable: an authored fade crosses a visible cut.",
  gap: "CutList unavailable: an authored fade meets a gap. The missing side contributes black picture and silence.",
  dissolve: "CutList unavailable: the format cannot represent a centered dissolve.",
  "dissolve-conflict": "CutList unavailable: a centered dissolve competes with another transition.",
  "dissolve-interrupted": "CutList unavailable: a visible cut interrupts a centered dissolve.",
  "dissolve-gap":
    "CutList unavailable: a centered dissolve meets a gap. The missing side contributes black picture and silence.",
} as const;

function findTransition(sequence: Sequence, id: string | undefined) {
  if (id === undefined) return undefined;
  for (const track of sequence.tracks) {
    for (const placement of track.placements) {
      for (const { field, label } of fadeFields) {
        const transition = placement[field];
        if (transition?.id === id)
          return {
            track,
            placement,
            field,
            transition,
            label: transition.kind === "dissolve" ? "Centered dissolve" : label,
          };
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
  const jumpFrames = secondsToFrame(1, frameRate);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [inspectorPlacementId, setInspectorPlacementId] = useState<string>();
  const [transitionId, setTransitionId] = useState<string>();
  const [splitMode, setSplitMode] = useState(false);
  const [blockedTrackEdit, setBlockedTrackEdit] = useState<Sequence>();
  const [dissolveConflict, setDissolveConflict] = useState(false);
  const [poolClipId, setPoolClipId] = useState<string>();
  const [hiddenPanes, setHiddenPanes] = useState<ReadonlySet<WorkspacePane>>(() => new Set());
  const { commitEdit, undo, redo } = useSequenceHistory(sequence, emitEdit);
  const fadeOutputIssue = useMemo(
    () => getFadeOutputIssue(sequence, clips, sources, frameRate),
    [sequence, clips, sources, frameRate],
  );
  useEffect(() => {
    const endPoolDrag = () => setPoolClipId(undefined);
    window.addEventListener("dragend", endPoolDrag, true);
    return () => window.removeEventListener("dragend", endPoolDrag, true);
  }, []);
  useEffect(() => {
    if (!splitMode) return;
    const dismissSplitMode = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      setSplitMode(false);
    };
    window.addEventListener("keydown", dismissSplitMode);
    return () => window.removeEventListener("keydown", dismissSplitMode);
  }, [splitMode]);
  const selectedTracks = sequence.tracks.flatMap((track) => {
    const placements = track.placements.filter(({ id }) => selection.includes(id));
    return placements.length > 0 ? [{ track, placements }] : [];
  });
  const selectedPlacements = selectedTracks.flatMap(({ track, placements }) =>
    placements.map((placement) => ({ track, placement })),
  );
  const selectedIds = selectedPlacements.map(({ placement }) => placement.id);
  const splitTargets = sequence.tracks.flatMap(({ placements }) => placements.map(({ id }) => id));
  const splitArgs = [sequence, clips, frameRate, splitTargets, transport.playheadFrame] as const;
  const canSplit = !!onSequenceChange && canSplitPlacementsAtPlayhead(...splitArgs);
  const inspectorTarget =
    selectedPlacements.find(({ placement }) => placement.id === inspectorPlacementId) ??
    selectedPlacements[0];
  const inspectedPlacement = inspectorTarget?.placement;
  // Keep a valid target as membership or host-supplied placements change.
  if (inspectorPlacementId !== inspectedPlacement?.id) {
    setInspectorPlacementId(inspectedPlacement?.id);
  }
  const selectedTransition = findTransition(sequence, transitionId);
  const sequenceDissolves = useMemo(
    () => getSequenceDissolves(sequence, clips, sources, frameRate),
    [sequence, clips, sources, frameRate],
  );
  const dissolveDetails =
    selectedTransition && sequenceDissolves.get(selectedTransition.transition.id);
  const fadeOwner: ClipPlacement | undefined = selectedTransition?.placement ?? inspectedPlacement;
  const fadeClip = clips.find(({ id }) => id === fadeOwner?.clipId);
  const fadeSourceExtension =
    selectedTransition && fadeClip
      ? getFadeSourceExtension(
          selectedTransition.placement,
          selectedTransition.field,
          fadeClip,
          frameRate,
          sequence.durationFrames,
        )
      : null;
  const inspectedClip = clips.find(({ id }) => id === inspectedPlacement?.clipId);
  const inspectedSourceRange =
    inspectedClip && inspectedPlacement
      ? getPlacementSourceRange(inspectedClip, inspectedPlacement)
      : null;
  const inspectedFrameCount = inspectedSourceRange
    ? getProjectFrameCount(inspectedSourceRange, frameRate)
    : null;
  const fadeBounds =
    onSequenceChange && fadeOwner && fadeClip
      ? getFadeBounds(getProjectFrameCount(getPlacementSourceRange(fadeClip, fadeOwner), frameRate))
      : null;
  const trimBounds =
    onSequenceChange && inspectorTarget && inspectedClip
      ? getTrailingTrimBounds(
          inspectorTarget.placement,
          inspectorTarget.track,
          inspectedClip,
          frameRate,
        )
      : null;
  const shortcutsHintId = useId();

  function selectPlacement(id: string | null, toggle: boolean) {
    setBlockedTrackEdit(undefined);
    setDissolveConflict(false);
    setTransitionId(undefined);
    if (id === null) setSelection([]);
    else if (!toggle) setSelection([id]);
    else if (selectedIds.includes(id)) setSelection(selectedIds.filter((other) => other !== id));
    else setSelection([...selectedIds, id]);
  }

  function selectTransition(id: string) {
    setBlockedTrackEdit(undefined);
    setDissolveConflict(false);
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
    setBlockedTrackEdit(undefined);
    onSequenceChange?.(next);
    onCutListChange?.(compileCutList(next, clips, sources, frameRate));
  }

  function splitAtPlayhead() {
    const next = splitPlacementsAtPlayhead(...splitArgs, () => crypto.randomUUID());
    if (next) commitEdit(next);
  }

  function splitAtPointer(placementId: string, frame: number) {
    if (findPlacementTrack(sequence, placementId)?.locked) {
      setBlockedTrackEdit(sequence);
      return;
    }
    const next = splitPlacementsAtPlayhead(sequence, clips, frameRate, [placementId], frame, () =>
      crypto.randomUUID(),
    );
    if (next) commitEdit(next);
  }

  function deleteSelection() {
    if (selectedTracks.some(({ track }) => track.locked)) {
      setBlockedTrackEdit(sequence);
      return;
    }
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

  function proposePlacementFade(
    placementId: string,
    field: PlacementFadeField,
    duration: number,
    onConflict?: () => void,
  ) {
    const next = evaluatePlacementFade(sequence, clips, frameRate, placementId, field, duration);
    if (next) {
      const transitions = next.tracks
        .flatMap(({ placements }) => placements)
        .find(({ id }) => id === placementId);
      const transitionId = transitions?.[field]?.id;
      if (
        transitionId &&
        hasTransitionAuthoringConflict(next, clips, sources, frameRate, transitionId)
      ) {
        onConflict?.();
        return null;
      }
    }
    return next;
  }

  function proposeTrim(placementId: string, edge: PlacementTrimEdge, sourceFrame: number) {
    const applyTrim = edge === "leading" ? applyLeadingTrim : applyTrailingTrim;
    return applyTrim(sequence, clips, frameRate, placementId, sourceFrame);
  }

  function trimPlacement(sourceOutFrame: number) {
    if (!onSequenceChange || !inspectedPlacement) return;
    if (inspectorTarget?.track.locked) {
      setBlockedTrackEdit(sequence);
      return;
    }
    const next = proposeTrim(inspectedPlacement.id, "trailing", sourceOutFrame);
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
      if (move.kind === "blocked" && move.reason === "locked-track") setBlockedTrackEdit(sequence);
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
        <fieldset className="gtve-sequence-transport">
          <legend className="sr-only">Sequence transport</legend>
          <button
            type="button"
            disabled={transport.playheadFrame === 0}
            className="timeline-transport-btn timeline-transport-btn--primary gtve-play-reverse"
            aria-label="Play reverse"
            aria-pressed={transport.isReversing}
            title={transport.isReversing ? "Pause reverse" : "Play reverse"}
            onClick={() => {
              if (transport.isReversing) transport.pause();
              else transport.play(-1);
            }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M12 1.5 1 7l11 5.5z" />
            </svg>
          </button>
          <div
            className="min-w-0 max-w-full"
            onClickCapture={(event) => {
              // Keplar's buttons omit type="button"; never submit a surrounding host form.
              if ((event.target as Element).closest("button")) event.preventDefault();
            }}
          >
            <TransportBar
              playRates={[]}
              formatDisplayTime={() =>
                `${formatTimecode(transport.playheadFrame, frameRate)}\n${transport.playheadFrame} fr`
              }
              player={{
                isPlaying: transport.isPlaying,
                currentTime: framesToSeconds(transport.playheadFrame, frameRate),
                playRate: 1,
                play: () => {
                  if (transport.playheadFrame < sequence.durationFrames) transport.play(1);
                },
                pause: transport.pause,
                stop: () => transport.seek(0),
                toStart: () => transport.seek(0),
                rewind: () => transport.seek(transport.playheadFrame - jumpFrames),
                forward: () => transport.seek(transport.playheadFrame + jumpFrames),
                setTime: (seconds) => transport.seek(secondsToFrame(seconds, frameRate)),
                setPlayRate: () => {},
              }}
            />
          </div>
          <output aria-label="Sequence playhead position" aria-live="off" className="sr-only">
            Sequence frame {transport.playheadFrame}
          </output>
        </fieldset>
        <button
          type="button"
          disabled={!canSplit}
          className="rounded border px-3 py-1 text-sm disabled:opacity-60"
          onClick={splitAtPlayhead}
        >
          Split
        </button>
        {onSequenceChange && (
          <button
            type="button"
            aria-pressed={splitMode}
            className="rounded border px-3 py-1 text-sm aria-pressed:bg-amber-200 aria-pressed:text-amber-950"
            onClick={() => setSplitMode((active) => !active)}
          >
            Split mode
          </button>
        )}
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
        {onSequenceChange && <AddSequenceTrack sequence={sequence} onCommit={commitEdit} />}
        {onSequenceChange && <RenameSequenceTrack sequence={sequence} onCommit={commitEdit} />}
        <WorkspacePaneToggles hiddenPanes={hiddenPanes} onToggle={togglePane} />
        <p id={shortcutsHintId} className="basis-full text-sm text-slate-600 dark:text-slate-300">
          Left/Right Arrow: step the playhead.
          {onSequenceChange && " [ and ]: nudge selection earlier or later."}
        </p>
      </header>
      {fadeOutputIssue && (
        <output className="block text-sm text-amber-900 dark:text-amber-200">
          {fadeOutputMessages[fadeOutputIssue]}
        </output>
      )}
      {blockedTrackEdit === sequence && (
        <output className="block text-sm text-amber-900 dark:text-amber-200">
          Blocked: the track is locked.
        </output>
      )}
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
            {(inspectorTarget?.track.locked || selectedTransition?.track.locked) && (
              <p className="mb-2 text-sm">
                This track is locked. Its placements can be inspected but not edited.
              </p>
            )}
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
                {dissolveDetails && (
                  <>
                    <p>
                      Dissolve window: {dissolveDetails.startFrame} inclusive –{" "}
                      {dissolveDetails.endFrame} exclusive (sequence frames)
                    </p>
                    <p>Linear picture blend and audio crossfade</p>
                    {dissolveDetails.phaseOffsetFrames > 0 && (
                      <p>
                        Blend starts {dissolveDetails.phaseOffsetFrames} sequence frames into its
                        authored phase.
                      </p>
                    )}
                    {dissolveDetails.covered && <p>Covered by a higher track</p>}
                    {(["outgoing", "incoming"] as const).map((side) => {
                      const extension =
                        side === "outgoing"
                          ? dissolveDetails.outgoingExtension
                          : dissolveDetails.incomingExtension;
                      const fallback =
                        side === "outgoing"
                          ? dissolveDetails.outgoingFallback
                          : dissolveDetails.incomingFallback;
                      const label = side === "outgoing" ? "Outgoing" : "Incoming";
                      return (
                        <div key={side}>
                          {extension && (
                            <p>
                              {label} extension: {extension.startFrame} inclusive –{" "}
                              {extension.endFrame} exclusive (source frames)
                            </p>
                          )}
                          {fallback.picture && <p>{label} picture: black</p>}
                          {fallback.audio && <p>{label} audio: silence</p>}
                        </div>
                      );
                    })}
                  </>
                )}
                {fadeSourceExtension && (
                  <p>
                    Transition source extension: {fadeSourceExtension.startFrame} inclusive –{" "}
                    {fadeSourceExtension.endFrame} exclusive (source frames)
                  </p>
                )}
              </div>
            )}
            {selectedIds.length > 1 && (
              <div className="mb-2 space-y-2 text-sm">
                <p>
                  {selectedIds.length} placements selected
                  <br />
                  {selectedTracks.map(({ track }) => track.label).join(", ")}
                </p>
                <label className="block space-y-1">
                  <span>Inspect placement</span>
                  <select
                    className="block w-full rounded border border-slate-400 bg-white px-2 py-1 dark:bg-slate-900"
                    value={inspectedPlacement?.id}
                    onChange={(event) => setInspectorPlacementId(event.currentTarget.value)}
                  >
                    {selectedPlacements.map(({ track, placement }) => (
                      <option key={placement.id} value={placement.id}>
                        {titles[placement.clipId] ?? `Clip ${placement.clipId}`} — {track.label}
                        {selectedTracks.some(
                          ({ track: other }) => other !== track && other.label === track.label,
                        ) && ` (track ${sequence.tracks.indexOf(track) + 1})`}
                        , sequence frame {placement.sequenceStartFrame}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {selectedIds.length === 1 && inspectedClip && (
              <p className="mb-2 text-sm font-medium">
                {titles[inspectedClip.id] ?? `Clip ${inspectedClip.id}`}
              </p>
            )}
            {inspectedSourceRange && inspectedPlacement && inspectedFrameCount !== null && (
              <div className="mb-3 space-y-1 text-sm tabular-nums">
                <p>
                  Source in/out (source frames): {inspectedSourceRange.sourceInFrame} inclusive –{" "}
                  {inspectedSourceRange.sourceOutFrame} exclusive
                </p>
                <p>
                  Sequence start/end (sequence frames): {inspectedPlacement.sequenceStartFrame}{" "}
                  inclusive – {inspectedPlacement.sequenceStartFrame + inspectedFrameCount}{" "}
                  exclusive
                </p>
              </div>
            )}
            {trimBounds && (
              <form
                key={`${inspectedPlacement?.id}:${trimBounds.sourceOutFrame}`}
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
                    className="block w-full rounded border border-slate-400 bg-white px-2 py-1 dark:bg-slate-900"
                  />
                </label>
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
                  .filter(
                    ({ field }) =>
                      fadeOwner[field]?.kind !== "dissolve" &&
                      (!selectedTransition || field === selectedTransition.field),
                  )
                  .map(({ field, label, button }) => (
                    <form
                      key={`${fadeOwner.id}:${field}:${fadeOwner[field]?.id}:${fadeOwner[field]?.durationFrames}`}
                      className="space-y-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (findPlacementTrack(sequence, fadeOwner.id)?.locked) {
                          setBlockedTrackEdit(sequence);
                          return;
                        }
                        const duration = Number(new FormData(event.currentTarget).get("duration"));
                        setDissolveConflict(false);
                        const next = proposePlacementFade(fadeOwner.id, field, duration, () =>
                          setDissolveConflict(true),
                        );
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
            {onSequenceChange &&
              fadeOwner &&
              (!selectedTransition || selectedTransition.transition.kind === "dissolve") && (
                <details
                  key={fadeOwner.id}
                  open={selectedTransition?.transition.kind === "dissolve" || undefined}
                  className="mt-3 space-y-3"
                >
                  <summary className="cursor-pointer text-sm font-medium">
                    Centered dissolves
                  </summary>
                  {fadeFields
                    .filter(
                      ({ field }) =>
                        fadeOwner[field]?.kind !== "fade" &&
                        (!selectedTransition || field === selectedTransition.field),
                    )
                    .map(({ field }) => {
                      const edge = field === "entryTransition" ? "leading" : "trailing";
                      const transition = fadeOwner[field];
                      return (
                        <form
                          key={`dissolve:${fadeOwner.id}:${field}:${transition?.durationFrames}`}
                          className="space-y-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const duration = Number(
                              new FormData(event.currentTarget).get("duration"),
                            );
                            const edit = evaluatePlacementDissolve(
                              sequence,
                              clips,
                              sources,
                              frameRate,
                              fadeOwner,
                              field,
                              duration,
                            );
                            setDissolveConflict(edit.kind === "conflict");
                            if (edit.kind === "locked") setBlockedTrackEdit(sequence);
                            if (edit.kind === "edit") commitEdit(edit.sequence);
                          }}
                        >
                          <label className="block space-y-1 text-sm">
                            <span>
                              {edge === "leading" ? "Leading" : "Trailing"} dissolve duration
                              (sequence frames)
                            </span>
                            <input
                              name="duration"
                              type="number"
                              required
                              min={1}
                              step={1}
                              defaultValue={transition?.durationFrames}
                              className="block w-full rounded border border-slate-400 bg-white px-2 py-1 dark:bg-slate-900"
                            />
                          </label>
                          <button
                            type="submit"
                            className="rounded bg-slate-800 px-3 py-1 text-sm text-white dark:bg-slate-600"
                          >
                            Apply {edge} dissolve
                          </button>
                        </form>
                      );
                    })}
                </details>
              )}
            {dissolveConflict && (
              <p role="alert" className="text-sm">
                This transition competes with another transition on the same cut or visible frames.
              </p>
            )}
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
          onTrackEdit={onSequenceChange ? commitEdit : undefined}
          onClipDrop={onSequenceChange ? dropClip : undefined}
          evaluateMove={onSequenceChange ? proposePlacementMove : undefined}
          onPlacementMove={onSequenceChange ? commitEdit : undefined}
          evaluateFade={onSequenceChange ? proposePlacementFade : undefined}
          onPlacementFade={onSequenceChange ? commitEdit : undefined}
          evaluateTrim={onSequenceChange ? proposeTrim : undefined}
          onPlacementTrim={onSequenceChange ? commitEdit : undefined}
          selectedPlacementIds={selectedIds}
          onPlacementSelect={onSequenceChange ? selectPlacement : undefined}
          onPlacementSplit={onSequenceChange && splitMode ? splitAtPointer : undefined}
          selectedTransitionId={selectedTransition?.transition.id}
          dissolveDetails={sequenceDissolves}
          onTransitionSelect={selectTransition}
        />
      )}
    </section>
  );
}
