import ReactPannellum from "react-pannellum";

interface Viewer360Props {
    imageUrl: string;
}

const Viewer360 = ({ imageUrl }: Viewer360Props) => {
    return (
        <ReactPannellum
            id="viewer"
            sceneId="scene"
            imageSource={imageUrl}
            style={{ height: "100%", width: "100%" }}
            config={{ autoLoad: true }}
        />
    );
};

export default Viewer360;