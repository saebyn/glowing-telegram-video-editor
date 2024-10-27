import { Section, VideoMetadata } from "types";
import AnimatedHamburgerIconButton from "./AnimatedHamburgerIconButton";
import { useState } from "react";
import NavEntry from "./NavEntry";
import HeadingLink from "./HeadingLink";

export const timeHighlightMargin = 5000;

function Sidebar({
  content,
  onSeekToTime,
  playheadTime,
}: {
  content: VideoMetadata;
  onSeekToTime: (milliseconds: number) => void;
  playheadTime?: number;
}) {
  const [filter, setFilter] = useState("");
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
      <div className="relative p-4">
        <input
          type="search"
          placeholder="Filter..."
          className="w-full rounded border p-2 pr-10 dark:bg-gray-800"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && (
          <button
            className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700"
            onClick={() => setFilter("")}
          >
            ❌
          </button>
        )}
      </div>
      <nav className="mt-4">
        <ul>
          <li>
            <HeadingLink href="#highlights">Highlights</HeadingLink>
          </li>
          {content.highlights.filter(matchesFilter(filter)).map((highlight) => (
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
          {content.attentions.filter(matchesFilter(filter)).map((attention) => (
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
          {content.transcription_errors
            .filter(matchesFilter(filter))
            .map((error) => (
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

function matchesFilter(filter: string): (highlight: Section) => boolean {
  return (highlight) => {
    return [
      highlight.category,
      highlight.description,
      highlight.reasoning,
    ].some((field) => {
      return field?.toLowerCase().includes(filter.toLowerCase());
    });
  };
}

export default Sidebar;
