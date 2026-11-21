import Button from "@/components/atoms/Button";
import type { FrameRate, Section } from "@/types";
import TimeLink from "../atoms/TimeLink";

function TimeTable({
  rows,
  includeEnd = false,
  includeReasoning = false,
  includeCategory = false,
  canEdit = false,
  canClip = false,
  playheadFrame,
  frameRate,
  onSeekToFrame,
  onClip,
}: {
  rows: Section[];
  includeEnd?: boolean;
  includeReasoning?: boolean;
  includeCategory?: boolean;
  canEdit?: boolean;
  canClip?: boolean;
  playheadFrame?: number;
  frameRate: FrameRate;
  onSeekToFrame?: (sourceFrame: number) => void;
  onClip?: (section: Section) => void;
}) {
  return (
    <section className="mb-6 text-gray-700 dark:text-gray-200">
      <table className="min-w-full rounded-sm bg-white shadow-md dark:bg-gray-600">
        <thead>
          <tr>
            <th className="border-b px-4 py-2 text-start">{includeEnd ? "Start Time" : "Time"}</th>

            {includeEnd && <th className="border-b px-4 py-2 text-start">End Time</th>}
            {includeCategory && <th className="border-b px-4 py-2 text-start">Category</th>}
            <th className="border-b px-4 py-2 text-start">Description</th>
            {includeReasoning && <th className="border-b px-4 py-2 text-start">Reasoning</th>}
            <th className="border-b px-4 py-2 text-start">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`row-${row.sourceFrame}-${index}`}
              className={`${
                playheadFrame !== undefined &&
                row.sourceFrame <= playheadFrame &&
                playheadFrame < (row.sourceOutFrame ?? row.sourceFrame + 1)
                  ? "bg-gray-200 dark:bg-gray-700"
                  : ""
              }`}
            >
              <td className="border-b px-4 py-2">
                <TimeLink frame={row.sourceFrame} frameRate={frameRate} onClick={onSeekToFrame} />
              </td>
              {includeEnd && (
                <td className="border-b px-4 py-2">
                  <TimeLink
                    frame={row.sourceOutFrame}
                    frameRate={frameRate}
                    onClick={onSeekToFrame}
                  />
                </td>
              )}
              {includeCategory && <td className="border-b px-4 py-2">{row?.category}</td>}

              <td className="border-b px-4 py-2">{row.description}</td>
              {includeReasoning && <td className="border-b px-4 py-2">{row.reasoning}</td>}
              <td className="border-b px-4 py-2 text-right">
                {canEdit && (
                  <Button className="mx-2 rounded-sm  text-white bg-green-500 dark:bg-green-600 dark:text-white">
                    Edit
                  </Button>
                )}

                {canClip && (
                  <Button
                    className="mx-2 rounded-sm bg-blue-500 text-white dark:!bg-blue-600 dark:text-white"
                    onClick={() => onClip?.(row)}
                  >
                    Clip
                  </Button>
                )}

                <Button className="rounded-sm bg-red-500 text-white dark:bg-red-600 dark:text-white">
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default TimeTable;
