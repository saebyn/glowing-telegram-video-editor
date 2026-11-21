import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { sampleSource, withSampleProject } from "@/fixtures/video";
import type { VideoClip } from "@/types";
import ProjectClipPool from "./ProjectClipPool";
import ProjectClipTimeline from "./ProjectClipTimeline";

const meta = {
  title: "Organisms/ProjectClipTimeline",
  component: ProjectClipTimeline,
  tags: ["organisms"],
  decorators: [withSampleProject],
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
    ...sampleSource,
    sourceInFrame: 0,
    sourceOutFrame: 1800,
    keyframeSrc:
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-016500.png",
  },
  {
    id: "clip-2",
    ...sampleSource,
    sourceInFrame: 1800,
    sourceOutFrame: 4500,
    keyframeSrc:
      "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-017000.png",
  },
  {
    id: "clip-3",
    ...sampleSource,
    sourceInFrame: 4500,
    sourceOutFrame: 7200,
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
    thumbnails: sampleThumbnails,
    keyframes: sampleKeyframes,
    titles: sampleTitles,
    playheadFrame: 0,
  },
};

export const WithPlayhead: Story = {
  args: {
    clips: sampleClips,
    thumbnails: sampleThumbnails,
    keyframes: sampleKeyframes,
    titles: sampleTitles,
    playheadFrame: 3600,
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
      {
        id: "clip-4",
        ...sampleSource,
        sourceInFrame: 7200,
        sourceOutFrame: 9000,
        keyframeSrc:
          "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-019000.png",
      },
      {
        id: "clip-5",
        ...sampleSource,
        sourceInFrame: 9000,
        sourceOutFrame: 10_800,
        keyframeSrc:
          "http://d347j9o7s02wqh.cloudfront.net/keyframes/2025-11-09/2025-11-09%2008-38-21.mkv/frame-019500.png",
      },
    ],
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
    const [playhead, setPlayhead] = useState(args.playheadFrame ?? 0);

    return (
      <ProjectClipTimeline
        {...args}
        clips={clips}
        playheadFrame={playhead}
        onClipsReorder={setClips}
        onClipRemove={(id) => setClips((prevClips) => prevClips.filter((c) => c.id !== id))}
        onSeek={setPlayhead}
        onClipTrim={(id, sourceInFrame, sourceOutFrame) =>
          setClips((prevClips) =>
            prevClips.map((c) => (c.id === id ? { ...c, sourceInFrame, sourceOutFrame } : c)),
          )
        }
      />
    );
  },
  args: {
    clips: sampleClips,
    thumbnails: sampleThumbnails,
    keyframes: sampleKeyframes,
    titles: sampleTitles,
    playheadFrame: 0,
  },
};

export const WithClipPool: Story = {
  args: {
    clips: [
      { ...sampleSource, id: "base", sourceInFrame: 0, sourceOutFrame: 732 },
      {
        id: "short",
        sourceId: "second-source",
        sourceFrameRate: { numerator: 120, denominator: 1 },
        sourceInFrame: 4,
        sourceOutFrame: 76,
      },
    ],
    thumbnails: {},
    keyframes: {},
    titles: { base: "Base clip", short: "Short clip", spare: "Spare clip" },
  },
  render: (args) => {
    const [clips, setClips] = useState(args.clips);
    const [playheadFrame, setPlayhead] = useState(0);
    const spare = { ...sampleSource, id: "spare", sourceInFrame: 0, sourceOutFrame: 120 };

    return (
      <div style={{ width: "min(800px, 100%)" }}>
        <ProjectClipPool
          clips={clips.some(({ id }) => id === spare.id) ? [] : [spare]}
          thumbnails={args.thumbnails}
          keyframes={args.keyframes}
          titles={args.titles}
        />
        <ProjectClipTimeline
          {...args}
          clips={clips}
          playheadFrame={playheadFrame}
          onSeek={setPlayhead}
          onClipsAdd={(ids, index) => {
            if (ids.includes(spare.id))
              setClips([...clips.slice(0, index), spare, ...clips.slice(index)]);
          }}
          onClipsReorder={setClips}
          onClipRemove={(id) => setClips(clips.filter((clip) => clip.id !== id))}
          onClipTrim={(id, sourceInFrame, sourceOutFrame) => {
            setClips(
              clips.map((clip) =>
                clip.id === id ? { ...clip, sourceInFrame, sourceOutFrame } : clip,
              ),
            );
          }}
          renderTransition={(left, right) => (
            <button
              type="button"
              aria-label={`Transition from ${left} to ${right}`}
              className="rounded bg-gray-600 px-2 text-white"
            >
              +
            </button>
          )}
        />
        <output aria-label="Sequence playhead frame">{playheadFrame}</output>
      </div>
    );
  },
};
