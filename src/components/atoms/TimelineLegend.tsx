export type TimelineElementType =
  | "cursor"
  | "silence"
  | "chat"
  | "highlight"
  | "attention"
  | "error";

export const timelineElementTypeColors: Record<TimelineElementType, string> = {
  silence: "bg-gray-700 dark:bg-gray-900",
  chat: "bg-gray-500 dark:bg-gray-300",
  highlight: "bg-blue-500 dark:bg-blue-300",
  attention: "bg-red-500 dark:bg-red-300",
  error: "bg-yellow-500 dark:bg-yellow-300",
  cursor: "bg-green-500 dark:bg-green-300",
};

export default function TimelineLegend() {
  return (
    <div
      className="my-8 flex space-x-4 text-sm text-gray-800
     dark:text-gray-200
    "
    >
      <div className="flex items-center">
        <div
          className={`mr-2 size-4 rounded-full ${timelineElementTypeColors.silence}`}
        />
        <span>Silence segment</span>
      </div>
      <div className="flex items-center">
        <div
          className={`mr-2 size-4 rounded-full ${timelineElementTypeColors.chat}`}
        />
        <span>Chat message</span>
      </div>
      <div className="flex items-center">
        <div
          className={`mr-2 size-4 rounded-full ${timelineElementTypeColors.highlight}`}
        />
        <span>Highlighted segment</span>
      </div>
      <div className="flex items-center">
        <div
          className={`mr-2 size-4 rounded-full ${timelineElementTypeColors.attention}`}
        />
        <span>Attention segment</span>
      </div>
      <div className="flex items-center">
        <div
          className={`mr-2 size-4 rounded-full ${timelineElementTypeColors.error}`}
        />
        <span>Transcript error</span>
      </div>
    </div>
  );
}
