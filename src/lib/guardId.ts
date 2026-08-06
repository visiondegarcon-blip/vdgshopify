import { cookies } from "next/headers";

/* Server-issued anti-abuse id for discount codes, distinct from the
   client-controlled analytics `sid`. The analytics sid comes straight from
   the request body — a shopper can rotate it per request in one line of
   devtools, which made `one_per_customer`/`first_order_only` trivially
   bypassable. This is httpOnly, so page JS can't read or change it; the only
   ways around it are clearing cookies or a private window, the same bar
   every cookie-based abuse guard accepts. */

const COOKIE = "vdg_gid";

export async function getOrSetGuardId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing) return existing;
  const id = crypto.randomUUID();
  store.set(COOKIE, id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  return id;
}
