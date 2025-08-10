import { default as React } from '../../../node_modules/react';
declare function Button({ children, variant, className, onClick, ...props }: React.ComponentPropsWithoutRef<"button"> & {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    variant?: "primary" | "danger" | "secondary" | "default";
}): import("react/jsx-runtime").JSX.Element;
export default Button;
