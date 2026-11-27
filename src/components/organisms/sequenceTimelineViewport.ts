const VISIBLE_TICKS = 4;
// Keplar sees twelve ticks at a time, independent of the sequence duration.
export const WIDGET_TICKS = 12;
const DETAIL_PIXELS_PER_FRAME = 8;

export function getSequenceTimelineViewport(width: number, fitFrames: number, zoom: number) {
  const scaleWidth = Math.max(1, Math.round(width / VISIBLE_TICKS));
  const pixelsPerFrame = (Math.max(1, width) * 2 ** zoom) / fitFrames;
  return { scaleWidth, pixelsPerFrame, framesPerTick: scaleWidth / pixelsPerFrame };
}

export function getMaxZoom(width: number, fitFrames: number) {
  return Math.max(
    0,
    Math.ceil(Math.log2((fitFrames * DETAIL_PIXELS_PER_FRAME) / Math.max(1, width))),
  );
}

export function getWidgetOrigin(leftFrame: number, framesPerTick: number, previousOrigin: number) {
  const leftTick = leftFrame / framesPerTick;
  if (leftTick >= previousOrigin + 2 && leftTick <= previousOrigin + 6) return previousOrigin;
  // Keep the major tick lattice anchored to frame zero, including across a rebase.
  return Math.floor(leftTick) - VISIBLE_TICKS;
}

export function getZoomLeftFrame(
  width: number,
  leftFrame: number,
  playheadFrame: number,
  pixelsPerFrame: number,
  nextPixelsPerFrame: number,
) {
  const playheadX = (playheadFrame - leftFrame) * pixelsPerFrame;
  const anchorX = playheadX >= 0 && playheadX <= width ? playheadX : width / 2;
  return leftFrame + anchorX / pixelsPerFrame - anchorX / nextPixelsPerFrame;
}
