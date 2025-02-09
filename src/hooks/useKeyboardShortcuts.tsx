import { useEffect } from "react";

interface KeyActionMap {
  [key: string]: (event: KeyboardEvent) => void;
}

const useKeyboardShortcuts = (keyActionMap: KeyActionMap) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keyParts = [
        event.ctrlKey ? "Ctrl" : "",
        event.shiftKey ? "Shift" : "",
        event.altKey ? "Alt" : "",
        event.metaKey ? "Meta" : "",
        event.key,
      ].filter((part) => part !== "");
      const key = `${keyParts.join("+")}`;
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
