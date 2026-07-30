"use client";
import { useEffect, useMemo, useState } from "react";
import { adminCall } from "../../adminApi";

/* Customer journeys — a Sankey-style flow of the first pages visitors see,
   plus a ranked list of full journeys. Opened from the Optimization page. */

type Journeys = {
  totalSessions: number;
  bouncedSessions: number;
  sequences: { steps: string[]; count: number }[];
  nodes: { step: number; path: string; count: number }[];
  transitions: { step: number; from: string; to: string; count: number }[];
};

const RANGES = { "7d": 7, "30d": 30, "90d": 90, All: 3650 } as const;
const STEPS = 4;
const COLORS = ["#2563eb", "#0d9488", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#65a30d", "#9ca3af"];

function label(path: string): string {
  if (path === "/") return "Home";
  if (path === "/store") return "Store";
  if (path === "/cart") return "Cart";
  if (path === "/about-us") return "About";
  if (path === "/account") return "Account";
  if (path === "/success") return "Order complete";
  if (path === "Other") return "Other";
  const m = path.match(/^\/products\/(.+)$/);
  if (m) return m[1].replace(/-/g, " ").toUpperCase();
  return path;
}

export default function JourneysPage() {
  const [range, setRange] = useState<keyof typeof RANGES>("All");
  const [d, setD] = useState<Journeys | null>(null);

  useEffect(() => {
    setD(null);
    adminCall<Journeys>("journeys", { days: RANGES[range] }).then(setD).catch(() => {});
  }, [range]);

  // Sankey layout: per step keep the top 6 pages, fold the rest into "Other"
  const sankey = useMemo(() => {
    if (!d) return null;
    const keepByStep: Map<string, string>[] = [];
    const columns: { path: string; count: number; y0: number; y1: number; color: string }[][] = [];
    const H = 320, GAP = 8, W = 980, NODE_W = 10;
    const colX = (s: number) => 30 + (s * (W - 160)) / (STEPS - 1);

    // one global scale (px per session) based on the busiest column, so later
    // columns visibly shrink as visitors drop off — like a real Sankey
    const colLists: { path: string; count: number }[][] = [];
    for (let s = 0; s < STEPS; s++) {
      const all = d.nodes.filter((n) => n.step === s).sort((a, b) => b.count - a.count);
      const keep = all.slice(0, 6);
      const otherCount = all.slice(6).reduce((sum, n) => sum + n.count, 0);
      const remap = new Map<string, string>();
      for (const n of all) remap.set(n.path, keep.includes(n) ? n.path : "Other");
      keepByStep.push(remap);
      const list = [...keep.map((n) => ({ path: n.path, count: n.count }))];
      if (otherCount) list.push({ path: "Other", count: otherCount });
      colLists.push(list);
    }
    const maxTotal = Math.max(1, ...colLists.map((l) => l.reduce((sum, n) => sum + n.count, 0)));
    const maxNodes = Math.max(1, ...colLists.map((l) => l.length));
    const pxPer = (H - GAP * (maxNodes - 1)) / maxTotal;
    for (const list of colLists) {
      let y = 0;
      columns.push(
        list.map((n, i) => {
          const h = Math.max(6, n.count * pxPer);
          const node = { ...n, y0: y, y1: y + h, color: n.path === "Other" ? "#9ca3af" : COLORS[i % COLORS.length] };
          y += h + GAP;
          return node;
        })
      );
    }

    // aggregate transitions onto the kept/folded node names
    const linkAgg = new Map<string, number>();
    for (const t of d.transitions) {
      if (t.step >= STEPS - 1) continue;
      const from = keepByStep[t.step]?.get(t.from) ?? "Other";
      const to = keepByStep[t.step + 1]?.get(t.to) ?? "Other";
      const k = `${t.step}|${from}|${to}`;
      linkAgg.set(k, (linkAgg.get(k) ?? 0) + t.count);
    }
    // assign link positions along each node edge
    const outOffset = new Map<string, number>();
    const inOffset = new Map<string, number>();
    const links: { x0: number; y0: number; x1: number; y1: number; w: number; color: string }[] = [];
    const sorted = [...linkAgg.entries()].sort((a, b) => b[1] - a[1]);
    for (const [k, count] of sorted) {
      const [stepStr, from, to] = k.split("|");
      const s = Number(stepStr);
      const a = columns[s]?.find((n) => n.path === from);
      const b = columns[s + 1]?.find((n) => n.path === to);
      if (!a || !b) continue;
      const aTotal = a.count || 1, bTotal = b.count || 1;
      const w = Math.max(1.5, Math.min((count / aTotal) * (a.y1 - a.y0), a.y1 - a.y0));
      const ao = outOffset.get(`${s}|${from}`) ?? 0;
      const bo = inOffset.get(`${s + 1}|${to}`) ?? 0;
      links.push({
        x0: colX(s) + NODE_W,
        y0: a.y0 + Math.min(ao + w / 2, a.y1 - a.y0 - w / 2 > 0 ? a.y1 - a.y0 - w / 2 : w / 2),
        x1: colX(s + 1),
        y1: b.y0 + Math.min(bo + ((count / bTotal) * (b.y1 - b.y0)) / 2, b.y1 - b.y0),
        w,
        color: a.color,
      });
      outOffset.set(`${s}|${from}`, ao + w);
      inOffset.set(`${s + 1}|${to}`, bo + (count / bTotal) * (b.y1 - b.y0));
    }
    return { columns, links, colX, NODE_W, W, H };
  }, [d]);

  const maxSeq = d?.sequences[0]?.count ?? 1;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/admin/optimization" className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs">
            ← Optimization
          </a>
          <h1 className="text-xl font-semibold">Customer journeys</h1>
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-300 bg-white p-0.5 text-xs">
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded-md px-2.5 py-1 ${range === r ? "bg-[#1a1a1a] text-white" : ""}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {!d && <p className="mt-6 text-sm text-gray-500">Mapping journeys…</p>}

      {d && (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {(
              [
                ["Sessions analysed", String(d.totalSessions)],
                ["Continued past first page", d.totalSessions ? `${Math.round(((d.totalSessions - d.bouncedSessions) / d.totalSessions) * 100)}%` : "—"],
                ["Bounced (one page only)", d.totalSessions ? `${Math.round((d.bouncedSessions / d.totalSessions) * 100)}%` : "—"],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="text-xs text-gray-600">{k}</div>
                <div className="mt-1 text-lg font-semibold">{v}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold">Flow — where visitors go, step by step</div>
            <div className="text-[11px] text-gray-400">Band thickness = share of visitors taking that path</div>
            {d.totalSessions === 0 ? (
              <p className="mt-4 text-sm text-gray-400">
                No visitor journeys in this range yet — journey tracking started with the new site
                (30 Jul 2026) and fills up as traffic arrives.
              </p>
            ) : (
              sankey && (
                <div className="overflow-x-auto">
                  <svg viewBox={`0 0 ${sankey.W} ${sankey.H + 60}`} className="mt-4 min-w-[760px]" style={{ width: "100%" }}>
                    {[0, 1, 2, 3].map((s) => (
                      <text key={s} x={sankey.colX(s) + 5} y={14} fontSize={11} fill="#9ca3af" fontWeight={600}>
                        {s === 0 ? "LANDED ON" : `PAGE ${s + 1}`}
                      </text>
                    ))}
                    <g transform="translate(0,26)">
                      {sankey.links.map((l, i) => {
                        const mx = (l.x0 + l.x1) / 2;
                        return (
                          <path
                            key={i}
                            d={`M ${l.x0} ${l.y0} C ${mx} ${l.y0}, ${mx} ${l.y1}, ${l.x1} ${l.y1}`}
                            stroke={l.color}
                            strokeWidth={l.w}
                            strokeOpacity={0.3}
                            fill="none"
                          />
                        );
                      })}
                      {sankey.columns.map((col, s) =>
                        col.map((n) => (
                          <g key={`${s}-${n.path}`}>
                            <rect x={sankey.colX(s)} y={n.y0} width={sankey.NODE_W} height={n.y1 - n.y0} rx={2} fill={n.color} />
                            <text x={sankey.colX(s) + sankey.NODE_W + 6} y={(n.y0 + n.y1) / 2 + 4} fontSize={11} fill="#374151">
                              {label(n.path)} <tspan fill="#9ca3af">({n.count})</tspan>
                            </text>
                          </g>
                        ))
                      )}
                    </g>
                  </svg>
                </div>
              )
            )}
          </div>

          <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold">Most common full journeys</div>
            <div className="mt-3 flex flex-col gap-2.5">
              {d.sequences.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 text-right text-sm font-semibold">{s.count}×</div>
                  <div className="h-2 w-24 shrink-0 overflow-hidden rounded bg-gray-100">
                    <div className="h-full rounded bg-[#1a1a1a]" style={{ width: `${(s.count / maxSeq) * 100}%` }} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                    {s.steps.map((p, j) => (
                      <span key={j} className="flex items-center gap-1.5">
                        {j > 0 && <span className="text-gray-300">→</span>}
                        <span className="rounded-md bg-gray-100 px-2 py-0.5">{label(p)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {d.sequences.length === 0 && <p className="text-sm text-gray-400">No journeys recorded in this range.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
