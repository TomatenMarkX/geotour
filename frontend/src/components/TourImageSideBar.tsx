import { useCallback, useState, type RefObject } from "react";
import { Trash } from "lucide-react";
import type { TourPhoto } from "@/types";

interface TourImageSideBarProps {
    photos: TourPhoto[];
    selectedPhotoId: string | null;
    hoveredPhotoId: string | null;
    onSelectPhoto: (photo: TourPhoto) => void;
    onDeletePhoto: (photo: TourPhoto) => void | Promise<void>;
    /** Meldet Hover in Richtung Karte: Foto-ID beim Betreten, null beim Verlassen. */
    onHoverPhoto: (photoId: string | null) => void;
    /** Wird von der Karte benutzt, um beim Hover zur passenden Zeile zu scrollen. */
    itemRefs: RefObject<Map<string, HTMLDivElement>>;
}

type TourImageRowProps = {
    photo: TourPhoto;
    isSelected: boolean;
    isHovered: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onHover: (hovering: boolean) => void;
    itemRefs: RefObject<Map<string, HTMLDivElement>>;
};

/**
 * Einzelne Zeile. Das Bild kommt als presigned URL direkt vom Objektspeicher —
 * kein Blob-Download mehr, also auch kein IntersectionObserver und kein
 * revokeObjectURL. Das Verzögern übernimmt der Browser über loading="lazy".
 */
const TourImageRow = ({
                          photo,
                          isSelected,
                          isHovered,
                          onSelect,
                          onDelete,
                          onHover,
                          itemRefs,
                      }: TourImageRowProps) => {
    const [loaded, setLoaded] = useState(false);

    // Callback-Ref: trägt die Zeile in die gemeinsame Map ein und wieder aus.
    const setRowRef = useCallback(
        (element: HTMLDivElement | null) => {
            const map = itemRefs.current;
            if (!map) return;
            if (element) map.set(photo.id, element);
            else map.delete(photo.id);
        },
        [itemRefs, photo.id],
    );

    return (
        <div
            ref={setRowRef}
            className={`mb-2 flex items-center gap-3 rounded-lg border bg-background p-2.5 cursor-pointer transition-colors group
                ${
                isSelected
                    ? "border-orange-500 bg-orange-100 ring-2 ring-orange-400"
                    : isHovered
                        ? "border-orange-400 bg-orange-50 ring-1 ring-orange-300"
                        : "border-border"
            }`}
            onDoubleClick={onSelect}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
        >
            <div className="h-12 w-12 shrink-0 rounded-md overflow-hidden bg-muted relative">
                {!loaded && <div className="absolute inset-0 animate-pulse bg-muted-foreground/10" />}
                <img
                    src={photo.url}
                    alt={`Foto ${photo.position + 1}`}
                    loading="lazy"
                    decoding="async"
                    onLoad={() => setLoaded(true)}
                    className={`h-full w-full object-cover transition-opacity ${
                        loaded ? "opacity-100" : "opacity-0"
                    }`}
                />
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground break-words">
                    Foto {photo.position + 1}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {photo.lat.toFixed(5)}, {photo.lng.toFixed(5)}
                </p>
            </div>

            <Trash
                className="h-4 w-4 shrink-0 text-muted-foreground/30 hover:text-destructive transition-colors cursor-pointer"
                onClick={(event) => {
                    event.stopPropagation();
                    void onDelete();
                }}
            />
        </div>
    );
};

// ── Hauptkomponente ───────────────────────────────────────────────────────────
const TourImageSideBar = ({
                              photos,
                              selectedPhotoId,
                              hoveredPhotoId,
                              onSelectPhoto,
                              onDeletePhoto,
                              onHoverPhoto,
                              itemRefs,
                          }: TourImageSideBarProps) => {
    if (photos.length === 0) {
        return <div className="py-8 text-sm text-muted-foreground">Keine Bilder in dieser Tour</div>;
    }

    return (
        <>
            {photos.map((photo) => (
                <TourImageRow
                    key={photo.id}
                    photo={photo}
                    isSelected={selectedPhotoId === photo.id}
                    isHovered={hoveredPhotoId === photo.id}
                    onSelect={() => onSelectPhoto(photo)}
                    onDelete={() => onDeletePhoto(photo)}
                    onHover={(hovering) => onHoverPhoto(hovering ? photo.id : null)}
                    itemRefs={itemRefs}
                />
            ))}
        </>
    );
};

export default TourImageSideBar;