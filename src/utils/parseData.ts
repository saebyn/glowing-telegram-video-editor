import {
  RawVideoMetadata,
  VideoMetadata,
  RawChatMessage,
  ChatMessage,
  RawSection,
  Section,
  RawTranscriptSegment,
  TranscriptSegment,
} from "types";
import { isoToMs } from "./duration";

export default function parseContent(
  rawContent: RawVideoMetadata,
): VideoMetadata {
  return {
    title: rawContent.title,
    video_url: rawContent.video_url,
    chat_history: rawContent.chat_history.map((item) => parseSection(item)),
    transcript: rawContent.transcript.map((item) => parseSection(item)),
    highlights: rawContent.highlights.map((item) => parseSection(item)),
    attentions: rawContent.attentions.map((item) => parseSection(item)),
    transcription_errors: rawContent.transcription_errors.map((item) =>
      parseSection(item),
    ),
    silences: rawContent.silences.map((item) => parseSection(item)),
    length: isoToMs(rawContent.length),
  };
}

function parseSection(item: RawChatMessage): ChatMessage;
function parseSection(item: RawSection): Section;
function parseSection(item: RawTranscriptSegment): TranscriptSegment;
function parseSection(
  item: RawChatMessage | RawSection | RawTranscriptSegment,
): ChatMessage | Section | TranscriptSegment {
  if ("timestamp" in item) {
    return {
      username: item.username,
      message: item.message,
      timestamp: isoToMs(item.timestamp),
    };
  } else {
    return {
      ...item,
      timestamp: isoToMs(item.timestamp_start),
      timestamp_end:
        "timestamp_end" in item && item.timestamp_end
          ? isoToMs(item.timestamp_end)
          : undefined,
    };
  }
}
