import { action } from "@storybook/addon-actions";
import { useState } from "react";
import type { AudioChannel } from "@/types";
import AudioChannelControl from "./AudioChannelControl";

export default {
  title: "Atoms/AudioChannelControl",
  component: AudioChannelControl,
  tags: ["atoms"],
};

const mockChannel: AudioChannel = {
  id: "channel-1",
  name: "Audio Track 1",
  level: 0.75,
  muted: false,
};

const mockMutedChannel: AudioChannel = {
  id: "channel-2",
  name: "Audio Track 2",
  level: 0.5,
  muted: true,
};

// Interactive wrapper for testing name editing
function InteractiveWrapper({
  initialChannel,
  ...props
}: {
  initialChannel: AudioChannel;
} & Partial<React.ComponentProps<typeof AudioChannelControl>>) {
  const [channel, setChannel] = useState(initialChannel);

  const handleChange = (updatedChannel: AudioChannel) => {
    setChannel(updatedChannel);
    action("onChange")(updatedChannel);
  };

  return (
    <AudioChannelControl channel={channel} onChange={handleChange} {...props} />
  );
}

export const Default = {
  render: () => <InteractiveWrapper initialChannel={mockChannel} />,
};

export const Muted = {
  render: () => <InteractiveWrapper initialChannel={mockMutedChannel} />,
};

export const Disabled = {
  render: () => (
    <InteractiveWrapper initialChannel={mockChannel} disabled={true} />
  ),
};

export const LowLevel = {
  render: () => (
    <InteractiveWrapper
      initialChannel={{
        ...mockChannel,
        level: 0.1,
      }}
    />
  ),
};

export const HighLevel = {
  render: () => (
    <InteractiveWrapper
      initialChannel={{
        ...mockChannel,
        level: 1.0,
      }}
    />
  ),
};

export const WithNameEdit = {
  render: () => (
    <InteractiveWrapper initialChannel={mockChannel} allowNameEdit={true} />
  ),
};

export const WithNameEditMuted = {
  render: () => (
    <InteractiveWrapper
      initialChannel={mockMutedChannel}
      allowNameEdit={true}
    />
  ),
};

export const WithNameEditDisabled = {
  render: () => (
    <InteractiveWrapper
      initialChannel={mockChannel}
      allowNameEdit={true}
      disabled={true}
    />
  ),
};

export const WithNameEditEmptyName = {
  render: () => (
    <InteractiveWrapper
      initialChannel={{
        ...mockChannel,
        name: "",
      }}
      allowNameEdit={true}
    />
  ),
};
