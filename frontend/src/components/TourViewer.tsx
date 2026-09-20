import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { loadPublicTour, fetchImageBlob } from "@/services/tourService";
import { Tour, ImageFile } from "@/types";
import ReactPannellum from "react-pannellum";
import {
    ChevronLeft,
    ChevronRight,
    MapPin,
    Compass,
    Loader2,
    AlertCircle,
    Maximize2,
    X,
} from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";

type Phase = "idle" | "zoomIn" | "black" | "zoomOut";

const ZOOM_IN_MS     = 600;
const BLACK_MS       = 80;
const ZOOM_OUT_MS    = 500;
const PRELOAD_AHEAD  = 2;
const PRELOAD_BEHIND = 1;
const MAX_CACHED_BLOBS = 10;

// ── LRU-Cache ────────────────────────────────────────────────────────────────
class LRUBlobCache {
    private cache: globalThis.Map<number, string> = new globalThis.Map();
    private max: number;
    constructor(max: number) { this.max = max; }

    get(index: number): string | undefined {
        if (!this.cache.has(index)) return undefined;
        const url = this.cache.get(index)!;
        this.cache.delete(index);
        this.cache.set(index, url);
        return url;
    }

    set(index: number, url: string) {
        if (this.cache.has(index)) this.cache.delete(index);
        if (this.cache.size >= this.max) {
            const oldestKey = this.cache.keys().next().value!;
            URL.revokeObjectURL(this.cache.get(oldestKey)!);
            this.cache.delete(oldestKey);
        }
        this.cache.set(index, url);
    }

    has(index: number): boolean { return this.cache.has(index); }

    destroy() {
        this.cache.forEach(url => URL.revokeObjectURL(url));
        this.cache.clear();
    }
}

// ── FitBounds: Karte auf alle Punkte fitten ───────────────────────────────────
function FitBounds({ images }: { images: ImageFile[] }) {
    const map = useMap();
    useEffect(() => {
        if (images.length === 0) return;
        if (images.length === 1) {
            map.setView([images[0].lat, images[0].lng], 14);
            return;
        }
        const bounds = images.map(f => [f.lat, f.lng] as [number, number]);
        map.fitBounds(bounds, { padding: [40, 40] });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images.length]);
    return null;
}


// ── Haupt-Komponente ──────────────────────────────────────────────────────────
const TourViewer = () => {
    const { id } = useParams<{ id: string }>();
    const [tour, setTour]         = useState<Tour | null>(null);
    const [loading, setLoading]   = useState(true);
    const [notFound, setNotFound] = useState(false);

    const blobCache = useRef(new LRUBlobCache(MAX_CACHED_BLOBS));
    const [cacheVersion, setCacheVersion] = useState(0);
    const [images, setImages] = useState<ImageFile[]>([]);

    const [visibleIndex, setVisibleIndex] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [phase, setPhase]               = useState<Phase>("idle");
    const isAnimating = useRef(false);

    const [mapOpenBig, setMapOpenBig] = useState(false);
    const [mapOpen, setMapOpen] = useState(true);

    useEffect(() => {
        const cache = blobCache.current;
        return () => cache.destroy();
    }, []);

    const ensureLoaded = useCallback(async (index: number, tourImages: ImageFile[]) => {
        if (blobCache.current.has(index)) return;
        const img = tourImages[index];
        if (!img) return;
        if (img.previewUrl?.startsWith("blob:")) {
            blobCache.current.set(index, img.previewUrl);
            setCacheVersion(v => v + 1);
            return;
        }
        const filename = img.filename ?? img.file.name;
        const url = await fetchImageBlob(filename, async () => undefined);
        if (url) {
            blobCache.current.set(index, url);
            setCacheVersion(v => v + 1);
        }
    }, []);

    const preloadAround = useCallback(async (index: number, tourImages: ImageFile[]) => {
        const total = tourImages.length;
        const indices = [index];
        for (let i = 1; i <= PRELOAD_AHEAD;  i++) indices.push((index + i) % total);
        for (let i = 1; i <= PRELOAD_BEHIND; i++) indices.push((index - i + total) % total);
        await Promise.all(indices.map(i => ensureLoaded(i, tourImages)));
    }, [ensureLoaded]);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        loadPublicTour(id)
            .then(async (data) => {
                if (!data) { setNotFound(true); return; }
                setTour(data);
                setImages(data.images);
                if (data.images[0]?.previewUrl) {
                    blobCache.current.set(0, data.images[0].previewUrl);
                    setCacheVersion(v => v + 1);
                }
                await preloadAround(0, data.images);
            })
            .finally(() => setLoading(false));
    }, [id, preloadAround]);

    const navigateTo = useCallback((nextIndex: number) => {
        if (isAnimating.current || !tour) return;
        isAnimating.current = true;
        setPhase("zoomIn");
        setTimeout(() => {
            setPhase("black");
            setVisibleIndex(nextIndex);
            setCurrentIndex(nextIndex);
            setTimeout(() => {
                setPhase("zoomOut");
                preloadAround(nextIndex, images);
                setTimeout(() => {
                    setPhase("idle");
                    isAnimating.current = false;
                }, ZOOM_OUT_MS);
            }, BLACK_MS);
        }, ZOOM_IN_MS);
    }, [tour, images, preloadAround]);

    const goNext = useCallback(() => {
        if (!tour) return;
        navigateTo((currentIndex + 1) % tour.images.length);
    }, [tour, currentIndex, navigateTo]);

    const goPrev = useCallback(() => {
        if (!tour) return;
        navigateTo((currentIndex - 1 + tour.images.length) % tour.images.length);
    }, [tour, currentIndex, navigateTo]);

    const goTo = useCallback((i: number) => {
        if (i === currentIndex) return;
        navigateTo(i);
    }, [currentIndex, navigateTo]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (mapOpenBig) {
                if (e.key === "Escape") setMapOpenBig(false);
                return;
            }
            if (e.key === "ArrowRight") goNext();
            if (e.key === "ArrowLeft")  goPrev();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [goNext, goPrev, mapOpenBig]);

    const viewerStyle = (): React.CSSProperties => {
        switch (phase) {
            case "zoomIn":  return { transform: "scale(2.5)", opacity: 0, transition: `transform ${ZOOM_IN_MS}ms cubic-bezier(0.4,0,1,1), opacity ${ZOOM_IN_MS}ms cubic-bezier(0.4,0,1,1)` };
            case "black":   return { transform: "scale(2.5)", opacity: 0, transition: "none" };
            case "zoomOut": return { transform: "scale(1)",   opacity: 1, transition: `transform ${ZOOM_OUT_MS}ms cubic-bezier(0,0,0.2,1), opacity ${ZOOM_OUT_MS * 0.6}ms ease-out` };
            default:        return { transform: "scale(1)",   opacity: 1, transition: "none" };
        }
    };

    void cacheVersion;
    const currentImageUrl = blobCache.current.get(visibleIndex);

    if (loading) return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-black gap-4">
            <Loader2 className="h-10 w-10 text-white/60 animate-spin" />
            <p className="text-white/50 text-sm tracking-widest uppercase">Tour wird geladen …</p>
        </div>
    );

    if (notFound || !tour) return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-black gap-4">
            <AlertCircle className="h-12 w-12 text-white/40" />
            <p className="text-white/60 text-lg font-medium">Tour nicht gefunden</p>
            <p className="text-white/30 text-sm">Diese Tour existiert nicht oder ist nicht öffentlich.</p>
        </div>
    );

    if (tour.images.length === 0) return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-black gap-4">
            <MapPin className="h-12 w-12 text-white/40" />
            <p className="text-white/60 text-lg font-medium">{tour.name}</p>
            <p className="text-white/30 text-sm">Diese Tour enthält keine Bilder.</p>
        </div>
    );

    const current: ImageFile = images[currentIndex] ?? tour.images[currentIndex];
    const total = tour.images.length;



    return (
        <div className="fixed inset-0 bg-black flex flex-col select-none overflow-hidden">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <header
                className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4"
                style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                        <Compass className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-white font-semibold tracking-tight text-lg">{tour.name}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1.5">
                    <MapPin className="h-3 w-3 text-white/70" />
                    <span className="text-white/70 text-xs font-mono">
                        {current.lat.toFixed(5)}, {current.lng.toFixed(5)}
                    </span>
                </div>
            </header>

            {/* ── 360° Viewer ────────────────────────────────────────────────── */}
            <div className="flex-1 relative overflow-hidden">
                {currentImageUrl ? (
                    <div style={{ position: "absolute", inset: 0, willChange: "transform, opacity", ...viewerStyle() }}>
                        <ReactPannellum
                            key={visibleIndex}
                            id={`viewer-${visibleIndex}`}
                            sceneId={`scene-${visibleIndex}`}
                            imageSource={currentImageUrl}
                            style={{ height: "100%", width: "100%" }}
                            config={{ autoLoad: true, showControls: false }}
                        />
                    </div>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
                    </div>
                )}
            </div>

            {/* ── Navigationspfeile ──────────────────────────────────────────── */}
            {total > 1 && (
                <button
                    onClick={goPrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white transition-all hover:bg-white/20 hover:scale-110 focus:outline-none"
                    aria-label="Vorheriges Bild"
                >
                    <ChevronLeft className="h-6 w-6" />
                </button>
            )}
            {total > 1 && (
                <button
                    onClick={goNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white transition-all hover:bg-white/20 hover:scale-110 focus:outline-none"
                    aria-label="Nächstes Bild"
                >
                    <ChevronRight className="h-6 w-6" />
                </button>
            )}

            {/* ── Karte-öffnen-Button (nur wenn mapOpen === false) ─────────────── */}
            {!mapOpen && (
                <button
                    onClick={() => setMapOpen(true)}
                    className="absolute z-30 bottom-6 left-5 flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 text-white text-xs font-medium hover:bg-white/20 transition-colors shadow"
                    title="Karte öffnen"
                >
                    <MapPin className="h-3.5 w-3.5" />
                    Karte anzeigen
                </button>
            )}

            {/* ── Mini-Map unten links ────────────────────────────────────────── */}
            {mapOpen && <div
                className="absolute z-30"
                style={{
                    bottom: 25,
                    left: 20,
                    width: 290,
                    height: 220,
                    borderRadius: 10,
                    overflow: "hidden",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.15)",
                }}
            >
                <MapContainer
                    center={[current.lat, current.lng]}
                    zoom={5}
                    style={{ height: "100%", width: "100%" }}
                    zoomControl={false}
                    attributionControl={false}
                    dragging={false}
                    scrollWheelZoom={false}
                    doubleClickZoom={false}
                    touchZoom={false}
                >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <FitBounds images={images} />
                    {images.map((img, i) => {
                        const isCurrent = i === currentIndex;
                        return (
                            <CircleMarker
                                key={i}
                                center={[img.lat, img.lng]}
                                radius={isCurrent ? 7 : 5}
                                pathOptions={{
                                    color: "#ffffff",
                                    fillColor: isCurrent ? "#f97316" : "#3b82f6",
                                    fillOpacity: 1,
                                    weight: isCurrent ? 2 : 1.5,
                                }}
                            />
                        );
                    })}
                </MapContainer>

                {/* Schließen-Button oben links in der Mini-Map */}
                <button
                    onClick={() => setMapOpen(false)}
                    className="absolute top-1.5 left-1.5 z-[400] flex h-6 w-6 items-center justify-center rounded bg-white/80 text-neutral-800 hover:bg-white transition-colors shadow"
                    title="Karte schließen"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
                {/* Vergrößern-Button oben rechts in der Mini-Map */}
                <button
                    onClick={() => setMapOpenBig(true)}
                    className="absolute top-1.5 right-1.5 z-[400] flex h-6 w-6 items-center justify-center rounded bg-white/80 text-neutral-800 hover:bg-white transition-colors shadow"
                    title="Karte vergrößern"
                >
                    <Maximize2 className="h-3.5 w-3.5" />
                </button>
            </div>}

            {/* ── Große Kartenansicht als Portal (gleiche Größe wie Viewer360) ── */}
            {mapOpenBig && createPortal(
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 99999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(0,0,0,0.7)",
                        backdropFilter: "blur(4px)",
                    }}
                    onClick={() => setMapOpenBig(false)}
                >
                    <div
                        style={{
                            position: "relative",
                            width: "85vw",
                            height: "80vh",
                            borderRadius: 12,
                            overflow: "hidden",
                            boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Schließen-Button */}
                        <button
                            onClick={() => setMapOpenBig(false)}
                            style={{
                                position: "absolute",
                                top: 12,
                                right: 12,
                                zIndex: 400,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 12px",
                                borderRadius: 6,
                                fontSize: 13,
                                fontWeight: 500,
                                backgroundColor: "rgba(0,0,0,0.5)",
                                color: "white",
                                border: "1px solid rgba(255,255,255,0.3)",
                                cursor: "pointer",
                            }}
                        >
                            <X style={{ width: 14, height: 14 }} />
                            Schließen
                        </button>

                        <MapContainer
                            center={[current.lat, current.lng]}
                            zoom={10}
                            style={{ height: "100%", width: "100%" }}
                            zoomControl={true}
                            attributionControl={true}
                        >
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <FitBounds images={images} />
                            {images.map((img, i) => {
                                const isCurrent = i === currentIndex;
                                return (
                                    <CircleMarker
                                        key={i}
                                        center={[img.lat, img.lng]}
                                        radius={isCurrent ? 12 : 8}
                                        pathOptions={{
                                            color: "#ffffff",
                                            fillColor: isCurrent ? "#f97316" : "#3b82f6",
                                            fillOpacity: 1,
                                            weight: isCurrent ? 2.5 : 2,
                                        }}
                                        eventHandlers={{
                                            click: () => {
                                                goTo(i);
                                                setMapOpenBig(false);
                                            },
                                        }}
                                    >
                                        <Popup>
                                            <div style={{ minWidth: 140 }}>
                                                <p style={{ fontWeight: 600, fontSize: 13, margin: "0 0 4px" }}>
                                                    Bild {i + 1}{isCurrent ? " · aktuell" : ""}
                                                </p>
                                                <p style={{ fontSize: 11, color: "#666", margin: "0 0 8px" }}>
                                                    {img.filename ?? img.file.name}
                                                </p>
                                                {!isCurrent && (
                                                    <button
                                                        style={{
                                                            padding: "4px 10px",
                                                            background: "#3b82f6",
                                                            color: "white",
                                                            border: "none",
                                                            borderRadius: 6,
                                                            fontSize: 11,
                                                            cursor: "pointer",
                                                            width: "100%",
                                                        }}
                                                        onClick={() => { goTo(i); setMapOpenBig(false); }}
                                                    >
                                                        Zu diesem Bild
                                                    </button>
                                                )}
                                            </div>
                                        </Popup>
                                    </CircleMarker>
                                );
                            })}
                        </MapContainer>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default TourViewer;