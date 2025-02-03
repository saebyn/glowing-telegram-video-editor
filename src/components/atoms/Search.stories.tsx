import { useState } from "react";
import Search from "./Search";

export default {
  title: "Atoms/Search",
  component: Search,
  tags: ["atoms"],
};

export const Default = () => {
  const [text, setText] = useState("");
  return <Search label="Search..." text={text} setText={setText} />;
};
