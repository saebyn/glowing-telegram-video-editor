import type { VideoClip } from "@/types";
import type { Meta, StoryObj } from "@storybook/react";
import ProjectClipPool from "./ProjectClipPool";

const meta = {
  title: "Organisms/ProjectClipPool",
  component: ProjectClipPool,
  tags: ["organisms"],
  argTypes: {
    onClipSelect: { action: "clipSelected" },
    onTitleUpdate: { action: "titleUpdated" },
    onDragStart: { action: "dragStarted" },
  },
} satisfies Meta<typeof ProjectClipPool>;

export default meta;

type Story = StoryObj<typeof meta>;

const sampleClips: VideoClip[] = [
  {
    id: "clip-1",
    start: 0,
    end: 30000,
    keyframeSrc:
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-016500.png",
  },
  {
    id: "clip-2",
    start: 30000,
    end: 75000,
    keyframeSrc:
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-017000.png",
  },
  {
    id: "clip-3",
    start: 75000,
    end: 120000,
    keyframeSrc:
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-018000.png",
  },
  {
    id: "clip-4",
    start: 120000,
    end: 180000,
    keyframeSrc:
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-019000.png",
  },
];

const sampleThumbnails: Record<string, string> = {
  "clip-1":
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-016500.png",
  "clip-2":
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-017000.png",
  "clip-3":
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-018000.png",
  "clip-4":
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-019000.png",
};

const sampleKeyframes: Record<string, string[]> = {
  "clip-1": [
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-016500.png",
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-016750.png",
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-017000.png",
  ],
  "clip-2": [
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-017000.png",
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-017250.png",
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-017500.png",
  ],
  "clip-3": [
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-018000.png",
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-018250.png",
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-018500.png",
  ],
  "clip-4": [
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-019000.png",
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-019250.png",
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-019500.png",
  ],
};

const sampleTitles: Record<string, string> = {
  "clip-1": "Introduction",
  "clip-2": "Main Content",
  "clip-3": "Highlights",
  "clip-4": "Conclusion",
};

export const Default: Story = {
  args: {
    clips: sampleClips,
    thumbnails: sampleThumbnails,
    keyframes: sampleKeyframes,
    titles: sampleTitles,
  },
};

export const WithCheckboxes: Story = {
  args: {
    clips: sampleClips,
    thumbnails: sampleThumbnails,
    keyframes: sampleKeyframes,
    titles: sampleTitles,
    showCheckboxes: true,
  },
};

export const Empty: Story = {
  args: {
    clips: [],
    thumbnails: {},
    keyframes: {},
    titles: {},
  },
};

export const SingleClip: Story = {
  args: {
    clips: [sampleClips[0]],
    thumbnails: { "clip-1": sampleThumbnails["clip-1"] },
    keyframes: { "clip-1": sampleKeyframes["clip-1"] },
    titles: { "clip-1": sampleTitles["clip-1"] },
  },
};

export const ManyClips: Story = {
  args: {
    clips: [
      ...sampleClips,
      ...sampleClips.map((clip, i) => ({
        ...clip,
        id: `${clip.id}-copy-${i}`,
      })),
      ...sampleClips.map((clip, i) => ({
        ...clip,
        id: `${clip.id}-copy2-${i}`,
      })),
    ],
    thumbnails: {
      ...sampleThumbnails,
      ...Object.fromEntries(
        Object.entries(sampleThumbnails).map(([key, value]) => [
          `${key}-copy-0`,
          value,
        ]),
      ),
      ...Object.fromEntries(
        Object.entries(sampleThumbnails).map(([key, value]) => [
          `${key}-copy2-0`,
          value,
        ]),
      ),
    },
    keyframes: {
      ...sampleKeyframes,
      ...Object.fromEntries(
        Object.entries(sampleKeyframes).map(([key, value]) => [
          `${key}-copy-0`,
          value,
        ]),
      ),
      ...Object.fromEntries(
        Object.entries(sampleKeyframes).map(([key, value]) => [
          `${key}-copy2-0`,
          value,
        ]),
      ),
    },
    titles: {
      ...sampleTitles,
      ...Object.fromEntries(
        Object.entries(sampleTitles).map(([key, value]) => [
          `${key}-copy-0`,
          value,
        ]),
      ),
      ...Object.fromEntries(
        Object.entries(sampleTitles).map(([key, value]) => [
          `${key}-copy2-0`,
          value,
        ]),
      ),
    },
  },
};
