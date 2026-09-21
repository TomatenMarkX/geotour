import type { PendingImage, UploadProgress } from "@/types";
import { useRef, type ChangeEvent } from "react";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {Camera, Upload} from "lucide-react";
import {Button} from "@/components/ui/button.tsx";
import {Progress} from "@/components/ui/progress.tsx";

interface PhotoDialogProps {
    open: boolean;
    tourname: string;
    pendingImages: PendingImage[];
    onFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
    onAdd: () => void | Promise<void>;
    onClose: () => void;
    uploadedProgress?: UploadProgress | null;
}

const PhotoDialog = ({open, tourname, pendingImages, onFileChange, onAdd, onClose, uploadedProgress} : PhotoDialogProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isUploading = uploadedProgress !== null && uploadedProgress !== undefined;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Fotos hinzufügen</DialogTitle>
                    <DialogDescription>
                        Fotos zu "{tourname}" hinzufügen
                    </DialogDescription>
                </DialogHeader>
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
                    {pendingImages.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground text-center">
                            {pendingImages.length} Bild{pendingImages.length === 1 ? "" : "er"} ausgewählt
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
                        <Button variant="outline" disabled={isUploading}>
                            Abbrechen
                        </Button>
                    </DialogClose>
                    <Button
                        onClick={() => void onAdd()}
                        disabled={isUploading || pendingImages.length === 0}
                    >
                        {isUploading ? "Wird hochgeladen…" : "Hochladen"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
};

export default PhotoDialog;