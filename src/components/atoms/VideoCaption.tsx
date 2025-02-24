import type { TranscriptSegment } from "types";

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
function VideoCaption({ playheadTime, transcript }: VideoCaptionProps) {
  // Find the nearby transcript segments to display
  const nearestTranscriptSegmentIndex = transcript.findIndex(
    (segment) => segment.timestamp >= playheadTime,
  );

  return (
    <div className="relative h-12 overflow-hidden rounded-sm bg-gray-900 p-2 text-gray-50 dark:bg-gray-50 dark:text-gray-900">
      {transcript.map((segment, index) => (
        <div
          className="absolute top-0 mx-2 h-full whitespace-nowrap transition-transform
    delay-150 duration-100 animate-in animate-out slide-in-from-right slide-out-to-left"
          style={{
            transform: `translateX(${
              (index - nearestTranscriptSegmentIndex) * 10000
            }px)`,
          }}
          key={segment.timestamp}
        >
          {segment.text}
        </div>
      ))}
    </div>
  );
}

export default VideoCaption;
