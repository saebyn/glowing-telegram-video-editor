import type { CutList } from "@saebyn/glowing-telegram-types";
import { type KeyboardEvent, useMemo, useState } from "react";
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
  evaluatePoolDrop,
  getFadeOutputIssue,
  getPlacementSourceRange,
  getSequenceDissolves,
  hasTransitionAuthoringConflict,
  placeClipInGap,
} from "@/utils/sequence";
import {
  addSequenceTrack,
  canRemoveSequenceTrack,
  findPlacementTrack,
  removeSequenceTrack,
  reorderSequenceTrack,
  toggleSequenceTrackLock,
} from "@/utils/sequenceTracks";
import { shortenSequence } from "@/utils/shortenSequence";
import { canSplitPlacementsAtPlayhead, splitPlacementsAtPlayhead } from "@/utils/splitPlacement";
import {
  applyLeadingTrim,
  applyTrailingTrim,
  getTrailingTrimBounds,
  getTrimmableSourceRange,
  type PlacementTrimEdge,
} from "@/utils/trimPlacement";
import type { SequencePreviewPlaceholderProps } from "./SequencePreviewPlaceholder";
import type { SequenceInspectorProps } from "./SequenceInspector";
import type { SequenceClipPoolProps } from "./SequenceClipPool";
import type {
  PlacementMoveIntent,
  PlaceClipIntent,
  PlacementMovePreview,
  PlacementMovePreviewIntent,
  SequenceTimelineProps,
  TimelineFadeIntent,
  TimelinePlacementActivation,
  TimelineTrimIntent,
} from "./SequenceTimeline";
import type { SequenceToolbarProps } from "./SequenceToolbar";
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

export function useSequenceEditor({
  sequence,
  clips,
  sources,
  thumbnails = emptyThumbnails,
  keyframes = emptyKeyframes,
  titles = emptyThumbnails,
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
  const [activeClipId, setActiveClipId] = useState<string>();
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

  function previewClipPlacement({ clipId, trackId, sequenceFrame }: PlaceClipIntent) {
    return evaluatePoolDrop(sequence, clips, frameRate, clipId, trackId, sequenceFrame);
  }

  function placeClip({ clipId, trackId, sequenceFrame }: PlaceClipIntent) {
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

  function previewPlacementMove({
    placementId,
    trackId,
    outsideTrackOffset,
    sequenceFrame,
    placementIds,
  }: PlacementMovePreviewIntent): PlacementMovePreview {
    const destination =
      trackId ??
      (outsideTrackOffset && Number.isSafeInteger(outsideTrackOffset)
        ? outsideTrackOffset < 0
          ? outsideTrackOffset
          : sequence.tracks.length - 1 + outsideTrackOffset
        : null);
    const result = proposePlacementMove(placementId, destination, sequenceFrame, placementIds);
    const destinations = result.destinations.map(
      ({ placementId, trackIndex, sequenceStartFrame }) => ({
        placementId,
        trackId: trackIndex === null ? null : (sequence.tracks[trackIndex]?.id ?? null),
        sequenceStartFrame,
      }),
    );
    return result.kind === "blocked"
      ? { kind: result.kind, reason: result.reason, trackId: result.trackId, destinations }
      : { kind: result.kind, destinations };
  }

  function movePlacement({
    placementId,
    trackId,
    sequenceFrame,
    placementIds,
  }: PlacementMoveIntent) {
    const result = proposePlacementMove(placementId, trackId, sequenceFrame, placementIds);
    if (result.kind === "move") commitEdit(result.sequence);
    if (result.kind === "blocked" && result.reason === "locked-track")
      setBlockedTrackEdit(sequence);
  }

  function endClipDrag() {
    setActiveClipId(undefined);
  }

  const clipPoolProps: SequenceClipPoolProps = {
    frameRate,
    clips,
    sources,
    titles,
    thumbnails,
    keyframes,
    beginClipDrag: onSequenceChange
      ? (id) => setActiveClipId(clips.some((clip) => clip.id === id) ? id : undefined)
      : undefined,
    endClipDrag,
  };

  const { trimRanges, fadePlacementIds, removableTrackIds } = useMemo(() => {
    const trimRanges = new Map<string, { sourceInFrame: number; sourceOutFrame: number }>();
    const fadePlacementIds = new Set<string>();
    for (const track of sequence.tracks) {
      for (const placement of track.placements) {
        const clip = clips.find(({ id }) => id === placement.clipId);
        if (!clip) continue;
        const trimRange = getTrimmableSourceRange(placement, clip, frameRate);
        if (trimRange) trimRanges.set(placement.id, trimRange);
        if (
          getFadeBounds(getProjectFrameCount(getPlacementSourceRange(clip, placement), frameRate))
        )
          fadePlacementIds.add(placement.id);
      }
    }
    const removableTrackIds = sequence.tracks
      .filter((track) => canRemoveSequenceTrack(sequence, track))
      .map(({ id }) => id);
    return { trimRanges, fadePlacementIds, removableTrackIds };
  }, [sequence, clips, frameRate]);

  function activatePlacement({
    placementId,
    sequenceFrame,
    toggle = false,
  }: TimelinePlacementActivation) {
    if (splitMode) {
      if (sequenceFrame !== undefined) splitAtPointer(placementId, sequenceFrame);
    } else if (findPlacementTrack(sequence, placementId)) {
      selectPlacement(placementId, toggle);
    }
  }

  function previewFade({ placementId, field, durationFrames }: TimelineFadeIntent) {
    let blocked: "blocked" | "conflict" = "blocked";
    return proposePlacementFade(placementId, field, durationFrames, () => {
      blocked = "conflict";
    })
      ? ("valid" as const)
      : blocked;
  }

  function editFade({ placementId, field, durationFrames }: TimelineFadeIntent) {
    const next = proposePlacementFade(placementId, field, durationFrames);
    if (next) commitEdit(next);
  }

  const timelineProps: SequenceTimelineProps = {
    frameRate,
    playheadFrame: transport.playheadFrame,
    onSeek: transport.seek,
    durationFrames: sequence.durationFrames,
    tracks: sequence.tracks,
    sources,
    clips,
    titles,
    activeClipId,
    endClipDrag,
    previewClipPlacement: onSequenceChange ? previewClipPlacement : undefined,
    placeClip: onSequenceChange ? placeClip : undefined,
    previewPlacementMove: onSequenceChange ? previewPlacementMove : undefined,
    movePlacement: onSequenceChange ? movePlacement : undefined,
    reorderTrack: onSequenceChange
      ? (trackId, destinationTrackId) => {
          const next = reorderSequenceTrack(
            sequence,
            trackId,
            sequence.tracks.findIndex(({ id }) => id === destinationTrackId),
          );
          if (next) commitEdit(next);
        }
      : undefined,
    removeTrack: onSequenceChange
      ? (trackId) => {
          const next = removeSequenceTrack(sequence, trackId);
          if (next) commitEdit(next);
        }
      : undefined,
    removableTrackIds,
    toggleTrackLock: onSequenceChange
      ? (trackId) => {
          const next = toggleSequenceTrackLock(sequence, trackId);
          if (next) commitEdit(next);
        }
      : undefined,
    previewFade: onSequenceChange ? previewFade : undefined,
    editFade: onSequenceChange ? editFade : undefined,
    previewTrim: onSequenceChange
      ? ({ placementId, edge, sourceFrame }) => !!proposeTrim(placementId, edge, sourceFrame)
      : undefined,
    trimPlacement: onSequenceChange
      ? ({ placementId, edge, sourceFrame }: TimelineTrimIntent) => {
          const next = proposeTrim(placementId, edge, sourceFrame);
          if (next) commitEdit(next);
        }
      : undefined,
    trimRanges,
    fadePlacementIds,
    selectedPlacementIds: selectedIds,
    splitMode: !!onSequenceChange && splitMode,
    activatePlacement: onSequenceChange ? activatePlacement : undefined,
    clearPlacementSelection: onSequenceChange
      ? () => {
          if (!splitMode) selectPlacement(null, false);
        }
      : undefined,
    selectedTransitionId: selectedTransition?.transition.id,
    dissolveDetails: sequenceDissolves,
    selectTransition,
  };

  function nudgeSelection(offset: number) {
    const anchor = selectedTracks[0];
    if (!onSequenceChange || !anchor) return;
    const placement = anchor.placements[0];
    movePlacement({
      placementId: placement.id,
      trackId: anchor.track.id,
      sequenceFrame: placement.sequenceStartFrame + offset,
      placementIds: selectedIds,
    });
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
      (event.currentTarget.hasAttribute("data-sequence-editor-shortcuts") &&
        target.closest("[data-sequence-editor-shortcuts]") !== event.currentTarget)
    ) {
      return;
    }

    if (event.key === "Escape" && splitMode && !target.closest("dialog[open]")) {
      event.preventDefault();
      setSplitMode(false);
      return;
    }
    if (target.closest("input, textarea, select, [contenteditable]")) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      transport.seek(transport.playheadFrame + (event.key === "ArrowLeft" ? -1 : 1));
    } else if ((event.key === "[" || event.key === "]") && onSequenceChange && selectedIds.length) {
      event.preventDefault();
      nudgeSelection(event.key === "[" ? -1 : 1);
    }
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

  function shorten(endFrame: number) {
    const next = shortenSequence(sequence, clips, frameRate, endFrame);
    if (!next) return false;
    commitEdit(next);
    return true;
  }

  function renameTrack(trackId: string, label: string) {
    const track = sequence.tracks.find(({ id }) => id === trackId);
    if (!track || track.label === label) return;
    commitEdit({
      ...sequence,
      tracks: sequence.tracks.map((candidate) =>
        candidate.id === trackId ? { ...candidate, label } : candidate,
      ),
    });
  }

  const toolbarProps: SequenceToolbarProps = {
    transport: {
      ...previewProps,
      seek: transport.seek,
      pause: transport.pause,
      playForward: () => {
        if (transport.playheadFrame < sequence.durationFrames) transport.play(1);
      },
      playReverse: () => {
        if (transport.playheadFrame > 0) transport.play(-1);
      },
    },
    splitAtPlayhead: canSplit ? splitAtPlayhead : undefined,
    splitMode,
    toggleSplitMode: onSequenceChange ? () => setSplitMode((active) => !active) : undefined,
    undo: onSequenceChange ? undo : undefined,
    redo: onSequenceChange ? redo : undefined,
    deleteSelection: onSequenceChange && selectedIds.length > 0 ? deleteSelection : undefined,
    shorten: onSequenceChange
      ? { durationFrames: sequence.durationFrames, onShorten: shorten }
      : undefined,
    addTrack: onSequenceChange
      ? () => commitEdit(addSequenceTrack(sequence, crypto.randomUUID()))
      : undefined,
    renameTrack: onSequenceChange
      ? { tracks: sequence.tracks.map(({ id, label }) => ({ id, label })), onRename: renameTrack }
      : undefined,
  };

  function clipTitle(id: string) {
    return titles?.[id] ?? `Clip ${id}`;
  }

  const inspectedEdges = fadeOwner
    ? fadeFields.filter(({ field }) => !selectedTransition || field === selectedTransition.field)
    : [];
  const inspectorProps: SequenceInspectorProps = {
    canEdit: !!onSequenceChange,
    locked: !!(inspectorTarget?.track.locked || selectedTransition?.track.locked),
    selection: selectedPlacements.map(({ track, placement }) => {
      const duplicate = selectedTracks.some(
        ({ track: other }) => other !== track && other.label === track.label,
      );
      const trackLabel = duplicate
        ? `${track.label} (track ${sequence.tracks.indexOf(track) + 1})`
        : track.label;
      return {
        id: placement.id,
        label: `${clipTitle(placement.clipId)} — ${trackLabel}, sequence frame ${placement.sequenceStartFrame}`,
      };
    }),
    selectedTracks: selectedTracks.map(({ track }) => track.label),
    inspectedPlacementId: inspectedPlacement?.id,
    inspectPlacement: (id) => {
      if (selectedIds.includes(id)) setInspectorPlacementId(id);
    },
    clipTitle: selectedIds.length === 1 && inspectedClip ? clipTitle(inspectedClip.id) : undefined,
    sourceRange: inspectedSourceRange
      ? {
          startFrame: inspectedSourceRange.sourceInFrame,
          endFrame: inspectedSourceRange.sourceOutFrame,
        }
      : undefined,
    sequenceRange:
      inspectedPlacement && inspectedFrameCount !== null
        ? {
            startFrame: inspectedPlacement.sequenceStartFrame,
            endFrame: inspectedPlacement.sequenceStartFrame + inspectedFrameCount,
          }
        : undefined,
    transition: selectedTransition
      ? {
          label: selectedTransition.label,
          owner: `${clipTitle(selectedTransition.placement.clipId)} — ${selectedTransition.track.label}, sequence frame ${selectedTransition.placement.sequenceStartFrame}`,
          durationFrames: selectedTransition.transition.durationFrames,
          sourceExtension: fadeSourceExtension,
          dissolve: dissolveDetails,
        }
      : undefined,
    trim:
      trimBounds && inspectedPlacement
        ? {
            id: `${inspectedPlacement.id}:${trimBounds.sourceOutFrame}`,
            label: "Source out (exclusive frame)",
            button: "Trim placement",
            frame: trimBounds.sourceOutFrame,
            min: trimBounds.min,
            max: trimBounds.max,
            onApply: trimPlacement,
          }
        : undefined,
    fades:
      fadeOwner && fadeBounds
        ? inspectedEdges
            .filter(({ field }) => fadeOwner[field]?.kind !== "dissolve")
            .map(({ field, label, button }) => ({
              id: `${fadeOwner.id}:${field}:${fadeOwner[field]?.id}:${fadeOwner[field]?.durationFrames}`,
              label: `${label} duration (sequence frames)`,
              button,
              frame: fadeOwner[field]?.durationFrames,
              min: fadeBounds.min,
              max: fadeBounds.max,
              onApply: (duration) => editInspectedFade(field, duration),
            }))
        : [],
    dissolves:
      onSequenceChange &&
      fadeOwner &&
      (!selectedTransition || selectedTransition.transition.kind === "dissolve")
        ? inspectedEdges
            .filter(({ field }) => fadeOwner[field]?.kind !== "fade")
            .map(({ field }) => {
              const edge = field === "entryTransition" ? "Leading" : "Trailing";
              return {
                id: `${fadeOwner.id}:${field}:${fadeOwner[field]?.durationFrames}`,
                label: `${edge} dissolve duration (sequence frames)`,
                button: `Apply ${edge.toLowerCase()} dissolve`,
                frame: fadeOwner[field]?.durationFrames,
                min: 1,
                onApply: (duration) => editInspectedDissolve(field, duration),
              };
            })
        : [],
    dissolveKey: fadeOwner?.id,
    showDissolvesOpen: selectedTransition?.transition.kind === "dissolve",
    conflict: dissolveConflict,
  };

  const notices = [];
  if (fadeOutputIssue) notices.push(fadeOutputMessages[fadeOutputIssue]);
  if (blockedTrackEdit === sequence) notices.push("Blocked: the track is locked.");

  return {
    previewProps,
    toolbarProps,
    inspectorProps,
    clipPoolProps,
    timelineProps,
    notices,
    handleEditorKeyDown,
  };
}

const emptyThumbnails: Record<string, string> = {};
const emptyKeyframes: Record<string, string[]> = {};
