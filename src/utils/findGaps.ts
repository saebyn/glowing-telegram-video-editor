import type { Section, SourceRange } from "@/types";

interface Settings {
  minGapFrames: number;
  minSectionFrames: number;
  durationFrames: number;
}

/** Find native ranges between sufficiently long silence sections. */
export default function findGaps(
  { minGapFrames, minSectionFrames, durationFrames }: Settings,
  sections: Section[],
): Pick<SourceRange, "sourceInFrame" | "sourceOutFrame">[] {
  const gaps: Pick<SourceRange, "sourceInFrame" | "sourceOutFrame">[] = [];
  const eligibleSections = sections
    .filter(
      (section): section is Section & { sourceOutFrame: number } =>
        section.sourceOutFrame !== undefined &&
        section.sourceOutFrame - section.sourceFrame >= minSectionFrames,
    )
    .sort((a, b) => a.sourceFrame - b.sourceFrame);

  let sourceInFrame = 0;
  for (const section of [
    ...eligibleSections,
    { sourceFrame: durationFrames, sourceOutFrame: durationFrames },
  ]) {
    const sourceOutFrame = Math.min(durationFrames, section.sourceFrame);
    if (sourceOutFrame > sourceInFrame && sourceOutFrame - sourceInFrame >= minGapFrames) {
      gaps.push({ sourceInFrame, sourceOutFrame });
    }
    sourceInFrame = Math.max(sourceInFrame, section.sourceOutFrame);
  }
  return gaps;
}
