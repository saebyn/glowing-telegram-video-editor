import { VideoClip, VideoMetadata } from '../../types';
interface VideoSelectionPageProps {
    content: VideoMetadata;
    onExport?: (clips: VideoClip[]) => void;
}
declare function VideoSelectionPage({ content, onExport }: VideoSelectionPageProps): import("react/jsx-runtime").JSX.Element;
export default VideoSelectionPage;
