//import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import ProjectClipPreview from "./ProjectClipPreview";

const meta = {
  title: "Molecules/ProjectClipPreview",
  component: ProjectClipPreview,
  tags: ["molecules"],

  argTypes: {
    onSelect: { action: "onSelect" },
    onTitleUpdate: { action: "onTitleUpdate" },
  },
} satisfies Meta<typeof ProjectClipPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default = {
  args: {
    thumbnailUrl:
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-016500.png",
    keyframeUrls: [
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-016500.png",
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-016750.png",
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-017000.png",
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-017250.png",
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-017500.png",
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-017750.png",
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-018000.png",
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-018250.png",
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-018500.png",
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-018750.png",
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-019000.png",
    ],
    title: "Sample Project Clip",
    durationSeconds: 120,
    width: "150px",
    height: "115px",
    id: "clip-1",
    showCheckbox: false,
    onTitleUpdate: (id: string, newTitle: string) => {},
  },
} satisfies Story;
