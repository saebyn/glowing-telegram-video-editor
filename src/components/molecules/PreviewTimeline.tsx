import WaveformDisplay from "@/components/atoms/WaveformDisplay";
import { useProjectFrameRate } from "@/context/ProjectContext";
import type { VideoClip, WaveformData } from "@/types";
import { formatFrames, layoutSequence, snapFrame } from "@/utils/frames";

interface PreviewTimelineProps {
  /**
   * Waveform data for all channels
   */
  waveformData: WaveformData[];
  /**
   * Current playhead position in sequence frames
   */
  playheadFrame: number;
  /**
   * Selected cutlist clips
   */
  cutlist: VideoClip[];
  /**
   * Rendered preview length in project frames
   */
  durationFrames: number;
  /**
   * Width of the timeline
   */
  width?: number;
  /**
   * Height per waveform channel
   */
  waveformHeight?: number;
  /**
   * Callback when the user seeks to a sequence frame
   */
  onSeek?: (sequenceFrame: number) => void;
}

export default function PreviewTimeline({
  waveformData,
  playheadFrame,
  cutlist,
  durationFrames,
  width = 800,
  waveformHeight = 60,
  onSeek,
}: PreviewTimelineProps) {
  const frameRate = useProjectFrameRate();
  const { placements } = layoutSequence(cutlist, frameRate);
  const toPercent = (frames: number) => (durationFrames > 0 ? (frames / durationFrames) * 100 : 0);
  const colors = [
    "#3b82f6", // blue
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#06b6d4", // cyan
  ];

  const handleSeek = (sequenceFrame: number) => {
    onSeek?.(snapFrame(sequenceFrame, durationFrames));
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Preview Timeline</h3>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {formatFrames(playheadFrame, frameRate)} / {formatFrames(durationFrames, frameRate)}
        </div>
      </div>

      {/* Cutlist visualization */}
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Selected Clips ({cutlist.length})
        </div>
        <div className="relative h-8 overflow-hidden bg-gray-100 dark:bg-gray-800 rounded">
          {placements.map(({ clip, sequenceStartFrame, durationFrames: clipFrames }, index) => (
            <div
              key={clip.id}
              className="absolute h-full bg-blue-500 bg-opacity-70 border border-blue-600 rounded flex items-center justify-center"
              style={{
                left: `${toPercent(sequenceStartFrame)}%`,
                width: `${toPercent(clipFrames)}%`,
              }}
              title={`Clip ${index + 1}: ${formatFrames(sequenceStartFrame, frameRate)} - ${formatFrames(sequenceStartFrame + clipFrames, frameRate)}`}
            >
              <span className="text-xs text-white font-medium">{index + 1}</span>
            </div>
          ))}

          {/* Playhead indicator */}
          <div
            className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
            style={{ left: `${toPercent(playheadFrame)}%` }}
          />
        </div>
      </div>

      {/* Waveform displays */}
      <div className="space-y-3">
        {waveformData.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No waveform data available
          </div>
        ) : (
          waveformData.map((waveform, index) => (
            <div key={waveform.channelId} className="space-y-1">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Channel {waveform.channelId}
              </div>
              <WaveformDisplay
                waveformData={waveform}
                width={width}
                height={waveformHeight}
                playheadFrame={playheadFrame}
                color={colors[index % colors.length]}
                onSeek={handleSeek}
              />
            </div>
          ))
        )}
      </div>

      {/* Timeline ruler */}
      <div className="mt-4 relative">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
            <span key={fraction}>
              {formatFrames(Math.round(durationFrames * fraction), frameRate)}
            </span>
          ))}
        </div>
        <div className="w-full h-px bg-gray-300 dark:bg-gray-600 mt-1" />
      </div>
    </div>
  );
}
