import { action } from "@storybook/addon-actions";
import AudioChannelControl from "./AudioChannelControl";
import type { AudioChannel } from "@/types";

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

export const Default = {
  args: {
    channel: mockChannel,
    onChange: action("onChange"),
    disabled: false,
  },
};

export const Muted = {
  args: {
    channel: mockMutedChannel,
    onChange: action("onChange"),
    disabled: false,
  },
};

export const Disabled = {
  args: {
    channel: mockChannel,
    onChange: action("onChange"),
    disabled: true,
  },
};

export const LowLevel = {
  args: {
    channel: {
      ...mockChannel,
      level: 0.1,
    },
    onChange: action("onChange"),
    disabled: false,
  },
};

export const HighLevel = {
  args: {
    channel: {
      ...mockChannel,
      level: 1.0,
    },
    onChange: action("onChange"),
    disabled: false,
  },
};