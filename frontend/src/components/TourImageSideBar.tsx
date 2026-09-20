import { useEffect, useRef, useState } from "react";
import { ImageFile, Tour } from "@/types";
import { Trash } from "lucide-react";
import { fetchImageBlob } from "@/services/tourService";

interface TourImageSideBarProps {
    activeTour: Tour | null;
    setSelectedFile: (image: ImageFile) => Promise<void>;
    handleDeleteTourImage: (image: ImageFile) => void;
    selectedFile: ImageFile | null;
    hoveredFile: ImageFile | null;
    token: string | undefined;
}

// Einzelne Zeile — lädt ihr Bild selbst wenn sichtbar
const TourImageRow = ({
                          image,
                          index,
                          isSelected,
                          isHovered,
                          token,
                          onDoubleClick,
                          onDelete,
                      }: {
    image: ImageFile;
    index: number;
    isSelected: boolean;
    isHovered: boolean;
    token: string | undefined;
    onDoubleClick: () => void;
    onDelete: () => void;
}) => {
    const [thumbUrl, setThumbUrl] = useState<string | null>(
        image.previewUrl?.startsWith("blob:") ? image.previewUrl : null
    );
    const ref = useRef<HTMLDivElement>(null);
    const loadedRef = useRef(false);

    useEffect(() => {
        if (thumbUrl || loadedRef.current) return;

        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            async (entries) => {
                if (!entries[0].isIntersecting) return;
                observer.disconnect();
                if (loadedRef.current) return;
                loadedRef.current = true;

                const filename = image.filename ?? image.file.name;
                const url = await fetchImageBlob(filename, async () => token);
                if (url) setThumbUrl(url);
            },
            { rootMargin: "300px" } // 300px Vorsprung
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [image, token, thumbUrl]);

    // Blob-URL freigeben beim Unmount
    useEffect(() => {
        return () => {
            if (thumbUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(thumbUrl);
            }
        };
    }, [thumbUrl]);

    return (
        <div
            ref={ref}
            className={`mb-2 flex items-center gap-3 rounded-lg border bg-background p-2.5 cursor-pointer transition-colors group
                ${isSelected
                ? "border-orange-400 bg-orange-50 ring-1 ring-orange-300"
                : isHovered
                    ? "border-primary/40 bg-muted"
                    : "border-border hover:bg-muted hover:border-primary/30"
            }`}
            onDoubleClick={onDoubleClick}
        >
            {/* Thumbnail mit Skeleton */}
            <div className="h-12 w-12 shrink-0 rounded-md overflow-hidden bg-muted relative">
                {!thumbUrl && (
                    <div className="absolute inset-0 animate-pulse bg-muted-foreground/10" />
                )}
                {thumbUrl && (
                    <img
                        src={thumbUrl}
                        alt={image.file.name}
                        className="h-full w-full object-cover"
                    />
                )}
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground break-words">
                    {image.file.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {image.file.size > 0 ? `${(image.file.size / 1024).toFixed(1)} KB` : `Bild ${index + 1}`}
                </p>
            </div>

            <Trash
                className="h-4 w-4 shrink-0 text-muted-foreground/30 hover:text-destructive transition-colors cursor-pointer"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
            />
        </div>
    );
};

// ── Hauptkomponente ───────────────────────────────────────────────────────────
const TourImageSideBar = ({
                              activeTour,
                              setSelectedFile,
                              handleDeleteTourImage,
                              selectedFile,
                              hoveredFile,
                              token,
                          }: TourImageSideBarProps) => {
    if (!activeTour || !activeTour.images || activeTour.images.length === 0) {
        return (
            <div className="py-8 text-sm text-muted-foreground">
                Keine Bilder in dieser Tour
            </div>
        );
    }

    return (
        <>
            {activeTour.images.map((image, index) => (
                <TourImageRow
                    key={`${activeTour.id}-${index}`}
                    image={image}
                    index={index}
                    isSelected={selectedFile === image}
                    isHovered={hoveredFile === image}
                    token={token}
                    onDoubleClick={() => setSelectedFile(image)}
                    onDelete={() => handleDeleteTourImage(image)}
                />
            ))}
        </>
    );
};

export default TourImageSideBar;