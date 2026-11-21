import { createRef } from "react";

import TimeLink from "@/components/atoms/TimeLink";
import useScrollToNearestFrame from "@/hooks/useScrollToNearestFrame";
import type { FrameRate, LogEvent } from "@/types";
import { secondsToFrame } from "@/utils/frames";

interface EditableTimestampedEventLogProps<T extends LogEvent> {
  log: T[];
  onChange: (updatedEvent: T) => void;
  onAdd: (newEvent: T) => void;
  onRemove: (event: T) => void;
  playheadFrame: number;
  frameRate: FrameRate;
  onSeekToFrame: (sourceFrame: number) => void;
  contentField: keyof T;
  followPlayback?: boolean;
}

export default function EditableTimestampedEventLog<T extends LogEvent>({
  log,
  onChange,
  onAdd,
  onRemove,
  playheadFrame,
  frameRate,
  onSeekToFrame,
  contentField,
  followPlayback = true,
}: EditableTimestampedEventLogProps<T>) {
  const logRef = createRef<HTMLDivElement>();
  const nearestElementIndex = useScrollToNearestFrame(playheadFrame, logRef, log, followPlayback);

  return (
    <div className="mt-4" ref={logRef}>
      <ul>
        {log.map((entry, i) => (
          <li
            key={`entry-${entry.sourceFrame}-${i}`}
            className={`mb-2 ${
              i === nearestElementIndex ? "bg-gray-200 dark:bg-gray-700" : ""
            } group relative flex items-start`}
            data-index={i}
          >
            <TimeLink frame={entry.sourceFrame} frameRate={frameRate} onClick={onSeekToFrame} />{" "}
            <textarea
              className="inline  w-full border-none bg-transparent pl-2 focus:border-transparent focus:outline-hidden focus:ring-0"
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
                type="button"
                className=" m-2 text-lg text-red-600 hover:text-red-800"
                onClick={() => {
                  onRemove(entry);
                }}
              >
                🗑
              </button>
              <button
                type="button"
                className="m-2 text-lg text-green-600 hover:text-green-800"
                onClick={() => {
                  const newEvent = {
                    ...entry,
                    sourceFrame: entry.sourceFrame + secondsToFrame(1, frameRate),
                  };
                  onAdd(newEvent);
                  onSeekToFrame(newEvent.sourceFrame);
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
