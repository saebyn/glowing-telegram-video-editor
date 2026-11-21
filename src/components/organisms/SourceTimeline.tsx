import {
  Timeline,
  type TimelineEditor,
  type TimelineState,
} from "@keplar-404/react-timeline-editor";
import { type PointerEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, Section, VideoMetadata } from "@/types";
import { formatFrames, framesToSeconds, secondsToFrame, snapFrame } from "@/utils/frames";

type SourceTimelineProps = {
  content: VideoMetadata;
  playheadFrame: number;
  onSeekToFrame: (sourceFrame: number) => void;
  onItemSelect: (item: Section) => void;
};

const ANNOTATION_LANES = [
  { id: "highlight", name: "Highlights", field: "highlights" },
  { id: "attention", name: "Attention flags", field: "attentions" },
  { id: "silence", name: "Silence", field: "silences" },
  { id: "error", name: "Transcription errors", field: "transcription_errors" },
] as const;

const LANES = [...ANNOTATION_LANES, { id: "chat", name: "Chat" }] as const;
const EFFECTS = Object.fromEntries(LANES.map(({ id, name }) => [id, { id, name }]));
const RULER = ".timeline-editor-time-area-interact";
const EDIT_ROW = ".timeline-editor-edit-row";
const EDIT_GRID = ".timeline-editor-edit-area .ReactVirtualized__Grid";
const START_LEFT = 12;
const ROW_HEIGHT = 28;
const OVERVIEW_TICKS = 8;
// Stay below react-virtualized's element width cap (1.5 million pixels).
const MAX_GRID_WIDTH = 1_000_000;
const DETAIL_FRAMES_PER_PIXEL = 2;

function makeAction(id: string, effectId: string, start: number, end: number) {
  return { id, effectId, start, end, movable: false, flexible: false };
}

function firstChatAtOrAfter(chat: readonly ChatMessage[], frame: number) {
  let lo = 0;
  let hi = chat.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (chat[mid].sourceFrame < frame) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export default function SourceTimeline({
  content,
  playheadFrame,
  onSeekToFrame,
  onItemSelect,
}: SourceTimelineProps) {
  const widget = useRef<TimelineState>(null);
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; left: number; moved: boolean } | null>(null);
  const pendingScroll = useRef<number | null>(null);
  const [width, setWidth] = useState(0);
  const [requestedZoom, setZoom] = useState(0);
  const [scrollLeft, setScrolledLeft] = useState(0);
  const {
    frameRate,
    durationFrames,
    highlights,
    attentions,
    silences,
    transcription_errors,
    chat_history,
  } = content;
  const timeWidth = Math.max(OVERVIEW_TICKS, width - START_LEFT);
  const maxZoom = Math.max(
    0,
    Math.min(
      Math.ceil(Math.log2(Math.max(1, durationFrames / timeWidth))),
      Math.floor(Math.log2(MAX_GRID_WIDTH / timeWidth)),
    ),
  );
  const zoom = Math.min(requestedZoom, maxZoom);
  const magnification = 2 ** zoom;
  const tickCount = OVERVIEW_TICKS * magnification;
  const framesPerPixel = Math.max(1, durationFrames) / (timeWidth * magnification);
  const scale = framesToSeconds(Math.max(1, durationFrames) / tickCount, frameRate);
  const maxScroll = timeWidth * (magnification - 1);

  useLayoutEffect(() => {
    const node = surface.current!;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const left = Math.min(pendingScroll.current ?? scrollLeft, maxScroll);
    if (pendingScroll.current !== null || left !== scrollLeft) {
      pendingScroll.current = null;
      widget.current?.setScrollLeft(left);
      setScrolledLeft(left);
    }
  }, [maxScroll, scrollLeft]);

  function zoomBy(delta: number, x = START_LEFT + timeWidth / 2) {
    const next = Math.max(0, Math.min(maxZoom, zoom + delta));
    if (next === zoom) return;
    const anchor = Math.max(0, x - START_LEFT);
    pendingScroll.current = Math.max(0, (scrollLeft + anchor) * 2 ** (next - zoom) - anchor);
    setZoom(next);
  }

  useLayoutEffect(() => {
    const node = surface.current!;
    function onWheel(event: WheelEvent) {
      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY)
        return;
      const direction = event.deltaY < 0 ? 1 : -1;
      if ((direction > 0 && zoom === maxZoom) || (direction < 0 && zoom === 0)) return;
      event.preventDefault();
      zoomBy(direction, event.clientX - node.getBoundingClientRect().left);
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  });

  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (zoom === 0 || event.button !== 0 || event.shiftKey || event.pointerType === "touch") return;
    if (!(event.target instanceof Element) || !event.target.closest(EDIT_ROW)) {
      return;
    }
    drag.current = { pointerId: event.pointerId, x: event.clientX, left: scrollLeft, moved: false };
  }

  function movePan(event: PointerEvent<HTMLDivElement>) {
    const pan = drag.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const delta = pan.x - event.clientX;
    if (!pan.moved) {
      if (Math.abs(delta) < 4) return;
      pan.moved = true;
      // Capture only once it's a pan, so a click on a row or marker can still reach the widget.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    widget.current?.setScrollLeft(Math.max(0, Math.min(maxScroll, pan.left + delta)));
  }

  function stopPan(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  const { annotationRows, annotations } = useMemo(() => {
    const items = { highlights, attentions, silences, transcription_errors };
    const annotations = new Map<string, Section>();
    const annotationRows = ANNOTATION_LANES.map(({ id, field }) => ({
      id,
      actions: items[field].map((item, index) => {
        const actionId = `${id}:${index}`;
        annotations.set(actionId, item);
        const start = snapFrame(item.sourceFrame, Math.max(0, durationFrames - 1));
        const end = Math.max(start + 1, snapFrame(item.sourceOutFrame ?? start, durationFrames));
        return makeAction(
          actionId,
          id,
          framesToSeconds(start, frameRate),
          framesToSeconds(end, frameRate),
        );
      }),
    }));
    return { annotationRows, annotations };
  }, [highlights, attentions, silences, transcription_errors, frameRate, durationFrames]);

  const chat = useMemo(
    () => [...chat_history].sort((a, b) => a.sourceFrame - b.sourceFrame),
    [chat_history],
  );
  const showDots = framesPerPixel <= DETAIL_FRAMES_PER_PIXEL;
  // Power-of-two buckets stay anchored to frame zero as the viewport pans. Render only
  // visible buckets (plus a little overscan): the widget virtualizes rows, not their actions.
  const bucketFrames = showDots ? 1 : 2 ** Math.ceil(Math.log2(8 * framesPerPixel));
  const firstBucket = Math.max(0, Math.floor((scrollLeft * framesPerPixel) / bucketFrames) - 1);
  const lastBucket = Math.ceil(((scrollLeft + timeWidth) * framesPerPixel) / bucketFrames) + 1;
  const { chatRow, chatMarkers } = useMemo(() => {
    const actions: TimelineEditor["editorData"][number]["actions"] = [];
    const chatMarkers = new Map<string, { count: number; username: string; frame: number }>();
    const limit = Math.min(lastBucket * bucketFrames, durationFrames);
    for (
      let i = firstChatAtOrAfter(chat, firstBucket * bucketFrames);
      i < chat.length && chat[i].sourceFrame < limit;
    ) {
      const { sourceFrame, username } = chat[i];
      const start = Math.floor(sourceFrame / bucketFrames) * bucketFrames;
      const end = Math.min(start + bucketFrames, durationFrames);
      const next = firstChatAtOrAfter(chat, end);
      const id = `chat:${start}`;
      chatMarkers.set(id, { count: next - i, username, frame: start });
      actions.push(
        makeAction(id, "chat", framesToSeconds(start, frameRate), framesToSeconds(end, frameRate)),
      );
      i = next;
    }
    return { chatRow: { id: "chat", actions }, chatMarkers };
  }, [chat, firstBucket, lastBucket, bucketFrames, durationFrames, frameRate]);
  const rows = useMemo(() => [...annotationRows, chatRow], [annotationRows, chatRow]);

  useLayoutEffect(() => {
    widget.current?.setTime(framesToSeconds(playheadFrame, frameRate));
  }, [playheadFrame, frameRate]);

  function seek(seconds: number) {
    if (durationFrames > 0) {
      onSeekToFrame(snapFrame(secondsToFrame(seconds, frameRate), durationFrames));
    }
  }

  return (
    <section aria-label="Source timeline" className="gtve-source-timeline">
      <div className="gtve-source-timeline-toolbar">
        <button type="button" disabled={zoom === maxZoom} onClick={() => zoomBy(1)}>
          Zoom in
        </button>
        <button type="button" disabled={zoom === 0} onClick={() => zoomBy(-1)}>
          Zoom out
        </button>
        <button
          type="button"
          disabled={zoom === 0}
          onClick={() => {
            pendingScroll.current = 0;
            setZoom(0);
          }}
        >
          Fit full source
        </button>
        <span>Click to seek · Shift-click a range to add a clip</span>
      </div>
      <div className="gtve-source-timeline-grid">
        <div className="gtve-source-timeline-labels">
          <div>Annotations</div>
          {LANES.map(({ id, name }) => (
            <div key={id} data-lane={id}>
              <i />
              {name}
            </div>
          ))}
        </div>
        <div
          ref={surface}
          className="gtve-source-timeline-surface"
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={stopPan}
          onPointerCancel={stopPan}
          onPointerLeave={stopPan}
          onClickCapture={(event) => {
            // Version 1.0.11 subtracts scrollLeft when checking the ruler's right bound,
            // rejecting valid clicks. Use the actual grid offset for both surfaces while panned
            // so they agree even before the vendor's scroll synchronization has caught up.
            if (
              event.shiftKey ||
              event.detail === 0 ||
              !(event.target instanceof Element) ||
              !event.target.closest(`${RULER}, ${EDIT_ROW}`)
            )
              return;
            const left = event.currentTarget.querySelector(EDIT_GRID)?.scrollLeft;
            if (!left) return;
            event.stopPropagation();
            const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
            seek(framesToSeconds((x + left - START_LEFT) * framesPerPixel, frameRate));
          }}
        >
          <Timeline
            ref={widget}
            editorData={rows}
            effects={EFFECTS}
            style={{ width: "100%", height: 42 + LANES.length * ROW_HEIGHT + 12 }}
            startLeft={START_LEFT}
            rowHeight={ROW_HEIGHT}
            scale={scale}
            scaleWidth={timeWidth / OVERVIEW_TICKS}
            scaleSplitCount={4}
            minScaleCount={tickCount}
            maxScaleCount={tickCount}
            getScaleRender={(seconds) =>
              formatFrames(secondsToFrame(seconds, frameRate), frameRate)
            }
            disableDrag
            autoReRender={false}
            onScroll={({ scrollLeft: left }) => setScrolledLeft(left)}
            onClickTimeArea={(seconds, event) => {
              if (!event.shiftKey) seek(seconds);
              return false;
            }}
            onClickRow={(event, { time }) => {
              if (!event.shiftKey) seek(time);
            }}
            onCursorDragEnd={seek}
            getActionRender={(action) => {
              const marker = chatMarkers.get(action.id);
              if (marker) {
                const time = formatFrames(marker.frame, frameRate);
                const density = Math.log2(marker.count + 1);
                const title =
                  showDots && marker.count === 1
                    ? `${marker.username} · ${time}`
                    : `${marker.count} chat ${marker.count === 1 ? "message" : "messages"} · ${time}`;
                return (
                  <span
                    className={`gtve-source-timeline-chat${showDots ? " is-dot" : ""}`}
                    title={title}
                    style={{ opacity: showDots ? 1 : 0.2 + (0.8 * density) / (density + 4) }}
                  />
                );
              }
              const item = annotations.get(action.id);
              if (!item) return null;
              const label =
                item.description ||
                item.category ||
                ANNOTATION_LANES.find(({ id }) => id === action.effectId)?.name;
              return (
                <button
                  type="button"
                  className="gtve-source-timeline-range"
                  data-lane={action.effectId}
                  title={`${label} · ${formatFrames(item.sourceFrame, frameRate)}${
                    item.sourceOutFrame === undefined
                      ? ""
                      : `–${formatFrames(item.sourceOutFrame, frameRate)}`
                  }`}
                  onClick={(event) => {
                    if (event.shiftKey || event.detail === 0) {
                      event.stopPropagation();
                      onItemSelect(item);
                    }
                  }}
                >
                  {label}
                </button>
              );
            }}
          />
        </div>
      </div>
    </section>
  );
}
