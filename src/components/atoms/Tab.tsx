export default function Tab({
  title,
  active,
  onClick,
}: {
  title: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`mb-4 rounded bg-gray-300 px-4 py-2 text-center text-xl font-bold dark:bg-gray-400 ${
        active ? "" : "bg-gray-400 dark:bg-gray-500"
      }`}
      onClick={onClick}
    >
      {title}
    </button>
  );
}

export function TabContainer({
  tabs,
  children,
}: {
  tabs: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div
        className="sticky inset-x-0 top-0 flex justify-items-start
         gap-4 bg-gray-300 p-2 shadow-md dark:bg-gray-400 dark:shadow-lg
      "
      >
        {tabs}
      </div>
      <div className=" p-4 ">{children}</div>
    </div>
  );
}
