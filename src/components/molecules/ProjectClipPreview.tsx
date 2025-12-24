import usePreloadImages from "@/hooks/usePreloadImages";
import { useEffect, useState } from "react";
import { Temporal } from "temporal-polyfill";

type ProjectClipPreviewProps = {
  thumbnailUrl: string;
  keyframeUrls: string[];
  title?: string;
  durationSeconds: number;
  width: string;
  height: string;
  id: string;
  onTitleUpdate: (id: string, newTitle: string) => void;
} & (
  | {
      showCheckbox: true;
      onSelect: (id: string, selected: boolean) => void;
    }
  | {
      showCheckbox?: false;
    }
);

function ProjectClipPreview(props: ProjectClipPreviewProps) {
  const duration = Temporal.Duration.from({ seconds: props.durationSeconds });
  const [hover, setHover] = useState(false);
  const [keyframe, setKeyframe] = useState(0);

  usePreloadImages(props.keyframeUrls);

  useEffect(() => {
    if (hover && props.keyframeUrls.length > 1) {
      const interval = setInterval(() => {
        setKeyframe((prev) => (prev + 1) % props.keyframeUrls.length);
      }, 200); // Change keyframe every 200ms

      return () => clearInterval(interval);
    } else {
      setKeyframe(0);
    }
  }, [hover, props.keyframeUrls.length]);

  return (
    <div
      className="relative border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden w-[150px]"
      style={{ width: props.width, height: props.height }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="w-full h-full bg-top bg-no-repeat bg-[length:100%_auto] absolute top-0 left-0"
        style={{ backgroundImage: `url(${props.thumbnailUrl})` }}
      ></div>
      <div
        className="w-full h-full bg-top bg-no-repeat bg-[length:100%_auto] absolute top-0 left-0"
        style={{
          backgroundImage: `url(${hover ? props.keyframeUrls[keyframe] : props.thumbnailUrl})`,
        }}
      ></div>
      <div
        className="p-2 absolute top-0 bottom-0 w-full bg-gradient-to-t from-black/70 to-transparent text-white"
        style={{ visibility: hover ? "visible" : "hidden" }}
      >
        <div
          className="text-sm font-medium left-7 right-0 absolute"
          aria-roledescription="project clip title"
        >
          {props.title || `Clip ${props.id}`}

          <div
            aria-roledescription="edit project clip title"
            className="inline-block ml-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-white opacity-75 inline-block cursor-pointer"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              onClick={() => {
                const newTitle = prompt(
                  "Enter new title:",
                  props.title || `Clip ${props.id}`,
                );
                if (newTitle !== null && newTitle.trim() !== "") {
                  props.onTitleUpdate(props.id, newTitle.trim());
                }
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </div>
        </div>
        <div
          className="text-xs absolute right-1 bottom-1"
          aria-roledescription="project clip duration"
        >
          {duration.toLocaleString()}
        </div>
      </div>
      <div
        aria-roledescription="drag handle"
        className="absolute top-2 left-1 cursor-move"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-white opacity-75"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8h16M4 16h16"
          />
        </svg>
      </div>
      {props.showCheckbox && (
        <div className="absolute bottom-1 left-2">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              aria-roledescription="select project clip"
              className="form-checkbox h-4 w-4 text-blue-600"
              onChange={(e) => props.onSelect(props.id, e.target.checked)}
            />
            <span className="sr-only">Select</span>
          </label>
        </div>
      )}
    </div>
  );
}

export default ProjectClipPreview;
