import { useState } from "react";
import AnimatedHamburgerIconButton from "./AnimatedHamburgerIconButton";

export default {
  title: "Atoms/AnimatedHamburgerIconButton",
  component: AnimatedHamburgerIconButton,
  tags: ["atoms"],
};

export const Default = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <AnimatedHamburgerIconButton
      isExpanded={isExpanded}
      onClick={() => setIsExpanded(!isExpanded)}
    />
  );
};
