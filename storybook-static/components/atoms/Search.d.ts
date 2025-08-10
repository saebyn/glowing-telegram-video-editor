interface SearchProps {
    label: string;
    text: string;
    setText: (value: string) => void;
}
declare function Search({ text, setText, label }: SearchProps): import("react/jsx-runtime").JSX.Element;
export default Search;
