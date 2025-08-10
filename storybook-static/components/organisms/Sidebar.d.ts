import { VideoMetadata } from '../../types';
declare function Sidebar({ content, onSeekToTime, playheadTime, }: {
    content: VideoMetadata;
    onSeekToTime: (milliseconds: number) => void;
    playheadTime?: number;
}): import("react/jsx-runtime").JSX.Element;
export default Sidebar;
