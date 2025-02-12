import type { Section, VideoClip } from "types";

/**
 * Finds gaps between video sections that are greater than or equal to the specified minimum gap duration.
 *
 * @param {Section[]} sections - The list of video sections.
 * @param {number} minGapDuration - The minimum duration of a gap to be considered.
 * @returns {Promise<VideoClip[]>} - A promise that resolves to an array of video clips representing the gaps.
 */
export default async function findGaps(
  sections: Section[],
  minGapDuration: number,
): Promise<VideoClip[]> {
  const gaps: VideoClip[] = [];

  const validSections = sections.filter(
    (section): section is Section & { timestamp_end: number } =>
      section.timestamp_end !== undefined,
  );

  for (let i = 0; i < validSections.length - 1; i++) {
    const currentSection = validSections[i];
    const nextSection = validSections[i + 1];

    const gapDuration = nextSection.timestamp - currentSection.timestamp_end;

    if (gapDuration >= minGapDuration) {
      gaps.push({
        id: `${currentSection.timestamp_end}-${nextSection.timestamp}`,
        start: currentSection.timestamp_end,
        end: nextSection.timestamp,
      });
    }
  }

  return gaps;
}
