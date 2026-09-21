import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Compass, FolderOpenDot, LogOut, Plus, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import Viewer360 from "@/components/Viewer360";
import GoogleIcon from "@/components/pictures/google-icon-logo-svgrepo-com.svg";
import type { PendingImage, TourPhoto, TourSummary, UploadProgress } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { readGeotaggedImages, revokePreviews } from "@/lib/exif";
import {
    createTour,
    deletePhoto,
    deleteTour,
    loadTourPhotos,
    loadTours,
    renameTour,
    setTourPrivacy,
    shareUrl,
    uploadPhotos,
} from "@/services/tourService";
import TourSidebar from "@/components/TourSideBar";
import TourImageSideBar from "@/components/TourImageSideBar";
import TourDialog from "@/components/TourDialog";
import NoActiveUserView from "@/components/NoActiveUserView";
import { TourSettingsDialog } from "@/components/TourSettingsDialog";
import PhotoDialog from "@/components/ui/PhotoDialog.tsx";
import {
    DropdownMenu,
    DropdownMenuContent, DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type MapPoint = {
    id: string;
    lat: number;
    lng: number;
    label: string;
    url: string;
};

const pointOfPhoto = (photo: TourPhoto): MapPoint => ({
    id: photo.id,
    lat: photo.lat,
    lng: photo.lng,
    label: `Foto ${photo.position + 1}`,
    url: photo.url,
});

// Die blob:-URL ist pro Datei eindeutig und taugt damit als Identität.
const pointOfPending = (image: PendingImage): MapPoint => ({
    id: image.previewUrl,
    lat: image.lat,
    lng: image.lng,
    label: image.file.name,
    url: image.previewUrl,
});

// ── Haupt-App ─────────────────────────────────────────────────────────────────
const App = () => {
    const { user, status, loginWithGoogle, logout } = useAuth();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const sidebarWidthRef = useRef(340);
    const isDragging = useRef(false);
    const isDraggingTour = useRef(false);
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const handleMouseMoveRef = useRef<((event: MouseEvent) => void) | null>(null);

    const [sidebarWidth, setSidebarWidth] = useState(340);
    const [tourSideBarWidth, setTourSideBarWidth] = useState(320);

    // Anonyme Ansicht: lokal gewählte Bilder ohne Tour
    const [files, setFiles] = useState<PendingImage[]>([]);
    // Tour-Dialog: Bilder, die mit der neuen Tour hochgeladen werden
    const [pendingTourImages, setPendingTourImages] = useState<PendingImage[]>([]);

    const [tours, setTours] = useState<TourSummary[]>([]);
    const [activeTour, setActiveTour] = useState<TourSummary | null>(null);
    const [photos, setPhotos] = useState<TourPhoto[]>([]);

    const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
    const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

    const [tourDialogOpen, setTourDialogOpen] = useState(false);
    const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
    const [tourName, setTourName] = useState("");
    const [tourLinkCopied, setTourLinkCopied] = useState(false);
    const [uploadedProgress, setUploadedProgress] = useState<UploadProgress | null>(null);
    const [error, setError] = useState<string | null>(null);

    const points = useMemo<MapPoint[]>(
        () => (activeTour ? photos.map(pointOfPhoto) : files.map(pointOfPending)),
        [activeTour, photos, files],
    );

    const selectedPoint = points.find((point) => point.id === selectedPointId) ?? null;

    // ── Laden ───────────────────────────────────────────────────────────────────

    /**
     * Ohne Abhängigkeit auf activeTour: die Aktualisierung läuft über den
     * Updater, sonst hängt der Callback an einem veralteten Closure.
     */
    const handleLoadTours = useCallback(async () => {
        try {
            const { tours: loaded } = await loadTours();
            setTours(loaded);
            setActiveTour((previous) =>
                previous ? (loaded.find((tour) => tour.id === previous.id) ?? null) : null,
            );
        } catch (cause: unknown) {
            setError(`Touren konnten nicht geladen werden: ${String(cause)}`);
        }
    }, []);

    useEffect(() => {
        if (!user) {
            setTours([]);
            setActiveTour(null);
            setTourName("");
            return;
        }
        void handleLoadTours();
    }, [user, handleLoadTours]);

    // Fotos hängen nicht mehr an der Tour, sie werden pro Tour nachgeladen.
    useEffect(() => {
        if (!activeTour) {
            setPhotos([]);
            return;
        }
        let cancelled = false;
        void loadTourPhotos(activeTour.id)
            .then((loaded) => {
                if (!cancelled) setPhotos(loaded);
            })
            .catch((cause: unknown) => {
                if (!cancelled) setError(`Fotos konnten nicht geladen werden: ${String(cause)}`);
            });
        return () => {
            cancelled = true;
        };
    }, [activeTour?.id]);

    useEffect(() => {
        setSelectedPointId(null);
        setHoveredPointId(null);
    }, [activeTour?.id]);

    // ── Karten-Helfer ───────────────────────────────────────────────────────────

    function ResizeMap({ trigger }: { trigger: number }) {
        const map = useMap();
        useEffect(() => {
            const timer = setTimeout(() => map.invalidateSize(), 100);
            return () => clearTimeout(timer);
        }, [map, trigger]);
        return null;
    }

    function FitBounds({ points: bounds }: { points: MapPoint[] }) {
        const map = useMap();
        useEffect(() => {
            if (bounds.length === 0) return;
            map.fitBounds(
                bounds.map((point) => [point.lat, point.lng] as [number, number]),
                { padding: [40, 40] },
            );
        }, [bounds.length]);
        return null;
    }

    // ── Sidebar-Resizing ────────────────────────────────────────────────────────

    useEffect(() => {
        sidebarWidthRef.current = sidebarWidth;
    }, [sidebarWidth]);

    handleMouseMoveRef.current = (event: MouseEvent) => {
        if (isDragging.current) {
            setSidebarWidth(Math.max(200, Math.min(600, event.clientX)));
        }
        if (isDraggingTour.current) {
            setTourSideBarWidth(
                Math.max(200, Math.min(600, event.clientX - sidebarWidthRef.current - 4)),
            );
        }
    };

    useEffect(() => {
        const onMove = (event: MouseEvent) => handleMouseMoveRef.current?.(event);
        const onUp = () => {
            isDragging.current = false;
            isDraggingTour.current = false;
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, []);

    const handleMouseDown = () => {
        isDragging.current = true;
    };

    const handleTourMouseDown = () => {
        isDraggingTour.current = true;
    };

    // ── Touren ──────────────────────────────────────────────────────────────────

    const handleNewTour = () => setTourDialogOpen(true);

    const handleCreateTour = async () => {
        if (!tourName.trim()) return;
        setError(null);
        try {
            const tour = await createTour(tourName);
            if (pendingTourImages.length > 0) {
                setUploadedProgress({ uploaded: 0, total: pendingTourImages.length });
                await uploadPhotos(tour.id, pendingTourImages, setUploadedProgress);
            }
            revokePreviews(pendingTourImages);
            setPendingTourImages([]);
            setTourDialogOpen(false);
            setTourName("");
            await handleLoadTours();
        } catch (cause: unknown) {
            setError(`Tour konnte nicht angelegt werden: ${String(cause)}`);
        } finally {
            setUploadedProgress(null);
        }
    };

    const handleAddPhoto = async () => {
        try {
            if (pendingTourImages.length > 0) {
                setUploadedProgress({ uploaded:0, total: pendingTourImages.length });
                await uploadPhotos(activeTour.id, pendingTourImages, setUploadedProgress);
            }
            revokePreviews(pendingTourImages);
            setPendingTourImages([]);
            setPhotoDialogOpen(false)
            setTourName("");
            await handleLoadTours();
        }
        catch (cause: unknown) {
            setError(`Fehler beim Hochladen der Fotos: ${String(cause)}`);
        } finally {
            setUploadedProgress(null);
        }
    };

    const handleDeleteTour = async (tour: TourSummary) => {
        try {
            await deleteTour(tour.id);
            await handleLoadTours();
        } catch (cause: unknown) {
            setError(`Tour konnte nicht gelöscht werden: ${String(cause)}`);
        }
    };

    const handleRenameTour = async (tourId: string, newName: string) => {
        await renameTour(tourId, newName);
        await handleLoadTours();
    };

    const handleVisibilityChange = async (tourId: string, isPublic: boolean) => {
        await setTourPrivacy(tourId, isPublic);
        await handleLoadTours();
    };

    /** Macht die Tour öffentlich, kopiert den Link und aktualisiert die Liste. */
    const handleExportTour = async () => {
        if (!activeTour) return;
        try {
            const { shareToken } = await setTourPrivacy(activeTour.id, true);
            if (shareToken) {
                // Clipboard API braucht einen Secure Context — über http ausserhalb
                // von localhost schlägt das still fehl.
                await navigator.clipboard.writeText(shareUrl(shareToken));
                setTourLinkCopied(true);
                setTimeout(() => setTourLinkCopied(false), 2000);
            }
            await handleLoadTours();
        } catch (cause: unknown) {
            setError(`Link konnte nicht erzeugt werden: ${String(cause)}`);
        }
    };

    // ── Fotos ───────────────────────────────────────────────────────────────────

    const handleSelectPhoto = (photo: TourPhoto) => setSelectedPointId(photo.id);

    const handleDeletePhoto = async (photo: TourPhoto) => {
        if (!activeTour) return;
        try {
            await deletePhoto(activeTour.id, photo.id);
            setPhotos(await loadTourPhotos(activeTour.id));
            setSelectedPointId((current) => (current === photo.id ? null : current));
        } catch (cause: unknown) {
            setError(`Foto konnte nicht gelöscht werden: ${String(cause)}`);
        }
    };

    // ── Dateiauswahl ────────────────────────────────────────────────────────────

    const handleOpenFileDialog = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const scan = await readGeotaggedImages(event.target.files);
        setFiles((previous) => [...previous, ...scan.images]);
        if (scan.skipped.length > 0) {
            setError(`${scan.skipped.length} Bild(er) ohne GPS-Daten übersprungen`);
        }
        event.target.value = "";
    };

    const handleTourFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const scan = await readGeotaggedImages(event.target.files);
        setPendingTourImages((previous) => [...previous, ...scan.images]);
        if (scan.skipped.length > 0) {
            setError(`${scan.skipped.length} Bild(er) ohne GPS-Daten übersprungen`);
        }
        event.target.value = "";
    };

    const handleFileDelete = (index: number) => {
        setFiles((previous) => {
            const removed = previous[index];
            if (removed) URL.revokeObjectURL(removed.previewUrl);
            return previous.filter((_, position) => position !== index);
        });
    };

    const handleDialogClose = () => {
        revokePreviews(pendingTourImages);
        setTourDialogOpen(false);
        setTourName("");
        setPendingTourImages([]);
        setUploadedProgress(null);
    };

    // ── Render ──────────────────────────────────────────────────────────────────

    return (
        <div className="h-screen bg-background font-sans">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                            <Compass className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-foreground">TourCreator</h1>
                            <p className="text-xs text-muted-foreground">
                                Fotos mit Geodaten auf einer Karte anzeigen
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={!activeTour}
                            onClick={handleExportTour}
                            title={activeTour ? "Tour teilen" : "Erst eine Tour auswählen"}
                        >
                            {tourLinkCopied ? (
                                <>
                                    <Check className="h-3.5 w-3.5 text-green-500" /> Link kopiert!
                                </>
                            ) : (
                                <>
                                    <Share2 className="h-3.5 w-3.5" /> Tour teilen
                                </>
                            )}
                        </Button>
                        {activeTour && (
                            <TourSettingsDialog
                                tour={activeTour}
                                photoCount={photos.length}
                                onRename={handleRenameTour}
                                onVisibilityChange={handleVisibilityChange}
                                onDelete={handleDeleteTour}
                            />
                        )}
                        {user ? (
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void logout()}>
                                <LogOut className="h-3.5 w-3.5" />
                                Abmelden
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={status === "loading"}
                                onClick={loginWithGoogle}
                            >
                                <img src={GoogleIcon} className="h-4 w-4" alt="Google" />
                                Mit Google anmelden
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            {error && (
                <div className="flex items-center justify-between border-b border-destructive/30 bg-destructive/10 px-6 py-2">
                    <p className="text-sm text-destructive">{error}</p>
                    <Button variant="ghost" size="sm" onClick={() => setError(null)}>
                        Schließen
                    </Button>
                </div>
            )}

            <div className="flex w-full gap-0 p-0" style={{ height: "calc(100vh - 73px)" }}>
                <aside
                    style={{ width: sidebarWidth }}
                    className="relative z-20 flex shrink-0 flex-col border-r border-border bg-card"
                >
                    {user ? (
                        <>
                            <div className="flex items-center justify-between px-4 py-3">
                                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <FolderOpenDot className="h-4 w-4 text-primary" />
                                    Meine Touren
                                </h2>
                                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleNewTour}>
                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </div>
                            <TourDialog
                                open={tourDialogOpen}
                                tourName={tourName}
                                pendingTourImages={pendingTourImages}
                                onTourNameChange={setTourName}
                                onFileChange={handleTourFileChange}
                                onCreate={handleCreateTour}
                                onClose={handleDialogClose}
                                uploadedProgress={uploadedProgress}
                            />
                            <ScrollArea className="flex-1 px-4 pb-4">
                                <TourSidebar
                                    tours={tours}
                                    onSelectTour={setActiveTour}
                                    onDeleteTour={handleDeleteTour}
                                />
                            </ScrollArea>
                        </>
                    ) : (
                        <NoActiveUserView
                            handleOpenFileDialog={handleOpenFileDialog}
                            fileInputRef={fileInputRef}
                            handleFileChange={handleFileChange}
                            files={files}
                            handleFileDelete={handleFileDelete}
                            hoveredFileId={hoveredPointId}
                            onHoverFile={setHoveredPointId}
                            itemRefs={itemRefs}
                        />
                    )}
                </aside>

                <div
                    onMouseDown={handleMouseDown}
                    className="w-1 cursor-col-resize bg-border hover:bg-primary/50"
                />

                <div
                    style={{ width: user && activeTour ? tourSideBarWidth + 4 : 0 }}
                    className="flex shrink-0 overflow-hidden transition-[width] duration-500 ease-in-out"
                >
                    <aside
                        style={{ width: tourSideBarWidth }}
                        className={`flex h-full min-w-0 flex-col overflow-hidden border-r border-border bg-card ${
                            user && activeTour ? "translate-x-0" : "-translate-x-full"
                        }`}
                    >
                        <div className="flex shrink-0 items-center justify-between px-4 py-3">
                            <h2 className="truncate text-sm font-semibold text-foreground">{activeTour?.name}</h2>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-1.5">
                                        <Plus className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-40" align="start">
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>Bilder hinzufügen</DropdownMenuLabel>
                                        <DropdownMenuItem disabled>
                                            Bilder am Ende hinzufügen
                                        </DropdownMenuItem>
                                        <DropdownMenuItem disabled>
                                            Bilder am Anfang hinzufügen
                                        </DropdownMenuItem>
                                        <DropdownMenuItem disabled>
                                            Bilder in passende Reihenfolge hinzufügen
                                        </DropdownMenuItem>
                                        <DropdownMenuItem disabled>
                                            Erweiterte Anzeige
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>


                            <Button variant="ghost" size="sm" onClick={() => setActiveTour(null)}>
                                Schließen
                            </Button>
                        </div>
                        <PhotoDialog
                            open={photoDialogOpen}
                            tourname={activeTour.name?}
                            pendingImages={pendingTourImages}
                            onFileChange={handleFileChange}
                            onAdd={handleAddPhoto}
                            onClose={() => setPhotoDialogOpen(false)}
                            uploadedProgress={uploadedProgress}
                        />

                        <Separator />

                        <ScrollArea className="flex-1 overflow-hidden px-4 pb-4 pt-4">
                            <TourImageSideBar
                                photos={photos}
                                selectedPhotoId={selectedPointId}
                                hoveredPhotoId={hoveredPointId}
                                onSelectPhoto={handleSelectPhoto}
                                onDeletePhoto={handleDeletePhoto}
                                onHoverPhoto={setHoveredPointId}
                                itemRefs={itemRefs}
                            />
                        </ScrollArea>
                    </aside>
                    <div
                        onMouseDown={handleTourMouseDown}
                        className="w-1 cursor-col-resize bg-border hover:bg-primary/50"
                    />
                </div>

                <main className="flex flex-1 flex-col min-h-0 overflow-hidden">
                    <div className="relative flex-1 min-h-0 bg-slate-100">
                        {points.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                Bilder laden oder Tour auswählen
                            </div>
                        ) : (
                            <div className="absolute inset-0 overflow-hidden">
                                <MapContainer
                                    center={[0, 0]}
                                    zoom={2}
                                    style={{ height: "100%", width: "100%" }}
                                    className="h-full w-full"
                                    doubleClickZoom={false}
                                >
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                    <ResizeMap
                                        trigger={sidebarWidth + tourSideBarWidth + points.length + (activeTour ? 1 : 0)}
                                    />
                                    <FitBounds points={points} />
                                    {points.map((point) => {
                                        const isSelected = selectedPointId === point.id;
                                        const isHovered = hoveredPointId === point.id;
                                        return (
                                            <CircleMarker
                                                key={point.id}
                                                center={[point.lat, point.lng] as [number, number]}
                                                radius={isHovered || isSelected ? 12 : 8}
                                                pathOptions={{
                                                    color: isHovered || isSelected ? "#c2410c" : "#ffffff",
                                                    fillColor: isSelected
                                                        ? "#ea580c"
                                                        : isHovered
                                                            ? "#f97316"
                                                            : "#3b82f6",
                                                    fillOpacity: 1,
                                                    weight: isHovered || isSelected ? 3 : 2,
                                                }}
                                                eventHandlers={{
                                                    dblclick: (event) => {
                                                        event.originalEvent.stopPropagation();
                                                        setSelectedPointId(point.id);
                                                    },
                                                    mouseover: () => {
                                                        setHoveredPointId(point.id);
                                                        itemRefs.current
                                                            .get(point.id)
                                                            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                                    },
                                                    mouseout: () => setHoveredPointId(null),
                                                }}
                                            >
                                                <Popup>{point.label}</Popup>
                                            </CircleMarker>
                                        );
                                    })}
                                </MapContainer>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {selectedPoint &&
                createPortal(
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
                        onClick={() => setSelectedPointId(null)}
                    >
                        <div
                            style={{
                                position: "relative",
                                width: "85vw",
                                height: "80vh",
                                borderRadius: "12px",
                                overflow: "hidden",
                                boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
                            }}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                style={{
                                    position: "absolute",
                                    top: 12,
                                    right: 12,
                                    zIndex: 10,
                                    backgroundColor: "rgba(0,0,0,0.5)",
                                    color: "white",
                                    borderColor: "rgba(255,255,255,0.3)",
                                }}
                                onClick={() => setSelectedPointId(null)}
                            >
                                ✕ Schließen
                            </Button>
                            <Viewer360 imageUrl={selectedPoint.url} />
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
};

export default App;