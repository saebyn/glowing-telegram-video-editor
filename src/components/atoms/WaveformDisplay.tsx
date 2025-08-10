import type { WaveformData } from "@/types";
import { useEffect, useRef } from "react";

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
   * Current playhead position in milliseconds
   */
  playheadPosition?: number;
  /**
   * Color of the waveform
   */
  color?: string;
  /**
   * Color of the playhead
   */
  playheadColor?: string;
  /**
   * Callback when user clicks on the waveform
   */
  onSeek?: (milliseconds: number) => void;
}

export default function WaveformDisplay({
  waveformData,
  width = 400,
  height = 80,
  playheadPosition = 0,
  color = "#3b82f6",
  playheadColor = "#ef4444",
  onSeek,
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    if (playheadPosition >= 0 && waveformData.duration > 0) {
      const playheadX = (playheadPosition / waveformData.duration) * width;
      ctx.strokeStyle = playheadColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [waveformData, width, height, playheadPosition, color, playheadColor]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || waveformData.duration === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const relativeX = x / width;
    const seekTime = relativeX * waveformData.duration;
    
    onSeek(Math.max(0, Math.min(seekTime, waveformData.duration)));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!onSeek || waveformData.duration === 0) return;

    // Allow seeking with arrow keys
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const step = waveformData.duration * 0.05; // 5% step
      const currentTime = playheadPosition || 0;
      const newTime = event.key === "ArrowLeft" 
        ? Math.max(0, currentTime - step)
        : Math.min(waveformData.duration, currentTime + step);
      onSeek(newTime);
    }
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="bg-gray-100 dark:bg-gray-800 rounded cursor-pointer"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={onSeek ? 0 : -1}
        role="slider"
        aria-label="Waveform timeline"
        aria-valuemin={0}
        aria-valuemax={waveformData.duration}
        aria-valuenow={playheadPosition}
      />
      {waveformData.amplitudes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
          No waveform data
        </div>
      )}
    </div>
  );
}