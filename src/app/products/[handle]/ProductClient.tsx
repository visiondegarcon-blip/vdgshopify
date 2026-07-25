"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { fmtPrice, type Product } from "@/lib/supabase";

const ACCORDIONS: { title: string; body: string }[] = [
  {
    title: "Impact Transparency Commitment",
    body: `Impact Transparency
We believe in full transparency. Regular updates on donations and partnerships will be shared, so you know exactly how your support is making a difference.

Charity & Our Commitments
A portion of your purchase will directly support organizations making a real impact in the Congo. We have carefully chosen Médecins Sans Frontières (Doctors Without Borders) and Save The Children for their dedicated efforts in providing medical aid, humanitarian relief, and support to vulnerable communities.`,
  },
  {
    title: "Environmental Sustainability",
    body: `We are committed to responsible fashion. By using recycled materials, we actively work to minimize waste and lower our carbon footprint. Sustainability isn't just a goal—it's a commitment.

Longevity & Quality
Fast fashion fuels waste. Our products are designed for durability, ensuring each piece lasts longer, reducing the need for constant replacement and further consumption.`,
  },
  {
    title: "Size Chart",
    body: `S
- Body Length (Back): 69CM
- Shoulder Width: 52.5
- Body Width: 55.5

M
- Body Length (Back): 72
- Shoulder Width: 54
- Body Width: 58.5

L
- Body Length (Back): 75
- Shoulder Width: 56
- Body Width: 62.5`,
  },
];

export default function ProductClient({
  product,
  nextHandle,
}: {
  product: Product;
  nextHandle: string;
}) {
  const { add } = useCart();
  const inStock = product.variants.filter((v) => v.stock > 0);
  const [variantId, setVariantId] = useState<number>(
    (inStock[0] ?? product.variants[0])?.id
  );
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((v) => v.id === variantId)!;
  const soldOut = product.variants.every((v) => v.stock <= 0);

  const addToCart = () => {
    if (!variant || variant.stock <= 0) return;
    add({
      variantId: variant.id,
      productHandle: product.handle,
      productTitle: product.title,
      variantTitle: variant.title,
      priceCents: variant.price_cents,
      image: product.product_images[0]?.url ?? "",
      qty: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pb-28 pt-6 md:grid-cols-2">
      <div className="flex flex-col gap-6">
        {product.product_images.map((img) => (
          <div key={img.url} className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={product.title} className="w-full object-contain" />
          </div>
        ))}
      </div>
      <div className="md:sticky md:top-6 md:self-start">
        <h1 className="font-oswald text-2xl font-bold tracking-wide">{product.title}</h1>
        <div
          className="prose-desc mt-4 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: product.description_html }}
        />
        <div className="mt-4 text-lg font-semibold">{fmtPrice(variant?.price_cents ?? 0)} AUD</div>

        {product.variants.length > 1 && (
          <select
            value={variantId}
            onChange={(e) => setVariantId(Number(e.target.value))}
            className="mt-4 block border border-black px-3 py-2 text-sm"
          >
            {product.variants.map((v) => (
              <option key={v.id} value={v.id} disabled={v.stock <= 0}>
                {v.title}
                {v.stock <= 0 ? " — Sold Out" : ""}
              </option>
            ))}
          </select>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={addToCart}
            disabled={soldOut || !variant || variant.stock <= 0}
            className="bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {soldOut ? "Sold Out" : added ? "Added ✓" : "Add To Cart"}
          </button>
          <Link href="/store" className="bg-black px-4 py-2 text-sm text-white">
            Keep Shopping
          </Link>
          <Link href={`/products/${nextHandle}`} className="text-sm">
            Next Item &gt;
          </Link>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {ACCORDIONS.map((a) => (
            <details key={a.title} className="border border-gray-200 px-4 py-3">
              <summary className="cursor-pointer select-none text-sm">{a.title}</summary>
              <div className="whitespace-pre-line pt-3 text-sm text-gray-700">{a.body}</div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
