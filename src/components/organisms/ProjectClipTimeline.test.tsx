import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectProvider } from "@/context/ProjectContext";
import type { VideoClip } from "@/types";
import ProjectClipTimeline from "./ProjectClipTimeline";

afterEach(cleanup);

it("lays out native cuts in project frames and preserves their counts through reorder and trim", () => {
  const at60 = { numerator: 60, denominator: 1 };
  const at30 = { numerator: 30, denominator: 1 };
  const clips: VideoClip[] = [
    {
      id: "a",
      sourceId: "source-a",
      sourceFrameRate: at60,
      sourceInFrame: 3,
      sourceOutFrame: 18,
      sourceDurationFrames: 19,
    },
    { id: "b", sourceId: "source-b", sourceFrameRate: at30, sourceInFrame: 7, sourceOutFrame: 11 },
  ];
  const onSeek = vi.fn();
  const onClipsReorder = vi.fn();
  const onClipTrim = vi.fn();
  const timeline = (clips: VideoClip[], frameRate = at30) => (
    <ProjectProvider frameRate={frameRate}>
      <ProjectClipTimeline
        clips={clips}
        thumbnails={{}}
        keyframes={{}}
        titles={{}}
        onSeek={onSeek}
        onClipsReorder={onClipsReorder}
        onClipTrim={onClipTrim}
      />
    </ProjectProvider>
  );
  const { rerender } = render(timeline(clips));
  const track = screen.getByRole("region", { name: "Sequence timeline" });
  vi.spyOn(track, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 120, 200));
  const placements = () => Array.from(track.querySelectorAll<HTMLElement>("[draggable=true]"));

  expect(Number.parseFloat(placements()[0].style.width)).toBeCloseTo(100 * (8 / 12));
  fireEvent.click(track, { clientX: 76 });
  expect(onSeek).toHaveBeenLastCalledWith(8);

  const dataTransfer = { getData: (format: string) => (format === "text/plain" ? "1" : "") };
  fireEvent.drop(placements()[0], { dataTransfer });
  expect(onClipsReorder).toHaveBeenCalledWith([clips[1], clips[0]]);
  rerender(timeline([clips[1], clips[0]]));
  expect(Number.parseFloat(placements()[0].style.width)).toBeCloseTo(100 * (4 / 12));

  const handle = screen.getAllByRole("button", { name: "Trim in point" })[1];
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  expect(onClipTrim).toHaveBeenLastCalledWith("a", 4, 18);
  fireEvent.mouseDown(handle, { clientX: 40 });
  fireEvent.mouseMove(document, { clientX: 54 });
  fireEvent.mouseUp(document, { clientX: 54 });
  expect(onClipTrim).toHaveBeenLastCalledWith("a", 5, 18);

  const outHandle = screen.getAllByRole("button", { name: "Trim out point" })[1];
  fireEvent.mouseDown(outHandle, { clientX: 120 });
  fireEvent.mouseMove(document, { clientX: 99 });
  fireEvent.mouseUp(document, { clientX: 99 });
  expect(onClipTrim).toHaveBeenLastCalledWith("a", 3, 14);
  fireEvent.mouseDown(outHandle, { clientX: 120 });
  fireEvent.mouseMove(document, { clientX: 146 });
  fireEvent.mouseUp(document, { clientX: 146 });
  expect(onClipTrim).toHaveBeenLastCalledWith("a", 3, 19);

  rerender(timeline(clips, at60));
  expect(Number.parseFloat(placements()[0].style.width)).toBeCloseTo(100 * (15 / 23));

  // Dragging two project frames left on a 24 fps clip at 60 fps
  // is -0.8 native frames, which snaps to -1, not zero.
  rerender(
    timeline([clips[0], { ...clips[1], sourceFrameRate: { numerator: 24, denominator: 1 } }], at60),
  );
  const slowerOutHandle = screen.getAllByRole("button", { name: "Trim out point" })[1];
  fireEvent.mouseDown(slowerOutHandle, { clientX: 120 });
  fireEvent.mouseMove(document, { clientX: 111 });
  fireEvent.mouseUp(document, { clientX: 111 });
  expect(onClipTrim).toHaveBeenLastCalledWith("b", 7, 10);
});
