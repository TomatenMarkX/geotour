import { Camera, Upload } from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { PendingImage, UploadProgress } from "@/types";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface TourDialogProps {
    open: boolean;
    tourName: string;
    pendingTourImages: PendingImage[];
    onTourNameChange: (name: string) => void;
    onFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
    onCreate: () => void | Promise<void>;
    onClose: () => void;
    uploadedProgress?: UploadProgress | null;
}

const TourDialog = ({
                        open,
                        tourName,
                        pendingTourImages,
                        onTourNameChange,
                        onFileChange,
                        onCreate,
                        onClose,
                        uploadedProgress,
                    }: TourDialogProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isUploading = uploadedProgress !== null && uploadedProgress !== undefined;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Neue Tour</DialogTitle>
                    <DialogDescription>
                        Name der Tour eingeben
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Name der Tour"
                        value={tourName}
                        onChange={(e) => onTourNameChange(e.target.value)}
                        disabled={isUploading}
                    />
                </div>

                <div className="p-4">
                    <div className="rounded-xl border-2 border-dashed border-upload-border bg-muted/50 p-6 text-center transition-colors hover:bg-muted">
                        <Upload className="mx-auto mb-3 h-8 w-8 text-primary/60" />
                        <p className="text-sm font-semibold text-foreground">
                            Bilder hierher ziehen
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            oder klicken zum Auswählen
                        </p>
                        <Button
                            size="sm"
                            className="mt-3 gap-1.5"
                            disabled={isUploading}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Camera className="h-3.5 w-3.5" />
                            Dateien auswählen
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={onFileChange}
                        />
                    </div>
                    {pendingTourImages.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground text-center">
                            {pendingTourImages.length} Bild{pendingTourImages.length === 1 ? "" : "er"} ausgewählt
                        </p>
                    )}
                    {isUploading && uploadedProgress && (
                        <div className="mt-3 space-y-1.5">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Bilder werden hochgeladen…</span>
                                <span>{uploadedProgress.uploaded} / {uploadedProgress.total}</span>
                            </div>
                            <Progress
                                value={(uploadedProgress.uploaded / uploadedProgress.total) * 100}
                            />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button onClick={onClose} variant="outline" disabled={isUploading}>
                            Abbrechen
                        </Button>
                    </DialogClose>
                    <Button onClick={() => void onCreate()} disabled={isUploading || !tourName.trim()}>
                        {isUploading ? "Wird hochgeladen…" : "Erstellen"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default TourDialog;