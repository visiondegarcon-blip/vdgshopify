/* Server-side image validation for uploads.

   The admin upload actions previously trusted the filename extension and had no
   size cap. This sniffs the actual leading bytes (magic numbers) so a payload
   can't claim to be a `.png` while carrying arbitrary bytes, and bounds the
   size so a direct API caller can't exhaust storage. */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB — comfortably above a full-quality photo

export type SniffedImage = "png" | "jpg" | "gif" | "webp" | "avif";

export function sniffImageType(buf: Buffer): SniffedImage | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (brand.startsWith("avif") || brand.startsWith("avis") || brand === "mif1" || brand === "msf1")
      return "avif";
  }
  return null;
}
