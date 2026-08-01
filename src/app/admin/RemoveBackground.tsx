"use client";
import { useEffect, useRef, useState } from "react";

/* Client-side background remover for admin images.

   Uses @imgly/background-removal (MIT-ish, free, no API key): the ONNX model
   runs entirely in the browser, so no image ever leaves the admin's machine and
   there is no server cost. The library is ~large and pulls a ~40MB model from
   its CDN on first use, so it is imported lazily inside the click handler —
   it never lands in the initial admin bundle. */

type Stage = "idle" | "loading" | "done" | "error";

const CHECKER =
  "repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 16px 16px";

export default function RemoveBackground({
  src,
  label = "Remove background",
  onSave,
}: {
  src: string;
  /** Called with the transparent PNG when the admin confirms. */
  onSave: (png: Blob) => Promise<void>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [step, setStep] = useState("");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const reset = () => {
    cancelled.current = true;
    setOpen(false);
    setStage("idle");
    setStep("");
    setPct(0);
    setError(null);
    setResult(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  const run = async () => {
    cancelled.current = false;
    setOpen(true);
    setStage("loading");
    setError(null);
    setResult(null);
    setPct(0);
    setStep("Starting…");
    try {
      // fetch the stored image first so we get a clear message on CORS/404
      const res = await fetch(src, { mode: "cors" });
      if (!res.ok) throw new Error(`Could not load the image (HTTP ${res.status})`);
      const input = await res.blob();

      const { removeBackground } = await import("@imgly/background-removal");
      const png = await removeBackground(input, {
        output: { format: "image/png" },
        progress: (key: string, current: number, total: number) => {
          if (cancelled.current) return;
          const downloading = key.startsWith("fetch");
          setStep(
            downloading
              ? "Downloading the AI model (first use only — this can take a minute)…"
              : "Removing background…"
          );
          setPct(total > 0 ? Math.round((current / total) * 100) : 0);
        },
      });
      if (cancelled.current) return;
      if (!png || png.size === 0) throw new Error("Background removal returned an empty image");
      setResult(png);
      setPreview(URL.createObjectURL(png));
      setStage("done");
    } catch (e) {
      if (cancelled.current) return;
      // never swallow: always surface the real message
      setError(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(result);
      setSaving(false);
      reset();
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "Save failed");
      setStage("error");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={run}
        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-700 hover:border-gray-400"
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Remove background</h2>
              <button onClick={reset} className="text-sm text-gray-500 hover:text-black">
                ✕
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] text-gray-500">Original</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full rounded-lg border border-gray-200 object-contain" />
              </div>
              <div>
                <div className="mb-1 text-[11px] text-gray-500">Result (transparent PNG)</div>
                <div
                  className="flex min-h-[160px] items-center justify-center rounded-lg border border-gray-200"
                  style={{ background: CHECKER }}
                >
                  {preview ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={preview} alt="" className="max-h-72 w-full object-contain" />
                  ) : (
                    <span className="px-3 text-center text-[11px] text-gray-500">
                      {stage === "loading" ? "Processing…" : "—"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {stage === "loading" && (
              <div className="mt-4">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full bg-[#1a1a1a] transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-[11px] text-gray-600">
                  {step} {pct > 0 && `${pct}%`}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  Everything runs in your browser — the image is never uploaded to a third party.
                </p>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={reset} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
                Cancel
              </button>
              {stage === "error" && (
                <button onClick={run} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
                  Try again
                </button>
              )}
              <button
                onClick={save}
                disabled={!result || saving}
                className="rounded-lg bg-[#1a1a1a] px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save image"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
