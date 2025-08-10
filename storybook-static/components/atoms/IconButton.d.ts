import { default as React } from '../../../node_modules/react';
declare function IconButton({ icon, className, text, ...props }: React.ComponentPropsWithoutRef<"button"> & {
    className?: string;
    icon: string;
    text?: string;
    onClick?: () => void;
    variant?: "primary" | "danger" | "secondary" | "default";
}): import("react/jsx-runtime").JSX.Element;
export default IconButton;
