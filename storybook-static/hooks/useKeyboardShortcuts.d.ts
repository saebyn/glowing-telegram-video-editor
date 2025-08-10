interface KeyActionMap {
    [key: string]: (event: KeyboardEvent) => void;
}
declare const useKeyboardShortcuts: (keyActionMap: KeyActionMap) => void;
export default useKeyboardShortcuts;
