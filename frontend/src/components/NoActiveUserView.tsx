import {Ban, Camera, Image, MapPin, Upload} from "lucide-react";
import {Button} from "@/components/ui/button.tsx";
import {Separator} from "@/components/ui/separator.tsx";
import {ScrollArea} from "@/components/ui/scroll-area.tsx";
import {ImageFile} from "@/types";
import React from "react";


interface NoActiveUserViewProps {
    handleOpenFileDialog: () => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    files: ImageFile[];
    handleFileDelete: (index: number) => void;
}

const NoActiveUserView = ({handleOpenFileDialog, fileInputRef, handleFileChange, files, handleFileDelete}: NoActiveUserViewProps) => {
    return (
        <>
            <div className="p-4">
                <div className="rounded-xl border-2 border-dashed border-upload-border bg-muted/50 p-6 text-center transition-colors hover:bg-muted">
                    <Upload className="mx-auto mb-3 h-8 w-8 text-primary/60" />
                    <p className="text-sm font-semibold text-foreground">
                        Bilder hierher ziehen
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        oder klicken zum Auswählen
                    </p>
                    <Button size="sm" className="mt-3 gap-1.5" onClick={handleOpenFileDialog}>
                        <Camera className="h-3.5 w-3.5" />
                        Dateien auswählen
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Image className="h-4 w-4 text-primary" />
                    Geladene Bilder
                </h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {files.length}
                </span>
            </div>

            <ScrollArea className="flex-1 px-4 pb-4">
                {files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <MapPin className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                            Noch keine Bilder geladen
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                            Lade Bilder mit GPS-Daten hoch
                        </p>
                    </div>
                ) : (
                    files.map((file, index) => (
                        <div
                            key={index}
                            className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-background p-2.5"
                        >
                            <img
                                src={file.previewUrl}
                                className="h-12 w-12 shrink-0 rounded-md object-cover"
                                alt={file.file.name}
                            />

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">
                                    {file.file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {(file.file.size / 1024).toFixed(1)} KB
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    x: {file.lng} / y: {file.lat}
                                </p>
                            </div>

                            <Ban
                                className="h-4 w-4 shrink-0 text-muted-foreground/50"
                                onClick={() => handleFileDelete(index)}
                            />
                        </div>
                    ))
                )}
            </ScrollArea>
        </>
    )
}

export default NoActiveUserView;