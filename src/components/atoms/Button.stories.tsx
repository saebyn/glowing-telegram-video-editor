import { action } from "storybook/actions";
import Button from "./Button";

export default {
  title: "Atoms/Button",
  component: Button,
  tags: ["atoms"],
};

export const Default = {
  args: {
    children: "Button",
    onClick: action("onClick"),
  },
};
