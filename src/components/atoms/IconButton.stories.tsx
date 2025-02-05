import { action } from "@storybook/addon-actions";
import IconButton from "./IconButton";

export default {
  title: "Atoms/IconButton",
  component: IconButton,
  tags: ["atoms"],
};

export const Default = {
  args: {
    children: "IconButton",
    onClick: action("onClick"),
  },
};
