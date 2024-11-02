import React from "react";
import type { Section } from "types";
import TimeLink from "./atoms/TimeLink";

function TimeTable({
  rows,
  includeEnd = false,
  includeReasoning = false,
  includeCategory = false,
  canEdit = false,
  playheadTime,
  onSeekToTime,
}: {
  rows: Section[];
  includeEnd?: boolean;
  includeReasoning?: boolean;
  includeCategory?: boolean;
  canEdit?: boolean;
  playheadTime?: number;
  onSeekToTime?: (milliseconds: number) => void;
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
              key={`row-${row.timestamp}`}
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
                  <button
                    type="button"
                    className="mx-2 rounded bg-green-500 px-2 py-1 text-white"
                  >
                    Edit
                  </button>
                )}

                <button
                  type="button"
                  className="rounded bg-red-500 px-2 py-1 text-white"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default TimeTable;
