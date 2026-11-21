import { useRef, useState } from "react";
import Button from "@/components/atoms/Button";
import AudioMixerPanel from "@/components/molecules/AudioMixerPanel";
import PreviewTimeline from "@/components/molecules/PreviewTimeline";
import VideoPlayer, { type VideoPlayerRef } from "@/components/molecules/VideoPlayer";
import type { AudioChannel, PreviewSettings } from "@/types";
import { hasAudioChanges } from "@/utils/audioChannels";

interface VideoPreviewProps {
  /**
   * Preview settings including cutlist and audio configuration
   */
  settings: PreviewSettings;
  /**
   * URL to the preview video (HLS stream)
   */
  previewVideoUrl: string;
  /**
   * Initial playhead position in sequence frames
   */
  playheadFrame?: number;
  /**
   * Number of project frames in the host-supplied preview
   */
  durationFrames: number;
  /**
   * Callback when preview settings change
   */
  onSettingsChange?: (settings: PreviewSettings) => void;
  /**
   * Callback when user requests to re-render preview
   */
  onRegenerate?: (settings: PreviewSettings) => void;
  /**
   * Callback when user saves settings
   */
  onSave?: (settings: PreviewSettings) => void;
  /**
   * Whether the preview is currently being generated
   */
  regenerating?: boolean;
  /**
   * Whether save is in progress
   */
  saving?: boolean;
}

export default function VideoPreview({
  settings,
  previewVideoUrl,
  playheadFrame = 0,
  durationFrames,
  onSettingsChange,
  onRegenerate,
  onSave,
  regenerating = false,
  saving = false,
}: VideoPreviewProps) {
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const [currentFrame, setCurrentFrame] = useState(playheadFrame);

  const handleAudioChannelsChange = (channels: AudioChannel[]) => {
    const updatedSettings = {
      ...settings,
      audioChannels: channels,
    };
    onSettingsChange?.(updatedSettings);
  };

  const handleSeek = (sequenceFrame: number) => {
    setCurrentFrame(sequenceFrame);
    videoPlayerRef.current?.seekTo(sequenceFrame);
  };

  const handleRegenerate = () => {
    onRegenerate?.(settings);
  };

  const handleSave = () => {
    onSave?.(settings);
  };

  const hasChanges = hasAudioChanges(settings.audioChannels);

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Video Preview</h1>
          <div className="flex space-x-3">
            <Button
              onClick={handleRegenerate}
              variant="secondary"
              disabled={regenerating || saving}
            >
              {regenerating ? "Regenerating..." : "Regenerate Preview"}
            </Button>
            <Button
              onClick={handleSave}
              variant="primary"
              disabled={!hasChanges || saving || regenerating}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Video player */}
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4">
            <VideoPlayer
              ref={videoPlayerRef}
              videoUrl={previewVideoUrl}
              durationFrames={durationFrames}
              onFrameUpdate={setCurrentFrame}
            />
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-auto p-4">
            <PreviewTimeline
              waveformData={settings.waveformData}
              playheadFrame={currentFrame}
              cutlist={settings.cutlist}
              durationFrames={durationFrames}
              onSeek={handleSeek}
            />
          </div>
        </div>

        {/* Audio mixer sidebar */}
        <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-auto">
          <div className="p-4">
            <AudioMixerPanel
              channels={settings.audioChannels}
              onChange={handleAudioChannelsChange}
              onSave={hasChanges ? handleSave : undefined}
              disabled={regenerating}
              saving={saving}
            />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div>
            {settings.cutlist.length} clips selected •{" "}
            {settings.audioChannels.filter((c) => !c.muted).length} of{" "}
            {settings.audioChannels.length} audio channels active
          </div>
          <div>
            {regenerating && "Generating preview..."}
            {saving && "Saving changes..."}
            {!regenerating && !saving && hasChanges && "Changes pending"}
          </div>
        </div>
      </div>
    </div>
  );
}
