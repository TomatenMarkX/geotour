import { useCallback, type RefObject } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable, isSortable } from "@dnd-kit/react/sortable";
import { FileImage, GripVertical, Trash } from "lucide-react";
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
    onReorder: (reordered: TourPhoto[]) => void;
}

type TourImageRowProps = {
    photo: TourPhoto;
    isSelected: boolean;
    isHovered: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onHover: (hovering: boolean) => void;
    itemRefs: RefObject<Map<string, HTMLDivElement>>;
    index: number;
};

/**
 * Einzelne Zeile. Das Bild kommt als presigned URL direkt vom Objektspeicher —
 * kein Blob-Download mehr, also auch kein IntersectionObserver und kein
 * revokeObjectURL. Das Verzögern übernimmt der Browser über loading="lazy".
 */
const TourImageRow = ({
                          photo,
                          index,
                          isSelected,
                          isHovered,
                          onSelect,
                          onDelete,
                          onHover,
                          itemRefs,
                      }: TourImageRowProps) => {
    const { ref, handleRef, isDragging } = useSortable({ id: photo.id, index })

    // Callback-Ref: trägt die Zeile in die gemeinsame Map ein und wieder aus.
    const setRowRef = useCallback(
        (element: HTMLDivElement | null) => {
            ref(element)
            const map = itemRefs.current;
            if (!map) return;
            if (element) map.set(photo.id, element);
            else map.delete(photo.id);
        },
        [ref, itemRefs, photo.id],
    );

    return (
        <div
            ref={setRowRef}
            className={`mb-2 flex items-center gap-3 rounded-lg border bg-background p-2.5 transition-colors group
                ${isDragging ? "opacity-60 shadow-lg" : ""}
                ${isSelected ? "border-orange-500 bg-orange-100 ring-2 ring-orange-400"
                : isHovered ? "border-orange-400 bg-orange-50 ring-1 ring-orange-300"
                    : "border-border"}`}
            onDoubleClick={onSelect}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
        >
            <button
                ref={handleRef}
                className="cursor-grab touch-none text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
                aria-label="Foto verschieben"
            >
                <GripVertical className="h-4 w-4" />
            </button>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
                <FileImage className="h-5 w-5 text-muted-foreground"/>
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground break-words">Foto {index + 1}</p>
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
                              onReorder,
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
        <DragDropProvider
            onDragEnd={(event) => {
                if (event.canceled) return;                 // Escape → dnd-kit setzt DOM selbst zurück
                const { source } = event.operation;
                if (!isSortable(source)) return;

                const { initialIndex, index } = source;
                if (initialIndex === index) return;

                const reordered = [...photos];
                const [moved] = reordered.splice(initialIndex, 1);
                reordered.splice(index, 0, moved);
                onReorder(reordered);
            }}
        >
            {photos.map((photo, index) => (
                <TourImageRow
                    key={photo.id}
                    photo={photo}
                    index={index}
                    isSelected={selectedPhotoId === photo.id}
                    isHovered={hoveredPhotoId === photo.id}
                    onSelect={() => onSelectPhoto(photo)}
                    onDelete={() => onDeletePhoto(photo)}
                    onHover={(hovering) => onHoverPhoto(hovering ? photo.id : null)}
                    itemRefs={itemRefs}
                />
            ))}
        </DragDropProvider>
    );
};

export default TourImageSideBar;