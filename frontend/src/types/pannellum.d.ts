// Pannellum ist ein klassisches Browser-Skript ohne ES-Exports und ohne
// mitgelieferte Typen: Beim Import hängt es sich an window.pannellum.
export {};

declare global {
    interface PannellumViewer {
        destroy(): void;
    }

    interface PannellumConfig {
        type?: "equirectangular";
        panorama: string;
        autoLoad?: boolean;
        showControls?: boolean;
        crossOrigin?: "anonymous" | "use-credentials";
    }

    interface Window {
        pannellum: {
            viewer(container: HTMLElement | string, config: PannellumConfig): PannellumViewer;
        };
    }
}