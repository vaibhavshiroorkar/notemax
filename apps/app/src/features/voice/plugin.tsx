import { activeEditor } from "@/features/editor/active";
import type { AppContext, Plugin } from "@/plugins/types";
import { listening, startVoice, stopVoice } from "./voice";
import "./voice.css";

function toggle(app: AppContext) {
  if (listening.get()) return stopVoice();
  const editor = activeEditor.get();
  if (!editor) return app.notify("Open a note and click where the words should go.");
  editor.commands.focus();
  const problem = startVoice(editor);
  if (problem) app.notify(problem);
}

/** "Listening" in the status bar while voice typing is on. A click stops it. */
function ListeningStatus() {
  const on = listening.use();
  if (!on) return null;
  return (
    <button className="voice-status" onClick={stopVoice} title="Stop voice typing">
      <span className="voice-dot" aria-hidden="true" />
      Listening, click to stop
    </button>
  );
}

export const voicePlugin: Plugin = {
  id: "voice",
  name: "Voice typing",
  description: "Speak and the words appear in the note as you go",
  statusItems: [{ id: "voice.status", component: ListeningStatus }],
  commands: [
    {
      id: "voice.toggle",
      title: "Start or stop voice typing",
      keywords: ["dictate", "speech", "microphone", "talk", "voice"],
      shortcut: "Mod+Shift+.",
      run: toggle,
    },
  ],
  slashItems: [
    {
      title: "Voice typing",
      hint: "",
      description: "Speak, and the words appear",
      icon: "mic",
      group: "Media",
      keywords: ["dictate", "speech", "microphone", "talk"],
      apply: (chain) =>
        chain.command(({ editor }) => {
          // After the / is removed, from the cursor where it was.
          queueMicrotask(() => startVoice(editor));
          return true;
        }),
    },
  ],
};

