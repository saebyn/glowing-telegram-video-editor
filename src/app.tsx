import { createRoot } from "react-dom/client";
import { VideoSelectionPage } from ".";

const container = document.getElementById("root") as HTMLDivElement;
const root = createRoot(container);

import parseContent from "utils/parseData";
import rawContent from "./data.json";

root.render(<VideoSelectionPage content={parseContent(rawContent)} />);
