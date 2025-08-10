import { TranscriptSegment } from '../../types';
interface VideoCaptionProps {
    playheadTime: number;
    transcript: TranscriptSegment[];
}
/**
 * VideoCaption component
 *
 * Stitches together the transcript segments to create a "ticker"
 * that scrolls through the transcript as the video plays.
 */
declare function VideoCaption({ playheadTime, transcript }: VideoCaptionProps): import("react/jsx-runtime").JSX.Element;
export default VideoCaption;
