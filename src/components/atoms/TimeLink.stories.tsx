import { action } from "@storybook/addon-actions";
import TimeLink from "./TimeLink";

export default {
  title: "Atoms/TimeLink",
  component: TimeLink,
  tags: ["atoms"],
};

export const Default = {
  args: {
    milliseconds: 60000,
    onClick: action("onClick"),
    children: "Click me",
  },
};
