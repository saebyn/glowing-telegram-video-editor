import Button from "components/atoms/Button";
import type { Section } from "types";
import TimeLink from "../atoms/TimeLink";

function TimeTable({
  rows,
  includeEnd = false,
  includeReasoning = false,
  includeCategory = false,
  canEdit = false,
  canClip = false,
  playheadTime,
  onSeekToTime,
  onClip,
}: {
  rows: Section[];
  includeEnd?: boolean;
  includeReasoning?: boolean;
  includeCategory?: boolean;
  canEdit?: boolean;
  canClip?: boolean;
  playheadTime?: number;
  onSeekToTime?: (milliseconds: number) => void;
  onClip?: (section: Section) => void;
}) {
  return (
    <section className="mb-6 text-gray-700 dark:text-gray-200">
      <table className="min-w-full rounded bg-white shadow-md dark:bg-gray-600">
        <thead>
          <tr>
            <th className="border-b px-4 py-2">
              {includeEnd ? "Start Time" : "Time"}
            </th>

            {includeEnd && <th className="border-b px-4 py-2">End Time</th>}
            {includeCategory && (
              <th className="border-b px-4 py-2">Category</th>
            )}
            <th className="border-b px-4 py-2">Description</th>
            {includeReasoning && (
              <th className="border-b px-4 py-2">Reasoning</th>
            )}
            <th className="border-b px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`row-${row.category}-${row.timestamp}`}
              className={`${
                playheadTime &&
                row.timestamp <= playheadTime &&
                (row.timestamp_end || 0) >= playheadTime
                  ? "bg-gray-200 dark:bg-gray-700"
                  : ""
              }`}
            >
              <td className="border-b px-4 py-2">
                <TimeLink milliseconds={row.timestamp} onClick={onSeekToTime} />
              </td>
              {includeEnd && (
                <td className="border-b px-4 py-2">
                  <TimeLink
                    milliseconds={row.timestamp_end}
                    onClick={onSeekToTime}
                  />
                </td>
              )}
              {includeCategory && (
                <td className="border-b px-4 py-2">{row?.category}</td>
              )}

              <td className="border-b px-4 py-2">{row.description}</td>
              {includeReasoning && (
                <td className="border-b px-4 py-2">{row.reasoning}</td>
              )}
              <td className="border-b px-4 py-2 text-right">
                {canEdit && (
                  <Button className="mx-2 rounded  text-white bg-green-500 dark:bg-green-600 dark:text-white">
                    Edit
                  </Button>
                )}

                {canClip && (
                  <Button
                    className="mx-2 rounded bg-blue-500 text-white dark:!bg-blue-600 dark:text-white"
                    onClick={() => onClip?.(row)}
                  >
                    Clip
                  </Button>
                )}

                <Button className="rounded bg-red-500 text-white dark:bg-red-600 dark:text-white">
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
