import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import { fetchActiveProducts, fmtPrice } from "@/lib/supabase";

export const revalidate = 60;

export default async function StorePage() {
  const products = await fetchActiveProducts();
  return (
    <main className="min-h-screen bg-white">
      <Header />
      <div className="px-4 pb-24">
        <Link href="/" className="ml-1 inline-block text-base underline-offset-2 hover:underline">
          Back Home
        </Link>
        <div className="mx-auto mt-6 grid max-w-6xl grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
          {products.map((p) => {
            const soldOut = p.variants.every((v) => v.stock <= 0);
            const img = p.product_images[0]?.url;
            const hoverImg = p.product_images[1]?.url;
            const price = p.variants[0]?.price_cents ?? 0;
            return (
              <Link key={p.id} href={`/products/${p.handle}`} className="group relative">
                {soldOut && (
                  <span className="absolute left-2 top-2 z-10 bg-[#a51b1b] px-2 py-1 text-[11px] font-bold text-white">
                    Sold Out
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
