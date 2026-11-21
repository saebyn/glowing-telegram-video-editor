import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TimelineProvider } from "@/context/TimelineContext";
import type { VideoMetadata } from "@/types";
import Timeline from "./Timeline";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("pans a zoomed source timeline even when each mouse move is smaller than a frame", () => {
  const content: VideoMetadata = {
    sourceId: "source",
    frameRate: { numerator: 60, denominator: 1 },
    title: "Source",
    video_url: "",
    durationFrames: 3600,
    highlights: [],
    attentions: [],
    transcription_errors: [],
    silences: [],
    chat_history: [],
    transcript: [],
  };
  const onSeekToFrame = vi.fn();
  render(
    <TimelineProvider durationFrames={content.durationFrames}>
      <Timeline content={content} playheadFrame={1800} onSeekToFrame={onSeekToFrame} />
    </TimelineProvider>,
  );
  const timeline = screen.getByRole("region", { name: "Source timeline" });
  vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 800, 64));

  for (let i = 0; i < 50; i++) {
    const wheel = new WheelEvent("wheel", { deltaY: -1, cancelable: true });
    // Happy DOM's WheelEvent does not inherit MouseEvent's coordinates.
    Object.defineProperty(wheel, "clientX", { value: 400 });
    fireEvent(timeline, wheel);
  }
  fireEvent.click(timeline, { clientX: 400 });
  expect(onSeekToFrame).toHaveBeenLastCalledWith(1800);

  const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
  fireEvent.mouseDown(timeline, { clientX: 400 });
  clock.mockReturnValue(1300);
  for (let x = 398; x >= 200; x -= 2) {
    fireEvent.mouseMove(document, { clientX: x, movementX: -2 });
  }
  fireEvent.mouseUp(document, { clientX: 200 });
  fireEvent.click(timeline, { clientX: 400 });

  expect(onSeekToFrame).toHaveBeenLastCalledWith(1808);
});
