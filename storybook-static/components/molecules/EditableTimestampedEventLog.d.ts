import { LogEvent } from '../../types';
interface EditableTimestampedEventLogProps<T extends LogEvent> {
    log: T[];
    onChange: (updatedEvent: T) => void;
    onAdd: (newEvent: T) => void;
    onRemove: (event: T) => void;
    playheadTime: number;
    onSeekToTime: (milliseconds: number) => void;
    contentField: keyof T;
    followPlayback?: boolean;
}
export default function EditableTimestampedEventLog<T extends LogEvent>({ log, onChange, onAdd, onRemove, playheadTime, onSeekToTime, contentField, followPlayback, }: EditableTimestampedEventLogProps<T>): import("react/jsx-runtime").JSX.Element;
export {};
