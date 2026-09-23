import { ApiError, apiFetch } from "@/lib/api";
import type {
  CreatedTour,
  PendingImage,
  PresignedUpload,
  PublicTour,
  RegisteredPhoto,
  ShareState,
  TourPhoto,
  TourSummary,
  UploadProgress,
  UserTours,
} from "@/types";

/** @Size(max = 50) auf UploadUrlRequest.filenames */
const UPLOAD_BATCH_SIZE = 50;

// ── Touren ────────────────────────────────────────────────────────────────────

export function loadTours(): Promise<UserTours> {
  return apiFetch<UserTours>("/tours");
}

export function createTour(name: string): Promise<CreatedTour> {
  return apiFetch<CreatedTour>("/tours", { method: "POST", json: { name: name.trim() } });
}

export function renameTour(tourId: string, name: string): Promise<void> {
  return apiFetch<void>(`/tours/${tourId}/name`, { method: "PUT", json: { name: name.trim() } });
}

export function deleteTour(tourId: string): Promise<void> {
  return apiFetch<void>(`/tours/${tourId}`, { method: "DELETE" });
}

/**
 * TODO: Backend-Endpoint fehlt noch.
 * GET /tours liefert nur TourSummary ohne Fotos, und POST /tours/verify greift
 * nur für öffentliche Touren. Für die Besitzer-Ansicht braucht es
 * GET /tours/{tourId}/photos, das PublicPhotos (inkl. presigned URL) zurückgibt.
 */
export function loadTourPhotos(tourId: string): Promise<TourPhoto[]> {
  return apiFetch<TourPhoto[]>(`/tours/${tourId}/photos`);
}

// ── Sichtbarkeit, Share-Token, Passwort ───────────────────────────────────────

export function setTourPrivacy(tourId: string, isPublic: boolean): Promise<ShareState> {
  return apiFetch<ShareState>(`/tours/${tourId}/privacy`, { method: "PUT", json: { isPublic } });
}

export function rotateShareToken(tourId: string): Promise<ShareState> {
  return apiFetch<ShareState>(`/tours/${tourId}/privacy/rotate`, { method: "POST" });
}

/** password === null entfernt den Passwortschutz. */
export function setTourPassword(tourId: string, password: string | null): Promise<void> {
  return apiFetch<void>(`/tours/${tourId}/password`, { method: "PUT", json: { password } });
}

export function shareUrl(shareToken: string): string {
  return `${window.location.origin}/tour/${shareToken}`;
}

// ── Öffentliche Tour ──────────────────────────────────────────────────────────

export type VerifyResult =
  | { kind: "ok"; tour: PublicTour }
  | { kind: "password"; wrong: boolean }
  | { kind: "notFound" };

export async function verifyTour(shareToken: string, password?: string): Promise<VerifyResult> {
  try {
    const tour = await apiFetch<PublicTour>("/tours/verify", {
      method: "POST",
      auth: false,
      json: { shareToken, password: password ?? null },
    });
    return { kind: "ok", tour };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 401) return { kind: "password", wrong: Boolean(password) };
    if (error.status === 404) return { kind: "notFound" };
    throw error;
  }
}

// ── Foto-Upload ───────────────────────────────────────────────────────────────

/**
 * Dreistufiger Upload, der das Backend nicht durch die Bilddaten schleift:
 *   1. POST /tours/{id}/photos/upload-urls  -> presigned PUT-URLs auf staging/
 *   2. PUT direkt in den Bucket
 *   3. POST /tours/{id}/photos              -> promote staging/ -> target/{tourId}/ + DB-Zeile
 * Schlägt Schritt 3 fehl, räumt das Backend die promoted Objekte selbst auf;
 * liegen gebliebene staging/-Objekte laufen über die Lifecycle-Rule des Buckets ab.
 */
export async function uploadPhotos(
  tourId: string,
  images: PendingImage[],
  startingIndex: number,
  onProgress?: (progress: UploadProgress) => void,
): Promise<RegisteredPhoto[]> {
  const registered: RegisteredPhoto[] = [];
  let uploaded = 0;

  for (let from = 0; from < images.length; from += UPLOAD_BATCH_SIZE) {
    const batch = images.slice(from, from + UPLOAD_BATCH_SIZE);

    const targets = await apiFetch<PresignedUpload[]>(`/tours/${tourId}/photos/upload-urls`, {
      method: "POST",
      json: { filenames: batch.map((image) => image.file.name) },
    });

    if (targets.length !== batch.length) {
      throw new Error(`Erwartet ${batch.length} Upload-URLs, bekommen ${targets.length}`);
    }

    const staged: Array<{ key: string; lat: number; lng: number }> = [];

    for (const [index, target] of targets.entries()) {
      const image = batch[index];
      await putToStorage(target.url, image.file);
      staged.push({ key: target.key, lat: image.lat, lng: image.lng });
      uploaded += 1;
      onProgress?.({ uploaded, total: images.length });
    }

    registered.push(
      ...(await apiFetch<RegisteredPhoto[]>(`/tours/${tourId}/photos`, {
        method: "POST",
        json: { photos: staged,
                startingIndex: startingIndex
        },
      })),
    );
  }

  return registered;
}

/**
 * Bewusst ohne Authorization-Header: die presigned URL trägt die Signatur
 * selbst, ein zusätzlicher Auth-Header würde S3/B2 nur verwirren.
 * Content-Type setzt fetch aus file.type — genau das soll im Bucket landen,
 * damit der presigned Download später als image/* ausgeliefert wird.
 */
async function putToStorage(url: string, file: File): Promise<void> {
  const response = await fetch(url, { method: "PUT", body: file });
  if (!response.ok) {
    throw new Error(`Upload von ${file.name} fehlgeschlagen (HTTP ${response.status})`);
  }
}

export function deletePhoto(tourId: string, photoId: string): Promise<void> {
  return apiFetch<void>(`/tours/${tourId}/photos/${photoId}`, { method: "DELETE" });
}

// ── Komfort ───────────────────────────────────────────────────────────────────

export function sortByPosition(photos: TourPhoto[]): TourPhoto[] {
  return [...photos].sort((left, right) => left.position - right.position);
}

export function newestFirst(tours: TourSummary[]): TourSummary[] {
  return [...tours].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
