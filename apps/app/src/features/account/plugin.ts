import type { Plugin } from "@/plugins/types";
import { AccountSection } from "./Account";
import { accountsEnabled } from "./config";

export const accountPlugin: Plugin = {
  id: "account",
  name: "Account",
  description: "Sign in to back up and, later, share. Optional",
  settings: [{ id: "account", order: 40, group: "Account and sync", title: "Account", icon: "user", keywords: ["google", "sign in"], when: () => accountsEnabled, component: AccountSection }],
};
