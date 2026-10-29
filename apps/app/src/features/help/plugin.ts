import type { Plugin } from "@/plugins/types";
import { HelpSection } from "./HelpSection";
import "./help.css";

export const helpPlugin: Plugin = {
  id: "help",
  name: "Help",
  description: "Answers to common questions, searchable, in Settings",
  required: true,
  settings: [{ id: "help", order: 1, group: "General", title: "Help", icon: "search", keywords: ["help", "question", "how", "faq", "support"], component: HelpSection }],
  commands: [{ id: "help.open", title: "Help: common questions", keywords: ["help", "how", "faq", "question", "support"], run: (app) => app.openSettings("help") }],
};
