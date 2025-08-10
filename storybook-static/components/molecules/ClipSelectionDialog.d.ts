import { VideoClip } from '../../types';
interface Props {
    clips: VideoClip[];
    show: boolean;
    onClear: () => void;
    onExport: () => void;
    onRemove: (id: string) => void;
    onReorder: (clips: VideoClip[]) => void;
    onCopyStartTime: (id: string) => void;
    onCopyEndTime: (id: string) => void;
    onSeekToTime: (milliseconds: number) => void;
}
export default function ClipSelectionDialog({ clips, show, onClear, onExport, onRemove, onReorder, onCopyStartTime, onCopyEndTime, onSeekToTime, }: Props): import("react/jsx-runtime").JSX.Element | null;
export {};
