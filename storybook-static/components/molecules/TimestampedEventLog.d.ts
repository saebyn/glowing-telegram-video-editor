import { LogEvent } from '../../types';
interface TimestampedEventLogProps<T extends LogEvent> {
    log: T[];
    playheadTime: number;
    onSeekToTime: (milliseconds: number) => void;
    renderEvent: (event: T) => React.ReactNode;
    followPlayback?: boolean;
}
export default function TimestampedEventLog<T extends LogEvent>({ log, playheadTime, onSeekToTime, renderEvent, followPlayback, }: TimestampedEventLogProps<T>): import("react/jsx-runtime").JSX.Element;
export {};
