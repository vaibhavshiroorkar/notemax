import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initAppearance } from "@/ui/appearance";
// Shared styles first, so each feature's own stylesheet loads after them.
import "@/ui/ui.css";
// Built-in features register before the first render.
import "@/plugins/builtin";
import { App } from "./App";

initAppearance();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
