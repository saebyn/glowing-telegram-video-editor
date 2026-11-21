import { action } from "storybook/actions";
import { sampleFrameRate } from "@/fixtures/video";
import TimeLink from "./TimeLink";

export default {
  title: "Atoms/TimeLink",
  component: TimeLink,
  tags: ["atoms"],
};

export const Default = {
  args: {
    frame: 3600,
    frameRate: sampleFrameRate,
    onClick: action("onClick"),
    children: "Click me",
  },
};
