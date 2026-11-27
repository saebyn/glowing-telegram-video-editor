import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SequencePreviewProps } from "@/components/molecules/SequencePreview";
import { useProjectFrameRate } from "@/context/ProjectContext";
import type {
  ClipPlacement,
  CutListIssue,
  CutListResult,
  PlacementEdge,
  PlacementPasteTarget,
  Sequence,
  SequenceInputIssue,
  SequenceSource,
  SequenceTimelineNavigation,
  SequenceTransportSnapshot,
  SourcesById,
  TransitionDraft,
  TransitionEditProblem,
  TransitionResizeIntent,
  VideoClip,
} from "@/types";
import { getPlacementSourceRange, transitionFields } from "@/utils/clipPlacements";
import compileCutList, { analyzeSequence } from "@/utils/compileCutList";
import { getFadeSourceExtension } from "@/utils/fadePlacement";
import { getProjectFrameCount, isValidFrameRate, secondsToFrame, snapFrame } from "@/utils/frames";
import {
  copyPlacements,
  duplicatePlacements,
  pastePlacements,
  previewPlacementPaste,
  type CopiedPlacements,
} from "@/utils/placementCopies";
import { evaluatePlacementMove, evaluatePoolDrop, placeClipInGap } from "@/utils/placementDrag";
import {
  evaluateTransitionEdit,
  evaluateTransitionResize,
  findTransition,
  getTransitionDurationBounds,
  removePlacementTransition,
  type TransitionEditIntent,
} from "@/utils/placementTransition";
import {
  addSequenceTrack,
  canRemoveSequenceTrack,
  findPlacementTrack,
  removeSequenceTrack,
  reorderSequenceTrack,
  setSequenceTrackLocked,
} from "@/utils/sequenceTracks";
import { getSequenceDissolves } from "@/utils/sequenceTransitions";
import { getSequenceInputIssues, sequenceInputIssueKey } from "@/utils/sequenceInputIssues";
import { canSplitPlacementsAtPlayhead, splitPlacementsAtPlayhead } from "@/utils/splitPlacement";
import {
  applyLeadingTrim,
  applyTrailingTrim,
  getTrailingTrimBounds,
  getTrimmableSourceRange,
} from "@/utils/trimPlacement";
import { resolveSequencePlacements } from "@/utils/visibleSequence";
import type { SequenceInspectorProps } from "./SequenceInspector";
import type { SequenceClipPoolProps } from "./SequenceClipPool";
import type {
  PlacementMoveIntent,
  PlaceClipIntent,
  PlacementMovePreview,
  PlacementMovePreviewIntent,
  SequenceTimelineProps,
  TimelinePlacementActivation,
} from "./SequenceTimeline";
import type { SequenceToolbarProps } from "./SequenceToolbar";
import { useSequenceHistory } from "./useSequenceHistory";
import { useSequenceTransport } from "./useSequenceTransport";

export interface UseSequenceEditorOptions {
  /** Snapshot to open on mount. Change the React key to open another snapshot. */
  initialSequence: Sequence;
  clips: VideoClip[];
  sources: SourcesById<SequenceSource>;
  thumbnails?: Record<string, string>;
  titles?: Record<string, string>;
  /** Optional notification of a committed, immutable working sequence snapshot. */
  onSequenceChange?: (sequence: Sequence) => void;
  /** Optional compilation result for the same committed snapshot. */
  onCutListResult?: (result: CutListResult) => void;
  /** Report initial or changed invalid host inputs, independently of edit notifications. */
  onSequenceInputError?: (issues: readonly [SequenceInputIssue, ...SequenceInputIssue[]]) => void;
}

const transitionOutputMessages: Partial<Record<CutListIssue["code"], string>> = {
  "fade-overlap": "CutList unavailable: authored fades overlap or compete at the same cut.",
  "fade-interrupted": "CutList unavailable: an authored fade crosses a visible cut.",
  "fade-gap":
    "CutList unavailable: an authored fade meets a gap. The missing side contributes black picture and silence.",
  "unsupported-dissolve": "CutList unavailable: the format cannot represent a dissolve.",
  "dissolve-conflict": "CutList unavailable: a dissolve competes with another transition.",
  "dissolve-interrupted": "CutList unavailable: a visible cut interrupts a dissolve.",
  "dissolve-gap":
    "CutList unavailable: a dissolve meets a gap. The missing side contributes black picture and silence.",
};

type PasteDropToken = { retired: boolean };

export function useSequenceEditor({
  initialSequence,
  clips,
  sources,
  thumbnails = emptyThumbnails,
  titles = emptyThumbnails,
  onSequenceChange,
  onCutListResult,
  onSequenceInputError,
}: UseSequenceEditorOptions) {
  const frameRate = useProjectFrameRate();
  const editInputs = useRef({ clips, sources, frameRate });
  useLayoutEffect(() => {
    editInputs.current = { clips, sources, frameRate };
  }, [clips, sources, frameRate]);
  const canEditLatest = useRef(false);
  const { sequence, getWorkingSequence, commitEdit, undo, redo } = useSequenceHistory(
    initialSequence,
    emitEdit,
    canEditLatest,
    (target) => !!resolveSequencePlacements(target, clips, sources, frameRate, true).geometry,
  );
  const analysis = useMemo(
    () => analyzeSequence(sequence, clips, sources, frameRate),
    [sequence, clips, sources, frameRate],
  );
  const cutListIssues = analysis.result.issues;
  const durationFrames = analysis.durationFrames ?? 0;
  const inputIssues = useMemo(() => getSequenceInputIssues(cutListIssues), [cutListIssues]);
  const hasValidInput = analysis.durationFrames !== null;
  const [navigation, setNavigation] = useState<SequenceTimelineNavigation>();
  const registerNavigation = useCallback((actions: SequenceTimelineNavigation) => {
    let mounted = true;
    const guard = (invoke: () => void) => () => {
      if (mounted) invoke();
    };
    const guarded: SequenceTimelineNavigation = {};
    for (const action of ["panLeft", "panRight", "fitToView"] as const) {
      const invoke = actions[action];
      if (invoke) guarded[action] = guard(invoke);
    }
    for (const action of ["zoomOut", "zoomIn"] as const) {
      const control = actions[action];
      if (control) guarded[action] = { ...control, run: guard(control.run) };
    }
    setNavigation(guarded);
    return () => {
      mounted = false;
      setNavigation((current) => (current === guarded ? undefined : current));
    };
  }, []);
  useLayoutEffect(() => {
    canEditLatest.current = hasValidInput;
    return () => {
      canEditLatest.current = false;
    };
  }, [hasValidInput]);
  const transport = useSequenceTransport(durationFrames, frameRate, hasValidInput);
  const snapshot: SequenceTransportSnapshot = {
    playheadFrame: transport.playheadFrame,
    frameRate,
    durationFrames,
    playback: transport.isReversing ? "reverse" : transport.isPlaying ? "forward" : "paused",
  };
  const previewProps: SequencePreviewProps = {
    ...snapshot,
    media: hasValidInput ? { sequence, clips, sources } : undefined,
    registerPreview: hasValidInput ? transport.registerPreview : undefined,
    stoppedOnSound: transport.stoppedOn === 1,
  };
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [inspectorPlacementId, setInspectorPlacementId] = useState<string>();
  const [transitionId, setTransitionId] = useState<string>();
  const [splitMode, setSplitMode] = useState(false);
  const [clipboard, setClipboard] = useState<CopiedPlacements | null>(null);
  const [pasteDrop, setPasteDrop] = useState<{
    token: PasteDropToken;
    target: PlacementPasteTarget | null;
  }>();
  const pasteTarget = useRef<PlacementPasteTarget | null>(null);
  const setPasteTarget = useCallback((target: PlacementPasteTarget | null) => {
    pasteTarget.current = target;
    setPasteDrop((drop) => (drop && drop.target !== target ? { ...drop, target } : drop));
  }, []);
  const pasteConfirmation = useRef<{
    token: PasteDropToken;
    confirm: (target: PlacementPasteTarget) => boolean;
  }>(undefined);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [activeClipId, setActiveClipId] = useState<string>();
  const [blockedTrackEdit, setBlockedTrackEdit] = useState<Sequence>();
  const [transitionConflict, setTransitionConflict] = useState(false);
  const [transitionProblem, setTransitionProblem] = useState<TransitionEditProblem>();
  const splitEnabled = hasValidInput && splitMode;
  if (!hasValidInput) {
    if (activeClipId !== undefined) setActiveClipId(undefined);
    if (pasteDrop) setPasteDrop(undefined);
    if (splitMode) setSplitMode(false);
  }
  useLayoutEffect(() => {
    if (!hasValidInput) pasteTarget.current = null;
  }, [hasValidInput]);

  function commitPaste(target: PlacementPasteTarget | null) {
    if (!canEditLatest.current || !clipboard || !target) return false;
    const next = pastePlacements(getWorkingSequence(), clips, frameRate, clipboard, target);
    if (!next) return false;
    cancelPasteDrop();
    commitEdit(next);
    return true;
  }

  function retirePasteConfirmation() {
    // Retire immediately, even before React publishes the drop state update.
    if (pasteConfirmation.current) pasteConfirmation.current.token.retired = true;
    pasteConfirmation.current = undefined;
  }

  function cancelPasteDrop() {
    retirePasteConfirmation();
    setPasteDrop(undefined);
  }

  useLayoutEffect(() => {
    // Retained confirmations are valid only for the same active drop session.
    pasteConfirmation.current =
      pasteDrop && !pasteDrop.token.retired
        ? { token: pasteDrop.token, confirm: commitPaste }
        : undefined;
    return () => {
      pasteConfirmation.current = undefined;
    };
  });
  const lastReportedInput = useRef<string | undefined>(undefined);
  useEffect(() => {
    const [first, ...rest] = inputIssues;
    if (!first) {
      lastReportedInput.current = undefined;
      return;
    }
    if (!onSequenceInputError) return;
    const key = sequenceInputIssueKey(inputIssues);
    if (key === lastReportedInput.current) return;
    lastReportedInput.current = key;
    onSequenceInputError([first, ...rest]);
  }, [inputIssues, onSequenceInputError]);
  const transitionNotices = useMemo(() => {
    const messages = new Set<string>();
    for (const { code } of cutListIssues) {
      const message = transitionOutputMessages[code];
      if (message) messages.add(message);
    }
    return [...messages];
  }, [cutListIssues]);
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
  const canSplit = hasValidInput && canSplitPlacementsAtPlayhead(...splitArgs);
  const inspectorTarget =
    selectedPlacements.find(({ placement }) => placement.id === inspectorPlacementId) ??
    selectedPlacements[0];
  const inspectedPlacement = inspectorTarget?.placement;
  // Keep a valid target as membership or host-supplied placements change.
  if (inspectorPlacementId !== inspectedPlacement?.id) {
    setInspectorPlacementId(inspectedPlacement?.id);
  }
  const selectedTransition = hasValidInput ? findTransition(sequence, transitionId) : undefined;
  const sequenceDissolves = useMemo(
    () => (hasValidInput ? getSequenceDissolves(sequence, clips, sources, frameRate) : new Map()),
    [sequence, clips, sources, frameRate, hasValidInput],
  );
  const dissolveDetails =
    selectedTransition && sequenceDissolves.get(selectedTransition.transition.id);
  const transitionClip = clips.find(({ id }) => id === selectedTransition?.placement.clipId);
  const fadeSourceExtension =
    selectedTransition && transitionClip
      ? getFadeSourceExtension(
          selectedTransition.placement,
          selectedTransition.edge,
          transitionClip,
          frameRate,
          durationFrames,
        )
      : null;
  const inspectedClip = clips.find(({ id }) => id === inspectedPlacement?.clipId);
  const inspectedSourceRange =
    hasValidInput && inspectedClip && inspectedPlacement
      ? getPlacementSourceRange(inspectedClip, inspectedPlacement)
      : null;
  const inspectedFrameCount =
    inspectedSourceRange && isValidFrameRate(inspectedSourceRange.sourceFrameRate)
      ? getProjectFrameCount(inspectedSourceRange, frameRate)
      : null;
  const transitionPlacementFrames =
    selectedTransition && transitionClip && isValidFrameRate(transitionClip.sourceFrameRate)
      ? getProjectFrameCount(
          getPlacementSourceRange(transitionClip, selectedTransition.placement),
          frameRate,
        )
      : 0;
  const trimBounds =
    hasValidInput && inspectorTarget && inspectedClip
      ? getTrailingTrimBounds(
          inspectorTarget.placement,
          inspectorTarget.track,
          inspectedClip,
          frameRate,
          clips,
        )
      : null;

  function selectPlacement(id: string | null, toggle: boolean) {
    setBlockedTrackEdit(undefined);
    setTransitionConflict(false);
    setTransitionProblem(undefined);
    setTransitionId(undefined);
    if (id === null) setSelection([]);
    else if (!toggle) setSelection([id]);
    else
      setSelection((ids) =>
        ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id],
      );
  }

  function getCutListInspection(placementId: string) {
    if (!hasValidInput) return;
    const track = findPlacementTrack(sequence, placementId);
    const placement = track?.placements.find(({ id }) => id === placementId);
    if (!track || !placement || !clips.some(({ id }) => id === placement.clipId)) return;
    return {
      label: `${clipTitle(placement.clipId)} on ${track.label}`,
      inspect: () => selectPlacement(placementId, false),
    };
  }

  function selectTransition(id: string) {
    setBlockedTrackEdit(undefined);
    setTransitionConflict(false);
    setTransitionProblem(undefined);
    setSelection([]);
    setTransitionId(id);
  }

  function emitEdit(next: Sequence) {
    setBlockedTrackEdit(undefined);
    setTransitionConflict(false);
    setTransitionProblem(undefined);
    onSequenceChange?.(next);
    onCutListResult?.(compileCutList(next, clips, sources, frameRate));
  }

  function splitAtPlayhead() {
    if (!canEditLatest.current) return;
    const working = getWorkingSequence();
    const targets = working.tracks.flatMap(({ placements }) => placements.map(({ id }) => id));
    const next = splitPlacementsAtPlayhead(
      working,
      clips,
      frameRate,
      targets,
      transport.playheadFrame,
      () => crypto.randomUUID(),
    );
    if (next) commitEdit(next);
  }

  function splitAtPointer(placementId: string, frame: number) {
    const sequence = getWorkingSequence();
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
    if (!canEditLatest.current) return;
    const sequence = getWorkingSequence();
    const tracksToEdit = sequence.tracks.filter(({ placements }) =>
      placements.some(({ id }) => selectedIds.includes(id)),
    );
    if (!tracksToEdit.length) return;
    if (tracksToEdit.some(({ locked }) => locked)) {
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
    const next = placeClipInGap(
      getWorkingSequence(),
      clips,
      frameRate,
      clipId,
      trackId,
      sequenceFrame,
    );
    if (next) commitEdit(next);
  }

  function proposePlacementMove(
    sequence: Sequence,
    placementId: string,
    destinationTrack: string | number | null,
    sequenceFrame: number,
    placementIds: readonly string[],
    snap?: PlacementMovePreviewIntent["snap"],
  ) {
    return evaluatePlacementMove(
      sequence,
      clips,
      frameRate,
      placementId,
      destinationTrack,
      sequenceFrame,
      placementIds,
      snap && { ...snap, playheadFrame: transport.playheadFrame },
    );
  }

  function previewPlacementMove({
    placementId,
    trackId,
    outsideTrackOffset,
    sequenceFrame,
    placementIds,
    snap,
  }: PlacementMovePreviewIntent): PlacementMovePreview {
    const destination =
      trackId ??
      (outsideTrackOffset && Number.isSafeInteger(outsideTrackOffset)
        ? outsideTrackOffset < 0
          ? outsideTrackOffset
          : sequence.tracks.length - 1 + outsideTrackOffset
        : null);
    const result = proposePlacementMove(
      sequence,
      placementId,
      destination,
      sequenceFrame,
      placementIds,
      snap,
    );
    const destinations = result.destinations.map(
      ({ placementId, trackIndex, sequenceStartFrame }) => ({
        placementId,
        trackId: trackIndex === null ? null : (sequence.tracks[trackIndex]?.id ?? null),
        sequenceStartFrame,
      }),
    );
    return result.kind === "blocked"
      ? { kind: result.kind, reason: result.reason, trackId: result.trackId, destinations }
      : { kind: result.kind, destinations, snapTargetFrame: result.snapTargetFrame };
  }

  function movePlacement({
    placementId,
    trackId,
    sequenceFrame,
    placementIds,
  }: PlacementMoveIntent) {
    const sequence = getWorkingSequence();
    const result = proposePlacementMove(
      sequence,
      placementId,
      trackId,
      sequenceFrame,
      placementIds,
    );
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
    beginClipDrag: hasValidInput
      ? (id) => {
          if (!canEditLatest.current) return;
          const clip = clips.find((clip) => clip.id === id);
          setActiveClipId(clip && isValidFrameRate(clip.sourceFrameRate) ? id : undefined);
        }
      : undefined,
    endClipDrag,
  };

  const { trimRanges, fadePlacementIds, removableTrackIds } = useMemo(() => {
    const trimRanges = new Map<string, { sourceInFrame: number; sourceOutFrame: number }>();
    const fadePlacementIds = new Set<string>();
    if (!hasValidInput) return { trimRanges, fadePlacementIds, removableTrackIds: [] };
    for (const track of sequence.tracks) {
      for (const placement of track.placements) {
        const clip = clips.find(({ id }) => id === placement.clipId);
        if (!clip || !isValidFrameRate(clip.sourceFrameRate)) continue;
        const trimRange = getTrimmableSourceRange(placement, clip, frameRate);
        if (trimRange) trimRanges.set(placement.id, trimRange);
        if (
          getTransitionDurationBounds(
            "fade",
            getProjectFrameCount(getPlacementSourceRange(clip, placement), frameRate),
          )
        )
          fadePlacementIds.add(placement.id);
      }
    }
    const removableTrackIds = sequence.tracks
      .filter((track) => canRemoveSequenceTrack(sequence, track))
      .map(({ id }) => id);
    return { trimRanges, fadePlacementIds, removableTrackIds };
  }, [sequence, clips, frameRate, hasValidInput]);

  function activatePlacement({
    placementId,
    sequenceFrame,
    toggle = false,
  }: TimelinePlacementActivation) {
    if (splitEnabled) {
      if (canEditLatest.current && sequenceFrame !== undefined)
        splitAtPointer(placementId, sequenceFrame);
    } else if (findPlacementTrack(getWorkingSequence(), placementId)) {
      selectPlacement(placementId, toggle);
    }
  }

  function previewTransitionResize(intent: TransitionResizeIntent) {
    if (splitEnabled) return "blocked";
    const result = evaluateTransitionResize(sequence, clips, sources, frameRate, intent);
    if (result.kind === "edit") return "valid";
    return result.kind === "conflict" ? "conflict" : "blocked";
  }

  // Relative actions and gesture releases use the latest rendered inputs.
  const currentActions = useRef<
    Pick<
      SequenceTimelineProps,
      | "placeClip"
      | "movePlacement"
      | "trimPlacement"
      | "activatePlacement"
      | "reorderTrack"
      | "resizeTransition"
    > &
      Pick<SequenceToolbarProps, "splitAtPlayhead" | "deleteSelection"> & {
        keyDown?: (event: KeyboardEvent<HTMLElement>) => void;
      }
  >({});
  useLayoutEffect(() => {
    currentActions.current = {
      keyDown: handleEditorKeyDown,
      activatePlacement: hasValidInput ? activatePlacement : undefined,
      ...(hasValidInput && {
        splitAtPlayhead,
        deleteSelection,
        placeClip,
        movePlacement: splitEnabled ? undefined : movePlacement,
        reorderTrack: (trackId, destinationTrackId) => {
          const sequence = getWorkingSequence();
          const next = reorderSequenceTrack(
            sequence,
            trackId,
            sequence.tracks.findIndex(({ id }) => id === destinationTrackId),
          );
          if (next) commitEdit(next);
        },
        trimPlacement: !splitEnabled
          ? ({ placementId, edge, sourceFrame }) => {
              const next = proposeTrim(getWorkingSequence(), placementId, edge, sourceFrame);
              if (next) commitEdit(next);
            }
          : undefined,
        resizeTransition: !splitEnabled
          ? (intent) => {
              const result = evaluateTransitionResize(
                getWorkingSequence(),
                clips,
                sources,
                frameRate,
                intent,
              );
              if (result.kind === "edit") commitEdit(result.sequence);
            }
          : undefined,
      }),
    };
    return () => {
      currentActions.current = {};
    };
  });

  const timelineProps: SequenceTimelineProps = {
    registerNavigation: hasValidInput ? registerNavigation : undefined,
    frameRate,
    playheadFrame: transport.playheadFrame,
    onSeek: transport.seek,
    durationFrames,
    tracks: sequence.tracks,
    sources,
    clips,
    titles,
    activeClipId: hasValidInput ? activeClipId : undefined,
    endClipDrag,
    previewClipPlacement: hasValidInput ? previewClipPlacement : undefined,
    placeClip: hasValidInput ? (intent) => currentActions.current.placeClip?.(intent) : undefined,
    snapEnabled,
    previewPlacementMove: hasValidInput ? previewPlacementMove : undefined,
    movePlacement: hasValidInput
      ? (intent) => currentActions.current.movePlacement?.(intent)
      : undefined,
    reorderTrack: hasValidInput
      ? (trackId, destinationTrackId) =>
          currentActions.current.reorderTrack?.(trackId, destinationTrackId)
      : undefined,
    removeTrack: hasValidInput
      ? (trackId) => {
          if (!canEditLatest.current) return;
          const next = removeSequenceTrack(getWorkingSequence(), trackId);
          if (next) commitEdit(next);
        }
      : undefined,
    removableTrackIds,
    setTrackLocked: hasValidInput
      ? (trackId, locked) => {
          if (!canEditLatest.current) return;
          const next = setSequenceTrackLocked(getWorkingSequence(), trackId, locked);
          if (next) commitEdit(next);
        }
      : undefined,
    previewTransitionResize: hasValidInput ? previewTransitionResize : undefined,
    resizeTransition: hasValidInput
      ? (intent) => currentActions.current.resizeTransition?.(intent)
      : undefined,
    previewTrim: hasValidInput
      ? ({ placementId, edge, sourceFrame }) =>
          !!proposeTrim(sequence, placementId, edge, sourceFrame)
      : undefined,
    trimPlacement: hasValidInput
      ? (intent) => currentActions.current.trimPlacement?.(intent)
      : undefined,
    trimRanges,
    fadePlacementIds,
    selectedPlacementIds: selectedIds,
    placementPaste: hasValidInput
      ? {
          onTargetChange: setPasteTarget,
          drop:
            pasteDrop && clipboard
              ? {
                  preview: pasteDrop.target
                    ? previewPlacementPaste(sequence, clips, frameRate, clipboard, pasteDrop.target)
                    : null,
                  confirm: (target) => {
                    const current = pasteConfirmation.current;
                    if (current?.token === pasteDrop.token) current.confirm(target);
                  },
                }
              : undefined,
        }
      : undefined,
    splitMode: splitEnabled,
    activatePlacement: hasValidInput
      ? (intent) => currentActions.current.activatePlacement?.(intent)
      : undefined,
    clearPlacementSelection: () => {
      if (!splitEnabled) selectPlacement(null, false);
    },
    selectedTransitionId: selectedTransition?.transition.id,
    dissolveDetails: sequenceDissolves,
    selectTransition,
  };

  function nudgeSelection(offset: number) {
    const anchor = getWorkingSequence().tracks.find(({ placements }) =>
      placements.some(({ id }) => selectedIds.includes(id)),
    );
    if (!hasValidInput || !anchor) return;
    const placement = anchor.placements.find(({ id }) => selectedIds.includes(id))!;
    movePlacement({
      placementId: placement.id,
      trackId: anchor.id,
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
      event.shiftKey ||
      !(target instanceof Element) ||
      !event.currentTarget.contains(target) ||
      (event.currentTarget.hasAttribute("data-sequence-editor-shortcuts") &&
        target.closest("[data-sequence-editor-shortcuts]") !== event.currentTarget)
    ) {
      return;
    }

    const field = target.closest("input, textarea, select, [contenteditable]");
    if (event.ctrlKey || event.metaKey) {
      if (field || !canEditLatest.current) return;
      const shortcut = event.key.toLowerCase();
      if (shortcut === "d" && selectedIds.length) {
        event.preventDefault();
        if (event.repeat) return;
        const next = duplicatePlacements(getWorkingSequence(), clips, frameRate, selectedIds);
        if (next) commitEdit(next);
      } else if (shortcut === "c" && selectedIds.length) {
        event.preventDefault();
        setClipboard(copyPlacements(getWorkingSequence(), clips, frameRate, selectedIds));
      } else if (shortcut === "v" && clipboard) {
        event.preventDefault();
        if (event.repeat) return;
        if (!commitPaste(pasteTarget.current)) {
          // A new Paste replaces any unfinished drop, even at the same target.
          retirePasteConfirmation();
          setSplitMode(false);
          setPasteDrop({ token: { retired: false }, target: pasteTarget.current });
        }
      }
      return;
    }

    if (event.key === "Escape" && !field && pasteDrop && !target.closest("dialog[open]")) {
      event.preventDefault();
      cancelPasteDrop();
      return;
    }
    if (event.key === "Escape" && splitMode && !target.closest("dialog[open]")) {
      event.preventDefault();
      setSplitMode(false);
      return;
    }
    if (field) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const from = snapFrame(transport.playheadFrame, durationFrames);
      transport.seek(from + (event.key === "ArrowLeft" ? -1 : 1));
    } else if (
      (event.key === "[" || event.key === "]") &&
      canEditLatest.current &&
      selectedIds.length
    ) {
      event.preventDefault();
      nudgeSelection(event.key === "[" ? -1 : 1);
    }
  }

  function proposeTransitionEdit(intent: TransitionEditIntent) {
    const { clips, sources, frameRate } = editInputs.current;
    return evaluateTransitionEdit(getWorkingSequence(), clips, sources, frameRate, intent);
  }

  function proposeTrim(
    sequence: Sequence,
    placementId: string,
    edge: PlacementEdge,
    sourceFrame: number,
  ) {
    const applyTrim = edge === "leading" ? applyLeadingTrim : applyTrailingTrim;
    return applyTrim(sequence, clips, frameRate, placementId, sourceFrame);
  }

  function trimPlacement(placementId: string, sourceOutFrame: number) {
    if (!canEditLatest.current) return;
    const sequence = getWorkingSequence();
    if (findPlacementTrack(sequence, placementId)?.locked) {
      setBlockedTrackEdit(sequence);
      return;
    }
    const { clips, frameRate } = editInputs.current;
    const next = applyTrailingTrim(sequence, clips, frameRate, placementId, sourceOutFrame);
    if (next) commitEdit(next);
  }

  function applyTransition(transitionId: string, transition: TransitionDraft) {
    if (!canEditLatest.current) return;
    const working = getWorkingSequence();
    const target = findTransition(working, transitionId);
    if (!target) return;
    const { placement, edge } = target;
    const edit = proposeTransitionEdit({
      placementId: placement.id,
      edge,
      transition,
    });
    setTransitionProblem(edit.kind === "edit" || edit.kind === "unchanged" ? undefined : edit);
    if (edit.kind === "locked") setBlockedTrackEdit(working);
    if (edit.kind === "edit") commitEdit(edit.sequence);
  }

  function removeTransition(transitionId: string) {
    if (!canEditLatest.current) return;
    const working = getWorkingSequence();
    const target = findTransition(working, transitionId);
    if (!target) return;
    const { placement, edge } = target;
    const next = removePlacementTransition(working, placement.id, edge);
    if (next) commitEdit(next, () => selectPlacement(placement.id, false));
  }

  function renameTrack(trackId: string, label: string) {
    if (!canEditLatest.current) return;
    const sequence = getWorkingSequence();
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
    navigation: hasValidInput ? navigation : undefined,
    transport: {
      ...snapshot,
      seek: transport.seek,
      pause: transport.pause,
      playForward: transport.playForward,
      playReverse: transport.playReverse,
    },
    splitAtPlayhead: canSplit ? () => currentActions.current.splitAtPlayhead?.() : undefined,
    splitMode,
    toggleSplitMode: hasValidInput
      ? () => {
          if (!canEditLatest.current) return;
          cancelPasteDrop();
          setSplitMode((active) => !active);
        }
      : undefined,
    snapEnabled,
    toggleSnap: hasValidInput
      ? () => {
          if (canEditLatest.current) setSnapEnabled((active) => !active);
        }
      : undefined,
    undo: hasValidInput ? undo : undefined,
    redo: hasValidInput ? redo : undefined,
    deleteSelection:
      hasValidInput && selectedIds.length > 0
        ? () => currentActions.current.deleteSelection?.()
        : undefined,
    addTrack: hasValidInput
      ? () => commitEdit(addSequenceTrack(getWorkingSequence(), crypto.randomUUID()))
      : undefined,
    renameTrack: hasValidInput
      ? { tracks: sequence.tracks.map(({ id, label }) => ({ id, label })), onRename: renameTrack }
      : undefined,
  };

  function clipTitle(id: string) {
    return titles?.[id] ?? `Clip ${id}`;
  }

  function getEdgeAction(placement: ClipPlacement, edge: PlacementEdge, locked?: boolean) {
    const transition = placement[transitionFields[edge]];
    if (transition) return { inspectTransition: () => selectTransition(transition.id) };
    if (!hasValidInput || locked || !inspectedFrameCount) return {};
    return { addTransition: () => addTransition(placement.id, edge) };
  }

  function addTransition(placementId: string, edge: PlacementEdge) {
    if (!canEditLatest.current) return;
    const owner = findPlacementTrack(getWorkingSequence(), placementId)?.placements.find(
      ({ id }) => id === placementId,
    );
    if (!owner || owner[transitionFields[edge]]) return;
    const { clips, frameRate } = editInputs.current;
    const clip = clips.find(({ id }) => id === owner.clipId);
    if (!clip) return;
    const frames = getProjectFrameCount(getPlacementSourceRange(clip, owner), frameRate);
    const durationFrames = Math.min(frames, Math.max(1, secondsToFrame(0.5, frameRate)));
    const result = proposeTransitionEdit({
      placementId,
      edge,
      transition: { kind: "fade", durationFrames },
    });
    setTransitionConflict(result.kind === "conflict");
    if (result.kind === "edit")
      commitEdit(result.sequence, () => selectTransition(result.transition.id));
  }

  const inspectorProps: SequenceInspectorProps = {
    inspection: selectedTransition
      ? {
          kind: "transition",
          properties: {
            owner: `${clipTitle(selectedTransition.placement.clipId)} — ${selectedTransition.track.label}, sequence frame ${selectedTransition.placement.sequenceStartFrame}`,
            edge: selectedTransition.edge,
            locked: !!selectedTransition.track.locked,
            transition: selectedTransition.transition,
            sourceExtension: fadeSourceExtension,
            dissolve: dissolveDetails,
            edit:
              hasValidInput && !selectedTransition.track.locked
                ? {
                    bounds: (kind) => getTransitionDurationBounds(kind, transitionPlacementFrames),
                    applyTransition: (draft) =>
                      applyTransition(selectedTransition.transition.id, draft),
                    removeTransition: () => removeTransition(selectedTransition.transition.id),
                  }
                : undefined,
            problem: transitionProblem,
          },
        }
      : inspectorTarget
        ? {
            kind: "placement",
            properties: {
              placementId: inspectorTarget.placement.id,
              clipTitle: clipTitle(inspectorTarget.placement.clipId),
              locked: !!inspectorTarget.track.locked,
              sourceRange: inspectedSourceRange
                ? {
                    startFrame: inspectedSourceRange.sourceInFrame,
                    endFrame: inspectedSourceRange.sourceOutFrame,
                  }
                : undefined,
              sequenceRange:
                inspectedFrameCount !== null
                  ? {
                      startFrame: inspectorTarget.placement.sequenceStartFrame,
                      endFrame: inspectorTarget.placement.sequenceStartFrame + inspectedFrameCount,
                    }
                  : undefined,
              trim: trimBounds
                ? {
                    min: trimBounds.min,
                    max: trimBounds.max,
                    trimPlacement: (frame) => trimPlacement(inspectorTarget.placement.id, frame),
                  }
                : undefined,
              edges: {
                leading: getEdgeAction(
                  inspectorTarget.placement,
                  "leading",
                  inspectorTarget.track.locked,
                ),
                trailing: getEdgeAction(
                  inspectorTarget.placement,
                  "trailing",
                  inspectorTarget.track.locked,
                ),
              },
              conflict: transitionConflict,
            },
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
            inspectPlacement: (id) => {
              if (!selectedIds.includes(id)) return;
              setInspectorPlacementId(id);
              setTransitionConflict(false);
            },
          }
        : { kind: "empty", canEdit: hasValidInput },
  };

  const notices = [...transitionNotices];
  if (!hasValidInput)
    notices.push("Editing and playback are unavailable until the sequence inputs are corrected.");
  if (blockedTrackEdit === sequence) notices.push("Blocked: the track is locked.");

  return {
    previewProps,
    toolbarProps,
    inspectorProps,
    clipPoolProps,
    timelineProps,
    notices,
    cutListIssues,
    getCutListInspection,
    handleEditorKeyDown: (event: KeyboardEvent<HTMLElement>) =>
      currentActions.current.keyDown?.(event),
  };
}

const emptyThumbnails: Record<string, string> = {};
