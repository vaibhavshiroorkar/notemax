import { accountPlugin } from "@/features/account/plugin";
import { appearancePlugin } from "@/features/appearance/plugin";
import { booksPlugin } from "@/features/books/plugin";
import { capturePlugin } from "@/features/capture/plugin";
import { notesPlugin } from "@/features/editor/plugin";
import { linksPlugin } from "@/features/links/plugin";
import { navigationPlugin } from "@/features/navigation/plugin";
import { palettePlugin } from "@/features/palette/plugin";
import { settingsPlugin } from "@/features/settings/plugin";
import { shortcutsPlugin } from "@/features/shortcuts/plugin";
import { sidebarPlugin } from "@/features/sidebar/plugin";
import { slashPlugin } from "@/features/slash/plugin";
import { tagsPlugin } from "@/features/tags/plugin";
import { registerPlugin } from "./registry";

// Order matters where lists are shown in order: the + menu lists kinds as
// they are registered here (note, folder, book), and the shortcut settings
// list commands in this order too.
[
  notesPlugin,
  sidebarPlugin,
  booksPlugin,
  tagsPlugin,
  linksPlugin,
  slashPlugin,
  palettePlugin,
  navigationPlugin,
  appearancePlugin,
  settingsPlugin,
  shortcutsPlugin,
  accountPlugin,
  capturePlugin,
].forEach(registerPlugin);
