import type { Decorator } from "@storybook/react-vite";
import { ProjectProvider } from "@/context/ProjectContext";

export const sampleFrameRate = { numerator: 60, denominator: 1 };
export const sampleSource = { sourceId: "sample-source", sourceFrameRate: sampleFrameRate };

export const withSampleProject: Decorator = (Story) => (
  <ProjectProvider frameRate={sampleFrameRate}>
    <Story />
  </ProjectProvider>
);
