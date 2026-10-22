import type { Editor } from "@tiptap/core";
import { createStore } from "@/platform/store";

// Voice typing: the browser's own speech recognition writes into the note as
// you speak. Words it is still unsure of show at once and change as it hears
// more; each phrase is settled when it is sure. Chrome and Edge have it; most
// other browsers do not.

interface Alternative {
  transcript: string;
}
interface Result {
  isFinal: boolean;
  0: Alternative;
}
interface ResultEvent {
  resultIndex: number;
  results: ArrayLike<Result>;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: ResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionClass = new () => Recognition;

const RecognitionOf = () =>
  ((window as unknown as { SpeechRecognition?: RecognitionClass }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: RecognitionClass }).webkitSpeechRecognition) as RecognitionClass | undefined;

export const canListen = () => !!RecognitionOf();

/** True while voice typing is on. */
export const listening = createStore(false);

let stopNow: (() => void) | null = null;

export function stopVoice() {
  stopNow?.();
}

/** Starts writing what is heard at the cursor. Returns a reason when it cannot. */
export function startVoice(editor: Editor): string | null {
  const Recognition = RecognitionOf();
  if (!Recognition) return "This browser cannot turn speech into text. Chrome and Edge can.";
  stopVoice();
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "en-US";

  // Where the words go, and how long the unsure part written there is.
  let at = editor.state.selection.to;
  let unsure = 0;
  let on = true;

  recognition.onresult = (event) => {
    let sure = "";
    let guess = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) sure += result[0].transcript;
      else guess += result[0].transcript;
    }
    // A space between phrases, unless the line is empty or ends in one.
    const before = editor.state.doc.textBetween(Math.max(0, at - 1), at);
    const lead = (sure || guess) && before && !/\s$/.test(before) && unsure === 0 ? " " : "";
    const text = lead + sure + guess;
    editor
      .chain()
      .insertContentAt({ from: at, to: at + unsure }, text ? [{ type: "text", text }] : [])
      .run();
    at += lead.length + sure.length;
    unsure = guess.length;
  };
  recognition.onerror = (event) => {
    // "no-speech" only means a pause; anything else ends voice typing.
    if (event.error !== "no-speech") on = false;
  };
  recognition.onend = () => {
    // Chrome stops after a silence; keep listening until told to stop.
    if (on) recognition.start();
    else listening.set(false);
  };

  stopNow = () => {
    on = false;
    stopNow = null;
    recognition.stop();
    listening.set(false);
  };
  recognition.start();
  listening.set(true);
  return null;
}
