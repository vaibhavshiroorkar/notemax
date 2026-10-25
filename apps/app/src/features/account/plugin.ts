import type { Plugin } from "@/plugins/types";
import { AccountSection } from "./Account";
import { accountsEnabled } from "./config";
import { AccountBar } from "@/features/sync/AccountBar";
import { AccountDialog } from "@/features/sync/AccountDialog";

export const accountPlugin: Plugin = {
  id: "account",
  name: "Account",
  required: true,
  description: "Sign in to back up and, later, share. Optional",
  settings: [{ id: "account", order: 40, group: "Account and sync", title: "Account", icon: "user", keywords: ["google", "sign in"], when: () => accountsEnabled, component: AccountSection }],
  sidebarFooter: [{ id: "account.open", component: AccountBar }],
  overlays: [{ id: "account", component: AccountDialog }],
  commands: [{ id: "account.open", title: "Account and device mode", keywords: ["profile", "offline", "online", "sign in"], run: (app) => app.openOverlay("account") }],
};
