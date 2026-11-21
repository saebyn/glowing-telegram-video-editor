import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectProvider } from "@/context/ProjectContext";
import type { RawVideoMetadata } from "@/types";
import parseContent from "@/utils/parseData";
import VideoSelectionPage from "./VideoSelectionPage";

afterEach(cleanup);

// Simulate only the HLS transport. Observe seeks on the actual media element.
vi.mock("hls.js", () => ({
  default: class {
    static Events = { ERROR: "error" };
    static isSupported = () => true;
    on() {}
    loadSource() {}
    attachMedia() {}
    detachMedia() {}
    destroy() {}
  },
}));

const rawSource: RawVideoMetadata = {
  sourceId: "source-a",
  frameRate: { numerator: 60, denominator: 1 },
  title: "Source A",
  video_url: "/source.m3u8",
  length: "PT10S",
  highlights: [],
  attentions: [],
  transcription_errors: [],
  silences: [],
  chat_history: [],
  transcript: [],
};

const nearbyHighlights = [
  { description: "First highlight", timestamp_start: "PT0.100S", timestamp_end: "PT1S" },
  { description: "Second highlight", timestamp_start: "PT0.106S", timestamp_end: "PT2S" },
  { description: "Other highlight", timestamp_start: "PT4S", timestamp_end: "PT5S" },
];

it("seeks, copies the playhead and exports cuts on the native source grid", () => {
  const frameRate = { numerator: 60, denominator: 1 };
  const content = parseContent({
    sourceId: "source-a",
    frameRate,
    title: "Source A",
    video_url: "/source.m3u8",
    length: "PT2.25S",
    highlights: [{ description: "Moment", timestamp_start: "PT0.05S", timestamp_end: "PT0.3S" }],
    attentions: [],
    transcription_errors: [],
    silences: [],
    chat_history: [],
    transcript: [],
  });
  const onExport = vi.fn();
  const { container } = render(
    <ProjectProvider frameRate={{ numerator: 30, denominator: 1 }}>
      <VideoSelectionPage content={content} onExport={onExport} />
    </ProjectProvider>,
  );
  const video = container.querySelector("video")!;
  const row = within(screen.getByRole("row", { name: /Moment/ }));
  const timeline = screen.getByRole("region", { name: "Source timeline" });
  vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 0, 270, 64));

  fireEvent.click(timeline, { clientX: 29 });
  expect(video.currentTime).toBeCloseTo(5 / 60, 10);
  fireEvent.click(row.getByRole("link", { name: "00:00.05" }));
  expect(video.currentTime).toBeCloseTo(0.05, 10);
  fireEvent.click(row.getByRole("button", { name: "Clip" }));

  fireEvent.keyDown(document, { key: "ArrowRight" });
  fireEvent.keyDown(document, { key: "ArrowRight" });
  expect(video.currentTime).toBeCloseTo(5 / 60, 10);

  video.currentTime = 0.12;
  fireEvent.timeUpdate(video);
  fireEvent.click(screen.getByTitle("Copy in point from playhead"));
  fireEvent.click(screen.getByTitle("Copy out point from playhead")); // would make the range empty
  fireEvent.click(screen.getAllByRole("button", { name: /Export/ })[0]);

  expect(onExport).toHaveBeenCalledWith([
    expect.objectContaining({
      sourceId: "source-a",
      sourceFrameRate: frameRate,
      sourceDurationFrames: 135,
      sourceInFrame: 7,
      sourceOutFrame: 18,
    }),
  ]);

  video.currentTime = 0.25;
  fireEvent.timeUpdate(video);
  fireEvent.click(screen.getByTitle("Copy out point from playhead"));
  fireEvent.click(screen.getAllByRole("button", { name: /Export/ })[0]);
  expect(onExport).toHaveBeenLastCalledWith([
    expect.objectContaining({ sourceInFrame: 7, sourceOutFrame: 15 }),
  ]);
});

it("exports distinct source ranges that start on the same snapped frame", () => {
  const content = parseContent({ ...rawSource, highlights: nearbyHighlights });
  const onExport = vi.fn();
  render(<VideoSelectionPage content={content} onExport={onExport} />);

  for (const name of [/First highlight/, /Second highlight/]) {
    const row = within(screen.getByRole("row", { name }));
    fireEvent.click(row.getByRole("button", { name: "Clip" }));
  }
  fireEvent.click(within(screen.getByRole("main")).getByRole("button", { name: "Export" }));

  expect(onExport).toHaveBeenCalledWith([
    expect.objectContaining({ sourceInFrame: 6, sourceOutFrame: 60 }),
    expect.objectContaining({ sourceInFrame: 6, sourceOutFrame: 120 }),
  ]);
});

it("filters every sidebar annotation on a shared frame independently", () => {
  const content = parseContent({ ...rawSource, highlights: nearbyHighlights });
  render(<VideoSelectionPage content={content} />);
  fireEvent.click(screen.getByRole("button", { name: "Toggle navigation menu" }));
  const nav = within(screen.getByRole("navigation"));
  expect(nav.getByRole("link", { name: /First highlight/ })).toBeVisible();
  expect(nav.getByRole("link", { name: /Second highlight/ })).toBeVisible();

  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Other highlight" } });

  expect(nav.queryAllByRole("link", { name: /(?:First|Second) highlight/ })).toHaveLength(0);
  expect(nav.getByRole("link", { name: /Other highlight/ })).toBeVisible();
});

it("removes every table row for annotations removed from a shared frame", () => {
  const content = parseContent({ ...rawSource, highlights: nearbyHighlights });
  const { rerender } = render(<VideoSelectionPage content={content} />);

  rerender(
    <VideoSelectionPage content={{ ...content, highlights: content.highlights.slice(2) }} />,
  );

  expect(screen.queryAllByRole("row", { name: /(?:First|Second) highlight/ })).toHaveLength(0);
  expect(screen.getByRole("row", { name: /Other highlight/ })).toBeVisible();
});

it("keeps playback in place and uses the corrected source duration for timeline seeks", () => {
  const content = parseContent(rawSource);
  const { container, rerender } = render(<VideoSelectionPage content={content} />);
  const seekToMiddle = () => {
    const timeline = screen.getByRole("region", { name: "Source timeline" });
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 500, 64));
    fireEvent.click(timeline, { clientX: 250 });
  };

  seekToMiddle();
  expect(container.querySelector("video")!.currentTime).toBe(5);

  rerender(<VideoSelectionPage content={{ ...content, durationFrames: 540 }} />);

  expect(container.querySelector("video")!.currentTime).toBe(5);
  seekToMiddle();
  expect(container.querySelector("video")!.currentTime).toBe(4.5);
});
