import exifr from "exifr";
import type { PendingImage } from "@/types";

export type GeotagScan = {
  /** Bilder mit auswertbaren GPS-Koordinaten. */
  images: PendingImage[];
  /** Bilder ohne GPS-Daten — die kann das Backend nicht annehmen (lat/lng sind @NotNull). */
  skipped: File[];
};

export async function readGeotaggedImages(input: FileList | File[] | null): Promise<GeotagScan> {
  if (!input) return { images: [], skipped: [] };

  const results = await Promise.all(
    Array.from(input).map(async (file) => {
      const gps = await exifr.gps(file).catch(() => null);
      if (gps?.latitude == null || gps.longitude == null) return { file, image: null };

      return {
        file,
        image: {
          file,
          lat: gps.latitude,
          lng: gps.longitude,
          previewUrl: URL.createObjectURL(file),
        } satisfies PendingImage,
      };
    }),
  );

  return {
    images: results.flatMap((result) => (result.image ? [result.image] : [])),
    skipped: results.filter((result) => !result.image).map((result) => result.file),
  };
}

export function revokePreviews(images: PendingImage[]): void {
  for (const image of images) URL.revokeObjectURL(image.previewUrl);
}
