import { default as VideoSelectionPage } from './VideoSelectionPage';
declare const _default: {
    title: string;
    component: typeof VideoSelectionPage;
    tags: string[];
};
export default _default;
export declare const Default: {
    args: {
        content: {
            title: string;
            video_url: string;
            length: number;
            highlights: {
                timestamp: number;
                timestamp_end: number;
                description: string;
                reasoning: string;
            }[];
            attentions: never[];
            transcription_errors: never[];
            silences: never[];
            chat_history: never[];
            transcript: never[];
        };
        onExport: import('@storybook/addon-actions').HandlerFunction;
    };
};
