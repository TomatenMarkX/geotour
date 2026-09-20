/**
 * Spiegelt die Records aus TourController / StorageService.
 * Jackson serialisiert Record-Komponenten 1:1, also camelCase — kein snake_case mehr.
 */

/** GET /tours -> UserTourResponse.tours[] */
export type TourSummary = {
  id: string;
  name: string;
  isPublic: boolean;
  shareToken: string | null;
  hasPassword: boolean;
  createdAt: string;
};

/** GET /tours -> UserTourResponse */
export type UserTours = {
  userId: string;
  tours: TourSummary[];
};

/** Foto mit presigned Download-URL (PublicPhotos) */
export type TourPhoto = {
  id: string;
  position: number;
  lat: number;
  lng: number;
  url: string;
};

/** Tour-Summary plus geladene Fotos — das Modell, mit dem die UI arbeitet */
export type Tour = TourSummary & {
  photos: TourPhoto[];
};

/** POST /tours/verify -> PublicTourResponse */
export type PublicTour = {
  id: string;
  name: string;
  photos: TourPhoto[];
};

/** POST /tours -> TourResponse */
export type CreatedTour = {
  id: string;
  name: string;
};

/** PUT /tours/{id}/privacy, POST /tours/{id}/privacy/rotate -> ShareResponse */
export type ShareState = {
  isPublic: boolean;
  shareToken: string | null;
};

/** POST /tours/{id}/photos/upload-urls -> PresignedUpload[] */
export type PresignedUpload = {
  originalName: string;
  key: string;
  url: string;
};

/** POST /tours/{id}/photos -> PhotoResponse[] */
export type RegisteredPhoto = {
  id: string;
  key: string;
  lat: number;
  lng: number;
};

/**
 * Lokal ausgewähltes, noch nicht hochgeladenes Bild.
 * Ersetzt den alten ImageFile-Typ, der File und Remote-Foto vermischt hat.
 */
export type PendingImage = {
  file: File;
  lat: number;
  lng: number;
  previewUrl: string;
};

export type UploadProgress = {
  uploaded: number;
  total: number;
};
