import { ChatMessage } from "types";
import TimestampedEventLog from "./TimestampedEventLog";

export default function ChatHistory({
  chatHistory,
  playheadTime,
  onSeekToTime,
  followPlayback = true,
}: {
  chatHistory: ChatMessage[];
  playheadTime: number;
  onSeekToTime: (milliseconds: number) => void;
  followPlayback?: boolean;
}) {
  return (
    <TimestampedEventLog<ChatMessage>
      log={chatHistory}
      playheadTime={playheadTime}
      onSeekToTime={onSeekToTime}
      renderEvent={(chat) => {
        return (
          <>
            <span className="font-bold">{chat.username}</span>: {chat.message}
          </>
        );
      }}
      followPlayback={followPlayback}
    />
  );
}
