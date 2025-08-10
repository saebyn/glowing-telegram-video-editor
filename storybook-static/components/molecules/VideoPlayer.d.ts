interface VideoPlayerProps {
    videoUrl: string;
    onTimeUpdate?: (time: number) => void;
    onEnd?: () => void;
}
export interface VideoPlayerRef {
    seekTo: (milliseconds: number) => void;
    togglePlay: () => void;
}
declare const _default: import('../../../node_modules/react').ForwardRefExoticComponent<VideoPlayerProps & import('../../../node_modules/react').RefAttributes<VideoPlayerRef>>;
export default _default;
