import Heading from "components/atoms/Heading";
import EditableTimestampedEventLog from "components/molecules/EditableTimestampedEventLog";
import TimeTable from "components/molecules/TimeTable";
import TimelineControls from "components/molecules/TimelineControls";
import TimestampedEventLog from "components/molecules/TimestampedEventLog";
import VideoPlayer, {
  type VideoPlayerRef,
} from "components/molecules/VideoPlayer";
import Viewport from "components/molecules/Viewport";
import Sidebar from "components/organisms/Sidebar";
import Timeline from "components/organisms/Timeline";
import { TimelineProvider } from "context/TimelineContext";
import useKeyboardShortcuts from "hooks/useKeyboardShortcuts";
import { useRef, useState } from "react";
import type { ChatMessage, TranscriptSegment } from "types";
import parseContent from "utils/parseData";
import rawContent from "../../data.json";

function VideoSelectionPage() {
  const [playheadTime, setPlayheadTime] = useState(0);
  const [followPlayback, setFollowPlayback] = useState(true);
  const videoPlayerRef = useRef<VideoPlayerRef>(null);

  function handleSeekToTime(milliseconds: number) {
    videoPlayerRef.current?.seekTo(milliseconds);
  }

  useKeyboardShortcuts({
    "1": () => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.seekTo(0);
      }
    },
  });

  const content = parseContent(rawContent);

  return (
    <TimelineProvider contentLength={content.length}>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-800">
        <Sidebar
          content={content}
          onSeekToTime={handleSeekToTime}
          playheadTime={playheadTime}
        />

        <div className="flex flex-1 flex-col">
          <main className="flex-1 overflow-auto p-4">
            <Heading level={1} id="top">
              {content.title}
            </Heading>

            <Viewport
              videoPlayer={
                <VideoPlayer
                  ref={videoPlayerRef}
                  videoUrl={content.video_url}
                  onTimeUpdate={(time) => setPlayheadTime(time)}
                />
              }
              chatHistory={
                <TimestampedEventLog<ChatMessage>
                  log={content.chat_history}
                  playheadTime={playheadTime}
                  onSeekToTime={handleSeekToTime}
                  renderEvent={(chat) => {
                    return (
                      <>
                        <span className="font-bold">{chat.username}</span>:{" "}
                        {chat.message}
                      </>
                    );
                  }}
                  followPlayback={followPlayback}
                />
              }
              timeline={
                <Timeline
                  content={content}
                  playheadTime={playheadTime}
                  onSeekToTime={handleSeekToTime}
                />
              }
              transcript={
                <EditableTimestampedEventLog<TranscriptSegment>
                  log={content.transcript}
                  onChange={(updatedSegment) => {
                    console.log(updatedSegment);
                  }}
                  onAdd={(newSegment) => {
                    console.log(newSegment);
                  }}
                  onRemove={(segment) => {
                    console.log(segment);
                  }}
                  playheadTime={playheadTime}
                  onSeekToTime={handleSeekToTime}
                  contentField="text"
                  followPlayback={followPlayback}
                />
              }
              settings={
                <TimelineControls
                  followPlayback={followPlayback}
                  setFollowPlayback={setFollowPlayback}
                />
              }
            />

            <Heading level={2} id="highlights">
              Highlights
            </Heading>
            <TimeTable
              rows={content.highlights}
              onSeekToTime={handleSeekToTime}
              playheadTime={playheadTime}
              includeEnd
              includeReasoning
              canEdit
            />

            <Heading level={2} id="attentions">
              Attentions
            </Heading>
            <TimeTable
              rows={content.attentions}
              onSeekToTime={handleSeekToTime}
              playheadTime={playheadTime}
              includeEnd
              includeReasoning
            />

            <Heading level={2} id="transcription-errors">
              Transcription Errors
            </Heading>
            <TimeTable
              rows={content.transcription_errors}
              playheadTime={playheadTime}
              onSeekToTime={handleSeekToTime}
              includeCategory
            />
          </main>
        </div>
      </div>
    </TimelineProvider>
  );
}

export default VideoSelectionPage;
