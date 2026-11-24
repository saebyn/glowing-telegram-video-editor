import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect } from "storybook/test";
import SequenceTimeline from "@/components/organisms/SequenceTimeline";
import { useSequenceEditor } from "@/components/organisms/useSequenceEditor";
import { ProjectProvider } from "@/context/ProjectContext";
import { sampleFrameRate } from "@/fixtures/video";
import type { SequencePreviewMedia, SequenceSource } from "@/types";
import SequencePreview from "./SequencePreview";
import { SequenceTransportControls } from "./SequenceTransportControls";

const meta = {
  title: "Molecules/SequencePreview",
  component: SequencePreview,
  decorators: [
    (Story) => (
      <div className="flex min-h-40 flex-col items-center justify-center rounded-lg bg-slate-900 p-4 text-center text-slate-100">
        <Story />
      </div>
    ),
  ],
  args: {
    frameRate: sampleFrameRate,
    playheadFrame: 90,
    durationFrames: 360,
    playback: "paused",
  },
  argTypes: {
    media: { name: "Media", control: "object", type: { name: "object", value: {} } },
    registerPreview: { control: false, table: { disable: true } },
    stoppedOnSound: { control: false, table: { disable: true } },
  },
} satisfies Meta<typeof SequencePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Paused: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Preview is not connected.")).toBeVisible();
    await expect(canvas.getByText("Paused · Sequence frame 90 of 360")).toBeVisible();
  },
};

export const PlayingForward: Story = {
  args: { playback: "forward" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Playing forward · Sequence frame 90 of 360")).toBeVisible();
  },
};

export const PlayingReverse: Story = {
  args: { playback: "reverse" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Playing reverse · Sequence frame 90 of 360")).toBeVisible();
  },
};

const muxSource: SequenceSource = {
  s3Location: "s3://example/mux",
  previewHlsUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  mediaKind: "audio-video",
};

const muxTitles = { opening: "Opening", middle: "Middle", closing: "Closing" };
const muxMedia: SequencePreviewMedia = {
  sequence: {
    durationFrames: 720,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "opening",
            clipId: "opening",
            sequenceStartFrame: 0,
            transitionIn: { id: "fade-in", kind: "fade", durationFrames: 60 },
          },
          {
            id: "middle",
            clipId: "middle",
            sequenceStartFrame: 240,
            transitionIn: { id: "dissolve", kind: "dissolve", durationFrames: 120 },
          },
          {
            id: "closing",
            clipId: "closing",
            sequenceStartFrame: 480,
            transitionOut: { id: "fade-out", kind: "fade", durationFrames: 60 },
          },
        ],
      },
    ],
  },
  clips: [
    {
      id: "opening",
      sourceId: "mux",
      sourceFrameRate: sampleFrameRate,
      sourceInFrame: 60,
      sourceOutFrame: 300,
    },
    {
      id: "middle",
      sourceId: "mux",
      sourceFrameRate: sampleFrameRate,
      sourceInFrame: 1860,
      sourceOutFrame: 2100,
    },
    {
      id: "closing",
      sourceId: "mux",
      sourceFrameRate: sampleFrameRate,
      sourceInFrame: 3660,
      sourceOutFrame: 3900,
    },
  ],
  sources: { mux: muxSource },
};

const toneMedia: SequencePreviewMedia = {
  sequence: {
    durationFrames: 180,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [{ id: "sample", clipId: "sample", sequenceStartFrame: 0 }],
      },
    ],
  },
  clips: [
    {
      id: "sample",
      sourceId: "mux",
      sourceFrameRate: sampleFrameRate,
      sourceInFrame: 0,
      sourceOutFrame: 180,
    },
  ],
  sources: {
    mux: { ...muxSource, previewHlsUrl: "./preview-fixtures/markers.m3u8" },
  },
};

function StandaloneHlsPreview({
  sequence,
  clips,
  sources,
  showTimeline = false,
}: SequencePreviewMedia & { showTimeline?: boolean }) {
  const editorClips = useMemo(() => [...clips], [clips]);
  const { previewProps, toolbarProps, timelineProps } = useSequenceEditor({
    sequence,
    clips: editorClips,
    sources,
    titles: showTimeline ? muxTitles : undefined,
  });
  return (
    <>
      <SequencePreview {...previewProps} />
      <SequenceTransportControls {...toolbarProps.transport} />
      {showTimeline && (
        <div className="mt-4 w-full max-w-4xl text-left">
          <SequenceTimeline {...timelineProps} />
        </div>
      )}
    </>
  );
}

export const PublicHlsSmoke: Story = {
  args: { media: muxMedia },
  argTypes: {
    durationFrames: { control: false, table: { disable: true } },
    playback: { control: false, table: { disable: true } },
    playheadFrame: { control: false, table: { disable: true } },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Play three placements from different parts of the same source. Scrub the read-only timeline to see the opening fade (0–1s), dissolve (3–5s), hard cut (8s), and closing fade (11–12s). In Controls, edit Media to try your own sequence, clips, or source URLs. The default Mux sample depends on the network; automated timing tests use a local fixture.",
      },
    },
  },
  render: ({ media = muxMedia, frameRate }) => (
    <ProjectProvider frameRate={frameRate}>
      <StandaloneHlsPreview {...media} showTimeline />
    </ProjectProvider>
  ),
};

export const LocalTone: Story = {
  ...PublicHlsSmoke,
  args: { media: toneMedia },
  parameters: {
    docs: {
      description: { story: "Play a local reference tone at 60 sequence frames per second." },
    },
  },
  render: ({ media = toneMedia, frameRate }) => (
    <ProjectProvider frameRate={frameRate}>
      <StandaloneHlsPreview {...media} />
    </ProjectProvider>
  ),
};
