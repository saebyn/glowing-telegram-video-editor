import { ReactNode } from '../../../node_modules/react';
interface VideoPlayerControlsProps {
    video: HTMLVideoElement | null;
    children: ReactNode;
}
export default function VideoPlayerControls({ video, children, }: VideoPlayerControlsProps): import("react/jsx-runtime").JSX.Element;
export {};
