import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { VideoClip } from "@/types";
import ProjectClipTimeline from "./ProjectClipTimeline";

const meta = {
  title: "Organisms/ProjectClipTimeline",
  component: ProjectClipTimeline,
  tags: ["organisms"],
  argTypes: {
    onClipsReorder: { action: "clipsReordered" },
    onClipRemove: { action: "clipRemoved" },
    onTitleUpdate: { action: "titleUpdated" },
    onSeek: { action: "seeked" },
    onClipsAdd: { action: "clipsAdded" },
    onClipTrim: { action: "clipTrimmed" },
  },
} satisfies Meta<typeof ProjectClipTimeline>;

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
];

const sampleThumbnails: Record<string, string> = {
  "clip-1":
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-016500.png",
  "clip-2":
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-017000.png",
  "clip-3":
    "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-018000.png",
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
};

const sampleTitles: Record<string, string> = {
  "clip-1": "Introduction",
  "clip-2": "Main Content",
  "clip-3": "Highlights",
};

export const Default: Story = {
  args: {
    clips: sampleClips,
    duration: 120000,
    thumbnails: sampleThumbnails,
    keyframes: sampleKeyframes,
    titles: sampleTitles,
    playheadPosition: 0,
  },
};

export const WithPlayhead: Story = {
  args: {
    clips: sampleClips,
    duration: 120000,
    thumbnails: sampleThumbnails,
    keyframes: sampleKeyframes,
    titles: sampleTitles,
    playheadPosition: 60000,
  },
};

export const Empty: Story = {
  args: {
    clips: [],
    duration: 120000,
    thumbnails: {},
    keyframes: {},
    titles: {},
  },
};

export const SingleClip: Story = {
  args: {
    clips: [sampleClips[0]],
    duration: 120000,
    thumbnails: { "clip-1": sampleThumbnails["clip-1"] },
    keyframes: { "clip-1": sampleKeyframes["clip-1"] },
    titles: { "clip-1": sampleTitles["clip-1"] },
  },
};

export const ManyClips: Story = {
  args: {
    clips: [
      ...sampleClips,
      {
        id: "clip-4",
        start: 120000,
        end: 150000,
        keyframeSrc:
          "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-019000.png",
      },
      {
        id: "clip-5",
        start: 150000,
        end: 180000,
        keyframeSrc:
          "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-019500.png",
      },
    ],
    duration: 180000,
    thumbnails: {
      ...sampleThumbnails,
      "clip-4":
        "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-019000.png",
      "clip-5":
        "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-019500.png",
    },
    keyframes: {
      ...sampleKeyframes,
      "clip-4": [
        "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-019000.png",
      ],
      "clip-5": [
        "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-019500.png",
      ],
    },
    titles: {
      ...sampleTitles,
      "clip-4": "Section 4",
      "clip-5": "Conclusion",
    },
  },
};

// Interactive story with state management
export const Interactive: Story = {
  render: (args) => {
    const [clips, setClips] = useState(args.clips);
    const [playhead, setPlayhead] = useState(args.playheadPosition || 0);

    return (
      <ProjectClipTimeline
        {...args}
        clips={clips}
        playheadPosition={playhead}
        onClipsReorder={setClips}
        onClipRemove={(id) =>
          setClips((prevClips) => prevClips.filter((c) => c.id !== id))
        }
        onSeek={setPlayhead}
        onClipTrim={(id, newStart, newEnd) =>
          setClips((prevClips) =>
            prevClips.map((c) =>
              c.id === id ? { ...c, start: newStart, end: newEnd } : c,
            ),
          )
        }
      />
    );
  },
  args: {
    clips: sampleClips,
    duration: 120000,
    thumbnails: sampleThumbnails,
    keyframes: sampleKeyframes,
    titles: sampleTitles,
    playheadPosition: 0,
  },
};
