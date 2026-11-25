import "./index.css";
import { createRoot } from "react-dom/client";
import { parseContent, VideoSelectionPage } from ".";
import rawContent from "./data.json";

const container = document.getElementById("root") as HTMLDivElement;
const root = createRoot(container);

root.render(<VideoSelectionPage content={parseContent(rawContent)} />);
