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

function App() {
  const [playbackTime, setPlaybackTime] = useState(0);
  const [followPlayback, setFollowPlayback] = useState(true);
  const videoPlayerRef = useRef<VideoPlayerRef>(null);

  function handleSeekToTime(milliseconds: number) {
    videoPlayerRef.current?.seekTo(milliseconds);
  }

  const content = parseContent(rawContent);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-800">
      <Sidebar content={content} onSeekToTime={handleSeekToTime} />

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
                onTimeUpdate={(time) => setPlaybackTime(time)}
              />
            }
            chatHistory={
              <ChatHistory
                chatHistory={content.chat_history}
                playbackTime={playbackTime}
                onSeekToTime={handleSeekToTime}
                followPlayback={followPlayback}
              />
            }
            timeline={
              <Timeline
                content={content}
                playbackTime={playbackTime}
                onSeekToTime={handleSeekToTime}
              />
            }
            transcript={
              <Transcript
                transcript={content.transcript}
                playbackTime={playbackTime}
                onSeekToTime={handleSeekToTime}
                followPlayback={followPlayback}
              />
            }
            settings={
              <div
                className="mt-4 rounded bg-gray-200
              p-4 text-gray-800 dark:bg-gray-700 dark:text-gray-200
              "
              >
                <label className="flex items-center space-x-2 p-4">
                  <input
                    type="checkbox"
                    checked={followPlayback}
                    onChange={(e) => setFollowPlayback(e.target.checked)}
                  />
                  <span>Follow playback</span>
                </label>
              </div>
            }
          />

          <Heading level={2} id="highlights">
            Highlights
          </Heading>
          <TimeTable
            rows={content.highlights}
            onSeekToTime={handleSeekToTime}
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
            includeEnd
            includeReasoning
          />

          <Heading level={2} id="transcription-errors">
            Transcription Errors
          </Heading>
          <TimeTable
            rows={content.transcription_errors}
            onSeekToTime={handleSeekToTime}
            includeCategory
          />
        </main>
      </div>
    </div>
  );
}

export default App;
