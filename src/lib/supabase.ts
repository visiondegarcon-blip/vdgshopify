import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Variant = {
  id: number;
  title: string;
  price_cents: number;
  compare_at_cents: number | null;
  stock: number;
  position: number;
};

export type Product = {
  id: number;
  handle: string;
  title: string;
  description_html: string;
  status: string;
  sort: number;
  /* Overrides the shared "Size Chart" accordion for this product only.
     Empty/null keeps the global one — see resolveAccordions in ProductClient. */
  size_chart: string | null;
  product_images: { url: string; position: number }[];
  variants: Variant[];
};

export async function fetchActiveProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(url,position), variants(id,title,price_cents,compare_at_cents,stock,position)")
    .eq("status", "active")
    .order("sort");
  if (error) throw error;
  for (const p of data ?? []) {
    p.product_images.sort((a: { position: number }, b: { position: number }) => a.position - b.position);
    p.variants.sort((a: Variant, b: Variant) => a.position - b.position);
  }
  return data as Product[];
}

export async function fetchProduct(handle: string): Promise<Product | null> {
  const { data } = await supabase
    .from("products")
    .select("*, product_images(url,position), variants(id,title,price_cents,compare_at_cents,stock,position)")
    .eq("handle", handle)
    .maybeSingle();
  if (data) {
    data.product_images.sort((a: { position: number }, b: { position: number }) => a.position - b.position);
    data.variants.sort((a: Variant, b: Variant) => a.position - b.position);
  }
  return data as Product | null;
}

export const fmtPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
