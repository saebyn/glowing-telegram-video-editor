import type { CutList } from "@saebyn/glowing-telegram-types";

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

/** Media content declared by the host for presentation in the editor. */
export type MediaKind = "video-only" | "audio-only" | "audio-video";

/** Source metadata keyed by the host's source IDs. Not every ID has an entry. */
export type SourcesById<T> = Readonly<Partial<Record<string, T>>>;

/** Renderable media location supplied by the host, separate from a clip's source range. */
export interface CutListSource {
  s3Location: string;
}

/** Source media and presentation metadata supplied to the sequence editor. */
export type SequenceSource = CutListSource & {
  /** Optional frame thumbnails at zero-based positions on this source's native frame grid. */
  frameThumbnails?: readonly { sourceFrame: number; url: string }[];
} & (
    | { mediaKind: "audio-only"; previewHlsUrl?: string }
    | {
        /** When omitted, the editor treats the media kind as unknown. */
        mediaKind?: Exclude<MediaKind, "audio-only">;
        /** Playback rendition with the same time zero and elapsed times as the render source. */
        previewHlsUrl: string;
      }
  );

export type PlacementEdge = "leading" | "trailing";

export type TransitionResizeIntent = { transitionId: string; durationFrames: number };

export interface PlacementTransition {
  /** Stable identity within the sequence. */
  id: string;
  /** A dissolve blends picture and sound linearly over the same centered window. */
  kind: "fade" | "dissolve";
  /** Positive whole sequence frames, anchored at the owning edge. */
  durationFrames: number;
}

export type TransitionDraft = Omit<PlacementTransition, "id">;

export type TransitionEditProblem =
  | { kind: "invalid-duration"; min: number; max?: number }
  | { kind: "conflict" | "locked" | "unavailable" };

export interface ClipPlacement {
  id: string;
  clipId: string;
  sequenceStartFrame: number;
  /** Signed offsets from the clip's native source in and out points. */
  sourceInOffsetFrames?: number;
  sourceOutOffsetFrames?: number;
  /** Transition owned by the leading edge. Omit for a hard cut. */
  transitionIn?: PlacementTransition;
  /** Transition owned by the trailing edge. Omit for a hard cut. */
  transitionOut?: PlacementTransition;
}

export interface SequenceTrack {
  id: string;
  label: string;
  /** Protects placement edits without changing this track's output. */
  locked?: boolean;
  placements: readonly ClipPlacement[];
}

export interface Sequence {
  durationFrames: number;
  /** Tracks in visual order, top first. */
  tracks: readonly SequenceTrack[];
}

export type PlacementPasteTarget = { trackId: string; sequenceFrame: number };

export type PlacementPastePreview = {
  placements: readonly {
    trackId: string;
    clipId: string;
    sequenceStartFrame: number;
    duration: number;
  }[];
} & (
  | { kind: "valid" }
  | {
      kind: "blocked";
      reason: "outside-tracks" | "locked-track" | "overlap" | "invalid-placement";
    }
);

export interface SequenceTransportSnapshot {
  readonly playheadFrame: number;
  readonly frameRate: Readonly<FrameRate>;
  readonly durationFrames: number;
  readonly playback: "paused" | "forward" | "reverse";
}

export interface SequencePreviewMedia {
  readonly sequence: Sequence;
  readonly clips: readonly VideoClip[];
  readonly sources: SourcesById<SequenceSource>;
}

/** A mounted Preview can hold the session clock at a frame until its media is ready. */
export interface SequencePreviewGate {
  readiness(frame: number, direction: 1 | -1): "ready" | "loading" | "failed";
  /** Schedule already prepared sound relative to the current transport tick. */
  presentSound?(frame: number, delaySeconds: number): void;
  unlockSound?(): void;
}

export type CutListIssue =
  | { code: "empty-sequence" }
  /** Zero-based sequence-frame range, with an exclusive end. */
  | { code: "sequence-gap"; startFrame: number; endFrame: number }
  | { code: "invalid-sequence-duration"; durationFrames: number }
  | { code: "invalid-project-frame-rate"; frameRate: FrameRate }
  | { code: "missing-clip"; placementId: string; clipId: string }
  | { code: "missing-source"; placementId: string; sourceId: string }
  | {
      code: "frame-rate-mismatch" | "invalid-source-frame-rate";
      placementId: string;
      sourceFrameRate: FrameRate;
    }
  | {
      code: "invalid-source-range";
      placementId: string;
      sourceInFrame: number;
      sourceOutFrame: number;
    }
  | { code: "placement-outside-sequence"; placementId: string }
  | { code: "track-overlap"; trackId: string; placementId: string; previousPlacementId: string }
  | {
      code:
        | "invalid-transition"
        | "fade-overlap"
        | "fade-interrupted"
        | "fade-gap"
        | "unsupported-dissolve"
        | "dissolve-conflict"
        | "dissolve-interrupted"
        | "dissolve-gap";
      transitionId: string;
    };

/** A CutList is present only on success. Issues can also accompany success. */
export type CutListResult =
  | { ok: true; cutList: CutList; issues: readonly CutListIssue[] }
  | { ok: false; issues: readonly [CutListIssue, ...CutListIssue[]] };

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
