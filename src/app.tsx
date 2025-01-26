import { createRoot } from "react-dom/client";
import { VideoSelectionPage } from ".";

const container = document.getElementById("root") as HTMLDivElement;
const root = createRoot(container);

root.render(<VideoSelectionPage />);
