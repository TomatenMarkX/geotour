import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { sortByPosition, verifyTour } from "@/services/tourService";
import type { PublicTour, TourPhoto } from "@/types";
import Viewer360 from "@/components/Viewer360";
import {
    ChevronLeft,
    ChevronRight,
    MapPin,
    Compass,
    Loader2,
    AlertCircle,
    Maximize2,
    Lock,
    X,
} from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";

type Phase = "idle" | "zoomIn" | "black" | "zoomOut";
type Status = "loading" | "password" | "notFound" | "ready";

const ZOOM_IN_MS     = 600;
const BLACK_MS       = 80;
const ZOOM_OUT_MS    = 500;
const PRELOAD_AHEAD  = 2;
const PRELOAD_BEHIND = 1;

// ── FitBounds: Karte auf alle Punkte fitten ───────────────────────────────────
function FitBounds({ photos }: { photos: TourPhoto[] }) {
    const map = useMap();
    useEffect(() => {
        if (photos.length === 0) return;
        if (photos.length === 1) {
            map.setView([photos[0].lat, photos[0].lng], 14);
            return;
        }
        map.fitBounds(photos.map((photo) => [photo.lat, photo.lng] as [number, number]), {
            padding: [40, 40],
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photos.length]);
    return null;
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
const TourViewer = () => {
    const { shareToken } = useParams<{ shareToken: string }>();

    const [status, setStatus]   = useState<Status>("loading");
    const [tour, setTour]       = useState<PublicTour | null>(null);
    const [photos, setPhotos]   = useState<TourPhoto[]>([]);
    const [passwordInput, setPasswordInput] = useState("");
    const [passwordWrong, setPasswordWrong] = useState(false);

    const [visibleIndex, setVisibleIndex] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [phase, setPhase]               = useState<Phase>("idle");
    const isAnimating = useRef(false);

    const [mapOpenBig, setMapOpenBig] = useState(false);
    const [mapOpen, setMapOpen]       = useState(true);

    /**
     * Kein Blob-Cache mehr: die Fotos sind presigned URLs, das Caching
     * übernimmt der Browser. Ein Image-Objekt anzulegen genügt, um das
     * Vorausladen anzustoßen.
     */
    const preloadAround = useCallback((index: number, list: TourPhoto[]) => {
        if (list.length === 0) return;
        const indices = new Set<number>([index]);
        for (let i = 1; i <= PRELOAD_AHEAD;  i++) indices.add((index + i) % list.length);
        for (let i = 1; i <= PRELOAD_BEHIND; i++) indices.add((index - i + list.length) % list.length);

        for (const i of indices) {
            const image = new Image();
            // Muss zum CORS-Modus von Pannellum passen, sonst landet der
            // Treffer im falschen Cache-Bucket und wird erneut geladen.
            image.crossOrigin = "anonymous";
            image.src = list[i].url;
        }
    }, []);

    const load = useCallback(async (password?: string) => {
        if (!shareToken) {
            setStatus("notFound");
            return;
        }
        setStatus("loading");
        try {
            const result = await verifyTour(shareToken, password);
            if (result.kind === "ok") {
                const ordered = sortByPosition(result.tour.photos);
                setTour(result.tour);
                setPhotos(ordered);
                setVisibleIndex(0);
                setCurrentIndex(0);
                preloadAround(0, ordered);
                setStatus("ready");
            } else if (result.kind === "password") {
                setPasswordWrong(result.wrong);
                setStatus("password");
            } else {
                setStatus("notFound");
            }
        } catch {
            setStatus("notFound");
        }
    }, [shareToken, preloadAround]);

    useEffect(() => {
        void load();
    }, [load]);

    const navigateTo = useCallback((nextIndex: number) => {
        if (isAnimating.current || photos.length === 0) return;
        isAnimating.current = true;
        setPhase("zoomIn");
        setTimeout(() => {
            setPhase("black");
            setVisibleIndex(nextIndex);
            setCurrentIndex(nextIndex);
            setTimeout(() => {
                setPhase("zoomOut");
                preloadAround(nextIndex, photos);
                setTimeout(() => {
                    setPhase("idle");
                    isAnimating.current = false;
                }, ZOOM_OUT_MS);
            }, BLACK_MS);
        }, ZOOM_IN_MS);
    }, [photos, preloadAround]);

    const goNext = useCallback(() => {
        if (photos.length === 0) return;
        navigateTo((currentIndex + 1) % photos.length);
    }, [photos.length, currentIndex, navigateTo]);

    const goPrev = useCallback(() => {
        if (photos.length === 0) return;
        navigateTo((currentIndex - 1 + photos.length) % photos.length);
    }, [photos.length, currentIndex, navigateTo]);

    const goTo = useCallback((index: number) => {
        if (index === currentIndex) return;
        navigateTo(index);
    }, [currentIndex, navigateTo]);

    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (mapOpenBig) {
                if (event.key === "Escape") setMapOpenBig(false);
                return;
            }
            if (event.key === "ArrowRight") goNext();
            if (event.key === "ArrowLeft")  goPrev();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [goNext, goPrev, mapOpenBig]);

    const viewerStyle = (): CSSProperties => {
        switch (phase) {
            case "zoomIn":  return { transform: "scale(2.5)", opacity: 0, transition: `transform ${ZOOM_IN_MS}ms cubic-bezier(0.4,0,1,1), opacity ${ZOOM_IN_MS}ms cubic-bezier(0.4,0,1,1)` };
            case "black":   return { transform: "scale(2.5)", opacity: 0, transition: "none" };
            case "zoomOut": return { transform: "scale(1)",   opacity: 1, transition: `transform ${ZOOM_OUT_MS}ms cubic-bezier(0,0,0.2,1), opacity ${ZOOM_OUT_MS * 0.6}ms ease-out` };
            default:        return { transform: "scale(1)",   opacity: 1, transition: "none" };
        }
    };

    // ── Zustände vor dem eigentlichen Viewer ────────────────────────────────────

    if (status === "loading") return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-black gap-4">
            <Loader2 className="h-10 w-10 text-white/60 animate-spin" />
            <p className="text-white/50 text-sm tracking-widest uppercase">Tour wird geladen …</p>
        </div>
    );

    if (status === "password") return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-black gap-5 px-6">
            <Lock className="h-10 w-10 text-white/40" />
            <p className="text-white/70 text-lg font-medium">Diese Tour ist passwortgeschützt</p>
            <form
                className="flex w-full max-w-sm flex-col gap-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    void load(passwordInput);
                }}
            >
                <input
                    type="password"
                    autoFocus
                    value={passwordInput}
                    onChange={(event) => setPasswordInput(event.target.value)}
                    placeholder="Passwort"
                    className="h-11 rounded-lg border border-white/20 bg-white/10 px-4 text-white placeholder:text-white/40 backdrop-blur-sm focus:border-white/40 focus:outline-none"
                />
                {passwordWrong && (
                    <p className="text-sm text-red-400">Falsches Passwort.</p>
                )}
                <button
                    type="submit"
                    className="h-11 rounded-lg bg-white font-medium text-neutral-900 transition-colors hover:bg-white/90"
                >
                    Tour öffnen
                </button>
            </form>
        </div>
    );

    if (status === "notFound" || !tour) return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-black gap-4">
            <AlertCircle className="h-12 w-12 text-white/40" />
            <p className="text-white/60 text-lg font-medium">Tour nicht gefunden</p>
            <p className="text-white/30 text-sm">Diese Tour existiert nicht oder ist nicht öffentlich.</p>
        </div>
    );

    if (photos.length === 0) return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-black gap-4">
            <MapPin className="h-12 w-12 text-white/40" />
            <p className="text-white/60 text-lg font-medium">{tour.name}</p>
            <p className="text-white/30 text-sm">Diese Tour enthält keine Bilder.</p>
        </div>
    );

    const current = photos[currentIndex] ?? photos[0];
    const currentImageUrl = (photos[visibleIndex] ?? photos[0]).url;
    const total = photos.length;

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
                <div style={{ position: "absolute", inset: 0, willChange: "transform, opacity", ...viewerStyle() }}>
                    <Viewer360 imageUrl={currentImageUrl} showControls={false} />
                </div>
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
                    <FitBounds photos={photos} />
                    {photos.map((photo, index) => {
                        const isCurrent = index === currentIndex;
                        return (
                            <CircleMarker
                                key={photo.id}
                                center={[photo.lat, photo.lng]}
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

            {/* ── Große Kartenansicht als Portal ───────────────────────────────── */}
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
                        onClick={(event) => event.stopPropagation()}
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
                            <FitBounds photos={photos} />
                            {photos.map((photo, index) => {
                                const isCurrent = index === currentIndex;
                                return (
                                    <CircleMarker
                                        key={photo.id}
                                        center={[photo.lat, photo.lng]}
                                        radius={isCurrent ? 12 : 8}
                                        pathOptions={{
                                            color: "#ffffff",
                                            fillColor: isCurrent ? "#f97316" : "#3b82f6",
                                            fillOpacity: 1,
                                            weight: isCurrent ? 2.5 : 2,
                                        }}
                                        eventHandlers={{
                                            click: () => {
                                                goTo(index);
                                                setMapOpenBig(false);
                                            },
                                        }}
                                    >
                                        <Popup>
                                            <div style={{ minWidth: 140 }}>
                                                <p style={{ fontWeight: 600, fontSize: 13, margin: "0 0 4px" }}>
                                                    Foto {index + 1}{isCurrent ? " · aktuell" : ""}
                                                </p>
                                                <p style={{ fontSize: 11, color: "#666", margin: "0 0 8px" }}>
                                                    {photo.lat.toFixed(5)}, {photo.lng.toFixed(5)}
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
                                                        onClick={() => { goTo(index); setMapOpenBig(false); }}
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