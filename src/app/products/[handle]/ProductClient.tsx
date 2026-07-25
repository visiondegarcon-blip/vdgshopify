"use client";
import { useState } from "react";
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
  const [featured, setFeatured] = useState(0);
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((v) => v.id === variantId)!;
  const soldOut = product.variants.every((v) => v.stock <= 0);
  const onSale = !!variant?.compare_at_cents && variant.compare_at_cents > variant.price_cents;
  const images = product.product_images;

  const addToCart = () => {
    if (!variant || variant.stock <= 0) return;
    add({
      variantId: variant.id,
      productHandle: product.handle,
      productTitle: product.title,
      variantTitle: variant.title,
      priceCents: variant.price_cents,
      image: images[0]?.url ?? "",
      qty: 1,
    });
    setAdded(true);
  };

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pb-28 pt-2 md:grid-cols-2">
      {/* Featured image, swapped by the thumbnail grid on the right */}
      <div className="md:sticky md:top-4 md:self-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[featured]?.url}
          alt={product.title}
          className="max-h-[80vh] w-full object-contain object-top"
        />
      </div>

      <div>
        {onSale && (
          <span className="mb-2 inline-block bg-black px-2 py-1 text-[11px] font-bold text-white">
            On Sale
          </span>
        )}
        <h1 className="font-mono text-[21px] font-bold tracking-wide">{product.title}</h1>
        <div
          className="prose-desc mt-3 text-xs leading-relaxed"
          dangerouslySetInnerHTML={{ __html: product.description_html }}
        />

        {images.length > 1 && (
          <div className="mt-5 grid w-fit grid-cols-2 gap-2">
            {images.map((img, i) => (
              <button key={img.url} onClick={() => setFeatured(i)} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt=""
                  className={`h-14 w-14 object-cover ${i === featured ? "outline outline-2 outline-black" : "opacity-90 hover:opacity-100"}`}
                />
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 text-lg font-bold">{fmtPrice(variant?.price_cents ?? 0)}</div>
        {onSale && (
          <div className="text-sm">
            Was: <span className="line-through">{fmtPrice(variant!.compare_at_cents!)}</span>
          </div>
        )}

        {product.variants.length > 1 && (
          <select
            value={variantId}
            onChange={(e) => setVariantId(Number(e.target.value))}
            className="mt-4 block border border-black px-3 py-2 font-mono text-sm"
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
          <div className="ml-auto w-full text-right font-mono text-sm md:order-3 md:w-auto">
            <Link href={`/products/${nextHandle}`}>Next Item &gt;</Link>
          </div>
          <button
            onClick={addToCart}
            disabled={soldOut || !variant || variant.stock <= 0}
            className="bg-black px-4 py-2 font-mono text-sm text-white disabled:cursor-not-allowed"
          >
            {soldOut ? "Sold Out" : "Add To Cart"}
          </button>
          <Link href="/store" className="bg-black px-4 py-2 font-mono text-sm text-white">
            Keep Shopping
          </Link>
        </div>

        {added && (
          <div className="mt-4 flex items-center justify-between border border-black px-4 py-3">
            <span className="font-mono text-sm">✓ Added to cart</span>
            <Link href="/cart" className="bg-black px-4 py-2 font-mono text-sm text-white">
              View Cart
            </Link>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {ACCORDIONS.map((a) => (
            <details key={a.title} className="border border-gray-200 px-4 py-3">
              <summary className="cursor-pointer select-none font-mono text-sm">{a.title}</summary>
              <div className="whitespace-pre-line pt-3 text-xs leading-relaxed text-gray-700">{a.body}</div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
