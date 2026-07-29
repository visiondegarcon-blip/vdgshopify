"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminCall, fmt } from "../adminApi";

export type AdminProduct = {
  id: number;
  handle: string;
  title: string;
  description_html: string;
  status: string;
  sort: number;
  product_images: { id: number; url: string; position: number }[];
  variants: { id: number; title: string; price_cents: number; compare_at_cents: number | null; stock: number; position: number }[];
};

export default function ProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    adminCall<{ products: AdminProduct[] }>("list_products")
      .then((r) => setProducts(r.products))
      .finally(() => setLoading(false));
  }, []);

  const addProduct = async () => {
    const title = prompt("Product title?");
    if (!title) return;
    const r = await adminCall<{ product: { id: number } }>("create_product", { title });
    router.push(`/admin/products/${r.product.id}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#1a1a1a]">Products</h1>
        <button onClick={addProduct} className="rounded-lg bg-[#1a1a1a] px-3 py-1.5 text-sm text-white">
          Add product
        </button>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs text-gray-600">
            <tr>
              <th className="w-14 px-4 py-2.5"></th>
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Inventory</th>
              <th className="px-4 py-2.5">Price</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {products.map((p) => {
              const stock = p.variants.reduce((n, v) => n + v.stock, 0);
              const img = [...p.product_images].sort((a, b) => a.position - b.position)[0]?.url;
              const price = p.variants[0]?.price_cents ?? 0;
              return (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/admin/products/${p.id}`)}
                  className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-2">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="h-10 w-10 rounded-md border border-gray-200 object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-md border border-dashed border-gray-300" />
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium">{p.title}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "active" ? "bg-[#cdfee1]" : "bg-[#e3e3e3]"}`}>
                      {p.status === "active" ? "Active" : "Draft"}
                    </span>
                  </td>
                  <td className={`px-4 py-2 ${stock === 0 ? "text-red-700" : ""}`}>
                    {stock} in stock{p.variants.length > 1 ? ` for ${p.variants.length} variants` : ""}
                  </td>
                  <td className="px-4 py-2">{fmt(price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Tip: keep new drops as <b>Draft</b> while you set them up — they&apos;re invisible on the store until you flip them to Active.{" "}
        <Link className="underline" href="/admin">Back home</Link>
      </p>
    </div>
  );
}
