import { TimelineElementType } from '../atoms/TimelineLegend';
import { TimelineItem } from '../../utils/timeline';
interface TimelineElementProps {
    content: TimelineItem<TimelineElementType>;
    onClick: () => void;
}
export default function TimelineElement({ content: { startMilliseconds, endMilliseconds, type, text }, onClick, }: TimelineElementProps): import("react/jsx-runtime").JSX.Element;
export {};
