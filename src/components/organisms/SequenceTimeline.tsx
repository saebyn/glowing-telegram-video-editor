import {
  CutOverlay,
  Timeline,
  type TimelineEditor,
  type TimelineState,
} from "@keplar-404/react-timeline-editor";
import {
  type CSSProperties,
  type DragEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SequenceFadeHandle from "@/components/atoms/SequenceFadeHandle";
import SequencePlayheadGrip from "@/components/atoms/SequencePlayheadGrip";
import SequenceTrackHeaders from "@/components/molecules/SequenceTrackHeaders";
import type {
  FrameRate,
  MediaKind,
  PlacementTransition,
  SequenceTrack,
  SequenceSource,
  VideoClip,
} from "@/types";
import { getPlacementSourceRange } from "@/utils/clipPlacements";
import { getDissolveWindow } from "@/utils/dissolveWindow";
import type { PlacementFadeField } from "@/utils/fadePlacement";
import { frameThumbnailsInRange } from "@/utils/frameThumbnails";
import {
  formatFrames,
  framesToSeconds,
  getProjectFrameCount,
  secondsToFrame,
  snapFrame,
} from "@/utils/frames";
import type { PlacementTrimEdge } from "@/utils/trimPlacement";
import { mediaKindLabels } from "./mediaKindLabels";
import {
  getSequenceTimelineViewport,
  getZoomScrollLeft,
  SEQUENCE_VIEWPORT_TICKS,
} from "./sequenceTimelineViewport";

const RULER_HEIGHT = 32;
const RULER = ".timeline-editor-time-area-interact";
const EDIT_GRID = ".timeline-editor-edit-area .ReactVirtualized__Grid";
const CURSOR_GRIP = ".timeline-editor-cursor-area";
const ROW_HEIGHT = 72;
const DRAG_THRESHOLD = 4;
const SNAP_TOLERANCE_PX = 8;
const SCROLL_EDGE = 32;
const SCROLL_STEP = 12;
const COMPACT_TRIM_GRIP_WIDTH = 12;
const EFFECTS = {
  placement: { id: "placement", name: "Placement" },
};

export interface PlacementMoveIntent {
  placementId: string;
  placementIds: readonly string[];
  trackId: string | null;
  sequenceFrame: number;
}

export type PlacementMovePreviewIntent = PlacementMoveIntent & {
  /** If the anchor is outside the tracks, -1 is just above the first and +1 just below the last. */
  outsideTrackOffset?: number;
  /** Proposed start before rounding, and snap tolerance, both in sequence-frame units. */
  snap?: { unroundedStartFrame: number; toleranceFrames: number };
};

export type PlacementMovePreview = {
  snapTargetFrame?: number;
  destinations: readonly {
    placementId: string;
    trackId: string | null;
    sequenceStartFrame: number;
  }[];
} & (
  | { kind: "move" | "unchanged" }
  | {
      kind: "blocked";
      reason:
        | "overlap"
        | "outside-tracks"
        | "negative-frame"
        | "invalid-placement"
        | "locked-track";
      trackId?: string;
    }
);

export interface PlaceClipIntent {
  clipId: string;
  trackId: string;
  sequenceFrame: number;
}

export type ClipPlacementPreview = { sequenceStartFrame: number; duration: number } & (
  | { kind: "place" }
  | { kind: "blocked"; reason: "locked" | "overlap" | "gap-too-short" }
);

export type SequenceTimelinePlacementProps = {
  frameRate: FrameRate;
  playheadFrame: number;
  onSeek: (sequenceFrame: number) => void;
  activeClipId?: string;
  endClipDrag: () => void;
  previewClipPlacement?: (intent: PlaceClipIntent) => ClipPlacementPreview | null;
  placeClip?: (intent: PlaceClipIntent) => void;
  snapEnabled?: boolean;
  previewPlacementMove?: (intent: PlacementMovePreviewIntent) => PlacementMovePreview;
  movePlacement?: (intent: PlacementMoveIntent) => void;
};

export type TimelineTrimIntent = {
  placementId: string;
  edge: PlacementTrimEdge;
  sourceFrame: number;
};
export type TimelineFadeIntent = {
  placementId: string;
  field: PlacementFadeField;
  durationFrames: number;
};
export type TimelinePlacementActivation = {
  placementId: string;
  sequenceFrame?: number;
  toggle?: boolean;
};
type Extension = Readonly<{ startFrame: number; endFrame: number }>;

export type SequenceTimelineProps = SequenceTimelinePlacementProps & {
  durationFrames: number;
  tracks: readonly SequenceTrack[];
  sources: readonly SequenceSource[];
  clips: readonly VideoClip[];
  titles: Record<string, string>;
  reorderTrack?: (trackId: string, destinationTrackId: string) => void;
  removeTrack?: (trackId: string) => void;
  removableTrackIds: readonly string[];
  toggleTrackLock?: (trackId: string) => void;
  previewFade?: (intent: TimelineFadeIntent) => "valid" | "blocked" | "conflict";
  editFade?: (intent: TimelineFadeIntent) => void;
  previewTrim?: (intent: TimelineTrimIntent) => boolean;
  trimPlacement?: (intent: TimelineTrimIntent) => void;
  trimRanges: ReadonlyMap<string, { sourceInFrame: number; sourceOutFrame: number }>;
  fadePlacementIds: ReadonlySet<string>;
  selectedPlacementIds: readonly string[];
  splitMode: boolean;
  activatePlacement?: (activation: TimelinePlacementActivation) => void;
  clearPlacementSelection?: () => void;
  selectedTransitionId?: string;
  dissolveDetails: ReadonlyMap<
    string,
    { outgoingExtension: Extension | null; incomingExtension: Extension | null }
  >;
  selectTransition: (id: string) => void;
};

type MoveDestination = {
  trackIndex: number | null;
  sequenceFrame: number;
  unroundedStartFrame: number;
};
type MoveDraft = MoveDestination & {
  placementId: string;
  placementIds: readonly string[];
  scrollLeft: number;
};
type PointerPosition = { clientX: number; clientY: number };
type PlacementDrag = {
  pointerId: number;
  placementId: string;
  placementIds: readonly string[];
  origin: PointerPosition;
  contentX: number;
  startFrame: number;
  width: number;
};
type TrimDrag = {
  pointerId: number;
  placementId: string;
  edge: PlacementTrimEdge;
  contentX: number;
  width: number;
  sourceFrame: number;
};
type TrimDraft = {
  placementId: string;
  edge: PlacementTrimEdge;
  frameOffset: number;
  sourceFrame: number;
  scrollLeft: number;
};

export default function SequenceTimeline({
  frameRate,
  playheadFrame,
  onSeek,
  durationFrames,
  tracks,
  sources,
  clips,
  titles,
  reorderTrack,
  removeTrack,
  removableTrackIds,
  toggleTrackLock,
  activeClipId,
  endClipDrag,
  previewClipPlacement,
  placeClip,
  snapEnabled,
  previewPlacementMove,
  movePlacement,
  previewFade,
  editFade,
  previewTrim,
  trimPlacement,
  trimRanges,
  fadePlacementIds,
  selectedPlacementIds,
  splitMode,
  activatePlacement,
  clearPlacementSelection,
  selectedTransitionId,
  dissolveDetails,
  selectTransition,
}: SequenceTimelineProps) {
  const surface = useRef<HTMLDivElement>(null);
  const timeline = useRef<TimelineState>(null);
  const keyboardPlayhead = useRef<HTMLDivElement>(null);
  const drag = useRef<PlacementDrag | null>(null);
  const moved = useRef(false);
  const splitPointerOrigin = useRef<PointerPosition | null>(null);
  const [splitOverlayRevision, setSplitOverlayRevision] = useState(0);
  const pointer = useRef<PointerPosition | null>(null);
  const scrollLeft = useRef(0);
  const [visibleScrollLeft, setVisibleScrollLeft] = useState(0);
  const pendingScrollLeft = useRef<number | null>(null);
  const [draft, setDraft] = useState<MoveDraft | null>(null);
  const trimDrag = useRef<TrimDrag | null>(null);
  const [trimDraft, setTrimDraft] = useState<TrimDraft | null>(null);
  const isDragging = draft !== null;
  const poolPointer = useRef<PointerPosition | null>(null);
  const [isPoolDragging, setIsPoolDragging] = useState(false);
  const [poolDraft, setPoolDraft] = useState<{
    trackIndex: number;
    sequenceFrame: number;
    scrollLeft: number;
  }>();
  const isTrailingTrim = trimDraft?.edge === "trailing";
  const hasDragHeadroom = isDragging || isPoolDragging || isTrailingTrim;
  const [width, setWidth] = useState(0);
  const [requestedZoom, setRequestedZoom] = useState(0);
  const viewport = getSequenceTimelineViewport(width, durationFrames, requestedZoom);
  const { zoom, maxZoom, tickCount, scaleWidth, pixelsPerFrame, maxScrollLeft } = viewport;
  const scale = framesToSeconds(Math.max(1, durationFrames) / tickCount, frameRate);
  // One extra tick lets a placement grabbed at its far end start beyond the endpoint.
  const headroomTicks = hasDragHeadroom ? SEQUENCE_VIEWPORT_TICKS + (isDragging ? 1 : 0) : 0;
  const scaleCount = tickCount + headroomTicks;
  const maxDragScrollLeft = maxScrollLeft + headroomTicks * scaleWidth;
  const playheadX = playheadFrame * pixelsPerFrame - visibleScrollLeft;
  const playheadVisible = playheadX >= 0 && playheadX <= width;
  const playheadGripOffset = Math.max(8, Math.min(width - 8, playheadX)) - playheadX;

  function seekFromCursor(seconds: number) {
    const frame = snapFrame(secondsToFrame(seconds, frameRate), durationFrames);
    onSeek(frame);
    return frame;
  }

  function changeZoom(nextZoom: number, fit = false) {
    const next = getSequenceTimelineViewport(width, durationFrames, nextZoom);
    if (next.zoom === zoom) return;
    pendingScrollLeft.current = fit
      ? 0
      : getZoomScrollLeft(width, scrollLeft.current, playheadFrame, viewport, next);
    setRequestedZoom(next.zoom);
  }

  useLayoutEffect(() => {
    const left = pendingScrollLeft.current ?? scrollLeft.current;
    const boundedLeft = Math.min(left, maxDragScrollLeft);
    if (pendingScrollLeft.current !== null || boundedLeft !== scrollLeft.current) {
      timeline.current?.setScrollLeft(boundedLeft);
    }
    pendingScrollLeft.current = null;
  }, [zoom, maxDragScrollLeft]);

  useLayoutEffect(() => {
    timeline.current?.setTime(framesToSeconds(playheadFrame, frameRate));
  }, [playheadFrame, frameRate]);

  const clearMove = useCallback(() => {
    drag.current = null;
    pointer.current = null;
    setDraft(null);
  }, []);

  const clearTrim = useCallback(() => {
    trimDrag.current = null;
    pointer.current = null;
    setTrimDraft(null);
  }, []);

  useLayoutEffect(() => {
    const node = surface.current!;
    const measure = () => {
      if (drag.current && drag.current.width !== node.getBoundingClientRect().width) clearMove();
      if (trimDrag.current && trimDrag.current.width !== node.getBoundingClientRect().width)
        clearTrim();
      setWidth(node.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [clearMove, clearTrim]);

  // Host replacements and rate changes can invalidate the origin or the frame scale.
  useLayoutEffect(() => {
    if (drag.current) clearMove();
    if (trimDrag.current) clearTrim();
  }, [
    tracks,
    durationFrames,
    clips,
    frameRate.numerator,
    frameRate.denominator,
    clearMove,
    clearTrim,
  ]);

  useLayoutEffect(() => {
    if (!hasDragHeadroom) return;
    let animationFrame: number;
    const scrollNearEdge = () => {
      const node = surface.current;
      const point = isDragging || isTrailingTrim ? pointer.current : poolPointer.current;
      if (node && point) {
        const { left, right, top } = node.getBoundingClientRect();
        const y = point.clientY - top - RULER_HEIGHT;
        if (y >= 0 && y < tracks.length * ROW_HEIGHT) {
          const x = point.clientX;
          if (
            x >= right - SCROLL_EDGE &&
            (x < right || isTrailingTrim) &&
            scrollLeft.current < maxDragScrollLeft
          )
            timeline.current?.setScrollLeft(
              Math.min(scrollLeft.current + SCROLL_STEP, maxDragScrollLeft),
            );
          else if (x >= left && x < left + SCROLL_EDGE && scrollLeft.current > 0)
            timeline.current?.setScrollLeft(Math.max(scrollLeft.current - SCROLL_STEP, 0));
        }
      }
      animationFrame = requestAnimationFrame(scrollNearEdge);
    };
    animationFrame = requestAnimationFrame(scrollNearEdge);
    return () => cancelAnimationFrame(animationFrame);
  }, [hasDragHeadroom, isDragging, isTrailingTrim, tracks.length, maxDragScrollLeft]);

  const clearPoolDrag = useCallback(() => {
    if (!poolPointer.current) return;
    poolPointer.current = null;
    setIsPoolDragging(false);
    setPoolDraft(undefined);
  }, []);

  useEffect(() => {
    window.addEventListener("dragend", clearPoolDrag, true);
    return () => window.removeEventListener("dragend", clearPoolDrag, true);
  }, [clearPoolDrag]);

  useLayoutEffect(() => {
    if (!activeClipId) clearPoolDrag();
  }, [activeClipId, clearPoolDrag]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (drag.current || trimDrag.current)) {
        event.preventDefault();
        if (drag.current) clearMove();
        if (trimDrag.current) clearTrim();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [clearMove, clearTrim]);

  // The widget updates its internal rows on a new array; keep the authored projection
  // stable while its scroll notifications update the draft.
  const { items, rows } = useMemo(() => {
    const items = new Map<
      string,
      {
        label: string;
        entryTransition?: PlacementTransition;
        revealTransition?: PlacementTransition;
        sequenceFrame: number;
        duration: number;
        trackIndex: number;
        trimRange: { sourceInFrame: number; sourceOutFrame: number } | undefined;
        mediaKind: MediaKind | undefined;
        thumbnails: SequenceSource["frameThumbnails"];
      }
    >();
    const sourcesById = new Map(sources.map((source) => [source.id, source]));
    const rows: TimelineEditor["editorData"] = tracks.map((track, trackIndex) => ({
      id: track.id,
      actions: track.placements.flatMap((placement) => {
        const clip = clips.find(({ id }) => id === placement.clipId);
        if (!clip) return [];
        const range = getPlacementSourceRange(clip, placement);
        const duration = getProjectFrameCount(range, frameRate);
        if (duration <= 0) return [];
        const source = sourcesById.get(clip.sourceId);
        items.set(placement.id, {
          label: titles[clip.id] ?? `Clip ${clip.id}`,
          entryTransition: placement.entryTransition,
          revealTransition: placement.revealTransition,
          sequenceFrame: placement.sequenceStartFrame,
          duration,
          trackIndex,
          trimRange: trimRanges.get(placement.id),
          mediaKind: source?.mediaKind,
          thumbnails:
            source?.mediaKind === "audio-only"
              ? undefined
              : frameThumbnailsInRange(source?.frameThumbnails, range),
        });
        return {
          id: placement.id,
          effectId: "placement",
          start: framesToSeconds(placement.sequenceStartFrame, frameRate),
          end: framesToSeconds(placement.sequenceStartFrame + duration, frameRate),
          movable: false,
          flexible: false,
        };
      }),
    }));
    return { items, rows };
  }, [tracks, clips, sources, titles, frameRate, trimRanges]);

  const splitEnabled = splitMode && activatePlacement !== undefined;
  const secondsPerFrame = framesToSeconds(1, frameRate);
  const splitRows = useMemo(
    () =>
      splitEnabled
        ? rows.map((row, index) => ({
            ...row,
            // Splitting, like trimming, requires matching source and project rates.
            actions: tracks[index].locked
              ? []
              : row.actions.flatMap((action) => {
                  const item = items.get(action.id);
                  if (!item?.trimRange) return [];
                  return [
                    {
                      ...action,
                      start: item.sequenceFrame * secondsPerFrame,
                      end: (item.sequenceFrame + item.duration) * secondsPerFrame,
                    },
                  ];
                }),
          }))
        : [],
    [splitEnabled, items, rows, tracks, secondsPerFrame],
  );

  function poolDestination(event: PointerPosition) {
    const { left, right, top } = surface.current!.getBoundingClientRect();
    if (event.clientX < left || event.clientX >= right) return;
    const trackIndex = Math.floor((event.clientY - top - RULER_HEIGHT) / ROW_HEIGHT);
    const track = tracks[trackIndex];
    if (!track) return;
    const x = event.clientX - left + scrollLeft.current;
    return {
      trackIndex,
      sequenceFrame: secondsToFrame((x / scaleWidth) * scale, frameRate),
      scrollLeft: scrollLeft.current,
    };
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    const destination = poolDestination(event);
    clearPoolDrag();
    if (!placeClip || !activeClipId) return;
    event.preventDefault();
    endClipDrag();
    if (destination) {
      placeClip({
        clipId: activeClipId,
        trackId: tracks[destination.trackIndex].id,
        sequenceFrame: destination.sequenceFrame,
      });
    }
  }

  function moveDestination(point: PointerPosition, activeDrag: PlacementDrag): MoveDestination {
    const { top, left, right } = surface.current!.getBoundingClientRect();
    const x = point.clientX;
    const delta = x - left + scrollLeft.current - activeDrag.contentX;
    const trackIndex = Math.floor((point.clientY - top - RULER_HEIGHT) / ROW_HEIGHT);
    return {
      trackIndex: x >= left && x < right ? trackIndex : null,
      sequenceFrame:
        activeDrag.startFrame + secondsToFrame((delta / scaleWidth) * scale, frameRate),
      unroundedStartFrame: activeDrag.startFrame + delta / pixelsPerFrame,
    };
  }

  function previewMove(point: PointerPosition, activeDrag: PlacementDrag) {
    setDraft({
      ...moveDestination(point, activeDrag),
      placementId: activeDrag.placementId,
      placementIds: activeDrag.placementIds,
      scrollLeft: scrollLeft.current,
    });
  }

  function proposedTrim(clientX: number, activeTrim: TrimDrag): TrimDraft {
    const { left, right } = surface.current!.getBoundingClientRect();
    // A pointer outside the right edge requests scrolling, not an unseen trim.
    const x = activeTrim.edge === "trailing" ? Math.min(clientX, right) : clientX;
    const delta = x - left + scrollLeft.current - activeTrim.contentX;
    const frameOffset = secondsToFrame((delta / scaleWidth) * scale, frameRate);
    return {
      placementId: activeTrim.placementId,
      edge: activeTrim.edge,
      frameOffset,
      sourceFrame: activeTrim.sourceFrame + frameOffset,
      scrollLeft: scrollLeft.current,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const splitOrigin = splitPointerOrigin.current;
    if (
      splitEnabled &&
      splitOrigin &&
      event.isPrimary &&
      Math.hypot(event.clientX - splitOrigin.clientX, event.clientY - splitOrigin.clientY) >=
        DRAG_THRESHOLD
    ) {
      moved.current = true;
    }
    const activeTrim = trimDrag.current;
    if (activeTrim?.pointerId === event.pointerId) {
      pointer.current = { clientX: event.clientX, clientY: event.clientY };
      setTrimDraft(proposedTrim(event.clientX, activeTrim));
      return;
    }
    const activeDrag = drag.current;
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    if (
      !moved.current &&
      Math.hypot(
        event.clientX - activeDrag.origin.clientX,
        event.clientY - activeDrag.origin.clientY,
      ) < DRAG_THRESHOLD
    ) {
      return;
    }
    // Keep capture on the placement button for a click, but on the stable surface for a drag.
    if (!moved.current) event.currentTarget.setPointerCapture(event.pointerId);
    moved.current = true;
    pointer.current = { clientX: event.clientX, clientY: event.clientY };
    previewMove(pointer.current, activeDrag);
  }

  function cancelPlacementDrag(event: PointerEvent<HTMLDivElement>) {
    splitPointerOrigin.current = null;
    if (trimDrag.current?.pointerId === event.pointerId) clearTrim();
    if (drag.current?.pointerId === event.pointerId) clearMove();
  }

  function finishPlacementDrag(event: PointerEvent<HTMLDivElement>) {
    splitPointerOrigin.current = null;
    const activeTrim = trimDrag.current;
    if (activeTrim?.pointerId === event.pointerId) {
      const next = proposedTrim(event.clientX, activeTrim);
      clearTrim();
      if (activeTrim.width !== event.currentTarget.getBoundingClientRect().width) return;
      trimPlacement?.(next);
      return;
    }
    const activeDrag = drag.current;
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    const widthMatches = activeDrag.width === event.currentTarget.getBoundingClientRect().width;
    const { trackIndex, sequenceFrame } = moveDestination(event, activeDrag);
    clearMove();
    // Page scrolling can move the tracks under a stationary pointer without updating the draft.
    if (
      !widthMatches ||
      !draft ||
      draft.trackIndex !== trackIndex ||
      draft.sequenceFrame !== sequenceFrame
    )
      return;
    movePlacement?.({
      placementId: activeDrag.placementId,
      trackId: trackIndex === null ? null : (tracks[trackIndex]?.id ?? null),
      // Apply the displayed destination, without searching again on release.
      sequenceFrame: previewStartFrame ?? sequenceFrame,
      placementIds: activeDrag.placementIds,
    });
  }

  const draftItem = draft && items.get(draft.placementId);
  const trimItem = trimDraft && items.get(trimDraft.placementId);
  const activeTrimPreview = trimItem && trimDraft && trimDraft.frameOffset !== 0;
  const trimBlocked = activeTrimPreview && !previewTrim?.(trimDraft);
  const trimStart =
    trimItem && trimDraft
      ? trimItem.sequenceFrame + (trimDraft.edge === "leading" ? trimDraft.frameOffset : 0)
      : 0;
  const trimEnd =
    trimItem && trimDraft
      ? trimItem.sequenceFrame +
        trimItem.duration +
        (trimDraft.edge === "trailing" ? trimDraft.frameOffset : 0)
      : 0;
  const draftTrack = draft?.trackIndex == null ? undefined : tracks[draft.trackIndex];
  const draftResult =
    draft &&
    previewPlacementMove?.({
      placementId: draft.placementId,
      trackId: draftTrack?.id ?? null,
      outsideTrackOffset:
        draft.trackIndex === null || draftTrack
          ? undefined
          : draft.trackIndex < 0
            ? draft.trackIndex
            : draft.trackIndex - tracks.length + 1,
      sequenceFrame: draft.sequenceFrame,
      placementIds: draft.placementIds,
      snap: snapEnabled
        ? {
            unroundedStartFrame: draft.unroundedStartFrame,
            toleranceFrames: SNAP_TOLERANCE_PX / pixelsPerFrame,
          }
        : undefined,
    });
  const previewStartFrame =
    draftResult?.destinations.find(({ placementId }) => placementId === draft?.placementId)
      ?.sequenceStartFrame ?? draft?.sequenceFrame;
  const companionDestinations = draftResult?.destinations.filter(
    ({ placementId }) => placementId !== draft?.placementId,
  );
  const blocked = draftResult?.kind === "blocked";
  const conflictTrack = blocked && tracks.find(({ id }) => id === draftResult.trackId);
  const blockedMessage = blocked
    ? {
        overlap: `Overlaps another placement on ${conflictTrack ? conflictTrack.label : "the destination track"}`,
        "outside-tracks": "Drop onto an existing track",
        "negative-frame": "Cannot start before sequence frame 0",
        "invalid-placement": "Cannot move this placement",
        "locked-track": "The track is locked",
      }[draftResult.reason]
    : null;
  const poolTrack = poolDraft && tracks[poolDraft.trackIndex];
  const poolDrop =
    poolDraft && poolTrack && activeClipId
      ? previewClipPlacement?.({
          clipId: activeClipId,
          trackId: poolTrack.id,
          sequenceFrame: poolDraft.sequenceFrame,
        })
      : null;
  const poolLabel = activeClipId && (titles[activeClipId] ?? `Clip ${activeClipId}`);

  function draftRectangle(
    trackIndex: number,
    startFrame: number,
    duration: number,
    scroll: number,
  ) {
    return {
      left: startFrame * pixelsPerFrame - scroll + 1,
      top: RULER_HEIGHT + trackIndex * ROW_HEIGHT + 4,
      width: Math.max(0, duration * pixelsPerFrame - 2),
      height: ROW_HEIGHT - 8,
    };
  }

  function placementPreview(
    key: string,
    label: string,
    trackIndex: number,
    startFrame: number,
    duration: number,
    scroll: number,
    blocked: boolean,
  ) {
    return (
      <figure
        key={key}
        aria-label={`Proposed placement: ${label}`}
        className={`pointer-events-none absolute z-10 flex items-center overflow-hidden rounded border-2 border-dashed px-2 text-xs whitespace-nowrap ${
          blocked ? "border-rose-300 bg-rose-900/90" : "border-sky-300 bg-sky-800/90"
        }`}
        style={draftRectangle(trackIndex, startFrame, duration, scroll)}
      >
        {label}
      </figure>
    );
  }

  return (
    <section aria-label="Sequence timeline">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-lg font-semibold">Sequence timeline</h2>
        <div className="flex min-w-0 flex-1 basis-[25rem] flex-wrap gap-2">
          {[
            { label: "Zoom in", next: zoom + 1, disabled: zoom === maxZoom },
            { label: "Zoom out", next: zoom - 1, disabled: zoom === 0 },
            { label: "Fit sequence", next: 0, disabled: zoom === 0, fit: true },
          ].map(({ label, next, disabled, fit }) => (
            <button
              key={label}
              type="button"
              className="rounded border px-2 py-0.5 text-sm disabled:opacity-50"
              disabled={disabled || hasDragHeadroom}
              onClick={() => changeZoom(next, fit)}
            >
              {label}
            </button>
          ))}
          <label className="flex min-w-32 flex-1 items-center gap-2 text-sm">
            Pan timeline
            <input
              type="range"
              min={0}
              max={Math.round(maxScrollLeft)}
              value={Math.min(visibleScrollLeft, maxScrollLeft)}
              disabled={maxScrollLeft === 0 || hasDragHeadroom}
              className="min-w-20 flex-1"
              onChange={(event) =>
                timeline.current?.setScrollLeft(event.currentTarget.valueAsNumber)
              }
            />
          </label>
        </div>
        <span className="text-sm tabular-nums">
          Duration: {formatFrames(durationFrames, frameRate)}
        </span>
      </div>
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] overflow-hidden rounded-md bg-slate-800 text-slate-100">
        <SequenceTrackHeaders
          tracks={tracks}
          rulerHeight={RULER_HEIGHT}
          rowHeight={ROW_HEIGHT}
          reorderTrack={reorderTrack}
          removeTrack={removeTrack}
          removableTrackIds={removableTrackIds}
          toggleTrackLock={toggleTrackLock}
        />
        <div
          ref={surface}
          // CutOverlay finds the widget's horizontal scroll through `.timeline-wrapper`.
          className="gtve-sequence-timeline timeline-wrapper relative overflow-hidden"
          data-pool-dragging={isPoolDragging || undefined}
          data-seekable-playhead={
            (!hasDragHeadroom && width > 0 && durationFrames > 0 && playheadVisible) || undefined
          }
          style={
            {
              "--gtve-ruler-height": `${RULER_HEIGHT}px`,
              "--gtve-cursor-grip-offset": `${playheadGripOffset}px`,
            } as CSSProperties
          }
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            moved.current = false;
            if ((event.target as Element).closest(CURSOR_GRIP)) {
              keyboardPlayhead.current?.focus({ preventScroll: true });
              onSeek(playheadFrame);
            }
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPlacementDrag}
          onPointerCancel={cancelPlacementDrag}
          onClickCapture={(event) => {
            if (!(event.target as Element).closest(RULER)) return;
            // The widget's ruler right-bound check subtracts the scroll offset
            // twice. Read the tracks' current scroll before seeking.
            const node = event.currentTarget;
            const left = node.querySelector(EDIT_GRID)?.scrollLeft ?? scrollLeft.current;
            const x = event.clientX - node.getBoundingClientRect().left + left;
            event.stopPropagation();
            onSeek(snapFrame(x / pixelsPerFrame, durationFrames));
          }}
          onLostPointerCapture={(event) => {
            if (!moved.current || event.target === event.currentTarget) cancelPlacementDrag(event);
          }}
          onDragOver={(event) => {
            const destination = placeClip && activeClipId ? poolDestination(event) : undefined;
            if (!destination && !poolPointer.current) return;
            if (!poolPointer.current) setIsPoolDragging(true);
            poolPointer.current = { clientX: event.clientX, clientY: event.clientY };
            if (activeClipId) setPoolDraft(destination);
            if (!destination) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(event) => {
            const next = event.relatedTarget;
            if (!(next instanceof Node && event.currentTarget.contains(next))) {
              clearPoolDrag();
            }
          }}
          onDrop={handleDrop}
        >
          {/* Keep the keyboard target hidden while placement gestures extend the ruler. */}
          {!hasDragHeadroom && width > 0 && durationFrames > 0 && (
            <SequencePlayheadGrip
              ref={keyboardPlayhead}
              frame={playheadFrame}
              durationFrames={durationFrames}
              pixelsPerFrame={pixelsPerFrame}
              scrollLeft={visibleScrollLeft}
              viewportWidth={width}
              onSeek={onSeek}
            />
          )}
          <Timeline
            ref={timeline}
            editorData={rows}
            effects={EFFECTS}
            style={{ width: "100%", height: RULER_HEIGHT + rows.length * ROW_HEIGHT }}
            startLeft={0}
            scale={scale}
            scaleWidth={scaleWidth}
            scaleSplitCount={4}
            // Add ruler space, not authored duration, while dragging along the tracks.
            minScaleCount={scaleCount}
            maxScaleCount={scaleCount}
            onScroll={({ scrollLeft: left }) => {
              if (scrollLeft.current === left) return;
              scrollLeft.current = left;
              setVisibleScrollLeft(left);
              if (drag.current && pointer.current) previewMove(pointer.current, drag.current);
              if (trimDrag.current && pointer.current)
                setTrimDraft(proposedTrim(pointer.current.clientX, trimDrag.current));
              if (activeClipId && poolPointer.current)
                setPoolDraft(poolDestination(poolPointer.current));
            }}
            rowHeight={ROW_HEIGHT}
            onCursorDrag={seekFromCursor}
            onCursorDragEnd={(seconds) => {
              const frame = seekFromCursor(seconds);
              // The widget ends the gesture in seconds, even when the rounded frame didn't change.
              timeline.current?.setTime(framesToSeconds(frame, frameRate));
            }}
            onClickRow={(event) => {
              if (
                !splitEnabled &&
                !moved.current &&
                event.detail !== 0 &&
                !(event.target as Element).closest("button")
              ) {
                clearPlacementSelection?.();
              }
            }}
            getScaleRender={(seconds) => {
              const frame = secondsToFrame(seconds, frameRate);
              const label = formatFrames(frame, frameRate);
              // The widget centers labels on ticks; keep the final one inside the ruler.
              return frame === durationFrames ? (
                <span className="inline-block -translate-x-1/2">{label}</span>
              ) : (
                label
              );
            }}
            disableDrag
            autoReRender={false}
            getActionRender={({ id }) => {
              const item = items.get(id);
              if (!item) return null;
              const { label, entryTransition, revealTransition, trimRange, mediaKind, thumbnails } =
                item;
              const mediaKindLabel = mediaKind && mediaKindLabels[mediaKind];
              const title = mediaKindLabel ? `${label} — ${mediaKindLabel}` : label;
              const audioOnly = mediaKind === "audio-only";
              const placementWidth = item.duration * pixelsPerFrame;
              const placementX = item.sequenceFrame * pixelsPerFrame;
              // Use the bottom of the row for wider hit targets on tiny placements.
              // The clipped bodies sit above this lane so a neighboring body keeps its move target.
              const compactTrim = placementWidth < 16;
              const gripPairWidth = COMPACT_TRIM_GRIP_WIDTH * 2;
              const gripPairLeft =
                Math.max(
                  0,
                  Math.min(
                    width - gripPairWidth,
                    placementX + (placementWidth - gripPairWidth) / 2,
                  ),
                ) - placementX;
              const hasThumbnails = !compactTrim && (thumbnails?.length ?? 0) > 0;
              const content = (
                <>
                  {hasThumbnails && (
                    <span className="pointer-events-none absolute inset-x-0 top-4 bottom-7 flex overflow-hidden">
                      {thumbnails?.map(({ sourceFrame, url }) => (
                        <img
                          key={`${sourceFrame}:${url}`}
                          src={url}
                          alt=""
                          draggable={false}
                          loading="lazy"
                          className="h-full min-w-0 max-w-16 flex-1 object-cover"
                        />
                      ))}
                    </span>
                  )}
                  {label}
                  {mediaKindLabel && <span className="ml-2 text-[10px]/3">{mediaKindLabel}</span>}
                </>
              );
              const classes = `absolute inset-0 flex overflow-hidden rounded text-xs font-medium whitespace-nowrap ${
                audioOnly
                  ? "bg-violet-950 text-violet-100 border-violet-400 inset-ring-violet-400"
                  : "bg-sky-950 text-sky-100 border-sky-400 inset-ring-sky-400"
              } ${compactTrim ? "inset-ring" : "border px-2"} ${
                hasThumbnails
                  ? "items-end pb-3"
                  : entryTransition || revealTransition
                    ? "items-end pb-0.5"
                    : "items-center"
              }`;
              const trimGrips =
                !splitEnabled &&
                previewTrim &&
                trimPlacement &&
                trimRange &&
                (["leading", "trailing"] as const).map((edge) => (
                  <button
                    key={edge}
                    type="button"
                    aria-label={`Trim ${edge} edge: ${label}`}
                    title={`Trim ${edge} edge: ${label}`}
                    className={`absolute bottom-0 cursor-ew-resize touch-none rounded-sm bg-sky-700 inset-ring inset-ring-sky-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white ${
                      compactTrim
                        ? "z-[1] h-2"
                        : `z-10 h-3 w-3 max-w-[40%] ${edge === "leading" ? "left-0" : "right-0"}`
                    }`}
                    style={
                      compactTrim
                        ? {
                            left:
                              gripPairLeft + (edge === "trailing" ? COMPACT_TRIM_GRIP_WIDTH : 0),
                            width: COMPACT_TRIM_GRIP_WIDTH,
                          }
                        : undefined
                    }
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      if (!event.isPrimary || event.button !== 0) return;
                      const node = surface.current!;
                      const { left, width } = node.getBoundingClientRect();
                      node.setPointerCapture(event.pointerId);
                      moved.current = true;
                      trimDrag.current = {
                        pointerId: event.pointerId,
                        placementId: id,
                        edge,
                        contentX: event.clientX - left + scrollLeft.current,
                        width,
                        sourceFrame:
                          edge === "leading" ? trimRange.sourceInFrame : trimRange.sourceOutFrame,
                      };
                    }}
                  />
                ));
              return (
                <>
                  <div
                    className={`absolute inset-y-1 z-[2] overflow-hidden rounded ${compactTrim ? "inset-x-0" : "inset-x-px"}`}
                  >
                    {activatePlacement ? (
                      <button
                        type="button"
                        title={title}
                        aria-pressed={selectedPlacementIds.includes(id)}
                        onPointerDown={(event) => {
                          if (
                            splitEnabled ||
                            !movePlacement ||
                            !event.isPrimary ||
                            event.button !== 0
                          )
                            return;
                          const { left, width } = surface.current!.getBoundingClientRect();
                          event.currentTarget.setPointerCapture(event.pointerId);
                          drag.current = {
                            pointerId: event.pointerId,
                            placementId: id,
                            placementIds: selectedPlacementIds.includes(id)
                              ? selectedPlacementIds
                              : [id],
                            origin: { clientX: event.clientX, clientY: event.clientY },
                            contentX: event.clientX - left + scrollLeft.current,
                            startFrame: item.sequenceFrame,
                            width,
                          };
                        }}
                        onClick={(event) => {
                          if (!splitEnabled && (event.detail === 0 || !moved.current))
                            activatePlacement({
                              placementId: id,
                              toggle: event.shiftKey,
                              sequenceFrame:
                                event.detail === 0
                                  ? undefined
                                  : poolDestination(event)?.sequenceFrame,
                            });
                        }}
                        className={`${classes} ${splitEnabled ? "cursor-crosshair select-none" : movePlacement ? "touch-none cursor-grab select-none active:cursor-grabbing" : "cursor-pointer"} ${audioOnly ? "aria-pressed:bg-violet-800" : "aria-pressed:bg-sky-800"}`}
                      >
                        {content}
                      </button>
                    ) : (
                      <div title={title} className={classes}>
                        {content}
                      </div>
                    )}
                    {(["entry", "reveal"] as const).map((edge) => {
                      const field = edge === "entry" ? "entryTransition" : "revealTransition";
                      const transition = item[field];
                      if (transition?.kind === "dissolve") return null;
                      return (
                        <SequenceFadeHandle
                          key={edge}
                          label={label}
                          edge={edge}
                          frames={transition?.durationFrames ?? 0}
                          placementFrames={item.duration}
                          pixelsPerFrame={pixelsPerFrame}
                          selected={!!transition && transition.id === selectedTransitionId}
                          onSelect={
                            transition && !splitEnabled
                              ? () => selectTransition(transition.id)
                              : undefined
                          }
                          edit={
                            !splitEnabled && previewFade && editFade && fadePlacementIds.has(id)
                              ? {
                                  evaluate: (durationFrames) =>
                                    previewFade({ placementId: id, field, durationFrames }),
                                  commit: (durationFrames) =>
                                    editFade({ placementId: id, field, durationFrames }),
                                  locked: tracks[item.trackIndex].locked,
                                }
                              : undefined
                          }
                        />
                      );
                    })}
                    {!compactTrim && trimGrips}
                  </div>
                  {compactTrim && trimGrips}
                </>
              );
            }}
          />
          {splitEnabled && width > 0 && tracks.length > 0 && (
            // Leave the ruler and playhead reachable above the overlay.
            <div
              className="absolute inset-x-0 bottom-0 top-(--gtve-ruler-height)"
              onPointerDown={(event) => {
                if (!event.isPrimary || event.button !== 0) return;
                splitPointerOrigin.current = { clientX: event.clientX, clientY: event.clientY };
              }}
              onClickCapture={(event) => {
                if (moved.current || event.detail === 0) {
                  event.stopPropagation();
                  return;
                }
                // Locked placements are absent from the blade's hit targets. Keep the
                // editor's blocked-edit feedback when someone clicks one anyway.
                const destination = poolDestination(event);
                if (!destination || !tracks[destination.trackIndex]?.locked) return;
                const seconds = framesToSeconds(destination.sequenceFrame, frameRate);
                const action = rows[destination.trackIndex].actions.find(
                  ({ start, end }) => start <= seconds && seconds < end,
                );
                if (action)
                  activatePlacement({
                    placementId: action.id,
                    sequenceFrame: destination.sequenceFrame,
                  });
              }}
            >
              <CutOverlay
                // The widget retains its hover until the pointer moves. Clear it on pan, zoom or cut.
                key={`${visibleScrollLeft}:${pixelsPerFrame}:${splitOverlayRevision}`}
                data={splitRows}
                // Same pixels/second as the ruler, but snap the blade to sequence frames, not ruler ticks.
                scale={secondsPerFrame}
                scaleWidth={pixelsPerFrame}
                scaleSplitCount={1}
                startLeft={0}
                rowHeight={ROW_HEIGHT}
                editAreaTopOffset={0}
                gridSnap
                config={{
                  cursor: "crosshair",
                  formatPillLabel: (seconds) =>
                    `Split at sequence frame ${secondsToFrame(seconds, frameRate)}`,
                }}
                onCut={(_trackId, placementId, seconds) => {
                  activatePlacement({
                    placementId,
                    sequenceFrame: secondsToFrame(seconds, frameRate),
                  });
                  setSplitOverlayRevision((revision) => revision + 1);
                }}
              />
            </div>
          )}
          {Array.from(items.values()).flatMap((item) =>
            (["entryTransition", "revealTransition"] as const).flatMap((field) => {
              const transition = item[field];
              if (transition?.kind !== "dissolve") return [];
              const cut = item.sequenceFrame + (field === "entryTransition" ? 0 : item.duration);
              const { startFrame, endFrame } = getDissolveWindow(
                cut,
                transition.durationFrames,
                durationFrames,
              );
              const details = dissolveDetails.get(transition.id);
              const extensions = [details?.outgoingExtension, details?.incomingExtension]
                .map(
                  (range, index) =>
                    range &&
                    `${index === 0 ? "Outgoing" : "Incoming"} extension: source frames [${range.startFrame}, ${range.endFrame})`,
                )
                .filter(Boolean);
              const left = startFrame * pixelsPerFrame - visibleScrollLeft;
              const right = endFrame * pixelsPerFrame - visibleScrollLeft;
              const isEmptyWindow = startFrame === endFrame;
              if (isEmptyWindow ? left < 0 || left > width : right <= 0 || left >= width) return [];
              return [
                <button
                  key={transition.id}
                  type="button"
                  aria-label={`Select centered dissolve: ${item.label}`}
                  aria-pressed={transition.id === selectedTransitionId}
                  title={[
                    `Centered dissolve: sequence frames [${startFrame}, ${endFrame})`,
                    ...extensions,
                  ].join("\n")}
                  disabled={splitEnabled}
                  className={`absolute z-[5] h-5 min-w-1 overflow-hidden rounded-sm border border-violet-900 bg-violet-200 text-[9px] text-violet-950 aria-pressed:bg-violet-500 aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-white ${splitEnabled ? "pointer-events-none" : ""}`}
                  style={{
                    left: isEmptyWindow ? Math.min(left, Math.max(0, width - 4)) : left,
                    top: RULER_HEIGHT + item.trackIndex * ROW_HEIGHT + 4,
                    width: right - left,
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    selectTransition(transition.id);
                  }}
                >
                  Dissolve
                </button>,
              ];
            }),
          )}
          {activeTrimPreview && trimDraft && trimItem && (
            <figure
              aria-label={`Proposed trim: ${trimItem.label}`}
              className={`pointer-events-none absolute z-10 rounded border-2 border-dashed ${
                trimBlocked ? "border-rose-300 bg-rose-900/90" : "border-sky-300 bg-sky-800/90"
              }`}
              style={draftRectangle(
                trimItem.trackIndex,
                trimStart,
                trimEnd - trimStart,
                trimDraft.scrollLeft,
              )}
            />
          )}
          {draft &&
            draftResult?.destinations.map(({ placementId, trackId, sequenceStartFrame }) => {
              const item = items.get(placementId);
              const trackIndex = tracks.findIndex(({ id }) => id === trackId);
              if (!item || trackIndex < 0) return null;
              return placementPreview(
                placementId,
                item.label,
                trackIndex,
                sequenceStartFrame,
                item.duration,
                draft.scrollLeft,
                blocked,
              );
            })}
          {draft && draftResult?.snapTargetFrame !== undefined && (
            <svg
              role="img"
              aria-label={`Snap guide at sequence frame ${draftResult.snapTargetFrame}`}
              className="pointer-events-none absolute top-0 z-20 h-full w-0.5 fill-amber-300"
              style={{ left: draftResult.snapTargetFrame * pixelsPerFrame - draft.scrollLeft }}
            >
              <rect width="100%" height="100%" />
            </svg>
          )}
          {poolDraft &&
            poolDrop &&
            poolLabel &&
            placementPreview(
              "pool",
              poolLabel,
              poolDraft.trackIndex,
              poolDrop.sequenceStartFrame,
              poolDrop.duration,
              poolDraft.scrollLeft,
              poolDrop.kind === "blocked",
            )}
        </div>
        {tracks.length === 0 && (
          <p className="col-span-full border-t border-slate-600 px-3 py-6 text-sm">
            Add your first track to begin
          </p>
        )}
      </div>
      {/* Draft feedback must not add a page scrollbar and resize the timeline during a gesture. */}
      <div className="h-20 overflow-y-auto text-sm wrap-anywhere tabular-nums">
        {activeTrimPreview && trimDraft && trimItem && (
          <output className="mt-1 block">
            {trimItem.label} · Sequence frame {trimDraft.edge === "leading" ? trimStart : trimEnd}
            {trimBlocked &&
              (tracks[trimItem.trackIndex].locked
                ? " · Blocked: The track is locked"
                : " · Blocked: Cannot trim to this edge")}
          </output>
        )}
        {draft && draftItem && (
          <output className="mt-1 block">
            {draftItem.label}
            {draftTrack && ` → ${draftTrack.label}`} · Sequence frame {previewStartFrame}
            {blockedMessage && ` · Blocked: ${blockedMessage}`}
          </output>
        )}
        {poolDrop && poolLabel && poolTrack && (
          <output className="mt-1 block">
            {poolLabel} → {poolTrack.label} · Sequence frame {poolDrop.sequenceStartFrame}
            {poolDrop.kind === "blocked" &&
              {
                overlap: ` · Blocked: Overlaps another placement on ${poolTrack.label}`,
                "gap-too-short": " · Blocked: The gap is too short for this clip",
                locked: " · Blocked: The track is locked",
              }[poolDrop.reason]}
          </output>
        )}
        {companionDestinations && companionDestinations.length > 0 && (
          <ul aria-label="Other proposed placements" className="pl-4">
            {companionDestinations.map(({ placementId, trackId, sequenceStartFrame }) => (
              <li key={placementId}>
                {items.get(placementId)?.label} →{" "}
                {tracks.find(({ id }) => id === trackId)?.label ?? "Outside existing tracks"} ·
                Sequence frame {sequenceStartFrame}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
