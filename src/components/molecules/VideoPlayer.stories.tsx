import { action } from "storybook/actions";

import VideoPlayer from "./VideoPlayer";

export default {
  title: "Molecules/VideoPlayer",
  component: VideoPlayer,
  tags: ["molecules"],
};

export const Default = () => {
  return (
    <div>
      <VideoPlayer
        videoUrl="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
        sourceFrameRate={{ numerator: 24, denominator: 1 }}
        durationFrames={15_216}
        onFrameUpdate={action("Frame Update")}
        onEnd={action("End")}
      />
    </div>
  );
};
