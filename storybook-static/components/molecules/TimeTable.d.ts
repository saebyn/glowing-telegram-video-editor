import { Section } from '../../types';
declare function TimeTable({ rows, includeEnd, includeReasoning, includeCategory, canEdit, canClip, playheadTime, onSeekToTime, onClip, }: {
    rows: Section[];
    includeEnd?: boolean;
    includeReasoning?: boolean;
    includeCategory?: boolean;
    canEdit?: boolean;
    canClip?: boolean;
    playheadTime?: number;
    onSeekToTime?: (milliseconds: number) => void;
    onClip?: (section: Section) => void;
}): import("react/jsx-runtime").JSX.Element;
export default TimeTable;
