import type { AppContext } from "@/plugins/types";
import { Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { HomeView } from "./HomeView";

/** Home over the whole window, above the sidebars and tabs. Esc, the close button or picking a page puts it away. */
export function HomeScreen({ app, onClose }: { app: AppContext; options: Record<string, unknown>; onClose(): void }) {
  return (
    <Dialog label="Home" onClose={onClose} className="home-screen">
      <button className="icon-button home-close" aria-label="Close Home" title="Close Home (Esc)" onClick={onClose}>
        <Icon name="close" />
      </button>
      <HomeView app={app} options={{}} onDone={onClose} />
    </Dialog>
  );
}
