import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import LockScreen from "@/components/LockScreen";
import { fetchActiveProducts, fmtPrice } from "@/lib/supabase";
import { getActiveLock } from "@/lib/lock";
import { getSettings, jsonSetting } from "@/lib/theme";

export const revalidate = 60;

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ unlock?: string }>;
}) {
  const lock = await getActiveLock(await searchParams);
  if (lock) return <LockScreen config={lock} />;
  const [products, settings] = await Promise.all([fetchActiveProducts(), getSettings()]);
  const store = jsonSetting<{ columns: 2 | 3 | 4; badge_bg: string; badge_fg: string; back_label: string; sold_out_label: string }>(
    settings,
    "content_store",
    { columns: 4, badge_bg: "", badge_fg: "", back_label: "Back Home", sold_out_label: "Sold Out" }
  );
  const cols = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" }[store.columns] ?? "md:grid-cols-4";
  const badgeStyle =
    store.badge_bg || store.badge_fg
      ? { background: store.badge_bg || undefined, color: store.badge_fg || undefined }
      : undefined;
  return (
    <main className="t-surface min-h-screen">
      <Header />
      <div className="px-4 pb-24">
        <Link href="/" className="ml-1 inline-block text-base underline-offset-2 hover:underline">
          {store.back_label}
        </Link>
        <div className={`mx-auto mt-6 grid max-w-6xl grid-cols-2 gap-x-6 gap-y-12 ${cols}`}>
          {products.map((p) => {
            const soldOut = p.variants.every((v) => v.stock <= 0);
            const img = p.product_images[0]?.url;
            const hoverImg = p.product_images[1]?.url;
            const price = p.variants[0]?.price_cents ?? 0;
            return (
              <Link key={p.id} href={`/products/${p.handle}`} className="group relative">
                {soldOut && (
                  <span className="t-badge absolute left-2 top-2 z-10 px-2 py-1 text-[11px] font-bold" style={badgeStyle}>
                    {store.sold_out_label}
                  </span>
                )}
                {img && (
                  <div className="relative aspect-[4/5] w-full overflow-hidden">
                    <Image
                      src={img}
                      alt={p.title}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-contain object-top"
                    />
                    {hoverImg && (
                      <Image
                        src={hoverImg}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="bg-white object-contain object-top opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                      />
                    )}
                  </div>
                )}
                <div className="mt-2 text-center text-base">{p.title}</div>
                <div className="text-center text-xs">{fmtPrice(price)}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
