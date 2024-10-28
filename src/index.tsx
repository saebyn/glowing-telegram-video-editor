import { createRoot } from "react-dom/client";
import "tailwindcss/tailwind.css";
import VideoSelectionPage from "components/pages/VideoSelectionPage";

const container = document.getElementById("root") as HTMLDivElement;
const root = createRoot(container);

root.render(<VideoSelectionPage />);
