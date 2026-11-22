/** Frames per second as a ratio of positive safe integers (e.g. 30_000 / 1001). */
export interface FrameRate {
  numerator: number;
  denominator: number;
}

/** An inclusive in point and exclusive out point on a source's native frame grid. */
export interface SourceRange {
  sourceInFrame: number;
  sourceOutFrame: number;
  sourceFrameRate: FrameRate;
}

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
  sourceId: string;
  frameRate: FrameRate;
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
  sourceId: string;
  frameRate: FrameRate;
  title: string;
  video_url: string;
  /** Number of native source frames. Also the exclusive endpoint of the source. */
  durationFrames: number;
  highlights: Section[];
  attentions: Section[];
  transcription_errors: Section[];
  silences: Section[];
  chat_history: ChatMessage[];
  transcript: TranscriptSegment[];
}

export interface Section extends LogEvent {
  /** Exclusive endpoint; omitted for a point event. */
  sourceOutFrame?: number;
  category?: string;
  description?: string;
  reasoning?: string;
}

export interface LogEvent {
  sourceFrame: number;
}

export interface TranscriptSegment extends LogEvent {
  /**
   * The text content of the transcript segment.
   */
  text: string;
}

export interface ChatMessage extends LogEvent {
  /**
   * Username of the chat message sender.
   */
  username: string;

  /**
   * The text content of the chat message.
   */
  message: string;
}

/**
 * A selection within a video.
 */
export interface VideoClip extends SourceRange {
  id: string;
  /** Host-defined identity of the source, independent of the clip ID. */
  sourceId: string;
  /** Optional source length, used to limit out-point extensions. */
  sourceDurationFrames?: number;
  /**
   * URL to the keyframe image, if available.
   */
  keyframeSrc?: string;
}

/** A clip in a gapless sequence; the source range remains on its native grid. */
export interface SequenceClipPlacement {
  clip: VideoClip;
  sequenceStartFrame: number;
  durationFrames: number;
}

export interface SequenceLayout {
  frameRate: FrameRate;
  durationFrames: number;
  placements: SequenceClipPlacement[];
}

/** Renderable media identity supplied by the host, separate from a clip's source range. */
export interface SequenceSource {
  id: string;
  s3Location: string;
}

export interface ClipPlacement {
  id: string;
  clipId: string;
  sequenceStartFrame: number;
  /** Signed offsets from the clip's native source in and out points. */
  sourceInOffsetFrames?: number;
  sourceOutOffsetFrames?: number;
  /** Entry fade duration in sequence frames, visual only in the first slice. */
  entryTransitionFrames?: number;
}

export interface SequenceTrack {
  id: string;
  label: string;
  placements: readonly ClipPlacement[];
}

export interface Sequence {
  durationFrames: number;
  /** Tracks in visual order, top first. */
  tracks: readonly SequenceTrack[];
}

/**
 * Audio channel information for preview
 */
export interface AudioChannel {
  id: string;
  name: string;
  /**
   * Audio level from 0.0 to 1.0
   */
  level: number;
  /**
   * Whether this channel is muted
   */
  muted: boolean;
}

/**
 * Waveform data for visualization
 */
export interface WaveformData {
  /**
   * Audio channel ID this waveform belongs to
   */
  channelId: string;
  /**
   * Array of amplitude values for visualization
   */
  amplitudes: number[];
  /**
   * Number of project frames this waveform represents
   */
  durationFrames: number;
  /**
   * Audio sample rate in Hz (not a frame rate)
   */
  sampleRate: number;
}

/**
 * Preview settings for video rendering
 */
export interface PreviewSettings {
  /**
   * Selected cutlist for preview
   */
  cutlist: VideoClip[];
  /**
   * Audio channel configurations
   */
  audioChannels: AudioChannel[];
  /**
   * Waveform data for each channel
   */
  waveformData: WaveformData[];
}
