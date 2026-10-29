import { createStore } from "@/platform/store";

/**
 * The third bar at the top of a phone, where a page puts its tools: the
 * formatting buttons in a note, the reading tools in a post. Pages draw into
 * it with a portal. Null on a wider screen, where pages keep their tools.
 */
export const phoneBar = createStore<HTMLElement | null>(null);
