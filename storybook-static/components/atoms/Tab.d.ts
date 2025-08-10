export default function Tab({ title, active, onClick, }: {
    title: string;
    active: boolean;
    onClick?: () => void;
}): import("react/jsx-runtime").JSX.Element;
export declare function TabContainer({ tabs, children, }: {
    tabs: React.ReactNode;
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
