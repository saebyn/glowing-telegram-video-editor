import {
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
import { useProjectFrameRate } from "@/context/ProjectContext";
import type { MediaKind, PlacementTransition, Sequence, SequenceSource, VideoClip } from "@/types";
import { getDissolveWindow } from "@/utils/dissolveWindow";
import { getFadeBounds, type PlacementFadeField } from "@/utils/fadePlacement";
import {
  formatFrames,
  framesToSeconds,
  getProjectFrameCount,
  secondsToFrame,
  snapFrame,
} from "@/utils/frames";
import {
  evaluatePoolDrop,
  type getSequenceDissolves,
  getPlacementSourceRange,
  type PlacementMoveResult,
} from "@/utils/sequence";
import { getTrimmableSourceRange, type PlacementTrimEdge } from "@/utils/trimPlacement";
import SequenceFadeHandle from "./SequenceFadeHandle";
import SequencePlayheadGrip from "./SequencePlayheadGrip";
import SequenceTrackHeaders from "./SequenceTrackHeaders";
import { mediaKindLabels } from "./mediaKindLabels";
import {
  getSequenceTimelineViewport,
  getZoomScrollLeft,
  SEQUENCE_VIEWPORT_TICKS,
} from "./sequenceTimelineViewport";

const RULER_HEIGHT = 32;
const RULER = ".timeline-editor-time-area-interact";
const EDIT_GRID = ".timeline-editor-edit-area .ReactVirtualized__Grid";
const ROW_HEIGHT = 72;
const DRAG_THRESHOLD = 4;
const SCROLL_EDGE = 32;
const SCROLL_STEP = 12;
const COMPACT_TRIM_GRIP_WIDTH = 12;
const EFFECTS = {
  placement: { id: "placement", name: "Placement" },
};

type SequenceTimelineProps = {
  playheadFrame: number;
  onSeek: (sequenceFrame: number) => void;
  sequence: Sequence;
  sources: readonly SequenceSource[];
  clips: readonly VideoClip[];
  titles: Record<string, string>;
  onTrackEdit?: (next: Sequence) => void;
  poolClipId?: string;
  onClipDrop?: (clipId: string, trackId: string, sequenceFrame: number) => void;
  evaluateMove?: (
    placementId: string,
    trackIndex: number | null,
    sequenceFrame: number,
    placementIds: readonly string[],
  ) => PlacementMoveResult;
  onPlacementMove?: (next: Sequence) => void;
  evaluateFade?: (
    id: string,
    field: PlacementFadeField,
    duration: number,
    onConflict?: () => void,
  ) => Sequence | null;
  onPlacementFade?: (next: Sequence) => void;
  evaluateTrim?: (id: string, edge: PlacementTrimEdge, sourceFrame: number) => Sequence | null;
  onPlacementTrim?: (next: Sequence) => void;
  selectedPlacementIds: readonly string[];
  onPlacementSelect?: (id: string | null, toggle: boolean) => void;
  onPlacementSplit?: (id: string, sequenceFrame: number) => void;
  selectedTransitionId?: string;
  dissolveDetails: ReturnType<typeof getSequenceDissolves>;
  onTransitionSelect: (id: string) => void;
};

type MoveDestination = { trackIndex: number | null; sequenceFrame: number };
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
  playheadFrame,
  onSeek,
  sequence,
  sources,
  clips,
  titles,
  onTrackEdit,
  poolClipId,
  onClipDrop,
  evaluateMove,
  onPlacementMove,
  evaluateFade,
  onPlacementFade,
  evaluateTrim,
  onPlacementTrim,
  selectedPlacementIds,
  onPlacementSelect,
  onPlacementSplit,
  selectedTransitionId,
  dissolveDetails,
  onTransitionSelect,
}: SequenceTimelineProps) {
  const { durationFrames, tracks } = sequence;
  const frameRate = useProjectFrameRate();
  const surface = useRef<HTMLDivElement>(null);
  const timeline = useRef<TimelineState>(null);
  const drag = useRef<PlacementDrag | null>(null);
  const moved = useRef(false);
  const splitPointerOrigin = useRef<PointerPosition | null>(null);
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
  }, [sequence, clips, frameRate.numerator, frameRate.denominator, clearMove, clearTrim]);

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
        trimRange: ReturnType<typeof getTrimmableSourceRange>;
        mediaKind: MediaKind | undefined;
        thumbnails: SequenceSource["keyframes"];
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
          trimRange: getTrimmableSourceRange(placement, clip, frameRate),
          mediaKind: source?.mediaKind,
          thumbnails:
            source?.mediaKind === "audio-only"
              ? undefined
              : source?.keyframes
                  ?.filter(
                    ({ sourceFrame }) =>
                      sourceFrame >= range.sourceInFrame && sourceFrame < range.sourceOutFrame,
                  )
                  .sort((first, second) => first.sourceFrame - second.sourceFrame),
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
  }, [tracks, clips, sources, titles, frameRate]);

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
    if (!onClipDrop || !destination) return;
    const data = event.dataTransfer.getData("application/json");
    if (!data) return;
    event.preventDefault();
    let clipIds: unknown;
    try {
      clipIds = JSON.parse(data);
    } catch {
      return;
    }
    if (!Array.isArray(clipIds) || clipIds.length !== 1 || typeof clipIds[0] !== "string") return;
    onClipDrop(clipIds[0], tracks[destination.trackIndex].id, destination.sequenceFrame);
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
      onPlacementSplit &&
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
      const result = evaluateTrim?.(next.placementId, next.edge, next.sourceFrame);
      if (result) onPlacementTrim?.(result);
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
    const result = evaluateMove?.(
      activeDrag.placementId,
      trackIndex,
      sequenceFrame,
      activeDrag.placementIds,
    );
    if (result?.kind === "move") onPlacementMove?.(result.sequence);
  }

  const draftItem = draft && items.get(draft.placementId);
  const trimItem = trimDraft && items.get(trimDraft.placementId);
  const activeTrimPreview = trimItem && trimDraft && trimDraft.frameOffset !== 0;
  const trimBlocked =
    activeTrimPreview &&
    !evaluateTrim?.(trimDraft.placementId, trimDraft.edge, trimDraft.sourceFrame);
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
    evaluateMove?.(draft.placementId, draft.trackIndex, draft.sequenceFrame, draft.placementIds);
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
      }[draftResult.reason]
    : null;
  const poolTrack = poolDraft && tracks[poolDraft.trackIndex];
  const poolDrop =
    poolDraft && poolTrack && poolClipId
      ? evaluatePoolDrop(
          sequence,
          clips,
          frameRate,
          poolClipId,
          poolTrack.id,
          poolDraft.sequenceFrame,
        )
      : null;
  const poolLabel = poolClipId && (titles[poolClipId] ?? `Clip ${poolClipId}`);

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
        style={{
          left: (framesToSeconds(startFrame, frameRate) / scale) * scaleWidth - scroll + 1,
          top: RULER_HEIGHT + trackIndex * ROW_HEIGHT + 4,
          width: Math.max(0, (framesToSeconds(duration, frameRate) / scale) * scaleWidth - 2),
          height: ROW_HEIGHT - 8,
        }}
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
          sequence={sequence}
          rulerHeight={RULER_HEIGHT}
          rowHeight={ROW_HEIGHT}
          onCommit={onTrackEdit}
        />
        <div
          ref={surface}
          className="gtve-sequence-timeline relative overflow-hidden"
          data-pool-dragging={isPoolDragging || undefined}
          style={{ "--gtve-ruler-height": `${RULER_HEIGHT}px` } as CSSProperties}
          onPointerDown={(event) => {
            if (event.isPrimary && event.button === 0) moved.current = false;
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
            // Like the other consumers of ProjectClipPool, accept its JSON clip-ID payload.
            // Native dragover exposes the type, but the payload is only readable on drop.
            const destination =
              onClipDrop && event.dataTransfer.types.includes("application/json")
                ? poolDestination(event)
                : undefined;
            if (!destination && !poolPointer.current) return;
            if (!poolPointer.current) setIsPoolDragging(true);
            poolPointer.current = { clientX: event.clientX, clientY: event.clientY };
            if (poolClipId) setPoolDraft(destination);
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
          {/* The widget scrolls its cursor during drag headroom; the ruler grip stays hidden. */}
          {!hasDragHeadroom && width > 0 && durationFrames > 0 && (
            <SequencePlayheadGrip
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
              if (poolClipId && poolPointer.current)
                setPoolDraft(poolDestination(poolPointer.current));
            }}
            rowHeight={ROW_HEIGHT}
            onClickRow={(event) => {
              if (
                !onPlacementSplit &&
                !moved.current &&
                event.detail !== 0 &&
                !(event.target as Element).closest("button")
              ) {
                onPlacementSelect?.(null, false);
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
                !onPlacementSplit &&
                evaluateTrim &&
                onPlacementTrim &&
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
                    {onPlacementSelect ? (
                      <button
                        type="button"
                        title={title}
                        aria-pressed={selectedPlacementIds.includes(id)}
                        onPointerDown={(event) => {
                          if (!event.isPrimary || event.button !== 0) return;
                          if (onPlacementSplit) {
                            splitPointerOrigin.current = {
                              clientX: event.clientX,
                              clientY: event.clientY,
                            };
                            return;
                          }
                          if (!onPlacementMove) return;
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
                          if (onPlacementSplit) {
                            if (event.detail === 0 || moved.current || !surface.current) return;
                            const node = surface.current;
                            const left =
                              node.querySelector(EDIT_GRID)?.scrollLeft ?? scrollLeft.current;
                            const x = event.clientX - node.getBoundingClientRect().left + left;
                            onPlacementSplit(id, snapFrame(x / pixelsPerFrame, durationFrames));
                            return;
                          }
                          if (event.detail === 0 || !moved.current)
                            onPlacementSelect(id, event.shiftKey);
                        }}
                        className={`${classes} ${onPlacementSplit ? "cursor-crosshair select-none" : onPlacementMove ? "touch-none cursor-grab select-none active:cursor-grabbing" : "cursor-pointer"} ${audioOnly ? "aria-pressed:bg-violet-800" : "aria-pressed:bg-sky-800"}`}
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
                            transition && !onPlacementSplit
                              ? () => onTransitionSelect(transition.id)
                              : undefined
                          }
                          edit={
                            !onPlacementSplit &&
                            evaluateFade &&
                            onPlacementFade &&
                            getFadeBounds(item.duration)
                              ? {
                                  evaluate: (frames, onConflict) =>
                                    evaluateFade(id, field, frames, onConflict),
                                  commit: onPlacementFade,
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
                  disabled={!!onPlacementSplit}
                  className={`absolute z-[5] h-5 min-w-1 overflow-hidden rounded-sm border border-violet-900 bg-violet-200 text-[9px] text-violet-950 aria-pressed:bg-violet-500 aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-white ${onPlacementSplit ? "pointer-events-none" : ""}`}
                  style={{
                    left: isEmptyWindow ? Math.min(left, Math.max(0, width - 4)) : left,
                    top: RULER_HEIGHT + item.trackIndex * ROW_HEIGHT + 4,
                    width: right - left,
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onTransitionSelect(transition.id);
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
              style={{
                left:
                  (framesToSeconds(trimStart, frameRate) / scale) * scaleWidth -
                  trimDraft.scrollLeft +
                  1,
                top: RULER_HEIGHT + trimItem.trackIndex * ROW_HEIGHT + 4,
                width: Math.max(
                  0,
                  (framesToSeconds(trimEnd - trimStart, frameRate) / scale) * scaleWidth - 2,
                ),
                height: ROW_HEIGHT - 8,
              }}
            />
          )}
          {draft &&
            draftResult?.destinations.map(({ placementId, trackIndex, sequenceStartFrame }) => {
              const item = items.get(placementId);
              if (!item || trackIndex === null || !tracks[trackIndex]) return null;
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
            {trimBlocked && " · Blocked: Cannot trim to this edge"}
          </output>
        )}
        {draft && draftItem && (
          <output className="mt-1 block">
            {draftItem.label}
            {draftTrack && ` → ${draftTrack.label}`} · Sequence frame {draft.sequenceFrame}
            {blockedMessage && ` · Blocked: ${blockedMessage}`}
          </output>
        )}
        {poolDrop && poolLabel && poolTrack && (
          <output className="mt-1 block">
            {poolLabel} → {poolTrack.label} · Sequence frame {poolDrop.sequenceStartFrame}
            {poolDrop.kind === "blocked" &&
              (poolDrop.reason === "overlap"
                ? ` · Blocked: Overlaps another placement on ${poolTrack.label}`
                : " · Blocked: The gap is too short for this clip")}
          </output>
        )}
        {companionDestinations && companionDestinations.length > 0 && (
          <ul aria-label="Other proposed placements" className="pl-4">
            {companionDestinations.map(({ placementId, trackIndex, sequenceStartFrame }) => (
              <li key={placementId}>
                {items.get(placementId)?.label} →{" "}
                {(trackIndex === null ? null : tracks[trackIndex]?.label) ??
                  "Outside existing tracks"}{" "}
                · Sequence frame {sequenceStartFrame}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
