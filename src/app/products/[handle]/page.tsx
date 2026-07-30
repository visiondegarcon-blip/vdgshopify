import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ProductClient from "./ProductClient";
import { fetchProduct, fetchActiveProducts } from "@/lib/supabase";
import { getSettings, jsonSetting } from "@/lib/theme";

export const revalidate = 60;

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await fetchProduct(handle);
  if (!product || product.status !== "active") notFound();

  const all = await fetchActiveProducts();
  const idx = all.findIndex((p) => p.handle === handle);
  const next = all[(idx + 1) % all.length];
  const settings = await getSettings();
  const { accordions } = jsonSetting<{ accordions: { title: string; body: string }[] }>(
    settings,
    "content_product",
    { accordions: [] }
  );

  return (
    <main className="t-surface min-h-screen">
      <Header />
      <ProductClient
        product={product}
        nextHandle={next?.handle ?? handle}
        accordionOverrides={accordions.length ? accordions : undefined}
      />
    </main>
  );
}
