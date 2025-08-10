import { default as React } from '../../../node_modules/react';
interface TimeLinkProps {
    milliseconds?: number;
    onClick?: (milliseconds: number) => void;
    children?: React.ReactNode;
    href?: string;
    className?: string;
}
export default function TimeLink({ milliseconds, onClick, children, href, className, }: TimeLinkProps): import("react/jsx-runtime").JSX.Element | null;
export {};
