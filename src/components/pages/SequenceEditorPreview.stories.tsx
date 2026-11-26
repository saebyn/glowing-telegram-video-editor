import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { useMemo, useState } from "react";
import { ProjectProvider } from "@/context/ProjectContext";
import type { Sequence, SequenceSource, SourcesById, VideoClip } from "@/types";
import SequenceEditorPage from "./SequenceEditorPage";

const rate = { numerator: 10, denominator: 1 };
const clips: VideoClip[] = [
  { id: "first", sourceId: "a", sourceInFrame: 2, sourceOutFrame: 17, sourceFrameRate: rate },
  { id: "second", sourceId: "a", sourceInFrame: 21, sourceOutFrame: 34, sourceFrameRate: rate },
];
const sequence: Sequence = {
  tracks: [
    {
      id: "main",
      label: "Main",
      placements: [
        { id: "first", clipId: "first", sequenceStartFrame: 0 },
        {
          id: "second",
          clipId: "second",
          sequenceStartFrame: 15,
          transitionIn: { id: "blend", kind: "dissolve", durationFrames: 6 },
        },
      ],
    },
  ],
};

const meta = {
  title: "Pages/SequenceEditorPreview",
  parameters: { layout: "fullscreen" },
  args: {
    previewHlsUrl: "./preview-fixtures/markers.m3u8",
    separateRenditions: false,
    interrupted: false,
    gapBeforeSecond: false,
  },
  argTypes: {
    firstSourceRateNumerator: { control: "number", type: "number" },
  },
  render: (args: PreviewHostArgs) => <PreviewHost {...args} />,
} satisfies Meta<PreviewHostArgs>;
export default meta;
type Story = StoryObj<typeof meta>;

interface PreviewHostArgs {
  previewHlsUrl: string;
  separateRenditions: boolean;
  interrupted: boolean;
  gapBeforeSecond: boolean;
  firstSourceRateNumerator?: number;
}

function PreviewHost({
  previewHlsUrl,
  separateRenditions,
  interrupted,
  gapBeforeSecond,
  firstSourceRateNumerator,
}: PreviewHostArgs) {
  const [edit, accept] = useState(() => {
    if (!interrupted && !gapBeforeSecond) return sequence;
    const [main] = sequence.tracks;
    const [first, second] = main.placements;
    return {
      ...sequence,
      tracks: [
        {
          ...main,
          placements: gapBeforeSecond
            ? [first, { ...second, sequenceStartFrame: 22 }]
            : [
                { ...first, sourceOutOffsetFrames: -2 },
                {
                  ...first,
                  id: "interrupting-cut",
                  sequenceStartFrame: 13,
                  sourceInOffsetFrames: 10,
                  sourceOutOffsetFrames: -3,
                },
                second,
              ],
        },
      ],
    };
  });
  const [replacement, setReplacement] = useState<string>();
  const url = replacement ?? previewHlsUrl;
  const sources = useMemo<SourcesById<SequenceSource>>(
    () => ({
      a: { s3Location: "s3://fixtures/markers", mediaKind: "audio-video", previewHlsUrl: url },
      ...(separateRenditions
        ? {
            incoming: {
              s3Location: "s3://fixtures/incoming",
              mediaKind: "audio-video",
              previewHlsUrl: "./preview-fixtures/markers.m3u8?incoming",
            } as const,
          }
        : {}),
    }),
    [url, separateRenditions],
  );
  const editorClips = useMemo(() => {
    const [first, second] = clips;
    return [
      firstSourceRateNumerator === undefined
        ? first
        : { ...first, sourceFrameRate: { ...rate, numerator: firstSourceRateNumerator } },
      separateRenditions ? { ...second, sourceId: "incoming" } : second,
    ];
  }, [firstSourceRateNumerator, separateRenditions]);
  const [onCutListResult] = useState(() => fn());
  const [onSequenceChange] = useState(() => fn());
  return (
    <ProjectProvider frameRate={rate}>
      <div className="flex gap-4 p-2">
        <button
          type="button"
          onClick={() => setReplacement("./preview-fixtures/picture-only.m3u8")}
        >
          Replace rendition with picture-only
        </button>
        <button type="button" onClick={() => setReplacement("./preview-fixtures/markers.m3u8")}>
          Use audio-video rendition
        </button>
        <button type="button" onClick={() => setReplacement(undefined)}>
          Restore story rendition
        </button>
      </div>
      <SequenceEditorPage
        sequence={edit}
        clips={editorClips}
        sources={sources}
        onSequenceChange={(next) => {
          onSequenceChange(next);
          accept(next);
        }}
        onCutListResult={onCutListResult}
      />
    </ProjectProvider>
  );
}

export const LocalDissolve: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Play from the start, hear the alternating tones, then seek and step around the dissolve at frame 15. The rendition runs at 5 fps and the project at 10 fps, so two neighboring sequence frames often show the same picture. Seek to frame 15 and compare it with the same frame after pausing reverse playback. At the exclusive end (frame 28), Preview holds the last picture without sound. Split or move a placement and confirm Preview follows the accepted edit even if CutList is unavailable. Use DevTools network throttling, then play, pause or seek while loading; try replacing the rendition or hiding Preview before a request finishes.",
      },
    },
  },
};
export const MissingExpectedSound: Story = {
  args: { previewHlsUrl: "./preview-fixtures/picture-only.m3u8" },
  parameters: {
    docs: {
      description: {
        story:
          "Paused and reverse transport can display the available picture. Play forward to confirm Preview stops and diagnoses the missing declared sound. Seek to the trailing gap to verify that it is ordinary black rather than No media.",
      },
    },
  },
};
export const UndefinedDissolve: Story = {
  args: { interrupted: true },
  parameters: {
    docs: {
      description: {
        story:
          "Play from the start. The dissolve meets a visible cut inside its window, so Preview should stop at frame 12 with an Undefined transition diagnostic. Seek past frame 18 to recover or remove the dissolve to make the edit playable.",
      },
    },
  },
};
