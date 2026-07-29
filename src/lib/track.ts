"use client";
import { onLCP, onINP, onCLS, type Metric } from "web-vitals";

/* First-party analytics client. Anonymous session id in localStorage (no
   cookies), events batched and flushed with sendBeacon so navigation never
   blocks. The server enriches with geo (Vercel headers) + device class. */

const KEY = "vdg-sid";
let queue: Record<string, unknown>[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let vitalsBound = false;

export function sessionId(): string {
  if (typeof window === "undefined") return "server";
  let sid = localStorage.getItem(KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(KEY, sid);
  }
  return sid;
}

function flush() {
  if (!queue.length) return;
  const payload = JSON.stringify({ events: queue });
  queue = [];
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
  } else {
    fetch("/api/track", { method: "POST", body: payload, keepalive: true }).catch(() => {});
  }
}

export function track(event: string, meta: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  queue.push({
    session_id: sessionId(),
    event,
    path: location.pathname,
    referrer: document.referrer || null,
    meta,
    // client timestamp only as a hint; server stamps authoritative ts
    t: Date.now(),
  });
  if (queue.length >= 8) flush();
  else {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 3000);
  }
}

export function bindLifecycleFlush() {
  if (typeof window === "undefined") return;
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  addEventListener("pagehide", flush);
}

export function bindWebVitals() {
  if (vitalsBound || typeof window === "undefined") return;
  vitalsBound = true;
  const report = (m: Metric) =>
    track("web_vital", { name: m.name, value: Math.round(m.value * 1000) / 1000, rating: m.rating });
  onLCP(report);
  onINP(report);
  onCLS(report);
}
