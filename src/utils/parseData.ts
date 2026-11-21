import type { RawSection, RawVideoMetadata, Section, VideoMetadata } from "@/types";
import { isoToNanoseconds } from "./duration";
import { nanosecondsToFrame } from "./frames";

export default function parseContent(rawContent: RawVideoMetadata): VideoMetadata {
  const { sourceId, frameRate, title, video_url } = rawContent;
  const toFrame = (iso: string) => nanosecondsToFrame(isoToNanoseconds(iso), frameRate);
  const parseSection = ({ timestamp_start, timestamp_end, ...details }: RawSection): Section => ({
    ...details,
    sourceFrame: toFrame(timestamp_start),
    ...(timestamp_end ? { sourceOutFrame: toFrame(timestamp_end) } : {}),
  });

  return {
    sourceId,
    frameRate,
    title,
    video_url,
    chat_history: rawContent.chat_history.map(({ timestamp, ...message }) => ({
      ...message,
      sourceFrame: toFrame(timestamp),
    })),
    transcript: rawContent.transcript.map(({ timestamp_start, text }) => ({
      text,
      sourceFrame: toFrame(timestamp_start),
    })),
    highlights: rawContent.highlights.map(parseSection),
    attentions: rawContent.attentions.map(parseSection),
    transcription_errors: rawContent.transcription_errors.map(parseSection),
    silences: rawContent.silences.map(parseSection),
    durationFrames: toFrame(rawContent.length),
  };
}
