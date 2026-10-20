import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initTheme } from "@/ui/theme";
import { Capture } from "./Capture";
import "./capture.css";

initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Capture />
  </StrictMode>,
);
