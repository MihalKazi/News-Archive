"use client";

import { FormEvent, useMemo, useState } from "react";
import { StickFigure } from "./stick-figure";

type Tag = { slug: string; label: string; source: "auto" | "human"; confidence: number | null };

type SearchResult = {
  id: number;
  title: string;
  url: string;
  publishedAt: string | null;
  outlet: { name: string; domain: string };
  tags: Tag[];
};

type Status = "idle" | "loading" | "done" | "error";

const PAGE_SIZE = 25;

const DHAKA_DAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});
const DHAKA_TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

const isBangla = (s: string) => /[ঀ-৿]/.test(s);

export default function Page() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [outletFilter, setOutletFilter] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const outlets = useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>();
    for (const r of results) {
      const cur = counts.get(r.outlet.domain) ?? { name: r.outlet.name, n: 0 };
      counts.set(r.outlet.domain, { name: cur.name, n: cur.n + 1 });
    }
    return [...counts.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [results]);

  const visible = useMemo(
    () => (outletFilter ? results.filter((r) => r.outlet.domain === outletFilter) : results),
    [results, outletFilter],
  );

  const days = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of visible) {
      const key = r.publishedAt ? DHAKA_DAY.format(new Date(r.publishedAt)) : "Date unknown";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [visible]);

  // Snapshot of the last submitted search, so Load more keeps the same query
  // even if the user edits the fields afterwards.
  const [active, setActive] = useState({ q: "", from: "", to: "" });
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  function buildParams(q: string, f: string, t: string, offset: number) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (q) params.set("q", q);
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    return params.toString();
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q && !from && !to) return;

    setSubmitted(q);
    setActive({ q, from, to });
    setStatus("loading");
    setError(null);
    setOutletFilter(null);
    setHasMore(false);

    try {
      const res = await fetch(`/api/search?${buildParams(q, from, to, 0)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Search failed (${res.status})`);
      const page = data.results as SearchResult[];
      setResults(page);
      setHasMore(page.length === PAGE_SIZE);
      setStatus("done");
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "Search failed");
      setStatus("error");
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?${buildParams(active.q, active.from, active.to, results.length)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Load failed (${res.status})`);
      const page = data.results as SearchResult[];
      setResults((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.filter((r) => !seen.has(r.id))];
      });
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--bg)] px-4 py-4">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4">
          <span className="font-[family-name:var(--hand)] text-[30px] leading-none">News Archive</span>
          <span className="font-[family-name:var(--hand)] text-[18px] text-[var(--muted)]">
            {status === "done" ? `${visible.length} found` : "stored articles"}
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-[1120px] px-4 pb-6 pt-8 md:pt-12">
        <div className="flex flex-col items-stretch gap-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="font-[family-name:var(--hand)] text-[clamp(2.6rem,7vw,4.6rem)] leading-[0.98] tracking-tight">
              Find the story.
              <br />
              <span className="text-[var(--muted)]">Then open the source.</span>
            </h1>
            <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--muted)]">
              Every result is a real article from the outlets we monitor, with its date and a link to the original.
            </p>

            <form onSubmit={search} className="mt-6 flex items-stretch gap-3">
              <input
                aria-label="Search the archive"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="dengue, Tarique Rahman, ডেঙ্গু"
                className="field-sketch w-0 min-w-0 flex-1 text-[20px] placeholder:text-[var(--muted)]"
              />
              <button type="submit" disabled={status === "loading"} className="btn-sketch shrink-0">
                {status === "loading" ? "Digging" : "Search"}
                <span aria-hidden="true">→</span>
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-end gap-3 font-[family-name:var(--hand)] text-[17px] text-[var(--muted)]">
              <label className="flex flex-col gap-1">
                From
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field-sketch text-base" />
              </label>
              <label className="flex flex-col gap-1">
                To
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field-sketch text-base" />
              </label>
            </div>
          </div>
          <div className="hidden md:block">
            <StickFigure pose={status === "loading" ? "write" : "hold"} size={110} />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-8 px-4 pb-16 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
        <aside className="min-w-0 space-y-7 md:sticky md:top-24 md:self-start">

          {outlets.length > 0 && (
            <section>
              <h2 className="mb-3 font-[family-name:var(--hand)] text-[20px] text-[var(--muted)]">Outlet</h2>
              <ul className="space-y-1.5 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => setOutletFilter(null)}
                    aria-current={outletFilter === null ? "true" : undefined}
                    className={`flex w-full justify-between rounded-md px-2 py-1 text-left hover:bg-[var(--panel)] ${
                      outletFilter === null ? "text-[var(--accent)]" : ""
                    }`}
                  >
                    All outlets <span className="tabular-nums text-[var(--muted)]">{results.length}</span>
                  </button>
                </li>
                {outlets.map(([domain, o]) => (
                  <li key={domain}>
                    <button
                      type="button"
                      onClick={() => setOutletFilter(domain)}
                      aria-current={outletFilter === domain ? "true" : undefined}
                      className={`flex w-full justify-between rounded-md px-2 py-1 text-left hover:bg-[var(--panel)] ${
                        outletFilter === domain ? "text-[var(--accent)]" : ""
                      }`}
                    >
                      {o.name} <span className="tabular-nums text-[var(--muted)]">{o.n}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        <main className="min-w-0">
          {status === "idle" && (
            <div className="sketch-soft flex items-center gap-5 p-5">
              <StickFigure pose="shrug" size={64} />
              <p className="font-[family-name:var(--hand)] text-[21px] leading-snug text-[var(--muted)]">
                Nothing searched yet. Try <span className="text-[var(--text)]">dengue</span> or{" "}
                <span className="text-[var(--text)]">Tarique Rahman</span>.
              </p>
            </div>
          )}
          {status === "loading" && (
            <div className="flex items-center gap-4 p-2">
              <StickFigure pose="write" size={56} />
              <p className="font-[family-name:var(--hand)] text-[20px] text-[var(--muted)]">Searching the archive</p>
            </div>
          )}
          {status === "error" && (
            <div role="alert" className="sketch-soft flex items-center gap-4 p-4">
              <StickFigure pose="shrug" size={52} />
              <p className="font-[family-name:var(--hand)] text-[20px] text-red-400">{error}</p>
            </div>
          )}
          {status === "done" && results.length === 0 && (
            <div className="sketch-soft flex items-center gap-5 p-5">
              <StickFigure pose="shrug" size={64} />
              <p className="font-[family-name:var(--hand)] text-[22px] text-[var(--muted)]">
                No matching articles. Try a shorter word.
              </p>
            </div>
          )}

          {status === "done" && results.length > 0 && (
            <>
              <p className="mb-2 font-[family-name:var(--hand)] text-[19px] text-[var(--muted)]">
                {visible.length} for &ldquo;{submitted || "all"}&rdquo;
              </p>
              {days.map(([day, items]) => (
                <section key={day}>
                  <h2 className="mt-7 font-[family-name:var(--hand)] text-[26px] leading-none">{day}</h2>
                  <ol className="mt-2">
                    {items.map((r, i) => (
                      <li
                        key={r.id}
                        className="result-row grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-[var(--line)] py-3.5 md:grid-cols-[52px_62px_minmax(0,1fr)]"
                      >
                        <span className="row-num pt-0.5 font-[family-name:var(--hand)] text-[20px] text-[var(--accent)]">
                          {i + 1}
                        </span>
                        <time
                          dateTime={r.publishedAt ?? undefined}
                          className="hidden pt-1 text-[13px] tabular-nums text-[var(--muted)] md:block"
                        >
                          {r.publishedAt ? DHAKA_TIME.format(new Date(r.publishedAt)) : "—"}
                        </time>
                        <div className="min-w-0">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            lang={isBangla(r.title) ? "bn" : undefined}
                            className={`text-balance underline decoration-[var(--line)] decoration-2 underline-offset-4 hover:decoration-[var(--accent)] ${
                              isBangla(r.title)
                                ? "font-[family-name:var(--bn)] text-[17px] font-medium leading-[1.6]"
                                : "text-[17px] font-medium leading-snug"
                            }`}
                          >
                            {r.title}
                          </a>
                          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[var(--muted)]">
                            <span className="text-[var(--text)]">{r.outlet.name}</span>
                            <time className="tabular-nums md:hidden">
                              {r.publishedAt ? DHAKA_TIME.format(new Date(r.publishedAt)) : "—"}
                            </time>
                            <span>{r.tags.length ? r.tags.map((t) => t.label).join(" · ") : "untagged"}</span>
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
              {hasMore && (
                <div className="mt-8 flex items-center gap-4">
                  <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-sketch">
                    {loadingMore ? "Fetching more" : "Load more"}
                  </button>
                  <span className="font-[family-name:var(--hand)] text-[17px] text-[var(--muted)]">
                    {results.length} shown so far
                  </span>
                </div>
              )}
              {error && (
                <p role="alert" className="mt-4 font-[family-name:var(--hand)] text-[18px] text-red-400">
                  {error}
                </p>
              )}
            </>
          )}
        </main>
      </div>

      <footer className="mx-auto flex max-w-[1120px] flex-wrap items-baseline justify-between gap-3 border-t border-[var(--line)] px-4 py-6 font-[family-name:var(--hand)] text-[17px] text-[var(--muted)]">
        <span>A project of Activate Rights</span>
        <span>Results link to the original article. Nothing here is written by a machine.</span>
      </footer>
    </div>
  );
}
