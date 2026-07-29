"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { bindLifecycleFlush, bindWebVitals, track } from "@/lib/track";

/* Mounted once in the root layout. Fires a page_view per route change and
   binds web-vitals + flush-on-hide. Admin pages are not tracked. */
export default function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
    bindLifecycleFlush();
    bindWebVitals();
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    track("page_view");
  }, [pathname]);

  return null;
}
