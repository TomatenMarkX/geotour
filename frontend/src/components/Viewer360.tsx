import { useState } from "react";
import ReactPannellum from "react-pannellum";

interface Viewer360Props {
    imageUrl: string;
}

/**
 * react-pannellum hält seine Viewer-Instanzen in modulweiten Variablen und
 * sucht den Container per document.getElementById. Zwei Konsequenzen:
 *   - die id muss pro Instanz eindeutig sein, sonst greifen zwei Viewer
 *     auf denselben DOM-Knoten zu
 *   - ein Wechsel von imageSource allein lädt die Szene nicht neu, deshalb
 *     erzwingt key={imageUrl} einen vollständigen Remount
 */
let instanceCounter = 0;

const Viewer360 = ({ imageUrl }: Viewer360Props) => {
    const [instanceId] = useState(() => ++instanceCounter);

    return (
        <ReactPannellum
            key={imageUrl}
            id={`viewer-${instanceId}`}
            sceneId={`scene-${instanceId}`}
            imageSource={imageUrl}
            style={{ height: "100%", width: "100%" }}
            config={{ autoLoad: true }}
        />
    );
};

export default Viewer360;