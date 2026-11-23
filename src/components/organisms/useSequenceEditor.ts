import type { CutList } from "@saebyn/glowing-telegram-types";
import { useMemo, useState } from "react";
import { useProjectFrameRate } from "@/context/ProjectContext";
import type { ClipPlacement, Sequence, SequenceSource, VideoClip } from "@/types";
import { evaluatePlacementDissolve } from "@/utils/dissolvePlacement";
import {
  evaluatePlacementFade,
  getFadeBounds,
  getFadeSourceExtension,
  type PlacementFadeField,
} from "@/utils/fadePlacement";
import { getProjectFrameCount } from "@/utils/frames";
import {
  compileCutList,
  evaluatePlacementMove,
  getFadeOutputIssue,
  getPlacementSourceRange,
  getSequenceDissolves,
  hasTransitionAuthoringConflict,
  placeClipInGap,
} from "@/utils/sequence";
import { findPlacementTrack } from "@/utils/sequenceTracks";
import { canSplitPlacementsAtPlayhead, splitPlacementsAtPlayhead } from "@/utils/splitPlacement";
import {
  applyLeadingTrim,
  applyTrailingTrim,
  getTrailingTrimBounds,
  type PlacementTrimEdge,
} from "@/utils/trimPlacement";
import type { SequencePreviewPlaceholderProps } from "./SequencePreviewPlaceholder";
import { useSequenceHistory } from "./useSequenceHistory";
import { useSequenceTransport } from "./useSequenceTransport";

export interface UseSequenceEditorOptions {
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

export const fadeFields = [
  { field: "entryTransition", label: "Entry fade", button: "Apply entry fade" },
  { field: "revealTransition", label: "Reveal fade", button: "Apply reveal fade" },
] as const;

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

export function useSequenceEditor({
  sequence,
  clips,
  sources,
  onSequenceChange,
  onCutListChange,
}: UseSequenceEditorOptions) {
  const frameRate = useProjectFrameRate();
  const transport = useSequenceTransport(sequence.durationFrames, frameRate);
  const previewProps: SequencePreviewPlaceholderProps = {
    playheadFrame: transport.playheadFrame,
    frameRate,
    durationFrames: sequence.durationFrames,
    playback: transport.isReversing ? "reverse" : transport.isPlaying ? "forward" : "paused",
  };
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [inspectorPlacementId, setInspectorPlacementId] = useState<string>();
  const [transitionId, setTransitionId] = useState<string>();
  const [splitMode, setSplitMode] = useState(false);
  const [blockedTrackEdit, setBlockedTrackEdit] = useState<Sequence>();
  const [dissolveConflict, setDissolveConflict] = useState(false);
  const { commitEdit, undo, redo } = useSequenceHistory(sequence, emitEdit);
  const fadeOutputIssue = useMemo(
    () => getFadeOutputIssue(sequence, clips, sources, frameRate),
    [sequence, clips, sources, frameRate],
  );
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

  function nudgeSelection(offset: number) {
    const anchor = selectedTracks[0];
    if (!onSequenceChange || !anchor) return;
    const placement = anchor.placements[0];
    const move = proposePlacementMove(
      placement.id,
      anchor.track.id,
      placement.sequenceStartFrame + offset,
      selectedIds,
    );
    if (move.kind === "move") commitEdit(move.sequence);
    if (move.kind === "blocked" && move.reason === "locked-track") setBlockedTrackEdit(sequence);
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

  function editInspectedFade(field: PlacementFadeField, duration: number) {
    if (!onSequenceChange || !fadeOwner) return;
    if (findPlacementTrack(sequence, fadeOwner.id)?.locked) {
      setBlockedTrackEdit(sequence);
      return;
    }
    setDissolveConflict(false);
    const next = proposePlacementFade(fadeOwner.id, field, duration, () =>
      setDissolveConflict(true),
    );
    if (next) commitEdit(next);
  }

  function editInspectedDissolve(field: PlacementFadeField, duration: number) {
    if (!onSequenceChange || !fadeOwner) return;
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
  }

  return {
    previewProps,
    transport,
    selectedIds,
    selectedTracks,
    selectedPlacements,
    inspectedPlacement,
    inspectedClip,
    inspectorTarget,
    inspectedSourceRange,
    inspectedFrameCount,
    setInspectorPlacementId,
    selectedTransition,
    dissolveDetails,
    sequenceDissolves,
    fadeOwner,
    fadeSourceExtension,
    fadeBounds,
    trimBounds,
    fadeOutputIssue: fadeOutputIssue as ReturnType<typeof getFadeOutputIssue>,
    dissolveConflict,
    trackEditBlocked: blockedTrackEdit === sequence,
    splitMode,
    setSplitMode,
    canSplit,
    splitAtPlayhead,
    splitAtPointer,
    commitEdit,
    undo,
    redo,
    deleteSelection,
    selectPlacement,
    selectTransition,
    editInspectedFade,
    editInspectedDissolve,
    nudgeSelection,
    dropClip,
    trimPlacement,
    proposePlacementMove,
    proposePlacementFade,
    proposeTrim,
  };
}
