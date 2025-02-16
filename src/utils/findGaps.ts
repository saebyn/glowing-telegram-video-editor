import type { Section, VideoClip } from "types";

type Settings = {
  /**
   * The minimum duration of a gap to be considered a valid gap.
   */
  minGapDuration: number;
  /**
   * The minimum duration of a section to be considered a valid section.
   */
  minSectionDuration: number;
  /**
   * The total length of the video.
   */
  length: number;
};

/**
 * Finds gaps between sections in a video.
 *
 * Gaps are defined as the time between the end of one section and the start of
 * the next section. A gap is only considered valid if it is at least as long
 * as the minimum gap duration.
 * A section is only considered valid if it is at least as long as the minimum
 * section duration and it has a defined end time.
 *
 * @param {Settings} settings - The settings including length, minGapDuration, and minSectionDuration.
 * @param {Section[]} sections - The list of video sections.
 * @returns {Promise<VideoClip[]>} - A promise that resolves to an array of video clips representing the gaps.
 */
export default async function findGaps(
  settings: Settings,
  sections: Section[],
): Promise<VideoClip[]> {
  const gaps: VideoClip[] = [];

  const eligibleSections = sections
    .filter(
      (section): section is Section & { timestamp_end: number } =>
        section.timestamp_end !== undefined,
    )
    .filter(
      (section) =>
        section.timestamp_end - section.timestamp >=
        settings.minSectionDuration,
    );

  const inclusiveSections = [
    {
      timestamp: 0,
      timestamp_end: 0,
    },
    ...eligibleSections,
    { timestamp: settings.length, timestamp_end: settings.length },
  ];

  for (let i = 0; i < inclusiveSections.length - 1; i++) {
    const currentSection = inclusiveSections[i];
    const nextSection = inclusiveSections[i + 1];

    const gapDuration = nextSection.timestamp - currentSection.timestamp_end;

    if (gapDuration >= settings.minGapDuration) {
      gaps.push({
        id: `${currentSection.timestamp_end}-${nextSection.timestamp}`,
        start: currentSection.timestamp_end,
        end: nextSection.timestamp,
      });
    }
  }

  return gaps;
}
