/* Client-side preparation for admin photo uploads.
 *
 * Everything is re-encoded to JPEG before it leaves the browser: it keeps the
 * Supabase storage bucket small, and it means whatever the camera produced
 * (HEIC from an iPhone, a 40MB PNG export) arrives as one predictable format.
 *
 * Two modes, chosen per upload:
 *   "full"    – keep the original pixel dimensions, encode at high quality.
 *               For photography you want customers to zoom into.
 *   "compact" – cap the long edge at 2000px. Plenty for a product page and a
 *               fraction of the weight; good for flat garment mockups where
 *               there's no fine detail to lose.
 */

export type UploadQuality = "full" | "compact";

export const QUALITY_LABEL: Record<UploadQuality, string> = {
  full: "Full quality (keep original size)",
  compact: "Compact (max 2000px)",
};

const SETTINGS: Record<UploadQuality, { maxPx: number | null; q: number }> = {
  full: { maxPx: null, q: 0.94 },
  compact: { maxPx: 2000, q: 0.86 },
};

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      /* Chrome and Firefox can't decode HEIC. iOS Safari normally transcodes
         iPhone photos to JPEG on pick, so this mostly bites when someone
         AirDrops a .HEIC to a desktop and uploads it there. */
      reject(
        new Error(
          "Couldn't read that image. If it's a HEIC/HEIF from an iPhone, open it in Preview and export as JPEG, or upload from your phone instead."
        )
      );
    };
    img.src = url;
  });
}

export type PreparedImage = { blob: Blob; filename: string; width: number; height: number };

export async function prepareImage(file: File, quality: UploadQuality): Promise<PreparedImage> {
  const { maxPx, q } = SETTINGS[quality];
  const img = await loadImage(file);

  let { naturalWidth: w, naturalHeight: h } = img;
  if (maxPx) {
    const longest = Math.max(w, h);
    if (longest > maxPx) {
      const scale = maxPx / longest;
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser blocked image processing.");

  /* JPEG has no alpha channel. Painting white first stops transparent areas
     (cutout product shots) turning black in the encoded file. */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
  if (!blob) throw new Error("Could not convert that image.");

  const stem = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60) || "photo";
  return { blob, filename: `${stem}.jpg`, width: w, height: h };
}

export const kb = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
