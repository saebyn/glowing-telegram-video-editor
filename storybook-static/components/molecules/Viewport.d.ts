import { ReactNode } from '../../../node_modules/react';
type ViewportProps = {
    videoPlayer?: ReactNode;
    transcript?: ReactNode;
    chatHistory?: ReactNode;
    timeline?: ReactNode;
    settings?: ReactNode;
};
/**
 * A layout for the viewport, which contains the `VideoPlayer`,
 * `VideoCaption`, transcript/chat sidebar, and `Timeline`.
 *
 * The layout is divided into two sections: the video player and the
 * transcript/chat sidebar. The video player takes up 2/3 of the width
 * and the sidebar takes up 1/3 of the width. Then, the `Timeline` is
 * displayed below the video player and sidebar.
 */
declare function Viewport({ chatHistory, timeline, transcript, videoPlayer, settings, }: ViewportProps): import("react/jsx-runtime").JSX.Element;
export default Viewport;
