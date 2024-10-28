import { ReactNode, useState } from "react";
import Tab, { TabContainer } from "components/atoms/Tab";

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
function Viewport({
  chatHistory,
  timeline,
  transcript,
  videoPlayer,
  settings,
}: ViewportProps) {
  const [chatTab, setChatTab] = useState<"chat" | "transcript">("chat");

  return (
    <section className="mb-6">
      <div className="rounded p-4 shadow-md">
        <div className=" mb-4 grid w-full grid-cols-3">
          <div className="col-span-2">{videoPlayer}</div>

          <div
            className="col-span-1 h-0 min-h-full overflow-y-scroll bg-gray-200
                  text-gray-800 shadow-md dark:bg-gray-600 dark:text-gray-200
                "
          >
            <TabContainer
              tabs={
                <>
                  <Tab
                    title="Chat"
                    active={chatTab === "chat"}
                    onClick={() => setChatTab("chat")}
                  />
                  <Tab
                    title="Transcript"
                    active={chatTab === "transcript"}
                    onClick={() => setChatTab("transcript")}
                  />
                </>
              }
            >
              {chatTab === "transcript" && transcript}
              {chatTab === "chat" && chatHistory}
            </TabContainer>
          </div>
        </div>

        {timeline}

        {settings}
      </div>
    </section>
  );
}

export default Viewport;
