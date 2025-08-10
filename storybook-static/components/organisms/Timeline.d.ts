import { Section, VideoMetadata } from '../../types';
export default function Timeline({ content: { chat_history, silences, highlights, attentions, transcription_errors, }, playheadTime, onSeekToTime, onItemSelect, }: {
    content: VideoMetadata;
    playheadTime: number;
    onSeekToTime?: (time: number) => void;
    onItemSelect?: (item: Section) => void;
}): import("react/jsx-runtime").JSX.Element;
