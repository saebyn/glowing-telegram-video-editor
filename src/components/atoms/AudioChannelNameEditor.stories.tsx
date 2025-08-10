import { action } from "@storybook/addon-actions";
import { useState } from "react";
import AudioChannelNameEditor from "./AudioChannelNameEditor";

export default {
  title: "Atoms/AudioChannelNameEditor",
  component: AudioChannelNameEditor,
  tags: ["atoms"],
};

// Interactive wrapper component for stories
function InteractiveWrapper({
  initialName,
  ...props
}: { initialName: string } & Partial<
  React.ComponentProps<typeof AudioChannelNameEditor>
>) {
  const [name, setName] = useState(initialName);
  
  const handleNameChange = (newName: string) => {
    setName(newName);
    action("onNameChange")(newName);
  };

  return (
    <div className="w-64">
      <AudioChannelNameEditor
        name={name}
        onNameChange={handleNameChange}
        {...props}
      />
    </div>
  );
}

export const Default = {
  render: () => (
    <InteractiveWrapper initialName="Audio Track 1" />
  ),
};

export const EmptyName = {
  render: () => (
    <InteractiveWrapper initialName="" />
  ),
};

export const LongName = {
  render: () => (
    <InteractiveWrapper initialName="Very Long Audio Channel Name That Might Be Too Long" />
  ),
};

export const CustomPlaceholder = {
  render: () => (
    <InteractiveWrapper 
      initialName="" 
      placeholder="Enter audio channel name..." 
    />
  ),
};

export const Disabled = {
  render: () => (
    <InteractiveWrapper 
      initialName="Read-only Channel" 
      disabled={true}
    />
  ),
};

export const DisabledEmpty = {
  render: () => (
    <InteractiveWrapper 
      initialName="" 
      disabled={true}
      placeholder="No name available"
    />
  ),
};

export const ShortMaxLength = {
  render: () => (
    <InteractiveWrapper 
      initialName="Short" 
      maxLength={10}
    />
  ),
};

export const MultipleChannels = {
  render: () => {
    const [channels, setChannels] = useState([
      { id: "1", name: "Main Audio" },
      { id: "2", name: "Commentary" },
      { id: "3", name: "" },
      { id: "4", name: "Music Track" },
    ]);

    const handleChannelNameChange = (id: string, newName: string) => {
      setChannels(prev => 
        prev.map(channel => 
          channel.id === id ? { ...channel, name: newName } : channel
        )
      );
      action("onNameChange")(`Channel ${id}: ${newName}`);
    };

    return (
      <div className="space-y-2 w-64">
        {channels.map(channel => (
          <div key={channel.id} className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 w-8">#{channel.id}</span>
            <AudioChannelNameEditor
              name={channel.name}
              onNameChange={(newName) => handleChannelNameChange(channel.id, newName)}
              placeholder={`Channel ${channel.id}`}
            />
          </div>
        ))}
      </div>
    );
  },
};

export const InDarkMode = {
  render: () => (
    <div className="dark bg-gray-900 p-4 rounded">
      <div className="space-y-4 w-64">
        <InteractiveWrapper initialName="Dark Mode Channel" />
        <InteractiveWrapper initialName="" placeholder="Empty in dark mode" />
        <InteractiveWrapper initialName="Disabled Channel" disabled={true} />
      </div>
    </div>
  ),
};