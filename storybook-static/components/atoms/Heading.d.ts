import { HTMLAttributes } from '../../../node_modules/react';
type HeadingProps = React.PropsWithChildren<HTMLAttributes<HTMLHeadingElement>> & {
    level?: 1 | 2 | 3 | 4 | 5 | 6;
};
export default function Heading({ level, children, ...props }: HeadingProps): import("react/jsx-runtime").JSX.Element;
export {};
