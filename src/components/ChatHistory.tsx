import { ChatMessage } from "types";
import TimestampedEventLog from "./TimestampedEventLog";

export default function ChatHistory({
  chatHistory,
  playbackTime,
  onSeekToTime,
  followPlayback = true,
}: {
  chatHistory: ChatMessage[];
  playbackTime: number;
  onSeekToTime: (milliseconds: number) => void;
  followPlayback?: boolean;
}) {
  return (
    <TimestampedEventLog<ChatMessage>
      log={chatHistory}
      playbackTime={playbackTime}
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
