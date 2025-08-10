interface ProgressBarProps {
    progress: number;
    seekToPercent: (progress: number) => void;
    duration: number;
}
export default function VideoPlayerProgressBar({ progress, seekToPercent, duration, }: ProgressBarProps): import("react/jsx-runtime").JSX.Element;
export {};
