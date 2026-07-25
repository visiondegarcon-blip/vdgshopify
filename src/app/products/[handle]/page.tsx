import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ProductClient from "./ProductClient";
import { fetchProduct, fetchActiveProducts } from "@/lib/supabase";

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

  return (
    <main className="min-h-screen bg-white">
      <Header />
      <ProductClient product={product} nextHandle={next?.handle ?? handle} />
    </main>
  );
}
