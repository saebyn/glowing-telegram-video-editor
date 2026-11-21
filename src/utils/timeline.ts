export interface TimelineItem<ElementType> {
  type: ElementType;
  startFrame: number;
  endFrame?: number;
  text: string;
  originIndex: number;
}

/** The visible frame range of a timeline. */
export interface TimelineLens {
  startFrame: number;
  endFrame: number;
  durationFrames: number;
}

export interface Timeline<ElementType> {
  sortedElements: TimelineItem<ElementType>[];
}

export function createTimeline<ElementType>(
  elements: TimelineItem<ElementType>[],
): Timeline<ElementType> {
  return { sortedElements: elements.slice().sort((a, b) => a.startFrame - b.startFrame) };
}

export function relativeToFrame(lens: TimelineLens, relative: number): number {
  return Math.round(lens.startFrame + relative * getLensLength(lens));
}

export function frameToRelative(lens: TimelineLens, frame: number): number {
  const length = getLensLength(lens);
  return length > 0 ? (frame - lens.startFrame) / length : 0;
}

export function getVisibleElements<ElementType>(
  lens: TimelineLens,
  timeline: Timeline<ElementType>,
): TimelineItem<ElementType>[] {
  return timeline.sortedElements.filter(
    (element) =>
      element.startFrame < lens.endFrame &&
      (element.endFrame ?? element.startFrame + 1) > lens.startFrame,
  );
}

export function createLens(durationFrames: number): TimelineLens {
  return { startFrame: 0, endFrame: durationFrames, durationFrames };
}

export function zoomIn(lens: TimelineLens, factor: number): TimelineLens {
  return zoomInTowards(lens, factor, 0.5);
}

export function zoomInTowards(lens: TimelineLens, factor: number, relativeX: number): TimelineLens {
  return zoomTowards(lens, 1 / factor, relativeX);
}

export function zoomOut(lens: TimelineLens, factor: number): TimelineLens {
  return zoomOutTowards(lens, factor, 0.5);
}

export function zoomOutTowards(
  lens: TimelineLens,
  factor: number,
  relativeX: number,
): TimelineLens {
  return zoomTowards(lens, factor, relativeX);
}

function zoomTowards(lens: TimelineLens, factor: number, relativeX: number): TimelineLens {
  const center = lens.startFrame + relativeX * getLensLength(lens);
  const halfWidth = (getLensLength(lens) * factor) / 2;
  const start = Math.max(0, center - halfWidth);
  const width = Math.min(
    lens.durationFrames,
    Math.max(1, Math.round(start + 2 * halfWidth) - Math.round(start)),
  );
  return positionLens(lens, Math.round(start), width);
}

function positionLens(lens: TimelineLens, start: number, width: number): TimelineLens {
  const startFrame = Math.max(0, Math.min(lens.durationFrames - width, start));
  return { ...lens, startFrame, endFrame: startFrame + width };
}

export function panLens(lens: TimelineLens, offsetFrames: number): TimelineLens {
  return positionLens(lens, lens.startFrame + offsetFrames, getLensLength(lens));
}

export function resetLens(lens: TimelineLens): TimelineLens {
  return createLens(lens.durationFrames);
}

export function getLensLength(lens: TimelineLens): number {
  return lens.endFrame - lens.startFrame;
}

export function generateKey<ElementType>(element: TimelineItem<ElementType>): string {
  return `${element.type}-${element.startFrame}-${element.originIndex}`;
}
