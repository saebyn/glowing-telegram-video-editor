import Button from "components/atoms/Button";
import Heading from "components/atoms/Heading";
import ClipSelectionDialog, {} from "components/molecules/ClipSelectionDialog";
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
import type {
  ChatMessage,
  Section,
  TranscriptSegment,
  VideoClip,
  VideoMetadata,
} from "types";
import findGaps from "utils/findGaps";

interface VideoSelectionPageProps {
  content: VideoMetadata;
  onExport?: (clips: VideoClip[]) => void;
}

function VideoSelectionPage({ content, onExport }: VideoSelectionPageProps) {
  const [playheadTime, setPlayheadTime] = useState(0);
  const [followPlayback, setFollowPlayback] = useState(true);
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const [selectedClips, setSelectedClips] = useState<VideoClip[]>([]);

  function handleSeekToTime(milliseconds: number) {
    videoPlayerRef.current?.seekTo(milliseconds);
  }

  function appendSectionToClips(section: Section) {
    const clip: VideoClip = {
      id: section.timestamp.toString(),
      start: section.timestamp,
      end: section.timestamp_end || section.timestamp + 10000,
    };

    setSelectedClips((prevClips) => {
      const prevClipsWithoutNew = prevClips.filter(
        (prevClip) => prevClip.id !== clip.id,
      );

      return [...prevClipsWithoutNew, clip];
    });
  }

  function handleCopyTime(startOrEnd: "start" | "end") {
    return (id: string) => {
      setSelectedClips((clips) =>
        clips.map((clip) => {
          if (clip.id === id) {
            return { ...clip, [startOrEnd]: playheadTime };
          }
          return clip;
        }),
      );
    };
  }

  useKeyboardShortcuts({
    "1": () => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.seekTo(0);
      }
    },
    " ": () => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.togglePlay();
      }
    },
    ArrowLeft: () => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.seekTo(playheadTime - 250);
      }
    },
    ArrowRight: () => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.seekTo(playheadTime + 250);
      }
    },
    "Shift+ArrowLeft": () => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.seekTo(playheadTime - 1000);
      }
    },
    "Shift+ArrowRight": () => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.seekTo(playheadTime + 1000);
      }
    },
  });

  return (
    <TimelineProvider contentLength={content.length}>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-800">
        <ClipSelectionDialog
          show={selectedClips.length > 0}
          clips={selectedClips}
          onExport={() => {
            onExport?.(selectedClips);
          }}
          onClear={() => setSelectedClips([])}
          onReorder={(newClips) => setSelectedClips(newClips)}
          onRemove={(id) =>
            setSelectedClips(selectedClips.filter((clip) => clip.id !== id))
          }
          onCopyStartTime={handleCopyTime("start")}
          onCopyEndTime={handleCopyTime("end")}
          onSeekToTime={handleSeekToTime}
        />

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
                  onItemSelect={appendSectionToClips}
                />
              }
              transcript={
                <EditableTimestampedEventLog<TranscriptSegment>
                  log={content.transcript}
                  onChange={(updatedSegment) => {
                    // TODO
                    console.log(updatedSegment);
                  }}
                  onAdd={(newSegment) => {
                    // TODO
                    console.log(newSegment);
                  }}
                  onRemove={(segment) => {
                    // TODO
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

            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  onExport?.(selectedClips);
                }}
                variant="primary"
              >
                Export
              </Button>
              <Button
                onClick={async () => {
                  setSelectedClips(await findGaps(content.silences, 1000));
                }}
              >
                Clip Silences
              </Button>
            </div>

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
              canClip
              onClip={appendSectionToClips}
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
