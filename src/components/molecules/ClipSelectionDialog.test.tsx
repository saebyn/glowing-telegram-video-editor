import { cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VideoClip } from "@/types";
import ClipSelectionDialog from "./ClipSelectionDialog";

const callbacks = {
  onClear: vi.fn(),
  onExport: vi.fn(),
  onRemove: vi.fn(),
  onReorder: vi.fn(),
  onCopyStartTime: vi.fn(),
  onCopyEndTime: vi.fn(),
  onSeekToTime: vi.fn(),
};

const clips: VideoClip[] = [
  { id: "first", start: 10000, end: 70000 },
  { id: "second", start: 30000, end: 65000 },
];

afterEach(cleanup);

describe("ClipSelectionDialog total duration", () => {
  it("sums each clip's duration, including overlapping ranges", () => {
    const { getByRole } = render(<ClipSelectionDialog {...callbacks} show clips={clips} />);
    expect(getByRole("status")).toHaveTextContent("Total duration: 01:35");
  });

  it("updates immediately when clips are added or trimmed through props", () => {
    const { getByRole, rerender } = render(
      <ClipSelectionDialog {...callbacks} show clips={clips.slice(0, 1)} />,
    );
    expect(getByRole("status")).toHaveTextContent("Total duration: 01:00");
    rerender(<ClipSelectionDialog {...callbacks} show clips={clips} />);
    expect(getByRole("status")).toHaveTextContent("Total duration: 01:35");
    rerender(
      <ClipSelectionDialog
        {...callbacks}
        show
        clips={[{ ...clips[0], start: 20000, end: 50000 }, clips[1]]}
      />,
    );
    expect(getByRole("status")).toHaveTextContent("Total duration: 01:05");
  });

  it("updates after playhead boundary changes, removal, reordering, and clearing", () => {
    function Selection() {
      const [selection, setSelection] = useState(clips);
      const copyTime = (id: string, boundary: "start" | "end") => {
        setSelection((current) =>
          current.map((clip) => (clip.id === id ? { ...clip, [boundary]: 40000 } : clip)),
        );
      };
      return (
        <ClipSelectionDialog
          {...callbacks}
          show
          clips={selection}
          onCopyStartTime={(id) => copyTime(id, "start")}
          onCopyEndTime={(id) => copyTime(id, "end")}
          onRemove={(id) => setSelection((current) => current.filter((clip) => clip.id !== id))}
          onReorder={setSelection}
          onClear={() => setSelection([])}
        />
      );
    }
    const { getByRole, getAllByTitle } = render(<Selection />);
    fireEvent.click(getAllByTitle("Copy start time from playhead")[0]);
    expect(getByRole("status")).toHaveTextContent("Total duration: 01:05");
    fireEvent.click(getAllByTitle("Copy end time from playhead")[1]);
    expect(getByRole("status")).toHaveTextContent("Total duration: 00:40");
    fireEvent.click(getAllByTitle("Move down")[0]);
    expect(getByRole("status")).toHaveTextContent("Total duration: 00:40");
    fireEvent.click(getAllByTitle("Remove")[0]);
    expect(getByRole("status")).toHaveTextContent("Total duration: 00:30");
    fireEvent.click(getByRole("button", { name: "Clear" }));
    expect(getByRole("status")).toHaveTextContent("Total duration: 00:00");
  });

  it("ignores invalid and zero-length ranges without losing valid durations", () => {
    const { getByRole } = render(
      <ClipSelectionDialog
        {...callbacks}
        show
        clips={[
          { id: "valid", start: 1000, end: 2500 },
          { id: "zero", start: 1000, end: 1000 },
          { id: "reversed", start: 2000, end: 1000 },
          { id: "negative", start: -1000, end: 2000 },
          { id: "nan", start: NaN, end: 2000 },
          { id: "infinity", start: 1000, end: Infinity },
        ]}
      />,
    );
    expect(getByRole("status")).toHaveTextContent("Total duration: 00:01.5");
  });

  it("does not render while hidden", () => {
    const { queryByRole } = render(
      <ClipSelectionDialog {...callbacks} show={false} clips={clips} />,
    );
    expect(queryByRole("status")).toBeNull();
  });
});
