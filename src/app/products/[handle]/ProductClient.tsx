"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { fmtPrice, type Product } from "@/lib/supabase";
import { track } from "@/lib/track";
import { DEFAULT_ACCORDIONS } from "@/lib/defaultAccordions";
import ZoomImage from "@/components/ZoomImage";
import RestockNotify from "@/components/RestockNotify";


export default function ProductClient({
  product,
  nextHandle,
  accordionOverrides,
  buttons,
}: {
  product: Product;
  nextHandle: string;
  accordionOverrides?: { title: string; body: string }[];
  buttons?: { add_to_cart: string; sold_out: string; view_cart: string };
}) {
  const label = { add_to_cart: "Add To Cart", sold_out: "Sold Out", view_cart: "View Cart", ...buttons };
  /* Info sections are brand-wide, but sizing isn't — a tee and a hoodie need
     different measurements. A product's own size_chart replaces the shared
     one's body; products that leave it blank keep the global chart. */
  const baseAccordions = accordionOverrides ?? DEFAULT_ACCORDIONS;
  const ownChart = product.size_chart?.trim();
  const isChart = (t: string) => /size\s*chart/i.test(t);
  const accordions = !ownChart
    ? baseAccordions
    : baseAccordions.some((a) => isChart(a.title))
      ? baseAccordions.map((a) => (isChart(a.title) ? { ...a, body: ownChart } : a))
      : // no shared chart section to slot into (it was removed globally) —
        // still show this product's own chart rather than dropping it
        [...baseAccordions, { title: "Size Chart", body: ownChart }];
  const { add } = useCart();
  const inStock = product.variants.filter((v) => v.stock > 0);
  const [variantId, setVariantId] = useState<number>(
    (inStock[0] ?? product.variants[0])?.id
  );
  const [featured, setFeatured] = useState(0);
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((v) => v.id === variantId)!;
  const soldOut = product.variants.every((v) => v.stock <= 0);

  useEffect(() => {
    track("product_view", { handle: product.handle, title: product.title, soldOut });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.handle]);
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
      maxQty: variant.stock,
    });
    track("add_to_cart", { handle: product.handle, title: product.title, variant: variant.title, priceCents: variant.price_cents });
    setAdded(true);
  };

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pb-28 pt-2 md:grid-cols-2">
      {/* Featured image, swapped by the thumbnail grid on the right */}
      <div className="md:sticky md:top-4 md:self-start">
        <ZoomImage src={images[featured]?.url ?? ""} alt={product.title} />
      </div>

      <div>
        {onSale && (
          <span className="t-btn mb-2 inline-block px-2 py-1 text-[11px] font-bold">
            On Sale
          </span>
        )}
        <h1 className="t-head text-[21px] font-bold tracking-wide">{product.title}</h1>
        <div
          className="prose-desc mt-3 text-xs leading-relaxed"
          dangerouslySetInnerHTML={{ __html: product.description_html }}
        />

        {images.length > 1 && (
          <div className="mt-5 grid w-fit grid-cols-2 gap-2">
            {images.map((img, i) => (
              <button
                key={img.url}
                onClick={() => setFeatured(i)}
                aria-label={`Show photo ${i + 1}`}
                className="block"
              >
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
            onChange={(e) => {
              const id = Number(e.target.value);
              setVariantId(id);
              const v = product.variants.find((x) => x.id === id);
              if (v) track("variant_click", { handle: product.handle, title: product.title, variant: v.title });
            }}
            className="mt-4 block border border-black px-3 py-2 font-mono text-sm"
          >
            {/* Sold-out sizes stay selectable so the shopper can ask to be
                told when they return; Add To Cart is what stays disabled. */}
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>
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
            className="t-btn px-4 py-2 font-mono text-sm disabled:cursor-not-allowed"
          >
            {soldOut ? label.sold_out : label.add_to_cart}
          </button>
          <Link href="/store" className="t-btn px-4 py-2 font-mono text-sm">
            Keep Shopping
          </Link>
        </div>

        {variant && variant.stock <= 0 && (
          <RestockNotify variantId={variant.id} variantTitle={variant.title} />
        )}

        {added && (
          <div className="mt-4 flex items-center justify-between border border-black px-4 py-3">
            <span className="font-mono text-sm">✓ Added to cart</span>
            <Link href="/cart" className="t-btn px-4 py-2 font-mono text-sm">
              {label.view_cart}
            </Link>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {accordions.map((a) => (
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
