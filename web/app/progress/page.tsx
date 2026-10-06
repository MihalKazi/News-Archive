// TEMP: live progress. Remove with app/api/progress.
"use client";

import { useEffect, useState } from "react";

type Progress = {
  articles: number;
  embedded: number;
  tagged: number;
  outlets_active: number;
  latest: string | null;
  at: string;
};

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums">
          {value.toLocaleString()} / {total.toLocaleString()} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded bg-black/10 dark:bg-white/10">
        <div className="h-full bg-black transition-all duration-500 dark:bg-white" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const [p, setP] = useState<Progress | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch("/api/progress", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Progress;
        if (alive) {
          setP(data);
          setErr(null);
        }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "error");
      }
    }
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Pipeline progress</h1>
      <p className="text-sm opacity-70">Live. Refreshes every 3 s. Temporary page.</p>
      {err && <p className="text-red-600">{err}</p>}
      {p && (
        <>
          <Bar label="Embedded (semantic search)" value={p.embedded} total={p.articles} />
          <Bar label="Tagged (auto)" value={p.tagged} total={p.articles} />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded border border-black/10 p-3 dark:border-white/15">
              <div className="opacity-70">Articles stored</div>
              <div className="text-xl tabular-nums">{p.articles.toLocaleString()}</div>
            </div>
            <div className="rounded border border-black/10 p-3 dark:border-white/15">
              <div className="opacity-70">Active outlets</div>
              <div className="text-xl tabular-nums">{p.outlets_active}</div>
            </div>
          </div>
          <p className="text-xs opacity-60">
            Latest fetched_at: {p.latest ?? "n/a"} · checked {new Date(p.at).toLocaleTimeString()}
          </p>
        </>
      )}
    </main>
  );
}
