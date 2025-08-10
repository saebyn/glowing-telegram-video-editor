import { action } from "@storybook/addon-actions";
import AudioMixerPanel from "./AudioMixerPanel";
import type { AudioChannel } from "@/types";

export default {
  title: "Molecules/AudioMixerPanel",
  component: AudioMixerPanel,
  tags: ["molecules"],
  decorators: [
    (story: () => React.ReactNode) => (
      <div className="h-[70vh] flex justify-center items-start p-4">{story()}</div>
    ),
  ],
};

const mockChannels: AudioChannel[] = [
  {
    id: "channel-1",
    name: "Game Audio",
    level: 0.8,
    muted: false,
  },
  {
    id: "channel-2", 
    name: "Microphone",
    level: 0.6,
    muted: false,
  },
  {
    id: "channel-3",
    name: "Desktop Audio",
    level: 0.4,
    muted: true,
  },
];

export const Default = {
  args: {
    channels: mockChannels,
    onChange: action("onChange"),
    onSave: action("onSave"),
    disabled: false,
    saving: false,
  },
};

export const SingleChannel = {
  args: {
    channels: [mockChannels[0]],
    onChange: action("onChange"),
    onSave: action("onSave"),
    disabled: false,
    saving: false,
  },
};

export const ManyChannels = {
  args: {
    channels: [
      ...mockChannels,
      {
        id: "channel-4",
        name: "Music",
        level: 0.3,
        muted: false,
      },
      {
        id: "channel-5",
        name: "Sound Effects",
        level: 0.7,
        muted: false,
      },
      {
        id: "channel-6",
        name: "Voice Chat",
        level: 0.5,
        muted: true,
      },
    ],
    onChange: action("onChange"),
    onSave: action("onSave"),
    disabled: false,
    saving: false,
  },
};

export const Disabled = {
  args: {
    channels: mockChannels,
    onChange: action("onChange"),
    onSave: action("onSave"),
    disabled: true,
    saving: false,
  },
};

export const Saving = {
  args: {
    channels: mockChannels,
    onChange: action("onChange"),
    onSave: action("onSave"),
    disabled: false,
    saving: true,
  },
};

export const AllMuted = {
  args: {
    channels: mockChannels.map(channel => ({ ...channel, muted: true })),
    onChange: action("onChange"),
    onSave: action("onSave"),
    disabled: false,
    saving: false,
  },
};

export const NoSaveCallback = {
  args: {
    channels: mockChannels,
    onChange: action("onChange"),
    // No onSave callback
    disabled: false,
    saving: false,
  },
};