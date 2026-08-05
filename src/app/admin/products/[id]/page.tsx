"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { adminCall } from "../../adminApi";
import RemoveBackground from "../../RemoveBackground";
import { QUALITY_LABEL, kb, prepareImage, type UploadQuality } from "@/lib/imageUpload";
import type { AdminProduct } from "../page";

export default function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<AdminProduct | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [quality, setQuality] = useState<UploadQuality>("full");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const load = useCallback(() => {
    adminCall<{ products: AdminProduct[] }>("list_products").then((r) =>
      setP(r.products.find((x) => x.id === Number(id)) ?? null)
    );
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const flash = (m: string) => { setSaved(m); setTimeout(() => setSaved(null), 1800); };

  if (!p) return <div className="text-sm text-gray-500">Loading…</div>;

  const saveProduct = async (fields: Record<string, unknown>) => {
    await adminCall("update_product", { id: p.id, fields });
    flash("Saved"); load();
  };
  const saveVariant = async (vid: number, fields: Record<string, unknown>) => {
    await adminCall("update_variant", { id: vid, fields });
    flash("Saved"); load();
  };

  /* Re-encodes in the browser first, so the bucket only ever receives JPEGs
     at the size the admin actually chose. */
  const uploadPhoto = async (file: File) => {
    setUploadErr(null);
    setUploading(true);
    try {
      const prepared = await prepareImage(file, quality);
      await upload(prepared.blob, prepared.filename);
      flash(`Uploaded ${prepared.width}×${prepared.height} · ${kb(prepared.blob.size)}`);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const upload = async (file: Blob, name?: string) => {
    // chunked base64 (spread syntax overflows the stack on big images)
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
    }
    const filename = name ?? (file instanceof File ? file.name : "image.png");
    await adminCall("upload_image", { productId: p.id, filename, base64: btoa(bin) });
    flash("Image uploaded"); load();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/products" className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm">←</Link>
          <h1 className="text-xl font-semibold text-[#1a1a1a]">{p.title}</h1>
          {saved && <span className="rounded-full bg-[#cdfee1] px-2 py-0.5 text-xs">{saved}</span>}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={p.status}
            onChange={(e) => saveProduct({ status: e.target.value })}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
          <button
            onClick={async () => {
              if (!confirm(`Delete "${p.title}" permanently?`)) return;
              await adminCall("delete_product", { id: p.id });
              router.push("/admin/products");
            }}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* Title + description */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <label className="text-xs font-semibold text-gray-600">Title</label>
            <input
              defaultValue={p.title}
              onBlur={(e) => e.target.value !== p.title && saveProduct({ title: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <label className="mt-4 block text-xs font-semibold text-gray-600">Description (HTML)</label>
            <textarea
              defaultValue={p.description_html}
              rows={7}
              onBlur={(e) => e.target.value !== p.description_html && saveProduct({ description_html: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            />
            <label className="mt-4 block text-xs font-semibold text-gray-600">Size chart</label>
            <textarea
              defaultValue={p.size_chart ?? ""}
              rows={9}
              placeholder={"Leave blank to use the shared size chart.\n\nS\n- Body Length (Back): 69CM\n- Shoulder Width: 52.5\n- Body Width: 55.5"}
              onBlur={(e) =>
                e.target.value !== (p.size_chart ?? "") && saveProduct({ size_chart: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Only applies to this product. Blank falls back to the shared chart in Online Store →
              Editor → Info accordions.
            </p>
            <p className="mt-1 text-[11px] text-gray-500">Fields save when you click away.</p>
          </div>

          {/* Media */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Media</div>
              <div className="flex items-center gap-2">
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as UploadQuality)}
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                >
                  {(Object.keys(QUALITY_LABEL) as UploadQuality[]).map((k) => (
                    <option key={k} value={k}>{QUALITY_LABEL[k]}</option>
                  ))}
                </select>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-60"
                >
                  {uploading ? "Uploading…" : "Upload image"}
                </button>
              </div>
              <input
                ref={fileRef} type="file" accept="image/*,.heic,.heif" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  // reset so re-picking the same file still fires onChange
                  e.target.value = "";
                  if (f) uploadPhoto(f);
                }}
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              Photos are converted to JPG before upload to save storage.{" "}
              <strong>Full quality</strong> keeps the original size — use it for shots customers zoom
              into. <strong>Compact</strong> caps the long edge at 2000px — fine for flat garment
              mockups.
            </p>
            {uploadErr && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{uploadErr}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              {[...p.product_images].sort((a, b) => a.position - b.position).map((img) => (
                <div key={img.id} className="flex w-24 flex-col items-stretch gap-1">
                  <div className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-24 w-24 rounded-lg border border-gray-200 object-cover" />
                    <button
                      onClick={async () => { await adminCall("delete_image", { id: img.id }); load(); }}
                      className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] text-white group-hover:flex"
                    >
                      ✕
                    </button>
                  </div>
                  <RemoveBackground
                    src={img.url}
                    label="Remove BG"
                    onSave={async (png) => { await upload(png, `nobg-${Date.now()}.png`); }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Variants */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Variants</div>
              <button
                onClick={async () => {
                  const title = prompt("Variant name (e.g. M, L, Brazil Design / XL)?");
                  if (title) { await adminCall("create_variant", { productId: p.id, title }); load(); }
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                Add variant
              </button>
            </div>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs text-gray-600">
                <tr>
                  <th className="py-1.5 pr-2">Variant</th>
                  <th className="py-1.5 pr-2">Price (A$)</th>
                  <th className="py-1.5 pr-2">Was (A$)</th>
                  <th className="py-1.5 pr-2">Stock</th>
                  <th className="py-1.5 pr-2">Weight (g)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {p.variants.map((v) => (
                  <tr key={v.id} className="border-t border-gray-100">
                    <td className="py-1.5 pr-2">
                      <input
                        defaultValue={v.title}
                        onBlur={(e) => e.target.value !== v.title && saveVariant(v.id, { title: e.target.value })}
                        className="w-full rounded-md border border-gray-200 px-2 py-1"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number" step="0.01" defaultValue={(v.price_cents / 100).toFixed(2)}
                        onBlur={(e) => saveVariant(v.id, { price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                        className="w-24 rounded-md border border-gray-200 px-2 py-1"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number" step="0.01"
                        defaultValue={v.compare_at_cents ? (v.compare_at_cents / 100).toFixed(2) : ""}
                        placeholder="—"
                        onBlur={(e) => saveVariant(v.id, { compare_at_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })}
                        className="w-24 rounded-md border border-gray-200 px-2 py-1"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number" defaultValue={v.stock}
                        onBlur={(e) => saveVariant(v.id, { stock: Math.max(0, parseInt(e.target.value || "0")) })}
                        className="w-20 rounded-md border border-gray-200 px-2 py-1"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number" defaultValue={v.weight_g ?? 500}
                        onBlur={(e) => saveVariant(v.id, { weight_g: Math.max(0, parseInt(e.target.value || "0")) })}
                        className="w-20 rounded-md border border-gray-200 px-2 py-1"
                      />
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        onClick={async () => {
                          if (p.variants.length === 1) return alert("A product needs at least one variant.");
                          if (confirm(`Delete variant "${v.title}"?`)) { await adminCall("delete_variant", { id: v.id }); load(); }
                        }}
                        className="text-xs text-gray-400 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side column */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-white p-5 shadow-sm text-sm">
            <div className="font-semibold">Storefront</div>
            <p className="mt-1 text-xs text-gray-600">
              {p.status === "active" ? "Visible in the store." : "Hidden until set to Active."}
            </p>
            <a
              className="mt-2 inline-block text-xs underline"
              href={`https://vdg-store.vercel.app/products/${p.handle}`}
              target="_blank" rel="noreferrer"
            >
              View on store ↗
            </a>
            <div className="mt-3 text-xs text-gray-500">handle: {p.handle}</div>
            <label className="mt-3 block text-xs font-semibold text-gray-600">Sort position</label>
            <input
              type="number" defaultValue={p.sort}
              onBlur={(e) => saveProduct({ sort: parseInt(e.target.value || "0") })}
              className="mt-1 w-24 rounded-md border border-gray-200 px-2 py-1 text-sm"
            />
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm text-xs text-gray-600">
            Store pages refresh within 60 seconds of a change (or instantly on redeploy).
          </div>
        </div>
      </div>
    </div>
  );
}
