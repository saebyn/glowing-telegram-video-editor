import WaveformDisplay from "@/components/atoms/WaveformDisplay";
import type { VideoClip, WaveformData } from "@/types";
import { formatMs } from "@/utils/duration";

interface PreviewTimelineProps {
  /**
   * Waveform data for all channels
   */
  waveformData: WaveformData[];
  /**
   * Current playhead position in milliseconds
   */
  playheadPosition: number;
  /**
   * Selected cutlist clips
   */
  cutlist: VideoClip[];
  /**
   * Total duration in milliseconds
   */
  duration: number;
  /**
   * Width of the timeline
   */
  width?: number;
  /**
   * Height per waveform channel
   */
  waveformHeight?: number;
  /**
   * Callback when user seeks to a time
   */
  onSeek?: (milliseconds: number) => void;
  /**
   * Callback when cutlist is updated
   */
  onCutlistChange?: (cutlist: VideoClip[]) => void;
}

export default function PreviewTimeline({
  waveformData,
  playheadPosition,
  cutlist,
  duration,
  width = 800,
  waveformHeight = 60,
  onSeek,
  onCutlistChange,
}: PreviewTimelineProps) {
  const colors = [
    "#3b82f6", // blue
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#06b6d4", // cyan
  ];

  const handleSeek = (milliseconds: number) => {
    onSeek?.(Math.max(0, Math.min(milliseconds, duration)));
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Preview Timeline
        </h3>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {formatMs(playheadPosition)} / {formatMs(duration)}
        </div>
      </div>

      {/* Cutlist visualization */}
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Selected Clips ({cutlist.length})
        </div>
        <div className="relative h-8 bg-gray-100 dark:bg-gray-800 rounded">
          {cutlist.map((clip, index) => {
            const left = (clip.start / duration) * 100;
            const width = ((clip.end - clip.start) / duration) * 100;
            return (
              <div
                key={clip.id}
                className="absolute h-full bg-blue-500 bg-opacity-70 border border-blue-600 rounded flex items-center justify-center"
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`Clip ${index + 1}: ${formatMs(clip.start)} - ${formatMs(clip.end)}`}
              >
                <span className="text-xs text-white font-medium">
                  {index + 1}
                </span>
              </div>
            );
          })}

          {/* Playhead indicator */}
          <div
            className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
            style={{ left: `${(playheadPosition / duration) * 100}%` }}
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
                playheadPosition={playheadPosition}
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
          <span>{formatMs(0)}</span>
          <span>{formatMs(duration / 4)}</span>
          <span>{formatMs(duration / 2)}</span>
          <span>{formatMs((duration * 3) / 4)}</span>
          <span>{formatMs(duration)}</span>
        </div>
        <div className="w-full h-px bg-gray-300 dark:bg-gray-600 mt-1" />
      </div>
    </div>
  );
}
