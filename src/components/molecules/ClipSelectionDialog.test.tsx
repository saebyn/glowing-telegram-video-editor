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
  onCopyInPoint: vi.fn(),
  onCopyOutPoint: vi.fn(),
  onSeekToFrame: vi.fn(),
};

const source = { sourceId: "a", sourceFrameRate: { numerator: 60, denominator: 1 } };
const clips: VideoClip[] = [
  { ...source, id: "first", sourceInFrame: 600, sourceOutFrame: 4200 },
  { ...source, id: "second", sourceInFrame: 1800, sourceOutFrame: 3900 },
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
        clips={[{ ...clips[0], sourceInFrame: 1200, sourceOutFrame: 3000 }, clips[1]]}
      />,
    );
    expect(getByRole("status")).toHaveTextContent("Total duration: 01:05");
  });

  it("updates after playhead boundary changes, removal, reordering, and clearing", () => {
    function Selection() {
      const [selection, setSelection] = useState(clips);
      const copyFrame = (id: string, boundary: "sourceInFrame" | "sourceOutFrame") => {
        setSelection((current) =>
          current.map((clip) => (clip.id === id ? { ...clip, [boundary]: 2400 } : clip)),
        );
      };
      return (
        <ClipSelectionDialog
          {...callbacks}
          show
          clips={selection}
          onCopyInPoint={(id) => copyFrame(id, "sourceInFrame")}
          onCopyOutPoint={(id) => copyFrame(id, "sourceOutFrame")}
          onRemove={(id) => setSelection((current) => current.filter((clip) => clip.id !== id))}
          onReorder={setSelection}
          onClear={() => setSelection([])}
        />
      );
    }
    const { getByRole, getAllByTitle } = render(<Selection />);
    fireEvent.click(getAllByTitle("Copy in point from playhead")[0]);
    expect(getByRole("status")).toHaveTextContent("Total duration: 01:05");
    fireEvent.click(getAllByTitle("Copy out point from playhead")[1]);
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
          { ...source, id: "valid", sourceInFrame: 60, sourceOutFrame: 150 },
          { ...source, id: "zero", sourceInFrame: 60, sourceOutFrame: 60 },
          { ...source, id: "reversed", sourceInFrame: 120, sourceOutFrame: 60 },
          { ...source, id: "negative", sourceInFrame: -60, sourceOutFrame: 120 },
          { ...source, id: "nan", sourceInFrame: NaN, sourceOutFrame: 120 },
          { ...source, id: "infinity", sourceInFrame: 60, sourceOutFrame: Infinity },
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
