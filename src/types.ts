export interface RawSection {
  timestamp_start: string;
  timestamp_end?: string;
  category?: string;
  description?: string;
  reasoning?: string;
}

export interface RawTranscriptSegment {
  timestamp_start: string;
  text: string;
}

export interface RawChatMessage {
  timestamp: string;
  username: string;
  message: string;
}

/**
 * Raw video metadata as received from the API.
 */
export interface RawVideoMetadata {
  title: string;
  video_url: string;
  length: string;
  highlights: RawSection[];
  attentions: RawSection[];
  transcription_errors: RawSection[];
  silences: RawSection[];
  chat_history: RawChatMessage[];
  transcript: RawTranscriptSegment[];
}

/**
 * Parsed video metadata for use in the frontend.
 *
 * This is the type that should be used in the frontend components.
 */
export interface VideoMetadata {
  title: string;
  video_url: string;
  /**
   * Length of the video in milliseconds.
   */
  length: number;
  highlights: Section[];
  attentions: Section[];
  transcription_errors: Section[];
  silences: Section[];
  chat_history: ChatMessage[];
  transcript: TranscriptSegment[];
}

export interface Section {
  /**
   * Start time of the section in milliseconds.
   *
   * If the `timestamp_end` is not provided, this represents a single point in
   * time.
   */
  timestamp: number;
  /**
   * End time of the section in milliseconds, if applicable.
   */
  timestamp_end?: number;
  category?: string;
  description?: string;
  reasoning?: string;
}

export interface LogEvent {
  timestamp: number;
}

export interface TranscriptSegment extends LogEvent {
  /**
   * Start time of the transcript segment in milliseconds.
   * This is used to sync the transcript with the video.
   */
  timestamp: number;

  /**
   * The text content of the transcript segment.
   */
  text: string;
}

export interface ChatMessage extends LogEvent {
  /**
   * Timestamp of the chat message in milliseconds.
   */
  timestamp: number;

  /**
   * Username of the chat message sender.
   */
  username: string;

  /**
   * The text content of the chat message.
   */
  message: string;
}
