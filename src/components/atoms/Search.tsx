interface SearchProps {
  label: string;
  text: string;
  setText: (value: string) => void;
}

function Search({ text, setText, label }: SearchProps) {
  return (
    <>
      <input
        type="search"
        placeholder={label}
        className="w-full rounded-sm border p-2 pr-10 dark:bg-gray-800"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {text && (
        <button
          type="button"
          className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700"
          onClick={() => setText("")}
          title="Clear filter"
        >
          ❌
        </button>
      )}
    </>
  );
}

export default Search;
