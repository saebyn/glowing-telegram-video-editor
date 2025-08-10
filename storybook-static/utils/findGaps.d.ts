import { Section, VideoClip } from '../types';
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
export default function findGaps(settings: Settings, sections: Section[]): Promise<VideoClip[]>;
export {};
