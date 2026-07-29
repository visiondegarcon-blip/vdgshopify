import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* Single admin endpoint. Every call must carry the caller's Supabase access
   token; we verify it server-side and check the email against the allowlist
   before doing anything with the service-role client. */

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "visiondegarcon@gmail.com,dngabo2@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authorize(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user?.email) return null;
  return ADMIN_EMAILS.includes(data.user.email.toLowerCase()) ? data.user : null;
}

export async function POST(req: NextRequest) {
  const user = await authorize(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const db = admin();
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    switch (action) {
      case "me":
        return NextResponse.json({ email: user.email });

      case "stats": {
        const { data: orders } = await db
          .from("orders")
          .select("id,total_cents,currency,status,fulfillment_status,created_at,email");
        const { data: variants } = await db.from("variants").select("id,stock");
        const paid = (orders ?? []).filter((o) => o.status === "paid");
        return NextResponse.json({
          orders: orders ?? [],
          totalSalesCents: paid.reduce((n, o) => n + o.total_cents, 0),
          orderCount: paid.length,
          unfulfilled: paid.filter((o) => o.fulfillment_status === "unfulfilled").length,
          unitsInStock: (variants ?? []).reduce((n, v) => n + v.stock, 0),
        });
      }

      case "list_orders": {
        const { data } = await db
          .from("orders")
          .select("*, order_items(product_title,variant_title,quantity,unit_price_cents)")
          .order("created_at", { ascending: false });
        return NextResponse.json({ orders: data ?? [] });
      }

      case "set_fulfillment": {
        const { orderId, fulfillment_status } = body;
        await db.from("orders").update({ fulfillment_status }).eq("id", orderId);
        return NextResponse.json({ ok: true });
      }

      case "list_products": {
        const { data } = await db
          .from("products")
          .select("*, product_images(id,url,position), variants(id,title,price_cents,compare_at_cents,stock,position)")
          .order("sort");
        return NextResponse.json({ products: data ?? [] });
      }

      case "update_product": {
        const { id, fields } = body; // {title?, handle?, description_html?, status?, sort?}
        const allowed = ["title", "handle", "description_html", "status", "sort"];
        const patch = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
        const { error } = await db.from("products").update(patch).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "create_product": {
        const { title } = body;
        const handle =
          String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
          "-" + Math.random().toString(36).slice(2, 6);
        const { data, error } = await db
          .from("products")
          .insert({ title, handle, status: "draft", sort: 50 })
          .select()
          .single();
        if (error) throw error;
        await db.from("variants").insert({ product_id: data.id, title: "Default", price_cents: 0, stock: 0, position: 0 });
        return NextResponse.json({ product: data });
      }

      case "delete_product": {
        await db.from("products").delete().eq("id", body.id);
        return NextResponse.json({ ok: true });
      }

      case "update_variant": {
        const { id, fields } = body; // {title?, price_cents?, compare_at_cents?, stock?}
        const allowed = ["title", "price_cents", "compare_at_cents", "stock", "position"];
        const patch = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
        const { error } = await db.from("variants").update(patch).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "create_variant": {
        const { productId, title } = body;
        const { data, error } = await db
          .from("variants")
          .insert({ product_id: productId, title, price_cents: 0, stock: 0, position: 99 })
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ variant: data });
      }

      case "delete_variant": {
        await db.from("variants").delete().eq("id", body.id);
        return NextResponse.json({ ok: true });
      }

      case "upload_image": {
        // base64 payload from the admin UI -> Supabase Storage (public bucket)
        const { productId, filename, base64 } = body;
        const ext = (filename.split(".").pop() || "png").toLowerCase();
        const path = `p${productId}/${Date.now()}.${ext}`;
        const buf = Buffer.from(base64, "base64");
        const { error } = await db.storage.from("product-images").upload(path, buf, {
          contentType: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`,
        });
        if (error) throw error;
        const { data: pub } = db.storage.from("product-images").getPublicUrl(path);
        const { data: maxPos } = await db
          .from("product_images")
          .select("position")
          .eq("product_id", productId)
          .order("position", { ascending: false })
          .limit(1);
        await db.from("product_images").insert({
          product_id: productId,
          url: pub.publicUrl,
          position: (maxPos?.[0]?.position ?? -1) + 1,
        });
        return NextResponse.json({ url: pub.publicUrl });
      }

      case "delete_image": {
        await db.from("product_images").delete().eq("id", body.id);
        return NextResponse.json({ ok: true });
      }

      case "customers": {
        const { data: orders } = await db
          .from("orders")
          .select("email,total_cents,status,created_at,shipping_name");
        const map = new Map<string, { email: string; name: string | null; orders: number; spentCents: number; last: string }>();
        for (const o of orders ?? []) {
          if (o.status !== "paid") continue;
          const cur = map.get(o.email) ?? { email: o.email, name: o.shipping_name, orders: 0, spentCents: 0, last: o.created_at };
          cur.orders += 1;
          cur.spentCents += o.total_cents;
          if (o.created_at > cur.last) cur.last = o.created_at;
          if (!cur.name && o.shipping_name) cur.name = o.shipping_name;
          map.set(o.email, cur);
        }
        return NextResponse.json({ customers: [...map.values()].sort((a, b) => b.spentCents - a.spentCents) });
      }

      case "get_settings": {
        const { data } = await db.from("site_settings").select("key,value");
        return NextResponse.json({ settings: Object.fromEntries((data ?? []).map((s) => [s.key, s.value])) });
      }

      case "update_settings": {
        const { settings } = body; // { key: value }
        const allowed = ["banner_text", "shipping_free_label", "shipping_intl_label", "shipping_intl_cents"];
        for (const [key, value] of Object.entries(settings ?? {})) {
          if (!allowed.includes(key)) continue;
          const { error } = await db
            .from("site_settings")
            .upsert({ key, value: String(value), updated_at: new Date().toISOString() });
          if (error) throw error;
        }
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
