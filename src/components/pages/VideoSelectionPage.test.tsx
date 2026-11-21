import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectProvider } from "@/context/ProjectContext";
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
