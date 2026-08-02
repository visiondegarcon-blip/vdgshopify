import { createClient } from "@supabase/supabase-js";

/* Shipping, priced per geographic region.
 *
 * A region prices one of two ways. In "flat" mode (the simple default) it
 * charges one price per service regardless of weight. In "weight" mode it uses
 * the bracket ladder described below. Everything after this paragraph applies
 * to weight mode only.
 *
 * A cart's total weight is the sum of each variant's weight_g (variants
 * default to the store's shipping_default_weight_g when unset). That total is
 * charged at the cheapest bracket whose max_weight_g covers it — so a 300g tee
 * plus a 400g chain (700g) falls into the 1kg bracket, matching how couriers
 * actually bill.
 *
 * Carts heavier than the region's largest bracket don't fall through a gap:
 * when shipping_overflow_enabled is on, they're charged that largest bracket
 * plus a flat per-500g surcharge for the excess. That means the admin never
 * has to enumerate brackets forever, and adding (say) a real 4kg bracket later
 * simply takes over from the surcharge with no code change.
 *
 * Prices are always computed here, server-side, from the DB — the client sends
 * a destination country and a service name, never an amount.
 */

export type ShippingService = "standard" | "express";

export type ShippingQuote = {
  service: ShippingService;
  label: string;
  priceCents: number;
  regionName: string;
  totalWeightG: number;
};

type RateRow = { service: string; max_weight_g: number; price_cents: number };

const SERVICE_LABEL: Record<ShippingService, string> = {
  standard: "Standard",
  express: "Express",
};

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Total cart weight in grams, falling back to the store default per unit. */
export async function cartWeightG(
  items: { variantId: number; qty: number }[],
  defaultWeightG: number
): Promise<number> {
  const ids = items.map((i) => i.variantId);
  if (!ids.length) return 0;
  const { data } = await db().from("variants").select("id,weight_g").in("id", ids);
  let total = 0;
  for (const item of items) {
    const row = (data ?? []).find((v) => v.id === item.variantId);
    const each = row?.weight_g ?? defaultWeightG;
    total += Math.max(0, each) * Math.max(1, item.qty);
  }
  return total;
}

function priceForWeight(
  rates: RateRow[],
  service: ShippingService,
  weightG: number,
  overflow: { enabled: boolean; per500gCents: number }
): number | null {
  const brackets = rates
    .filter((r) => r.service === service)
    .sort((a, b) => a.max_weight_g - b.max_weight_g);
  if (!brackets.length) return null;

  const fits = brackets.find((b) => weightG <= b.max_weight_g);
  if (fits) return fits.price_cents;

  // Heavier than every bracket the admin has defined.
  if (!overflow.enabled) return null;
  const top = brackets[brackets.length - 1];
  const excess = weightG - top.max_weight_g;
  const blocks = Math.ceil(excess / 500);
  return top.price_cents + blocks * overflow.per500gCents;
}

/**
 * Shipping options for a destination. Returns [] when the country isn't in any
 * region (i.e. the store doesn't ship there) so callers can refuse checkout.
 */
export async function quoteShipping(
  countryCode: string,
  items: { variantId: number; qty: number }[]
): Promise<ShippingQuote[]> {
  const supabase = db();
  const country = countryCode.trim().toUpperCase();

  const { data: settingsRows } = await supabase.from("site_settings").select("key,value");
  const settings = Object.fromEntries((settingsRows ?? []).map((s) => [s.key, s.value]));
  const defaultWeightG = Math.max(0, parseInt(settings.shipping_default_weight_g ?? "500", 10) || 500);
  const overflow = {
    enabled: (settings.shipping_overflow_enabled ?? "true") !== "false",
    per500gCents: Math.max(0, parseInt(settings.shipping_overflow_per_500g_cents ?? "1500", 10) || 0),
  };

  const { data: regions } = await supabase
    .from("shipping_regions")
    .select("id,name,countries,pricing_mode,flat_standard_cents,flat_express_cents")
    .order("sort");
  const region = (regions ?? []).find((r) => (r.countries ?? []).includes(country));
  if (!region) return [];

  const flat = region.pricing_mode !== "weight";
  const { data: rates } = flat
    ? { data: [] as RateRow[] }
    : await supabase
        .from("shipping_rates")
        .select("service,max_weight_g,price_cents")
        .eq("region_id", region.id);
  if (!flat && !rates?.length) return [];

  // Weight is still reported in flat mode — it's useful on the packing slip
  // even when it doesn't affect the price.
  const totalWeightG = await cartWeightG(items, defaultWeightG);

  const flatPrice = (service: ShippingService) =>
    service === "standard" ? region.flat_standard_cents : region.flat_express_cents;

  const quotes: ShippingQuote[] = [];
  for (const service of ["standard", "express"] as ShippingService[]) {
    const priceCents = flat
      ? // null (not 0) means "this region doesn't offer that service"
        (flatPrice(service) ?? null)
      : priceForWeight(rates ?? [], service, totalWeightG, overflow);
    if (priceCents === null) continue;
    quotes.push({
      service,
      label: `${SERVICE_LABEL[service]} — ${region.name}`,
      priceCents,
      regionName: region.name,
      totalWeightG,
    });
  }
  return quotes;
}

/** Countries the store currently ships to, derived from the region table. */
export async function shippableCountries(): Promise<string[]> {
  const { data } = await db().from("shipping_regions").select("countries");
  return [...new Set((data ?? []).flatMap((r) => r.countries ?? []))].sort();
}
