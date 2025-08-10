import AudioChannelControl from "@/components/atoms/AudioChannelControl";
import Button from "@/components/atoms/Button";
import type { AudioChannel } from "@/types";

interface AudioMixerPanelProps {
  /**
   * Array of audio channels to control
   */
  channels: AudioChannel[];
  /**
   * Callback when any channel changes
   */
  onChange: (channels: AudioChannel[]) => void;
  /**
   * Callback when save is clicked
   */
  onSave?: () => void;
  /**
   * Whether the mixer is disabled
   */
  disabled?: boolean;
  /**
   * Whether save is in progress
   */
  saving?: boolean;
}

export default function AudioMixerPanel({
  channels,
  onChange,
  onSave,
  disabled = false,
  saving = false,
}: AudioMixerPanelProps) {
  const handleChannelChange = (updatedChannel: AudioChannel) => {
    const updatedChannels = channels.map((channel) =>
      channel.id === updatedChannel.id ? updatedChannel : channel,
    );
    onChange(updatedChannels);
  };

  const handleMasterMute = () => {
    const allMuted = channels.every((channel) => channel.muted);
    const updatedChannels = channels.map((channel) => ({
      ...channel,
      muted: !allMuted,
    }));
    onChange(updatedChannels);
  };

  const handleResetLevels = () => {
    const resetChannels = channels.map((channel) => ({
      ...channel,
      level: 1.0,
      muted: false,
    }));
    onChange(resetChannels);
  };

  const allMuted = channels.every((channel) => channel.muted);
  const hasChanges = channels.some(
    (channel) => channel.level !== 1.0 || channel.muted,
  );

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Audio Mixer
        </h3>
        <div className="flex space-x-2">
          <Button
            onClick={handleMasterMute}
            variant={allMuted ? "danger" : "secondary"}
            disabled={disabled}
          >
            {allMuted ? "Unmute All" : "Mute All"}
          </Button>
          <Button
            onClick={handleResetLevels}
            variant="secondary"
            disabled={disabled || !hasChanges}
          >
            Reset
          </Button>
          {onSave && (
            <Button
              onClick={onSave}
              variant="primary"
              disabled={disabled || saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {channels.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No audio channels available
          </div>
        ) : (
          channels.map((channel) => (
            <AudioChannelControl
              key={channel.id}
              channel={channel}
              onChange={handleChannelChange}
              disabled={disabled}
            />
          ))
        )}
      </div>

      {channels.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {channels.filter((c) => !c.muted).length} of {channels.length}{" "}
            channels active
          </div>
        </div>
      )}
    </div>
  );
}
