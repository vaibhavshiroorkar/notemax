import { createDriveClient } from "@notemax/core";
import { driveToken } from "./google";

// Google Drive's REST API, bound to this app's Google token provider.
// The implementation and folder layout live in @notemax/core.

const client = createDriveClient(driveToken);

export const findFolder = client.findFolder;
export const readKeyCheck = client.readKeyCheck;
export const writeKeyCheck = client.writeKeyCheck;
export const folderHasDocs = client.folderHasDocs;
export const driveRemote = client.driveRemote;
