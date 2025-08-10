export default function TimeSegmentMarker({ startMilliseconds, endMilliseconds, text, className, onClick, }: {
    startMilliseconds: number;
    endMilliseconds: number | undefined;
    className: string;
    text: string;
    onClick?: () => void;
}): import("react/jsx-runtime").JSX.Element;
