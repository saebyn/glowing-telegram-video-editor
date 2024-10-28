import { createRef } from "react";

import useScrollToNearestElementToTime from "hooks/useScrollToNearestElementToTime";
import { LogEvent } from "types";
import TimeLink from "components/atoms/TimeLink";

interface EditableTimestampedEventLogProps<T extends LogEvent> {
  log: T[];
  onChange: (updatedEvent: T) => void;
  onAdd: (newEvent: T) => void;
  onRemove: (event: T) => void;
  playheadTime: number;
  onSeekToTime: (milliseconds: number) => void;
  contentField: keyof T;
  followPlayback?: boolean;
}

export default function EditableTimestampedEventLog<T extends LogEvent>({
  log,
  onChange,
  onAdd,
  onRemove,
  playheadTime,
  onSeekToTime,
  contentField,
  followPlayback = true,
}: EditableTimestampedEventLogProps<T>) {
  const ref = createRef<HTMLDivElement>();
  const nearestElementIndex = useScrollToNearestElementToTime(
    playheadTime,
    ref,
    log,
    followPlayback,
  );

  return (
    <div className="mt-4" ref={ref}>
      <ul>
        {log.map((entry, i) => (
          <li
            key={`entry-${entry.timestamp}`}
            className={`mb-2 ${
              i === nearestElementIndex ? "bg-gray-200 dark:bg-gray-700" : ""
            } group relative flex items-start`}
            data-index={i}
          >
            <TimeLink milliseconds={entry.timestamp} onClick={onSeekToTime} />{" "}
            <textarea
              className="inline  w-full border-none bg-transparent pl-2 focus:border-transparent focus:outline-none focus:ring-0"
              value={String(entry[contentField])}
              onChange={(e) => {
                onChange({
                  ...entry,
                  [contentField]: e.target.value,
                });
              }}
            />
            {/* button that appears on hover of each log entry, allowing a user either to delete the entry or add a new entry after it */}
            <div className="absolute  bottom-0 right-1/2 hidden group-hover:block">
              <button
                className=" m-2 text-lg text-red-600 hover:text-red-800"
                onClick={() => {
                  onRemove(entry);
                }}
              >
                🗑
              </button>
              <button
                className="m-2 text-lg text-green-600 hover:text-green-800"
                onClick={() => {
                  const newEvent = {
                    ...entry,
                    timestamp: entry.timestamp + 1000,
                  };
                  onAdd(newEvent);
                  onSeekToTime(newEvent.timestamp);
                }}
              >
                ➕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
