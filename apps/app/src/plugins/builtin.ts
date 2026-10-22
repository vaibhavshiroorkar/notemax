import { accountPlugin } from "@/features/account/plugin";
import { appearancePlugin } from "@/features/appearance/plugin";
import { boardsPlugin } from "@/features/boards/plugin";
import { booksPlugin } from "@/features/books/plugin";
import { capturePlugin } from "@/features/capture/plugin";
import { notesPlugin } from "@/features/editor/plugin";
import { downloadsPlugin } from "@/features/export/plugin";
import { graphPlugin } from "@/features/graph/plugin";
import { imagesPlugin } from "@/features/images/plugin";
import { linksPlugin } from "@/features/links/plugin";
import { navigationPlugin } from "@/features/navigation/plugin";
import { pageInfoPlugin } from "@/features/page-info/plugin";
import { palettePlugin } from "@/features/palette/plugin";
import { settingsPlugin } from "@/features/settings/plugin";
import { shortcutsPlugin } from "@/features/shortcuts/plugin";
import { sidebarPlugin } from "@/features/sidebar/plugin";
import { slashPlugin } from "@/features/slash/plugin";
import { starPlugin } from "@/features/star/plugin";
import { temporaryPlugin } from "@/features/temporary/plugin";
import { syncPlugin } from "@/features/sync/plugin";
import { tagsPlugin } from "@/features/tags/plugin";
import { registerPlugin } from "./registry";

// Order matters where lists are shown in order: the + menu lists kinds as
// they are registered here (note, folder, book), the / menu lists its items
// in this order (text blocks before Picture), and the shortcut settings list
// commands in this order too.
[
  notesPlugin,
  sidebarPlugin,
  starPlugin,
  temporaryPlugin,
  booksPlugin,
  boardsPlugin,
  tagsPlugin,
  slashPlugin,
  imagesPlugin,
  linksPlugin,
  pageInfoPlugin,
  graphPlugin,
  downloadsPlugin,
  palettePlugin,
  navigationPlugin,
  appearancePlugin,
  settingsPlugin,
  shortcutsPlugin,
  accountPlugin,
  syncPlugin,
  capturePlugin,
].forEach(registerPlugin);
