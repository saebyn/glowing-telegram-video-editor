import {
  Timeline,
  type TimelineEditor,
  type TimelineState,
} from "@keplar-404/react-timeline-editor";
import {
  createContext,
  type CSSProperties,
  type DragEvent,
  type PointerEvent,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SequenceFadeHandle from "@/components/atoms/SequenceFadeHandle";
import SequenceDissolveHandle from "@/components/atoms/SequenceDissolveHandle";
import SequencePlayheadGrip from "@/components/atoms/SequencePlayheadGrip";
import SequenceTrackHeaders from "@/components/molecules/SequenceTrackHeaders";
import type {
  FrameRate,
  MediaKind,
  PlacementEdge,
  PlacementPastePreview,
  PlacementPasteTarget,
  PlacementTransition,
  SequenceTrack,
  SequenceSource,
  SourcesById,
  TransitionResizeIntent,
  VideoClip,
} from "@/types";
import { getPlacementSourceRange, transitionFields } from "@/utils/clipPlacements";
import { frameThumbnailsInRange } from "@/utils/frameThumbnails";
import {
  formatFrames,
  framesToSeconds,
  getProjectFrameCount,
  isValidFrameRate,
  secondsToFrame,
  snapFrame,
} from "@/utils/frames";
import { getSource } from "@/utils/sourcesById";
import { resolveSequencePlacements } from "@/utils/visibleSequence";
import { mediaKindLabels } from "./mediaKindLabels";
import {
  getMaxZoom,
  getSequenceTimelineViewport,
  getWidgetOrigin,
  getZoomLeftFrame,
  WIDGET_TICKS,
} from "./sequenceTimelineViewport";

const RULER_HEIGHT = 32;
const RULER = ".timeline-editor-time-area-interact";
const ACTION = ".timeline-editor-action";
const CURSOR_GRIP = "[data-sequence-playhead-grip]";
const ROW_HEIGHT = 72;
const PLACEMENT_INSET_Y = 4;
const TRIM_GRIP_HEIGHT = 12;
// Cover the upper ~80% of the placement, stopping just above the trim corners.
const TRANSITION_HEIGHT = ROW_HEIGHT - 2 * PLACEMENT_INSET_Y - TRIM_GRIP_HEIGHT;
const DRAG_THRESHOLD = 4;
const SNAP_TOLERANCE_PX = 8;
const SCROLL_EDGE = 32;
const SCROLL_STEP = 12;
const COMPACT_TRIM_GRIP_WIDTH = 12;
const EFFECTS = {
  placement: { id: "placement", name: "Placement" },
};

// React Virtualized caches rendered cells while scrolling. Context lets cached
// labels update when the same physical column now represents a different time.
const RulerOrigin = createContext(0);

function RulerLabel({ seconds, frameRate }: { seconds: number; frameRate: FrameRate }) {
  const sequenceSeconds = useContext(RulerOrigin) + seconds;
  const frame = secondsToFrame(sequenceSeconds, frameRate);
  return `${frame < 0 ? "−" : ""}${formatFrames(Math.abs(frame), frameRate)}`;
}

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
  edge: PlacementEdge;
  sourceFrame: number;
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
  sources: SourcesById<SequenceSource>;
  clips: readonly VideoClip[];
  titles: Record<string, string>;
  reorderTrack?: (trackId: string, destinationTrackId: string) => void;
  removeTrack?: (trackId: string) => void;
  removableTrackIds: readonly string[];
  toggleTrackLock?: (trackId: string) => void;
  previewTransitionResize?: (intent: TransitionResizeIntent) => "valid" | "blocked" | "conflict";
  resizeTransition?: (intent: TransitionResizeIntent) => void;
  previewTrim?: (intent: TimelineTrimIntent) => boolean;
  trimPlacement?: (intent: TimelineTrimIntent) => void;
  trimRanges: ReadonlyMap<string, { sourceInFrame: number; sourceOutFrame: number }>;
  fadePlacementIds: ReadonlySet<string>;
  selectedPlacementIds: readonly string[];
  placementPaste?: {
    onTargetChange: (target: PlacementPasteTarget | null) => void;
    drop?: {
      preview: PlacementPastePreview | null;
      confirm: (target: PlacementPasteTarget) => void;
    };
  };
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
};
type PointerPosition = { clientX: number; clientY: number };
type SurfacePosition = { x: number; trackIndex: number };
type PlacementDrag = {
  pointerId: number;
  placementId: string;
  placementIds: readonly string[];
  origin: PointerPosition;
  grabFrame: number;
  startFrame: number;
  width: number;
};
type TrimDrag = {
  pointerId: number;
  placementId: string;
  edge: PlacementEdge;
  grabFrame: number;
  width: number;
  sourceFrame: number;
};
type TrimDraft = {
  placementId: string;
  edge: PlacementEdge;
  frameOffset: number;
  sourceFrame: number;
};

type PanPress = { pointerId: number; x: number; leftFrame: number; active: boolean };
type CursorPress = { pointerId: number; x: number; playheadX: number };

export default function SequenceTimeline(props: SequenceTimelineProps) {
  const { tracks, clips, sources, frameRate } = props;
  const valid = useMemo(
    () => resolveSequencePlacements({ tracks }, clips, sources, frameRate, true).geometry !== null,
    [tracks, clips, sources, frameRate],
  );
  if (!valid) {
    return (
      <section aria-label="Sequence timeline">
        <p>Timeline unavailable until the sequence inputs are corrected.</p>
      </section>
    );
  }
  return <SequenceTimelineWidget {...props} />;
}

function SequenceTimelineWidget({
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
  previewTransitionResize,
  resizeTransition,
  previewTrim,
  trimPlacement,
  trimRanges,
  fadePlacementIds,
  selectedPlacementIds,
  placementPaste,
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
  const panPress = useRef<PanPress | null>(null);
  const cursorPress = useRef<CursorPress | null>(null);
  const splitPointerOrigin = useRef<PointerPosition | null>(null);
  const [splitPointer, setSplitPointer] = useState<SurfacePosition | null>(null);
  const pointer = useRef<PointerPosition | null>(null);
  const pastePointer = useRef<PointerPosition | null>(null);
  const reportedPasteTarget = useRef<PlacementPasteTarget | null>(null);
  const pasteReporter =
    useRef<NonNullable<SequenceTimelineProps["placementPaste"]>["onTargetChange"]>(undefined);
  // Gestures use the requested sequence frame, never the widget's rounded,
  // asynchronously reported physical scroll position.
  const leftFrame = useRef(0);
  const [{ frame: visibleLeftFrame, originTick }, setView] = useState({ frame: 0, originTick: -4 });
  const [draft, setDraft] = useState<MoveDraft | null>(null);
  const trimDrag = useRef<TrimDrag | null>(null);
  const [trimDraft, setTrimDraft] = useState<TrimDraft | null>(null);
  const isDragging = draft !== null;
  const poolPointer = useRef<PointerPosition | null>(null);
  const [isPoolDragging, setIsPoolDragging] = useState(false);
  const [poolDraft, setPoolDraft] = useState<{
    trackIndex: number;
    sequenceFrame: number;
  }>();
  const isTrailingTrim = trimDraft?.edge === "trailing";
  const editing = isDragging || isPoolDragging || trimDraft !== null;
  const [width, setWidth] = useState(0);
  const [fitFrames, setFitFrames] = useState(() => Math.max(1, durationFrames));
  const [zoom, setZoom] = useState(0);
  const { scaleWidth, pixelsPerFrame, framesPerTick } = getSequenceTimelineViewport(
    width,
    fitFrames,
    zoom,
  );
  const maxZoom = getMaxZoom(width, fitFrames);
  const widgetOriginTick = getWidgetOrigin(visibleLeftFrame, framesPerTick, originTick);
  const widgetOriginFrame = widgetOriginTick * framesPerTick;
  const widgetScroll = Math.round((visibleLeftFrame - widgetOriginFrame) * pixelsPerFrame);
  const scale = framesToSeconds(framesPerTick, frameRate);
  const visibleScrollLeft = visibleLeftFrame * pixelsPerFrame;
  const playheadX = playheadFrame * pixelsPerFrame - visibleScrollLeft;
  const playheadVisible = playheadX >= 0 && playheadX <= width;
  const fitDisabled =
    visibleLeftFrame === 0 && zoom === 0 && fitFrames === Math.max(1, durationFrames);
  const reportPasteTarget = placementPaste?.onTargetChange;
  const pasteDrop = placementPaste?.drop;
  const pastePress = useRef<PointerPosition | null>(null);

  function pasteTargetAt(point: PointerPosition | null): PlacementPasteTarget | null {
    if (!point || !width) return null;
    const destination = poolDestination(point);
    return destination
      ? { trackId: tracks[destination.trackIndex].id, sequenceFrame: destination.sequenceFrame }
      : null;
  }

  function syncPasteTarget() {
    if (!reportPasteTarget) return;
    const next = pasteTargetAt(pastePointer.current);
    const previous = reportedPasteTarget.current;
    if (next?.trackId !== previous?.trackId || next?.sequenceFrame !== previous?.sequenceFrame) {
      reportedPasteTarget.current = next;
      reportPasteTarget(next);
    }
  }

  const showFrom = useCallback((frame: number, tickSize: number) => {
    leftFrame.current = frame;
    setView((previous) => {
      const nextOrigin = getWidgetOrigin(frame, tickSize, previous.originTick);
      return frame === previous.frame && nextOrigin === previous.originTick
        ? previous
        : { frame, originTick: nextOrigin };
    });
  }, []);

  function sequenceFrameAt(clientX: number) {
    return (
      leftFrame.current + (clientX - surface.current!.getBoundingClientRect().left) / pixelsPerFrame
    );
  }

  function changeZoom(nextZoom: number, fit = false) {
    if (fit) {
      const nextDuration = Math.max(1, durationFrames);
      setFitFrames(nextDuration);
      showFrom(0, getSequenceTimelineViewport(width, nextDuration, 0).framesPerTick);
    } else {
      const next = getSequenceTimelineViewport(width, fitFrames, nextZoom);
      showFrom(
        getZoomLeftFrame(
          width,
          leftFrame.current,
          playheadFrame,
          pixelsPerFrame,
          next.pixelsPerFrame,
        ),
        next.framesPerTick,
      );
    }
    setZoom(nextZoom);
  }

  useLayoutEffect(() => {
    if (!width) return;
    timeline.current?.setScrollLeft(widgetScroll);
  }, [widgetOriginTick, widgetScroll, scaleWidth, width]);

  useLayoutEffect(() => {
    const node = surface.current!;
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? width : 1;
      const horizontal = event.deltaX || (event.shiftKey ? event.deltaY : 0);
      if (!horizontal || (!event.shiftKey && Math.abs(event.deltaY) > Math.abs(horizontal))) return;
      event.preventDefault();
      if (cursorPress.current) return;
      const delta = (horizontal * unit) / pixelsPerFrame;
      if (panPress.current) panPress.current.leftFrame += delta;
      showFrom(leftFrame.current + delta, framesPerTick);
    };
    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, [framesPerTick, pixelsPerFrame, showFrom, width]);

  useLayoutEffect(() => {
    if (!reportPasteTarget && reportedPasteTarget.current) {
      reportedPasteTarget.current = null;
      pasteReporter.current?.(null);
    }
    pasteReporter.current = reportPasteTarget;
    if (!reportPasteTarget) return;
    // Re-evaluate when layout or the viewport changes without a pointer event.
    syncPasteTarget();
    window.addEventListener("scroll", syncPasteTarget, true);
    return () => window.removeEventListener("scroll", syncPasteTarget, true);
  });

  useLayoutEffect(
    () => () => {
      if (reportedPasteTarget.current) {
        reportedPasteTarget.current = null;
        pasteReporter.current?.(null);
      }
    },
    [],
  );

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
    if (!isDragging && !isPoolDragging && !isTrailingTrim) return;
    let animationFrame: number;
    const scrollNearEdge = () => {
      const node = surface.current;
      const point = isDragging || isTrailingTrim ? pointer.current : poolPointer.current;
      if (node && point) {
        const { left, right, top } = node.getBoundingClientRect();
        const y = point.clientY - top - RULER_HEIGHT;
        if (y >= 0 && y < tracks.length * ROW_HEIGHT) {
          const x = point.clientX;
          if (x >= right - SCROLL_EDGE && (x < right || isTrailingTrim))
            showFrom(leftFrame.current + SCROLL_STEP / pixelsPerFrame, framesPerTick);
          else if (x >= left && x < left + SCROLL_EDGE)
            showFrom(leftFrame.current - SCROLL_STEP / pixelsPerFrame, framesPerTick);
        }
      }
      animationFrame = requestAnimationFrame(scrollNearEdge);
    };
    animationFrame = requestAnimationFrame(scrollNearEdge);
    return () => cancelAnimationFrame(animationFrame);
  }, [
    isPoolDragging,
    isDragging,
    isTrailingTrim,
    tracks.length,
    pixelsPerFrame,
    framesPerTick,
    showFrom,
  ]);

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

  const items = useMemo(() => {
    const items = new Map<
      string,
      {
        label: string;
        transitionIn?: PlacementTransition;
        transitionOut?: PlacementTransition;
        sequenceFrame: number;
        duration: number;
        trackIndex: number;
        trimRange: { sourceInFrame: number; sourceOutFrame: number } | undefined;
        mediaKind: MediaKind | undefined;
        thumbnails: SequenceSource["frameThumbnails"];
      }
    >();
    tracks.forEach((track, trackIndex) => {
      for (const placement of track.placements) {
        const clip = clips.find(({ id }) => id === placement.clipId);
        if (!clip || !isValidFrameRate(clip.sourceFrameRate)) continue;
        const range = getPlacementSourceRange(clip, placement);
        const duration = getProjectFrameCount(range, frameRate);
        if (duration <= 0) continue;
        const source = getSource(sources, clip.sourceId);
        items.set(placement.id, {
          label: titles[clip.id] ?? `Clip ${clip.id}`,
          transitionIn: placement.transitionIn,
          transitionOut: placement.transitionOut,
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
      }
    });
    return items;
  }, [tracks, clips, sources, titles, frameRate, trimRanges]);

  const splitEnabled = splitMode && activatePlacement !== undefined;
  const widgetEndFrame = widgetOriginFrame + WIDGET_TICKS * framesPerTick;
  // Reproject only when the widget window shifts, not on every pan. Keep
  // actions straddling the window at their true starts and widths.
  const rows = useMemo<TimelineEditor["editorData"]>(
    () =>
      tracks.map((track) => ({
        id: track.id,
        actions: track.placements.flatMap(({ id }) => {
          const item = items.get(id);
          if (!item) return [];
          const end = item.sequenceFrame + item.duration;
          if (end <= widgetOriginFrame || item.sequenceFrame >= widgetEndFrame) return [];
          return [
            {
              id,
              effectId: "placement",
              start: framesToSeconds(item.sequenceFrame - widgetOriginFrame, frameRate),
              end: framesToSeconds(end - widgetOriginFrame, frameRate),
              movable: false,
              flexible: false,
            },
          ];
        }),
      })),
    [tracks, items, widgetOriginFrame, widgetEndFrame, frameRate],
  );

  function positionOnTrack(event: PointerPosition): SurfacePosition | null {
    const { left, right, top } = surface.current!.getBoundingClientRect();
    if (event.clientX < left || event.clientX >= right) return null;
    const trackIndex = Math.floor((event.clientY - top - RULER_HEIGHT) / ROW_HEIGHT);
    if (!tracks[trackIndex]) return null;
    return { x: event.clientX - left, trackIndex };
  }

  function poolDestination(event: PointerPosition) {
    const point = positionOnTrack(event);
    if (!point) return;
    return {
      trackIndex: point.trackIndex,
      sequenceFrame: Math.round(leftFrame.current + point.x / pixelsPerFrame),
    };
  }

  function splitTargetAt(point: SurfacePosition | null, viewStart: number) {
    if (!point) return;
    const { trackIndex, x } = point;
    const track = tracks[trackIndex];
    if (!track) return;
    const sequenceFrame = Math.round(viewStart + x / pixelsPerFrame);
    const placement = track.placements.find(({ id }) => {
      const item = items.get(id);
      return (
        item &&
        sequenceFrame < item.sequenceFrame + item.duration &&
        (track.locked
          ? item.sequenceFrame <= sequenceFrame
          : item.trimRange && item.sequenceFrame < sequenceFrame)
      );
    });
    if (placement)
      return { placementId: placement.id, sequenceFrame, trackIndex, locked: track.locked };
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    const destination = poolDestination(event);
    clearPoolDrag();
    if (!placeClip || !activeClipId) return;
    event.preventDefault();
    endClipDrag();
    if (destination && destination.sequenceFrame >= 0) {
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
    const delta = sequenceFrameAt(x) - activeDrag.grabFrame;
    const trackIndex = Math.floor((point.clientY - top - RULER_HEIGHT) / ROW_HEIGHT);
    return {
      trackIndex: x >= left && x < right ? trackIndex : null,
      sequenceFrame: activeDrag.startFrame + Math.round(delta),
      unroundedStartFrame: activeDrag.startFrame + delta,
    };
  }

  function previewMove(point: PointerPosition, activeDrag: PlacementDrag) {
    setDraft({
      ...moveDestination(point, activeDrag),
      placementId: activeDrag.placementId,
      placementIds: activeDrag.placementIds,
    });
  }

  function proposedTrim(clientX: number, activeTrim: TrimDrag): TrimDraft {
    const { right } = surface.current!.getBoundingClientRect();
    // A pointer outside the right edge requests scrolling, not an unseen trim.
    const x = activeTrim.edge === "trailing" ? Math.min(clientX, right) : clientX;
    const frameOffset = Math.round(sequenceFrameAt(x) - activeTrim.grabFrame);
    return {
      placementId: activeTrim.placementId,
      edge: activeTrim.edge,
      frameOffset,
      sourceFrame: activeTrim.sourceFrame + frameOffset,
    };
  }

  const lastPreviewView = useRef({ frame: visibleLeftFrame, pixelsPerFrame });
  function refreshDragPreviews() {
    if (drag.current && pointer.current) previewMove(pointer.current, drag.current);
    if (trimDrag.current && pointer.current)
      setTrimDraft(proposedTrim(pointer.current.clientX, trimDrag.current));
    if (activeClipId && poolPointer.current) setPoolDraft(poolDestination(poolPointer.current));
  }

  useLayoutEffect(() => {
    const previous = lastPreviewView.current;
    if (previous.frame === visibleLeftFrame && previous.pixelsPerFrame === pixelsPerFrame) return;
    lastPreviewView.current = { frame: visibleLeftFrame, pixelsPerFrame };
    refreshDragPreviews();
  });

  function seekToPointer(event: PointerEvent<HTMLDivElement>, press: CursorPress) {
    const x = Math.max(0, Math.min(width, press.playheadX + event.clientX - press.x));
    onSeek(snapFrame(leftFrame.current + x / pixelsPerFrame, durationFrames));
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const cursor = cursorPress.current;
    if (cursor?.pointerId === event.pointerId) {
      seekToPointer(event, cursor);
      return;
    }
    const pan = panPress.current;
    if (pan?.pointerId === event.pointerId) {
      const delta = event.clientX - pan.x;
      if (pan.active || Math.abs(delta) >= DRAG_THRESHOLD) {
        if (!pan.active) event.currentTarget.setPointerCapture(event.pointerId);
        pan.active = true;
        moved.current = true;
        showFrom(pan.leftFrame - delta / pixelsPerFrame, framesPerTick);
      }
    }
    if (event.isPrimary && event.pointerType !== "touch") {
      pastePointer.current = { clientX: event.clientX, clientY: event.clientY };
      syncPasteTarget();
    }
    if (splitEnabled) {
      setSplitPointer(pan?.active ? null : positionOnTrack(event));
    }
    const pasteOrigin = pastePress.current;
    if (
      pasteOrigin &&
      Math.hypot(event.clientX - pasteOrigin.clientX, event.clientY - pasteOrigin.clientY) >=
        DRAG_THRESHOLD
    ) {
      pastePress.current = null;
    }
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
    pastePress.current = null;
    splitPointerOrigin.current = null;
    if (panPress.current?.pointerId === event.pointerId) panPress.current = null;
    if (cursorPress.current?.pointerId === event.pointerId) cursorPress.current = null;
    if (trimDrag.current?.pointerId === event.pointerId) clearTrim();
    if (drag.current?.pointerId === event.pointerId) clearMove();
  }

  function finishPlacementDrag(event: PointerEvent<HTMLDivElement>) {
    splitPointerOrigin.current = null;
    if (panPress.current?.pointerId === event.pointerId) {
      const { x, leftFrame: origin, active } = panPress.current;
      if (active) showFrom(origin - (event.clientX - x) / pixelsPerFrame, framesPerTick);
      panPress.current = null;
    }
    if (cursorPress.current?.pointerId === event.pointerId) {
      seekToPointer(event, cursorPress.current);
      cursorPress.current = null;
      return;
    }
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
  const splitHover = splitEnabled ? splitTargetAt(splitPointer, visibleLeftFrame) : undefined;
  const splitHoverItem = splitHover && items.get(splitHover.placementId);

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
            { label: "Zoom in", next: zoom + 1, disabled: zoom >= maxZoom },
            { label: "Zoom out", next: zoom - 1, disabled: zoom === 0 },
            { label: "Fit sequence", next: 0, disabled: fitDisabled, fit: true },
          ].map(({ label, next, disabled, fit }) => (
            <button
              key={label}
              type="button"
              className="rounded border px-2 py-0.5 text-sm disabled:opacity-50"
              disabled={disabled || editing}
              onClick={() => changeZoom(next, fit)}
            >
              {label}
            </button>
          ))}
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
          className="gtve-sequence-timeline relative touch-pan-y overflow-hidden"
          data-pool-dragging={isPoolDragging || undefined}
          style={{ "--gtve-ruler-height": `${RULER_HEIGHT}px` } as CSSProperties}
          tabIndex={pasteDrop ? -1 : undefined}
          onPointerDownCapture={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            moved.current = false;
            const target = event.target as Element;
            if (target.closest(CURSOR_GRIP)) {
              keyboardPlayhead.current?.focus({ preventScroll: true });
              cursorPress.current = { pointerId: event.pointerId, x: event.clientX, playheadX };
              event.currentTarget.setPointerCapture(event.pointerId);
              onSeek(snapFrame(playheadFrame, durationFrames));
              return;
            }
            const rowY =
              event.clientY - event.currentTarget.getBoundingClientRect().top - RULER_HEIGHT;
            const inTracks = rowY >= 0 && rowY < Math.max(1, tracks.length) * ROW_HEIGHT;
            const offset = sequenceFrameAt(event.clientX);
            const inPlacement =
              splitEnabled &&
              tracks[Math.floor(rowY / ROW_HEIGHT)]?.placements.some(({ id }) => {
                const item = items.get(id);
                return (
                  item &&
                  offset >= item.sequenceFrame &&
                  offset < item.sequenceFrame + item.duration
                );
              });
            if (inTracks && !inPlacement && !target.closest(`${ACTION}, button`)) {
              panPress.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                leftFrame: leftFrame.current,
                active: false,
              };
            }
            if (event.pointerType !== "touch") {
              pastePointer.current = { clientX: event.clientX, clientY: event.clientY };
              syncPasteTarget();
            }
            if (!pasteDrop || !pasteTargetAt(event)) return;
            pastePress.current = { clientX: event.clientX, clientY: event.clientY };
            event.stopPropagation();
            event.preventDefault();
            event.currentTarget.focus({ preventScroll: true });
          }}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => {
            pastePointer.current = null;
            pastePress.current = null;
            setSplitPointer(null);
            if (!panPress.current?.active) panPress.current = null;
            syncPasteTarget();
          }}
          onPointerUp={finishPlacementDrag}
          onPointerCancel={cancelPlacementDrag}
          onClickCapture={(event) => {
            if (moved.current && event.detail !== 0) {
              event.stopPropagation();
              return;
            }
            const target = pasteDrop && event.detail !== 0 && pasteTargetAt(event);
            if (pasteDrop && target) {
              event.stopPropagation();
              const origin = pastePress.current;
              pastePress.current = null;
              if (
                origin &&
                target.sequenceFrame >= 0 &&
                Math.hypot(event.clientX - origin.clientX, event.clientY - origin.clientY) <
                  DRAG_THRESHOLD
              )
                pasteDrop.confirm(target);
              return;
            }
            if (!(event.target as Element).closest(RULER)) return;
            event.stopPropagation();
            onSeek(snapFrame(sequenceFrameAt(event.clientX), durationFrames));
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
          {width > 0 && playheadVisible && (
            <div
              className="pointer-events-none absolute top-(--gtve-ruler-height) bottom-0 z-[4] border-l border-[#5297ff]"
              style={{ left: playheadX }}
            />
          )}
          {!editing && width > 0 && durationFrames > 0 && (
            <>
              <SequencePlayheadGrip
                ref={keyboardPlayhead}
                frame={playheadFrame}
                durationFrames={durationFrames}
                pixelsPerFrame={pixelsPerFrame}
                scrollLeft={visibleScrollLeft}
                viewportWidth={width}
                onSeek={onSeek}
              />
              {playheadVisible && (
                <div
                  aria-hidden="true"
                  data-sequence-playhead-grip
                  className="gtve-sequence-playhead-grip"
                  style={{ left: Math.max(8, Math.min(width - 8, playheadX)) }}
                />
              )}
            </>
          )}
          <RulerOrigin.Provider value={framesToSeconds(widgetOriginFrame, frameRate)}>
            <Timeline
              ref={timeline}
              editorData={rows}
              effects={EFFECTS}
              style={{
                width: "100%",
                height: RULER_HEIGHT + Math.max(1, rows.length) * ROW_HEIGHT,
              }}
              startLeft={0}
              scale={scale}
              scaleWidth={scaleWidth}
              scaleSplitCount={4}
              minScaleCount={WIDGET_TICKS}
              maxScaleCount={WIDGET_TICKS}
              rowHeight={ROW_HEIGHT}
              hideCursor
              autoScroll={false}
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
              getScaleRender={(seconds) => <RulerLabel seconds={seconds} frameRate={frameRate} />}
              disableDrag
              autoReRender={false}
              getActionRender={({ id }) => {
                const item = items.get(id);
                if (!item) return null;
                const { label, transitionIn, transitionOut, trimRange, mediaKind, thumbnails } =
                  item;
                const mediaKindLabel = mediaKind && mediaKindLabels[mediaKind];
                const title = mediaKindLabel ? `${label} — ${mediaKindLabel}` : label;
                const audioOnly = mediaKind === "audio-only";
                const placementWidth = item.duration * pixelsPerFrame;
                const placementX = (item.sequenceFrame - widgetOriginFrame) * pixelsPerFrame;
                // Use the bottom of the row for wider hit targets on tiny placements.
                // The clipped bodies sit above this lane so a neighboring body keeps its move target.
                const compactTrim = placementWidth < 16;
                const gripPairWidth = COMPACT_TRIM_GRIP_WIDTH * 2;
                const gripPairLeft =
                  Math.max(
                    0,
                    Math.min(
                      WIDGET_TICKS * scaleWidth - gripPairWidth,
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
                  transitionIn || transitionOut
                    ? "items-end pb-0.5"
                    : hasThumbnails
                      ? "items-end pb-3"
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
                        const { width } = node.getBoundingClientRect();
                        node.setPointerCapture(event.pointerId);
                        moved.current = true;
                        trimDrag.current = {
                          pointerId: event.pointerId,
                          placementId: id,
                          edge,
                          grabFrame: sequenceFrameAt(event.clientX),
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
                            const { width } = surface.current!.getBoundingClientRect();
                            event.currentTarget.setPointerCapture(event.pointerId);
                            drag.current = {
                              pointerId: event.pointerId,
                              placementId: id,
                              placementIds: selectedPlacementIds.includes(id)
                                ? selectedPlacementIds
                                : [id],
                              origin: { clientX: event.clientX, clientY: event.clientY },
                              grabFrame: sequenceFrameAt(event.clientX),
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
                      {!compactTrim && trimGrips}
                    </div>
                    {compactTrim && trimGrips}
                  </>
                );
              }}
            />
          </RulerOrigin.Provider>
          {splitEnabled && width > 0 && tracks.length > 0 && (
            // Leave the ruler and playhead reachable above the overlay.
            <div
              className="absolute inset-x-0 bottom-0 top-(--gtve-ruler-height) z-[6] cursor-crosshair"
              onPointerDown={(event) => {
                if (!event.isPrimary || event.button !== 0) return;
                splitPointerOrigin.current = { clientX: event.clientX, clientY: event.clientY };
              }}
              onClickCapture={(event) => {
                // The blade's hover can refer to a different row after a host edit.
                // Consume the click here and hit-test the current layout instead.
                event.stopPropagation();
                if (moved.current || event.detail === 0) return;
                setSplitPointer(null);
                const target = splitTargetAt(positionOnTrack(event), leftFrame.current);
                if (target)
                  activatePlacement({
                    placementId: target.placementId,
                    sequenceFrame: target.sequenceFrame,
                  });
              }}
            >
              {splitHover && splitHoverItem && !splitHover.locked && (
                <div
                  className="pointer-events-none absolute bg-red-500/10 outline outline-red-500/30 -outline-offset-1"
                  style={{
                    left: (splitHoverItem.sequenceFrame - visibleLeftFrame) * pixelsPerFrame,
                    width: splitHoverItem.duration * pixelsPerFrame,
                    top: splitHover.trackIndex * ROW_HEIGHT,
                    height: ROW_HEIGHT,
                  }}
                >
                  <div
                    className="absolute inset-y-0 w-px bg-red-500"
                    style={{
                      left:
                        (splitHover.sequenceFrame - splitHoverItem.sequenceFrame) * pixelsPerFrame,
                    }}
                  >
                    <span className="absolute top-1 left-2 rounded bg-red-700 px-1 text-xs whitespace-nowrap text-white">
                      Split at sequence frame {splitHover.sequenceFrame}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* All transition bodies share a stacking context, even when a window
              extends outside its owner's widget action. The underlay still receives
              placement and trim gestures outside the interactive transition bodies. */}
          <div className="pointer-events-none absolute inset-0 z-[5]">
            {[...items].flatMap(([id, item]) =>
              (["leading", "trailing"] as const).flatMap((edge) => {
                const transition = item[transitionFields[edge]];
                if (!transition) return [];
                const top = RULER_HEIGHT + item.trackIndex * ROW_HEIGHT + PLACEMENT_INSET_Y;
                const selected = transition.id === selectedTransitionId;
                const onSelect = splitEnabled ? undefined : () => selectTransition(transition.id);
                const locked = tracks[item.trackIndex].locked;
                const edit =
                  !splitMode && previewTransitionResize && resizeTransition
                    ? {
                        evaluate: (durationFrames: number) =>
                          previewTransitionResize({ transitionId: transition.id, durationFrames }),
                        commit: (durationFrames: number) =>
                          resizeTransition({ transitionId: transition.id, durationFrames }),
                        locked,
                      }
                    : undefined;
                if (transition.kind === "fade") {
                  return [
                    <div
                      key={transition.id}
                      className="absolute"
                      style={{
                        left: item.sequenceFrame * pixelsPerFrame - visibleScrollLeft,
                        width: item.duration * pixelsPerFrame,
                        top,
                        height: TRANSITION_HEIGHT,
                      }}
                    >
                      <SequenceFadeHandle
                        label={item.label}
                        edge={edge}
                        frames={transition.durationFrames}
                        placementFrames={item.duration}
                        pixelsPerFrame={pixelsPerFrame}
                        selected={selected}
                        onSelect={onSelect}
                        edit={fadePlacementIds.has(id) ? edit : undefined}
                      />
                    </div>,
                  ];
                }
                const cut = item.sequenceFrame + (edge === "leading" ? 0 : item.duration);
                const details = dissolveDetails.get(transition.id);
                const extensions = [details?.outgoingExtension, details?.incomingExtension].flatMap(
                  (range, index) =>
                    range
                      ? [
                          `${index === 0 ? "Outgoing" : "Incoming"} extension: source frames [${range.startFrame}, ${range.endFrame})`,
                        ]
                      : [],
                );
                return [
                  <SequenceDissolveHandle
                    key={transition.id}
                    label={item.label}
                    frames={transition.durationFrames}
                    cut={cut}
                    sequenceDuration={durationFrames}
                    pixelsPerFrame={pixelsPerFrame}
                    scrollLeft={visibleScrollLeft}
                    viewportWidth={width}
                    top={top}
                    height={TRANSITION_HEIGHT}
                    selected={selected}
                    extensions={extensions}
                    onSelect={onSelect}
                    edit={locked ? undefined : edit}
                  />,
                ];
              }),
            )}
          </div>
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
                visibleScrollLeft,
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
                visibleScrollLeft,
                blocked,
              );
            })}
          {draft && draftResult?.snapTargetFrame !== undefined && (
            <svg
              role="img"
              aria-label={`Snap guide at sequence frame ${draftResult.snapTargetFrame}`}
              className="pointer-events-none absolute top-0 z-20 h-full w-0.5 fill-amber-300"
              style={{ left: draftResult.snapTargetFrame * pixelsPerFrame - visibleScrollLeft }}
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
              visibleScrollLeft,
              poolDrop.kind === "blocked",
            )}
          {pasteDrop?.preview?.placements.map((placement, index) => {
            const trackIndex = tracks.findIndex(({ id }) => id === placement.trackId);
            if (trackIndex < 0) return null;
            return placementPreview(
              `paste-${index}`,
              titles[placement.clipId] ?? `Clip ${placement.clipId}`,
              trackIndex,
              placement.sequenceStartFrame,
              placement.duration,
              visibleScrollLeft,
              pasteDrop.preview?.kind === "blocked",
            );
          })}
        </div>
        {tracks.length === 0 && (
          <p className="col-span-full border-t border-slate-600 px-3 py-6 text-sm">
            Add your first track to begin
          </p>
        )}
      </div>
      {/* Draft feedback must not add a page scrollbar and resize the timeline during a gesture. */}
      <div className="h-20 overflow-y-auto text-sm wrap-anywhere tabular-nums">
        {pasteDrop && (
          <output className="mt-1 block">
            Paste: click to place or press Escape to cancel.
            {pasteDrop.preview?.placements.map(({ trackId, sequenceStartFrame }, index) => (
              <span key={index}>
                {" · "}
                {tracks.find(({ id }) => id === trackId)?.label} · Sequence frame{" "}
                {sequenceStartFrame}
              </span>
            ))}
            {pasteDrop.preview?.kind === "blocked" &&
              {
                overlap: " · Blocked: Overlaps another placement",
                "outside-tracks": " · Blocked: The selection needs more tracks",
                "locked-track": " · Blocked: The track is locked",
                "invalid-placement": " · Blocked: Cannot place this selection",
              }[pasteDrop.preview.reason]}
          </output>
        )}
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
