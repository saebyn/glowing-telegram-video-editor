import { default as Timeline } from './Timeline';
declare const _default: {
    title: string;
    component: typeof Timeline;
    tags: string[];
    decorators: ((story: () => React.ReactNode) => import("react/jsx-runtime").JSX.Element)[];
};
export default _default;
export declare const Default: {
    args: {
        content: {
            chat_history: never[];
            silences: never[];
            highlights: {
                timestamp: number;
                timestamp_end: number;
                description: string;
                reasoning: string;
            }[];
            attentions: {
                timestamp: number;
                timestamp_end: number;
                category: string;
                description: string;
                reasoning: string;
            }[];
            transcription_errors: never[];
        };
        playheadTime: number;
        onSeekToTime: import('@storybook/addon-actions').HandlerFunction;
        onItemSelect: import('@storybook/addon-actions').HandlerFunction;
    };
};
