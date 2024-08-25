export default function HeadingLink({
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
