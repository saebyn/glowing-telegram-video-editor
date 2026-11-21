import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { TimelineEditor, TimelineState } from "@keplar-404/react-timeline-editor";
import { type Ref, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectProvider } from "@/context/ProjectContext";
import type { VideoClip } from "@/types";
import ProjectClipTimeline from "./ProjectClipTimeline";

// Use the vendor's public callbacks in Happy DOM; verify real geometry in the browser.
vi.mock("@keplar-404/react-timeline-editor", async () => {
  const { useImperativeHandle, useState } = await import("react");
  return {
    Timeline: ({
      ref: widgetRef,
      editorData,
      getActionRender,
      onClickTimeArea,
      onClickRow,
    }: TimelineEditor & { ref?: Ref<Pick<TimelineState, "setTime">> }) => {
      const [time, setTime] = useState(0);
      useImperativeHandle(widgetRef, () => ({ setTime }));
      return (
        <>
          <div
            role="presentation"
            onClick={(event) => {
              if (onClickTimeArea?.(0.253, event) !== false) setTime(0.253);
            }}
          >
            <button type="button">Seek at 0.253 seconds</button>
          </div>
          <output aria-label="Widget cursor time">{time}</output>
          {editorData.map((row) => (
            <div
              key={row.id}
              role="presentation"
              onClick={(event) => onClickRow?.(event, { row, time: 0.253 })}
            >
              {row.actions.map((action) => (
                <div key={action.id}>{getActionRender?.(action, row)}</div>
              ))}
            </div>
          ))}
        </>
      );
    },
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("seeks in sequence frames and keeps the playhead controlled by the host", () => {
  const at30 = { numerator: 30, denominator: 1 };
  const onSeek = vi.fn();
  const clips = [
    {
      id: "a",
      sourceId: "source-a",
      sourceFrameRate: { numerator: 60, denominator: 1 },
      sourceInFrame: 3,
      sourceOutFrame: 123,
    },
  ];
  const timeline = (playheadFrame: number) => (
    <ProjectProvider frameRate={at30}>
      <ProjectClipTimeline
        clips={clips}
        thumbnails={{}}
        keyframes={{}}
        titles={{}}
        playheadFrame={playheadFrame}
        onSeek={onSeek}
      />
    </ProjectProvider>
  );
  const { rerender } = render(timeline(15));
  const track = within(screen.getByRole("region", { name: "Sequence timeline" }));
  fireEvent.click(track.getByRole("button", { name: "Seek at 0.253 seconds" }));
  expect(onSeek).toHaveBeenCalledExactlyOnceWith(8);
  expect(track.getByLabelText("Widget cursor time")).toHaveTextContent(/^0\.5$/);
  rerender(timeline(30));
  expect(track.getByLabelText("Widget cursor time")).toHaveTextContent(/^1$/);
  expect(onSeek).toHaveBeenCalledTimes(1);
});

it("preserves native cut points through reorder and trim", () => {
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
  const onClipsReorder = vi.fn();
  const onClipTrim = vi.fn();
  const timeline = (clips: VideoClip[], frameRate = at30) => (
    <ProjectProvider frameRate={frameRate}>
      <ProjectClipTimeline
        clips={clips}
        thumbnails={{}}
        keyframes={{}}
        titles={{}}
        onClipsReorder={onClipsReorder}
        onClipTrim={onClipTrim}
      />
    </ProjectProvider>
  );
  const { rerender } = render(timeline(clips));
  const track = screen.getByRole("region", { name: "Sequence timeline" });
  vi.spyOn(track, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 120, 200));
  const placements = () => Array.from(track.querySelectorAll<HTMLElement>("[draggable=true]"));

  expect(screen.getByText("Total: 00:00.4")).toBeVisible();

  const dataTransfer = { getData: (format: string) => (format === "text/plain" ? "1" : "") };
  fireEvent.drop(placements()[0], { dataTransfer });
  expect(onClipsReorder).toHaveBeenCalledWith([clips[1], clips[0]]);
  rerender(timeline([clips[1], clips[0]]));

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
  expect(screen.getByText("Total: 00:00.383")).toBeVisible();

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

it("does not seek when releasing a trim, but seeks on the next clip click", () => {
  const at30 = { numerator: 30, denominator: 1 };
  const onSeek = vi.fn();
  const { container } = render(
    <ProjectProvider frameRate={at30}>
      <ProjectClipTimeline
        clips={[
          {
            id: "a",
            sourceId: "source-a",
            sourceFrameRate: { numerator: 60, denominator: 1 },
            sourceInFrame: 3,
            sourceOutFrame: 123,
          },
        ]}
        thumbnails={{}}
        keyframes={{}}
        titles={{}}
        onSeek={onSeek}
      />
    </ProjectProvider>,
  );
  const track = screen.getByRole("region", { name: "Sequence timeline" });
  vi.spyOn(track, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 120, 200));
  const clip = container.querySelector("[draggable=true]")!;
  const trim = within(track).getByRole("button", { name: "Trim out point" });
  fireEvent.mouseDown(trim, { clientX: 120 });
  fireEvent.mouseMove(document, { clientX: 102 });
  fireEvent.mouseUp(clip, { clientX: 102 });
  fireEvent.click(clip, { detail: 1 });
  expect(onSeek).not.toHaveBeenCalled();

  fireEvent.pointerDown(clip);
  fireEvent.click(clip, { detail: 1 });
  expect(onSeek).toHaveBeenCalledExactlyOnceWith(8);
});

it("edits a clip title without seeking the sequence", () => {
  const onTitleUpdate = vi.fn();
  const onSeek = vi.fn();
  vi.stubGlobal("prompt", () => "  Renamed  ");
  const rate = { numerator: 30, denominator: 1 };
  render(
    <ProjectProvider frameRate={rate}>
      <ProjectClipTimeline
        clips={[
          {
            id: "a",
            sourceId: "source-a",
            sourceFrameRate: rate,
            sourceInFrame: 0,
            sourceOutFrame: 30,
          },
        ]}
        thumbnails={{}}
        keyframes={{}}
        titles={{ a: "Old title" }}
        onTitleUpdate={onTitleUpdate}
        onSeek={onSeek}
      />
    </ProjectProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Edit clip title" }), { detail: 1 });
  expect(onTitleUpdate).toHaveBeenCalledExactlyOnceWith("a", "Renamed");
  expect(onSeek).not.toHaveBeenCalled();
});

it("offers separate mouse trim handles for a clip too narrow to hit on the timeline", () => {
  const frameRate = { numerator: 60, denominator: 1 };
  const source = { sourceId: "source", sourceFrameRate: frameRate };
  const onClipTrim = vi.fn();
  const onClipRemove = vi.fn();
  let trackWidth = 2400;
  let notifyResize: () => void;
  // Happy DOM does not deliver layout-driven ResizeObserver callbacks.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe: () => void;
      disconnect() {}
      constructor(callback: () => void) {
        this.observe = () => {
          notifyResize = callback;
        };
      }
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, 0, trackWidth, 200),
  );
  render(
    <ProjectProvider frameRate={frameRate}>
      <ProjectClipTimeline
        clips={[
          { ...source, id: "long", sourceInFrame: 0, sourceOutFrame: 3540 },
          { ...source, id: "medium", sourceInFrame: 3540, sourceOutFrame: 3600 },
          { ...source, id: "short", sourceInFrame: 3600, sourceOutFrame: 3601 },
        ]}
        thumbnails={{}}
        keyframes={{}}
        titles={{ long: "Long clip", medium: "Medium clip", short: "Short clip" }}
        onClipTrim={onClipTrim}
        onClipRemove={onClipRemove}
      />
    </ProjectProvider>,
  );

  const controls = within(screen.getByRole("group", { name: "Trim Short clip" }));
  const trimIn = controls.getByRole("button", { name: "Trim in point" });
  const trimOut = controls.getByRole("button", { name: "Trim out point" });
  const track = within(screen.getByRole("region", { name: "Sequence timeline" }));
  expect(track.getAllByRole("button", { name: "Trim in point" })).toHaveLength(2);
  expect(screen.queryByRole("group", { name: "Trim Medium clip" })).not.toBeInTheDocument();

  trackWidth = 800;
  act(() => notifyResize());
  expect(screen.getByRole("group", { name: "Trim Medium clip" })).toBeInTheDocument();
  expect(track.getAllByRole("button", { name: "Trim in point" })).toHaveLength(1);
  expect(screen.queryByRole("group", { name: "Trim Long clip" })).not.toBeInTheDocument();

  fireEvent.mouseDown(trimIn, { clientX: 100 });
  fireEvent.mouseMove(document, { clientX: 90 });
  fireEvent.mouseUp(document);
  expect(onClipTrim).toHaveBeenLastCalledWith("short", 3555, 3601);

  fireEvent.mouseDown(trimOut, { clientX: 100 });
  fireEvent.mouseMove(document, { clientX: 110 });
  fireEvent.mouseUp(document);
  expect(onClipTrim).toHaveBeenLastCalledWith("short", 3600, 3646);

  expect(track.getAllByRole("button", { name: "Remove clip" })).toHaveLength(1);
  fireEvent.click(controls.getByRole("button", { name: "Remove clip" }));
  expect(onClipRemove).toHaveBeenCalledExactlyOnceWith("short");
  fireEvent.click(track.getByRole("button", { name: "Remove clip" }));
  expect(onClipRemove).toHaveBeenLastCalledWith("long");
});

it("keeps keyboard focus on the same clip and edge as trim controls move", () => {
  const frameRate = { numerator: 60, denominator: 1 };
  const source = { sourceId: "source", sourceFrameRate: frameRate };
  const onClipTrim = vi.fn();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 800, 200),
  );

  function Sequence() {
    const [clips, setClips] = useState([
      { ...source, id: "long", sourceInFrame: 0, sourceOutFrame: 2940 },
      { ...source, id: "short", sourceInFrame: 0, sourceOutFrame: 60 },
    ]);
    return (
      <ProjectClipTimeline
        clips={clips}
        thumbnails={{}}
        keyframes={{}}
        titles={{ short: "Short clip" }}
        onClipTrim={(id, sourceInFrame, sourceOutFrame) => {
          onClipTrim(id, sourceInFrame, sourceOutFrame);
          setClips((current) =>
            current.map((clip) =>
              clip.id === id ? { ...clip, sourceInFrame, sourceOutFrame } : clip,
            ),
          );
        }}
      />
    );
  }

  render(
    <ProjectProvider frameRate={frameRate}>
      <Sequence />
    </ProjectProvider>,
  );
  const track = within(screen.getByRole("region", { name: "Sequence timeline" }));
  const inlineHandle = () => track.getAllByRole("button", { name: "Trim out point" })[1];
  const pressArrow = (key: "ArrowLeft" | "ArrowRight") =>
    fireEvent.keyDown(document.activeElement!, { key });

  inlineHandle().focus();
  pressArrow("ArrowLeft");
  expect(onClipTrim).toHaveBeenLastCalledWith("short", 0, 59);
  const fallback = within(screen.getByRole("group", { name: "Trim Short clip" }));
  expect(fallback.getByRole("button", { name: "Trim out point" })).toHaveFocus();

  pressArrow("ArrowLeft");
  expect(onClipTrim).toHaveBeenLastCalledWith("short", 0, 58);
  pressArrow("ArrowRight");
  pressArrow("ArrowRight");
  expect(onClipTrim).toHaveBeenLastCalledWith("short", 0, 60);
  expect(inlineHandle()).toHaveFocus();
  pressArrow("ArrowRight");
  expect(onClipTrim).toHaveBeenLastCalledWith("short", 0, 61);
});
