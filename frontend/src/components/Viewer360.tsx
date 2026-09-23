import { useEffect, useRef } from "react";
import "pannellum/build/pannellum.js";

interface Viewer360Props {
    imageUrl: string;
    showControls?: boolean;
}

/**
 * Pannellum direkt, ohne Wrapper: Der Viewer bekommt das DOM-Element per Ref,
 * damit entfallen die globalen ids. Bei jedem Bildwechsel wird die alte
 * Instanz zerstört und eine neue erzeugt.
 */
const Viewer360 = ({ imageUrl, showControls = true }: Viewer360Props) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const viewer = window.pannellum.viewer(container, {
            type: "equirectangular",
            panorama: imageUrl,
            autoLoad: true,
            showControls,
            // Muss zum Preload im TourViewer passen (gleicher Cache-Eintrag)
            crossOrigin: "anonymous",
        });

        return () => viewer.destroy();
    }, [imageUrl, showControls]);

    return <div ref={containerRef} className="h-full w-full" />;
};

export default Viewer360;