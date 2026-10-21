import type { Plugin } from "@/plugins/types";
import { AccountSection } from "./Account";
import { accountsEnabled } from "./config";

export const accountPlugin: Plugin = {
  id: "account",
  name: "Account",
  settings: [{ id: "account", order: 20, when: () => accountsEnabled, component: AccountSection }],
};
