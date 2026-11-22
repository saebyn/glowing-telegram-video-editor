export const SEQUENCE_VIEWPORT_TICKS = 4;

const DETAIL_PIXELS_PER_FRAME = 8;
// Leave space for drag headroom below react-virtualized's grid width limit.
const MAX_RULER_WIDTH = 500_000;

export function getSequenceTimelineViewport(
  width: number,
  durationFrames: number,
  requestedZoom: number,
) {
  const scaleWidth = Math.max(1, width / SEQUENCE_VIEWPORT_TICKS);
  const fitWidth = scaleWidth * SEQUENCE_VIEWPORT_TICKS;
  const frames = Math.max(1, durationFrames);
  const maxZoom =
    width === 0 || durationFrames === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            Math.ceil(Math.log2((frames * DETAIL_PIXELS_PER_FRAME) / fitWidth)),
            Math.floor(Math.log2(MAX_RULER_WIDTH / fitWidth)),
          ),
        );
  const zoom = Math.max(0, Math.min(requestedZoom, maxZoom));
  const magnification = 2 ** zoom;
  const rulerWidth = fitWidth * magnification;
  return {
    zoom,
    maxZoom,
    scaleWidth,
    rulerWidth,
    tickCount: SEQUENCE_VIEWPORT_TICKS * magnification,
    pixelsPerFrame: rulerWidth / frames,
    maxScrollLeft: rulerWidth - fitWidth,
  };
}

type Viewport = ReturnType<typeof getSequenceTimelineViewport>;

export function getZoomScrollLeft(
  width: number,
  scrollLeft: number,
  playheadFrame: number,
  current: Viewport,
  next: Viewport,
) {
  const playheadX = playheadFrame * current.pixelsPerFrame - scrollLeft;
  const anchorX = playheadX >= 0 && playheadX <= width ? playheadX : width / 2;
  const anchorFrame = (scrollLeft + anchorX) / current.pixelsPerFrame;
  return Math.max(
    0,
    Math.min(next.maxScrollLeft, Math.round(anchorFrame * next.pixelsPerFrame - anchorX)),
  );
}
