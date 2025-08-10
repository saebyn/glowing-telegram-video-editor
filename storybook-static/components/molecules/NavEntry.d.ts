export declare const timeHighlightMargin = 5000;
export default function NavEntry({ timestamp, description, onSeekToTime, playheadTime, }: {
    timestamp: number;
    description?: string;
    onSeekToTime: (milliseconds: number) => void;
    playheadTime?: number;
}): import("react/jsx-runtime").JSX.Element;
