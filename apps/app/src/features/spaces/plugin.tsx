import { accountsEnabled } from "@/features/account/config";
import { accountView } from "@/features/account/session";
import type { AppContext, Plugin } from "@/plugins/types";
import { messageOf } from "@/ui/format";
import { joinSpace, spaceFromLink } from "./actions";
import { isViewOnly, startSpaces } from "./runtime";
import { SharedWithYou } from "./SharedWithYou";
import { ShareWorkspaceDialog } from "./ShareWorkspaceDialog";

/** Opens the workspace a link was for, adding it to this device's list the first time. */
function openFromLink(app: AppContext) {
  if (!spaceFromLink || !accountsEnabled) return;
  const { space, token } = spaceFromLink;
  joinSpace(space, token).then(
    (result) => {
      if (!result) app.notify("This link does not open anything any more. Ask for a new one.");
      else app.notify(`Opened ${result.name}. Its pages arrive in a moment.`);
    },
    (err: unknown) => app.notify(`Could not open the shared workspace: ${messageOf(err)}`),
  );
}

export const spacesPlugin: Plugin = {
  id: "spaces",
  online: true,
  name: "Shared workspaces",
  description: "Share a whole workspace by email or link, with people who view, edit or manage it",
  overlays: [{ id: "workspace-share", component: ShareWorkspaceDialog }],
  lockPage: (_node, workspace) => (isViewOnly(workspace) ? "Shared with you to view. Ask its owner to let you edit." : undefined),
  // Invitations go to the email you sign in with, so signed out there is nothing to show.
  homeSections: [{ id: "home.shared", title: "Shared with you", order: 15, when: () => accountView.get().state === "in", component: SharedWithYou }],
  commands: [
    {
      id: "spaces.share",
      title: "Share this workspace",
      keywords: ["invite", "collaborate", "team", "people", "link", "access", "members"],
      run: (app) => app.openOverlay("workspace-share", { workspace: app.workspace }),
    },
  ],
  start(app) {
    if (!accountsEnabled) return;
    startSpaces();
    openFromLink(app);
  },
};
