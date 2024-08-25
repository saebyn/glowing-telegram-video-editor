import { useEffect } from "react";

interface KeyActionMap {
  [key: string]: (event: KeyboardEvent) => void;
}

const useKeyboardShortcuts = (keyActionMap: KeyActionMap) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = `${event.ctrlKey ? "Ctrl+" : ""}${event.key}`;
      if (keyActionMap[key]) {
        event.preventDefault();
        keyActionMap[key](event);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [keyActionMap]);
};

export default useKeyboardShortcuts;
