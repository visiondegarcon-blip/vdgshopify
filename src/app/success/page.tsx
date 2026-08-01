"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useCart } from "@/lib/cart";
import { supabase } from "@/lib/supabase";

const DEFAULTS = {
  heading: "Merci! Order Confirmed ✓",
  body: "Thank you for supporting the vision. A receipt has been emailed to you.",
};

export default function SuccessPage() {
  const { clear } = useCart();
  const [content, setContent] = useState(DEFAULTS);
  useEffect(() => {
    clear();
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "content_success")
      .maybeSingle()
      .then(({ data }) => {
        try {
          const c = JSON.parse(data?.value ?? "{}") as Partial<typeof DEFAULTS>;
          setContent({ ...DEFAULTS, ...c });
        } catch {}
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="t-surface min-h-screen">
      <Header />
      <div className="mx-auto max-w-xl px-4 pb-28 text-center">
        <h1 className="font-oswald text-2xl font-bold">{content.heading}</h1>
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{content.body}</p>
        <Link href="/store" className="t-btn mt-8 inline-block px-6 py-3 text-sm">
          Keep Shopping
        </Link>
      </div>
    </main>
  );
}
