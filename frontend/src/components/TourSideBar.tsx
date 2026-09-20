import { Ban, Globe, Lock, Route, Spline } from "lucide-react";
import type { TourSummary } from "@/types";

interface TourSideBarProps {
    tours: TourSummary[];
    onSelectTour: (tour: TourSummary) => void;
    onDeleteTour: (tour: TourSummary) => void | Promise<void>;
}

const dateFormat = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});

const TourSidebar = ({ tours, onSelectTour, onDeleteTour }: TourSideBarProps) => {
    if (tours.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Route className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                    Du hast noch keine Touren erstellt
                </p>
            </div>
        );
    }

    return (
        <>
            {tours.map((tour) => (
                <div
                    key={tour.id}
                    onClick={() => onSelectTour(tour)}
                    className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-background p-3 cursor-pointer transition-colors hover:bg-muted hover:border-primary/30 group"
                >
                    <Spline className="h-10 w-10 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground break-words">{tour.name}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{dateFormat.format(new Date(tour.createdAt))}</span>
                            {tour.isPublic && (
                                <>
                                    <span aria-hidden>·</span>
                                    <Globe className="h-3 w-3" />
                                    <span>Öffentlich</span>
                                </>
                            )}
                            {tour.hasPassword && (
                                <>
                                    <span aria-hidden>·</span>
                                    <Lock className="h-3 w-3" />
                                    <span className="sr-only">Passwortgeschützt</span>
                                </>
                            )}
                        </p>
                    </div>
                    <Ban
                        className="h-4 w-4 shrink-0 text-muted-foreground/30 hover:text-destructive transition-colors cursor-pointer"
                        onClick={(event) => {
                            event.stopPropagation();
                            void onDeleteTour(tour);
                        }}
                    />
                </div>
            ))}
            <div className="flex items-center w-full justify-center">
                <p className="text-xs text-muted-foreground">Neue Tour mit + erstellen</p>
            </div>
        </>
    );
};

export default TourSidebar;