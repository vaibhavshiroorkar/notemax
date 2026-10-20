import type { ComponentType } from "react";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { SuggestionListHandle } from "./SuggestionList";

/** Shows a React menu for a Tiptap suggestion, and hands it the keys it wants. */
export function renderPopup<I, S>(Menu: ComponentType<SuggestionProps<I, S>>): SuggestionOptions<I, S>["render"] {
  return () => {
    let menu: ReactRenderer<SuggestionListHandle, SuggestionProps<I, S>> | undefined;
    let unmount: (() => void) | undefined;
    return {
      onStart(props) {
        menu = new ReactRenderer(Menu, { props, editor: props.editor });
        unmount = props.mount(menu.element as HTMLElement);
      },
      onUpdate(props) {
        menu?.updateProps(props);
      },
      onKeyDown({ event }) {
        return menu?.ref?.onKeyDown(event) ?? false;
      },
      onExit() {
        unmount?.();
        menu?.destroy();
        menu = undefined;
      },
    };
  };
}
