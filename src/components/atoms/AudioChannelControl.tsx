import type { AudioChannel } from "@/types";
import AudioChannelNameEditor from "./AudioChannelNameEditor";
import AudioLevelSlider from "./AudioLevelSlider";
import IconButton from "./IconButton";

interface AudioChannelControlProps {
  /**
   * Audio channel configuration
   */
  channel: AudioChannel;
  /**
   * Callback when channel settings change
   */
  onChange: (channel: AudioChannel) => void;
  /**
   * Whether the control is disabled
   */
  disabled?: boolean;
  /**
   * Whether the channel name can be edited
   */
  allowNameEdit?: boolean;
}

export default function AudioChannelControl({
  channel,
  onChange,
  disabled = false,
  allowNameEdit = false,
}: AudioChannelControlProps) {
  const handleLevelChange = (level: number) => {
    onChange({ ...channel, level });
  };

  const handleMuteToggle = () => {
    onChange({ ...channel, muted: !channel.muted });
  };

  const handleNameChange = (name: string) => {
    onChange({ ...channel, name });
  };

  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="flex-shrink-0">
        <div className="mb-1">
          {allowNameEdit ? (
            <AudioChannelNameEditor
              name={channel.name}
              onNameChange={handleNameChange}
              disabled={disabled}
              placeholder="Channel Name"
            />
          ) : (
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {channel.name}
            </div>
          )}
        </div>
        <IconButton
          icon={channel.muted ? "volume_off" : "volume_up"}
          onClick={handleMuteToggle}
          disabled={disabled}
          variant={channel.muted ? "danger" : "secondary"}
          title={channel.muted ? "Unmute" : "Mute"}
        />
      </div>
      <div className="flex-1 min-w-0">
        <AudioLevelSlider
          level={channel.muted ? 0 : channel.level}
          onChange={handleLevelChange}
          disabled={disabled || channel.muted}
        />
      </div>
    </div>
  );
}
