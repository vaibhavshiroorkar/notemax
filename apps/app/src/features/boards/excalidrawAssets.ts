// Fonts come from this app, never from Excalidraw's CDN (see vite.config.ts),
// so boards work offline and load nothing from elsewhere. Excalidraw reads
// this when its module loads, so this file is imported before it.
(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = "/excalidraw/";

export {};
