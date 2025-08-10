import { action } from "@storybook/addon-actions";
import AudioLevelSlider from "./AudioLevelSlider";

export default {
  title: "Atoms/AudioLevelSlider",
  component: AudioLevelSlider,
  tags: ["atoms"],
};

export const Default = {
  args: {
    level: 0.75,
    onChange: action("onChange"),
    disabled: false,
  },
};

export const WithLabel = {
  args: {
    level: 0.5,
    onChange: action("onChange"),
    label: "Master Volume",
    disabled: false,
  },
};

export const Muted = {
  args: {
    level: 0,
    onChange: action("onChange"),
    disabled: false,
  },
};

export const FullVolume = {
  args: {
    level: 1.0,
    onChange: action("onChange"),
    disabled: false,
  },
};

export const Disabled = {
  args: {
    level: 0.6,
    onChange: action("onChange"),
    disabled: true,
  },
};

export const DisabledWithLabel = {
  args: {
    level: 0.3,
    onChange: action("onChange"),
    label: "Disabled Track",
    disabled: true,
  },
};
