import { action } from "@storybook/addon-actions";

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
        onTimeUpdate={action("Time Update")}
        onEnd={action("End")}
      />
    </div>
  );
};
