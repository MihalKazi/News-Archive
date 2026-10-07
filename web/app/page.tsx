"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Search as SearchIcon } from "lucide-react";
import { StickFigure } from "./stick-figure";
import { CatchSearch } from "./catch-search";
import { SketchBox } from "./sketch-box";
import { LoadMoreToggle } from "./load-more-toggle";

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
  // Results show only after the catch animation finishes, even if the request returned earlier.
  const [revealed, setRevealed] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // Bring the animation to the middle of the screen whenever a search starts or plays.
  useEffect(() => {
    if (status === "loading") stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [status]);
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

  function search(e: FormEvent) {
    e.preventDefault();
    runSearch(query.trim());
  }

  // Suggestions: only queries verified to return results on the live archive.
  const SUGGESTIONS = [
    "arrested for writing against PM",
    "against PM",
    "PM Tarique Japan visit",
    "harassment women",
    "dengue",
    "ধর্ষণ",
  ];

  function runSuggestion(s: string) {
    setQuery(s);
    runSearch(s);
  }

  async function runSearch(q: string) {
    if (!q && !from && !to) return;

    setSubmitted(q);
    setActive({ q, from, to });
    setStatus("loading");
    setRevealed(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
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
            {status === "done" && revealed ? `${visible.length} found` : "stored articles"}
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-[1120px] px-4 pb-6 pt-8 md:pt-12">
        <div className="flex flex-col items-stretch gap-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="font-[family-name:var(--hand)] text-[clamp(2.6rem,7vw,4.6rem)] leading-[0.98] tracking-tight">
              Search Bangladeshi news
              <br />
              <span className="text-[var(--muted)]">by topic, name, or date.</span>
            </h1>
            <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--muted)]">
              Each result is an article from a monitored outlet, with its date and a link to the original.
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
              <motion.button
                type="submit"
                disabled={status === "loading"}
                whileTap={{ scale: 0.96 }}
                className="btn-sketch shrink-0"
              >
                {status === "loading" ? "Digging" : "Search"}
                <SearchIcon aria-hidden="true" size={18} strokeWidth={2} />
              </motion.button>
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
        </div>
      </section>

      {(status === "loading" || ((status === "done" || status === "error") && !revealed)) && (
        <div ref={stageRef} className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-4 px-4 pb-4 pt-2">
          <CatchSearch status={status} size={240} onSequenceEnd={() => setRevealed(true)} />
          <p className="font-[family-name:var(--hand)] text-[22px] text-[var(--muted)]">Searching the archive</p>
        </div>
      )}

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
            <SketchBox className="text-[var(--muted)]">
              <div className="flex flex-col gap-4 p-5">
                <div className="flex items-center gap-5">
                  <StickFigure pose="shrug" size={64} />
                  <p className="font-[family-name:var(--hand)] text-[21px] leading-snug text-[var(--muted)]">
                    Nothing searched yet. Try one of these:
                  </p>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <button type="button" onClick={() => runSuggestion(s)} className="chip-sketch">
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </SketchBox>
          )}
          {status === "error" && revealed && (
            <div role="alert" className="sketch-soft flex items-center gap-4 p-4">
              <StickFigure pose="shrug" size={52} />
              <p className="font-[family-name:var(--hand)] text-[20px] text-red-400">{error}</p>
              <button type="button" onClick={() => runSearch(active.q)} className="btn-sketch ml-auto shrink-0">
                Try again
              </button>
            </div>
          )}
          {status === "done" && revealed && results.length === 0 && (
            <SketchBox className="text-[var(--muted)]">
              <div className="flex items-center gap-5 p-5">
                <StickFigure pose="shrug" size={64} />
                <p className="font-[family-name:var(--hand)] text-[22px] text-[var(--muted)]">
                  No matching articles. Try a shorter word.
                </p>
              </div>
            </SketchBox>
          )}

          {status === "done" && revealed && results.length > 0 && (
            <>
              <p className="mb-2 font-[family-name:var(--hand)] text-[19px] text-[var(--muted)]">
                {visible.length} for &ldquo;{submitted || "all"}&rdquo;
              </p>
              {days.map(([day, items]) => (
                <section key={day}>
                  <h2 className="mt-7 font-[family-name:var(--hand)] text-[26px] leading-none">{day}</h2>
                  <ol className="mt-2">
                    {items.map((r, i) => (
                      <motion.li
                        key={r.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03, ease: [0.22, 1, 0.36, 1] }}
                        whileHover={{ x: 6 }}
                        whileTap={{ scale: 0.99 }}
                        className="result-row group grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-[var(--line)] px-2 py-3.5 transition-colors duration-300 hover:bg-[var(--panel)] md:grid-cols-[52px_62px_minmax(0,1fr)]"
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
                            className={`text-balance underline decoration-[var(--line)] decoration-2 underline-offset-4 hover:decoration-[var(--violet)] hover:text-[var(--violet)] group-hover:text-[var(--violet)] transition-colors duration-300 ${
                              isBangla(r.title)
                                ? "font-[family-name:var(--bn)] text-[17px] font-medium leading-[1.6]"
                                : "text-[17px] font-medium leading-snug"
                            }`}
                          >
                            {r.title}
                          </a>
                          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[var(--muted)]">
                            <span className="text-[var(--text)] transition-colors duration-300 group-hover:text-[var(--violet)]">{r.outlet.name}</span>
                            <time className="tabular-nums md:hidden">
                              {r.publishedAt ? DHAKA_TIME.format(new Date(r.publishedAt)) : "—"}
                            </time>
                            {r.tags.length > 0 && <span>{r.tags.map((t) => t.label).join(" · ")}</span>}
                          </p>
                        </div>
                      </motion.li>
                    ))}
                  </ol>
                </section>
              ))}
              {hasMore && (
                <div className="mt-8 flex flex-col items-center gap-2">
                  <LoadMoreToggle loading={loadingMore} hasMore={hasMore} onClick={loadMore} />
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
