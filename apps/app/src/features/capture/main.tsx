import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initAppearance } from "@/ui/appearance";
import { Capture } from "./Capture";
import "./capture.css";

initAppearance();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Capture />
  </StrictMode>,
);
