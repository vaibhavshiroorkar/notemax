import { accountPlugin } from "@/features/account/plugin";
import { booksPlugin } from "@/features/books/plugin";
import { capturePlugin } from "@/features/capture/plugin";
import { notesPlugin } from "@/features/editor/plugin";
import { linksPlugin } from "@/features/links/plugin";
import { palettePlugin } from "@/features/palette/plugin";
import { settingsPlugin } from "@/features/settings/plugin";
import { sidebarPlugin } from "@/features/sidebar/plugin";
import { slashPlugin } from "@/features/slash/plugin";
import { registerPlugin } from "./registry";

// Order matters where lists are shown in order: the + menu lists kinds as
// they are registered here (note, folder, book).
[notesPlugin, sidebarPlugin, booksPlugin, linksPlugin, slashPlugin, palettePlugin, settingsPlugin, accountPlugin, capturePlugin].forEach(registerPlugin);
