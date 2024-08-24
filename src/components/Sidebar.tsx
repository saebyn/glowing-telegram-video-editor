import { VideoMetadata } from "types";
import TimeLink from "./TimeLink";
import AnimatedHamburgerIconButton from "./AnimatedHamburgerIconButton";
import { useState } from "react";

const timeHighlightMargin = 5000;

function Sidebar({
  content,
  onSeekToTime,
  playheadTime,
}: {
  content: VideoMetadata;
  onSeekToTime: (milliseconds: number) => void;
  playheadTime?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isExpanded) {
    return (
      <aside className="h-full w-20 bg-white shadow-md dark:bg-gray-900 dark:text-gray-200">
        <AnimatedHamburgerIconButton
          isExpanded={isExpanded}
          onClick={() => setIsExpanded(!isExpanded)}
        />
      </aside>
    );
  }

  return (
    <aside
      className="w-96 overflow-y-scroll bg-white shadow-md dark:bg-gray-900 dark:text-gray-200
    "
    >
      <AnimatedHamburgerIconButton
        isExpanded={isExpanded}
        onClick={() => setIsExpanded(!isExpanded)}
      />
      <div className="p-4">
        <input
          type="search"
          placeholder="Filter..."
          className="w-full rounded border p-2 dark:bg-gray-800"
        />
      </div>
      <nav className="mt-4">
        <ul>
          <li>
            <HeadingLink href="#highlights">Highlights</HeadingLink>
          </li>
          {content.highlights.map((highlight) => (
            <NavEntry
              key={`highlight-${highlight.timestamp}`}
              {...highlight}
              playheadTime={playheadTime}
              onSeekToTime={onSeekToTime}
            />
          ))}
          <li>
            <button className="block w-full p-4 text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">
              Add New
            </button>
          </li>
          <li>
            <HeadingLink href="#attentions">Attentions</HeadingLink>
          </li>
          {content.attentions.map((attention) => (
            <NavEntry
              key={`attention-${attention.timestamp}`}
              {...attention}
              playheadTime={playheadTime}
              onSeekToTime={onSeekToTime}
            />
          ))}
          <li>
            <HeadingLink href="#transcription-errors">
              Transcription Errors
            </HeadingLink>
          </li>
          {content.transcription_errors.map((error) => (
            <NavEntry
              key={`error-${error.timestamp}`}
              {...error}
              playheadTime={playheadTime}
              onSeekToTime={onSeekToTime}
            />
          ))}

          <li>
            <HeadingLink href="#top">Back to Top</HeadingLink>
          </li>
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;

function HeadingLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="block p-4 text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700"
    >
      {children}
    </a>
  );
}

function NavEntry({
  timestamp,
  description,
  onSeekToTime,
  playheadTime,
}: {
  timestamp: number;
  description?: string;
  onSeekToTime: (milliseconds: number) => void;
  playheadTime?: number;
}) {
  const shouldHighlight =
    playheadTime && Math.abs(playheadTime - timestamp) < timeHighlightMargin;

  return (
    <li
      key={`error-${timestamp}`}
      className={`ml-4 ${
        shouldHighlight ? "bg-gray-300 dark:bg-gray-600" : ""
      }`}
    >
      <TimeLink
        className="p-4 text-gray-700 dark:text-gray-200"
        href={`#${timestamp}`}
        milliseconds={timestamp}
        onClick={onSeekToTime}
      >
        {" "}
        - {description?.substring(0, 30)}...
      </TimeLink>
    </li>
  );
}
