import * as React from "react";
import {
    Check,
    Copy,
    Globe,
    Image as ImageIcon,
    Lock,
    Settings2,
    Trash2,
    Loader2,
    RefreshCw,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TourSummary } from "@/types";
import { rotateShareToken, setTourPassword, shareUrl as buildShareUrl } from "@/services/tourService";
import { Switch } from "@/components/ui/switch";

interface TourSettingsDialogProps {
    tour: TourSummary;
    /** Fotos hängen nicht mehr an der Tour — die Zahl kommt aus der aktiven Tour in App.tsx. */
    photoCount: number;
    onRename: (tourId: string, newName: string) => Promise<void>;
    onVisibilityChange: (tourId: string, isPublic: boolean) => Promise<void>;
    onDelete: (tour: TourSummary) => Promise<void>;
    trigger?: React.ReactNode;
}

export function TourSettingsDialog({
                                       tour,
                                       photoCount,
                                       onRename,
                                       onVisibilityChange,
                                       onDelete,
                                       trigger,
                                   }: TourSettingsDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState(tour.name);
    const [password, setPassword] = React.useState<string | null>(null);
    const [isPublic, setIsPublic] = React.useState(tour.isPublic);
    const [shareToken, setShareToken] = React.useState<string | null>(tour.shareToken);
    const [copied, setCopied] = React.useState(false);
    const [savingName, setSavingName] = React.useState(false);
    const [savingPassword, setSavingPassword] = React.useState(false);
    const [savingVisibility, setSavingVisibility] = React.useState(false);
    const [regenerating, setRegenerating] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [passwordProtected, setPasswordProtected] = React.useState(tour.hasPassword);

    React.useEffect(() => {
        setName(tour.name);
        setIsPublic(tour.isPublic);
        setShareToken(tour.shareToken);
        setPasswordProtected(tour.hasPassword);
    }, [tour.id, tour.name, tour.isPublic, tour.shareToken, tour.hasPassword]);

    const shareUrl = shareToken ? buildShareUrl(shareToken) : null;

    const handleCopy = () => {
        if (!shareUrl) return;

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
            }).catch(() => {/* noop */});
            return;
        }

        // Fallback für http — die Clipboard API gibt es nur im Secure Context.
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const success = document.execCommand("copy");
        document.body.removeChild(textArea);

        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        }
    };

    const handleRegenerate = async () => {
        setRegenerating(true);
        setCopied(false);
        try {
            const state = await rotateShareToken(tour.id);
            setShareToken(state.shareToken);
        } finally {
            setRegenerating(false);
        }
    };

    const handleNameBlur = async () => {
        const trimmed = name.trim();
        if (!trimmed || trimmed === tour.name) return;
        setSavingName(true);
        try {
            await onRename(tour.id, trimmed);
        } finally {
            setSavingName(false);
        }
    };

    const handlePasswordBlur = async () => {
        const trimmed = password?.trim();
        if (!trimmed) return;
        setSavingPassword(true);
        try {
            await setTourPassword(tour.id, trimmed);
        } finally {
            setSavingPassword(false);
        }
    };

    const handlePasswordToggle = async (checked: boolean) => {
        setPasswordProtected(checked);
        if (!checked) {
            setPassword(null);
            await setTourPassword(tour.id, null);
        }
    };

    const handleVisibilityChange = async (next: boolean) => {
        setIsPublic(next);
        setSavingVisibility(true);
        try {
            await onVisibilityChange(tour.id, next);
        } catch {
            setIsPublic(!next);
        } finally {
            setSavingVisibility(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await onDelete(tour);
            setOpen(false);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="outline" size="sm" className="gap-1.5">
                        <Settings2 className="h-3.5 w-3.5" />
                        Tour-Einstellungen
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="w-[min(520px,95vw)] gap-0 overflow-hidden border border-neutral-200 bg-white p-0 text-neutral-900 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50">
                {/* Cover */}
                <div className="relative h-28 w-full overflow-hidden bg-neutral-900">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_60%)]" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(0,0,0,0.55))]" />
                    <div className="absolute bottom-3 left-5 flex items-center gap-2 text-xs font-medium text-white/70">
                        <ImageIcon className="h-3.5 w-3.5" />
                        {photoCount} Bild{photoCount === 1 ? "" : "er"}
                    </div>
                </div>

                <div className="px-6 pb-6 pt-5 space-y-5">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-xl font-semibold tracking-tight">
                            Tour bearbeiten
                        </DialogTitle>
                        <DialogDescription className="text-sm text-neutral-500 dark:text-neutral-400">
                            Änderungen werden sofort gespeichert.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Name */}
                    <div className="space-y-2">
                        <Label
                            htmlFor="tour-name"
                            className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
                        >
                            Tour-Name
                        </Label>
                        <div className="relative">
                            <Input
                                id="tour-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onBlur={handleNameBlur}
                                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                className="h-11 border-neutral-200 bg-neutral-50 text-base pr-8 focus-visible:ring-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:focus-visible:ring-neutral-100"
                                placeholder="Gib deiner Tour einen Namen"
                                disabled={savingName}
                            />
                            {savingName && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neutral-400" />
                            )}
                        </div>
                    </div>

                    {/* Visibility toggle */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                                Sichtbarkeit
                            </Label>
                            {savingVisibility && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
                            {([
                                { value: false, label: "Privat", icon: Lock },
                                { value: true,  label: "Öffentlich", icon: Globe },
                            ] as const).map((opt) => {
                                const active = isPublic === opt.value;
                                const Icon = opt.icon;
                                return (
                                    <button
                                        key={String(opt.value)}
                                        type="button"
                                        disabled={savingVisibility}
                                        onClick={() => handleVisibilityChange(opt.value)}
                                        className={cn(
                                            "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all disabled:opacity-60",
                                            active
                                                ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900"
                                                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Share link — only when public */}
                    <div
                        className={cn(
                            "grid transition-all duration-300 ease-out",
                            isPublic
                                ? "grid-rows-[1fr] opacity-100"
                                : "grid-rows-[0fr] opacity-0 pointer-events-none",
                        )}
                    >
                        <div className="overflow-hidden">
                            <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
                                {/* Link */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                                        Geteilter Link
                                    </Label>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                                        <div className="flex h-10 flex-1 items-center rounded-md border border-neutral-200 bg-white px-3 font-mono text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 min-w-0">
                                            <span className="truncate">
                                                {shareUrl ?? "Wird generiert…"}
                                            </span>
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={handleCopy}
                                            disabled={!shareUrl || copied}
                                            className={cn(
                                                "h-10 gap-2 px-4 transition-all shrink-0 w-full sm:w-auto",
                                                copied
                                                    ? "bg-emerald-600 text-white hover:bg-emerald-600"
                                                    : "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200",
                                            )}
                                        >
                                            {copied ? (
                                                <><Check className="h-4 w-4" /> Kopiert</>
                                            ) : (
                                                <><Copy className="h-4 w-4" /> Kopieren</>
                                            )}
                                        </Button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRegenerate}
                                        disabled={regenerating}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 disabled:opacity-50"
                                    >
                                        <RefreshCw className={cn("h-3 w-3", regenerating && "animate-spin")} />
                                        {regenerating ? "Wird generiert…" : "Neuen Link generieren"}
                                    </button>
                                    <p className="text-xs text-neutral-400 dark:text-neutral-600">
                                        Der alte Link wird sofort ungültig.
                                    </p>
                                </div>

                                <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

                                {/* Password protect */}
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium">Passwortschutz</p>
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                            Nur mit Passwort sichtbar
                                        </p>
                                    </div>
                                    <Switch checked={passwordProtected} onCheckedChange={handlePasswordToggle} />
                                </div>
                                {passwordProtected && (
                                    <div className="relative">
                                        <Input
                                            id="password-input"
                                            type="password"
                                            value={password ?? ""}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onBlur={handlePasswordBlur}
                                            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                            className="h-11 border-neutral-200 bg-neutral-50 text-base pr-8 focus-visible:ring-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:focus-visible:ring-neutral-100"
                                            placeholder={tour.hasPassword ? "Neues Passwort setzen" : "Passwort eingeben"}
                                            disabled={savingPassword}
                                        />
                                        {savingPassword && (
                                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neutral-400" />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Danger zone */}
                    <div className="rounded-xl border border-red-100 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                                    Tour löschen
                                </p>
                                <p className="text-xs text-red-500/80 dark:text-red-500/60">
                                    Alle Bilder werden unwiderruflich gelöscht.
                                </p>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                                        disabled={deleting}
                                    >
                                        {deleting
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <Trash2 className="h-3.5 w-3.5" />
                                        }
                                        Löschen
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Tour wirklich löschen?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            „{tour.name}" und alle {photoCount} Bilder werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDelete}
                                            className="bg-red-600 text-white hover:bg-red-700"
                                        >
                                            Ja, löschen
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}