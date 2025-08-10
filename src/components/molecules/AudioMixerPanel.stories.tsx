import type { AudioChannel } from "@/types";
import { action } from "@storybook/addon-actions";
import { useState } from "react";
import AudioMixerPanel from "./AudioMixerPanel";

export default {
  title: "Molecules/AudioMixerPanel",
  component: AudioMixerPanel,
  tags: ["molecules"],
  decorators: [
    (story: () => React.ReactNode) => (
      <div className="h-[70vh] flex justify-center items-start p-4">
        {story()}
      </div>
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

// Interactive wrapper for testing name editing
function InteractiveWrapper({
  initialChannels,
  ...props
}: {
  initialChannels: AudioChannel[];
} & Partial<React.ComponentProps<typeof AudioMixerPanel>>) {
  const [channels, setChannels] = useState(initialChannels);

  const handleChange = (updatedChannels: AudioChannel[]) => {
    setChannels(updatedChannels);
    action("onChange")(updatedChannels);
  };

  return (
    <AudioMixerPanel
      channels={channels}
      onChange={handleChange}
      onSave={action("onSave")}
      {...props}
    />
  );
}

export const Default = {
  render: () => <InteractiveWrapper initialChannels={mockChannels} />,
};

export const SingleChannel = {
  render: () => <InteractiveWrapper initialChannels={[mockChannels[0]]} />,
};

export const ManyChannels = {
  render: () => (
    <InteractiveWrapper
      initialChannels={[
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
      ]}
    />
  ),
};

export const Disabled = {
  render: () => (
    <InteractiveWrapper initialChannels={mockChannels} disabled={true} />
  ),
};

export const Saving = {
  render: () => (
    <InteractiveWrapper initialChannels={mockChannels} saving={true} />
  ),
};

export const AllMuted = {
  render: () => (
    <InteractiveWrapper
      initialChannels={mockChannels.map((channel) => ({
        ...channel,
        muted: true,
      }))}
    />
  ),
};

export const NoSaveCallback = {
  render: () => (
    <InteractiveWrapper initialChannels={mockChannels} onSave={undefined} />
  ),
};

export const WithNameEdit = {
  render: () => (
    <InteractiveWrapper initialChannels={mockChannels} allowNameEdit={true} />
  ),
};

export const WithNameEditAndEmptyNames = {
  render: () => (
    <InteractiveWrapper
      initialChannels={[
        { id: "channel-1", name: "Named Channel", level: 0.8, muted: false },
        { id: "channel-2", name: "", level: 0.6, muted: false },
        { id: "channel-3", name: "Another Named", level: 0.4, muted: true },
        { id: "channel-4", name: "", level: 0.5, muted: false },
      ]}
      allowNameEdit={true}
    />
  ),
};

export const WithNameEditDisabled = {
  render: () => (
    <InteractiveWrapper
      initialChannels={mockChannels}
      allowNameEdit={true}
      disabled={true}
    />
  ),
};
