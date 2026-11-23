import { useEffect, useRef } from "react";
import type { WaveformData } from "@/types";
import { snapFrame } from "@/utils/frames";

interface WaveformDisplayProps {
  /**
   * Waveform data to display
   */
  waveformData: WaveformData;
  /**
   * Width of the waveform display
   */
  width?: number;
  /**
   * Height of the waveform display
   */
  height?: number;
  /**
   * Current playhead position in sequence frames
   */
  playheadFrame?: number;
  /**
   * Color of the waveform
   */
  color?: string;
  /**
   * Color of the playhead
   */
  playheadColor?: string;
  /**
   * Callback when the user seeks on the waveform
   */
  onSeek?: (sequenceFrame: number) => void;
}

export default function WaveformDisplay({
  waveformData,
  width = 400,
  height = 80,
  playheadFrame = 0,
  color = "#3b82f6",
  playheadColor = "#ef4444",
  onSeek,
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { durationFrames } = waveformData;
  const visibleFrame = snapFrame(playheadFrame, durationFrames);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    const { amplitudes } = waveformData;
    if (amplitudes.length === 0) return;

    const barWidth = width / amplitudes.length;
    const halfHeight = height / 2;

    ctx.fillStyle = color;

    for (let i = 0; i < amplitudes.length; i++) {
      const amplitude = Math.abs(amplitudes[i]);
      const barHeight = amplitude * halfHeight;
      const x = i * barWidth;

      // Draw positive amplitude
      ctx.fillRect(x, halfHeight - barHeight, barWidth - 1, barHeight);
      // Draw negative amplitude (mirrored)
      ctx.fillRect(x, halfHeight, barWidth - 1, barHeight);
    }

    // Draw playhead
    if (durationFrames > 0) {
      const playheadX = (visibleFrame / durationFrames) * width;
      ctx.strokeStyle = playheadColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [waveformData, width, height, visibleFrame, durationFrames, color, playheadColor]);

  return (
    <div className="relative w-fit rounded has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-500">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block rounded bg-gray-100 dark:bg-gray-800"
        aria-label="Audio waveform"
      />
      {waveformData.amplitudes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
          No waveform data
        </div>
      )}
      {onSeek && durationFrames > 0 && (
        <input
          type="range"
          dir="ltr"
          min={0}
          max={durationFrames}
          step={1}
          value={visibleFrame}
          aria-label="Waveform timeline"
          className="gtve-seek-input absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
          onChange={(event) => onSeek(event.currentTarget.valueAsNumber)}
          onKeyDown={(event) => {
            // Preserve the existing five-percent waveform seek for left and right.
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const step = Math.max(1, Math.round(durationFrames * 0.05));
            const offset = event.key === "ArrowLeft" ? -step : step;
            onSeek(snapFrame(visibleFrame + offset, durationFrames));
          }}
        />
      )}
    </div>
  );
}
