import { useRef, useState } from "react";
import Button from "@/components/atoms/Button";
import Heading from "@/components/atoms/Heading";
import ClipSelectionDialog from "@/components/molecules/ClipSelectionDialog";
import EditableTimestampedEventLog from "@/components/molecules/EditableTimestampedEventLog";
import TimelineControls from "@/components/molecules/TimelineControls";
import TimestampedEventLog from "@/components/molecules/TimestampedEventLog";
import TimeTable from "@/components/molecules/TimeTable";
import VideoPlayer, { type VideoPlayerRef } from "@/components/molecules/VideoPlayer";
import Viewport from "@/components/molecules/Viewport";
import Sidebar from "@/components/organisms/Sidebar";
import Timeline from "@/components/organisms/Timeline";
import { TimelineProvider } from "@/context/TimelineContext";
import useKeyboardShortcuts from "@/hooks/useKeyboardShortcuts";
import type { ChatMessage, Section, TranscriptSegment, VideoClip, VideoMetadata } from "@/types";
import findGaps from "@/utils/findGaps";
import { secondsToFrame, snapFrame } from "@/utils/frames";

interface VideoSelectionPageProps {
  content: VideoMetadata;
  onExport?: (clips: VideoClip[]) => void;
}

const SILENCE_CLIP_THRESHOLDS = {
  gapSeconds: 30,
  sectionSeconds: 60,
};

export default function VideoSelectionPage(props: VideoSelectionPageProps) {
  return <SourceReview key={props.content.sourceId} {...props} />;
}

function SourceReview({ content, onExport }: VideoSelectionPageProps) {
  const [playheadFrame, setPlayheadFrame] = useState(0);
  const [followPlayback, setFollowPlayback] = useState(true);
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const [selectedClips, setSelectedClips] = useState<VideoClip[]>([]);

  const { sourceId, frameRate, durationFrames } = content;

  function handleSeekToFrame(sourceFrame: number) {
    videoPlayerRef.current?.seekTo(sourceFrame);
  }

  function appendSectionToClips(section: Section) {
    const sourceInFrame = snapFrame(section.sourceFrame, durationFrames);
    const sourceOutFrame = snapFrame(
      section.sourceOutFrame ?? sourceInFrame + secondsToFrame(10, frameRate),
      durationFrames,
    );
    if (sourceOutFrame <= sourceInFrame) return;
    const clip: VideoClip = {
      id: `${sourceId}:${sourceInFrame}`,
      sourceId,
      sourceFrameRate: frameRate,
      sourceDurationFrames: durationFrames,
      sourceInFrame,
      sourceOutFrame,
    };

    setSelectedClips((prevClips) => {
      const prevClipsWithoutNew = prevClips.filter((prevClip) => prevClip.id !== clip.id);

      return [...prevClipsWithoutNew, clip];
    });
  }

  function handleCopyPoint(point: "sourceInFrame" | "sourceOutFrame") {
    return (id: string) => {
      setSelectedClips((clips) =>
        clips.map((clip) => {
          if (clip.id === id) {
            const frame = snapFrame(playheadFrame, durationFrames);
            if (
              point === "sourceInFrame" ? frame < clip.sourceOutFrame : frame > clip.sourceInFrame
            ) {
              return { ...clip, [point]: frame };
            }
          }
          return clip;
        }),
      );
    };
  }

  useKeyboardShortcuts({
    "1": () => handleSeekToFrame(0),
    " ": () => videoPlayerRef.current?.togglePlay(),
    ArrowLeft: () => handleSeekToFrame(playheadFrame - 1),
    ArrowRight: () => handleSeekToFrame(playheadFrame + 1),
    "Shift+ArrowLeft": () => handleSeekToFrame(playheadFrame - secondsToFrame(1, frameRate)),
    "Shift+ArrowRight": () => handleSeekToFrame(playheadFrame + secondsToFrame(1, frameRate)),
  });

  return (
    <TimelineProvider key={durationFrames} durationFrames={durationFrames}>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-800">
        <ClipSelectionDialog
          show={selectedClips.length > 0}
          clips={selectedClips}
          onExport={() => {
            onExport?.(selectedClips);
          }}
          onClear={() => setSelectedClips([])}
          onReorder={(newClips) => setSelectedClips(newClips)}
          onRemove={(id) => setSelectedClips(selectedClips.filter((clip) => clip.id !== id))}
          onCopyInPoint={handleCopyPoint("sourceInFrame")}
          onCopyOutPoint={handleCopyPoint("sourceOutFrame")}
          onSeekToFrame={handleSeekToFrame}
        />

        <Sidebar
          content={content}
          onSeekToFrame={handleSeekToFrame}
          playheadFrame={playheadFrame}
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
                  sourceFrameRate={frameRate}
                  durationFrames={durationFrames}
                  onFrameUpdate={setPlayheadFrame}
                />
              }
              chatHistory={
                <TimestampedEventLog<ChatMessage>
                  log={content.chat_history}
                  playheadFrame={playheadFrame}
                  frameRate={frameRate}
                  onSeekToFrame={handleSeekToFrame}
                  renderEvent={(chat) => {
                    return (
                      <>
                        <span className="font-bold">{chat.username}</span>: {chat.message}
                      </>
                    );
                  }}
                  followPlayback={followPlayback}
                />
              }
              timeline={
                <Timeline
                  content={content}
                  playheadFrame={playheadFrame}
                  onSeekToFrame={handleSeekToFrame}
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
                  playheadFrame={playheadFrame}
                  frameRate={frameRate}
                  onSeekToFrame={handleSeekToFrame}
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
                onClick={() => {
                  setSelectedClips(
                    findGaps(
                      {
                        durationFrames,
                        minGapFrames: secondsToFrame(SILENCE_CLIP_THRESHOLDS.gapSeconds, frameRate),
                        minSectionFrames: secondsToFrame(
                          SILENCE_CLIP_THRESHOLDS.sectionSeconds,
                          frameRate,
                        ),
                      },
                      content.silences,
                    ).map((range) => ({
                      id: `${sourceId}:${range.sourceInFrame}-${range.sourceOutFrame}`,
                      sourceId,
                      sourceFrameRate: frameRate,
                      sourceDurationFrames: durationFrames,
                      ...range,
                    })),
                  );
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
              onSeekToFrame={handleSeekToFrame}
              playheadFrame={playheadFrame}
              frameRate={frameRate}
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
              onSeekToFrame={handleSeekToFrame}
              playheadFrame={playheadFrame}
              frameRate={frameRate}
              includeEnd
              includeReasoning
            />

            <Heading level={2} id="transcription-errors">
              Transcription Errors
            </Heading>
            <TimeTable
              rows={content.transcription_errors}
              playheadFrame={playheadFrame}
              onSeekToFrame={handleSeekToFrame}
              frameRate={frameRate}
              includeCategory
            />
          </main>
        </div>
      </div>
    </TimelineProvider>
  );
}
