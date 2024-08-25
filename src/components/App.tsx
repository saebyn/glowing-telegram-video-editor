import rawContent from "data.json";
import Sidebar from "./Sidebar";
import TimeTable from "./TimeTable";
import parseContent from "utils/parseData";
import Heading from "./Heading";
import Viewport from "./Viewport";
import Transcript from "./Transcript";
import { useRef, useState } from "react";
import Timeline from "./Timeline";
import ChatHistory from "./ChatHistory";
import VideoPlayer, { VideoPlayerRef } from "./VideoPlayer";
import { TimelineProvider } from "./TimelineContext";
import TimelineControls from "./TimelineControls";
import useKeyboardShortcuts from "hooks/useKeyboardShortcuts";

function App() {
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
                <ChatHistory
                  chatHistory={content.chat_history}
                  playheadTime={playheadTime}
                  onSeekToTime={handleSeekToTime}
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
                <Transcript
                  transcript={content.transcript}
                  playheadTime={playheadTime}
                  onSeekToTime={handleSeekToTime}
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

export default App;
