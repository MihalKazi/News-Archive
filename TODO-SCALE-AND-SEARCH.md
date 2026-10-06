# TODO: search quality, scale, and open decisions

Parked for later. Read top to bottom before resuming work.

## Current state (2026-10-07)

- Articles: ~14.1k in Supabase (99 scraped here + 14,011 imported from Takedown Watch).
- Live outlets in ingest: Prothom Alo, Dhaka Tribune, TBS (+ Ittefaq, Dainik Azadi, DMPNews validated, not yet enabled).
- Search: keyword (tsvector `simple`, prefix, AND) + LLM concept expansion (Groq) + semantic (Workers AI `@cf/baai/bge-m3`, 1024-dim, one vector per article, first 1,500 chars) + threshold gate.
- Eval: `web/tests/search-cases.json`, runner `node web/scripts/search-eval.mjs`. Last run 2/6 pass (custodial death, RU journalist attack).
- Design: Impeccable direction round not finished. Playful stick-figure UI in place. Mobile overflow not verified (headless Chrome min width ~500px).
- DB size ~191 MB of 500 MB Supabase free cap.
- `article_chunks` table exists (migration 0002), empty. Chunk backfill not written yet.

## 1. Search quality (do first)

- [ ] Chunk long articles (~1,000 chars, sentence-aware, Bangla `।` included, cap 8 per article).
- [ ] Chunk embeddings into `article_chunks.embedding` (HNSW).
- [ ] Replace threshold gate with RRF fusion (keyword top-k + vector top-k).
- [ ] Rerank top 30 with local cross-encoder (`BAAI/bge-reranker-v2-m3`) via embed service.
- [ ] Persist LLM concept cache in DB (same query = same concepts across instances).
- [ ] Re-run eval. Target: all 6 cases pass. Add more cases from real journalist queries.
- [ ] Remove `article_embeddings` once chunks replace it (~50 MB).

## 2. Scale fixes (before ~200k articles)

- [ ] Semantic search: `ORDER BY embedding <=> query LIMIT k` (use HNSW). Current SQL computes similarity for every row in WHERE = full scan.
- [ ] Keyword search: cap candidates (e.g. top 1,000) before ranking. Common words ("police") match huge sets.
- [ ] Paging: keyset `(score, published_at, id)` instead of OFFSET.
- [ ] Index `article_tags(tag_id)` and `(tag_id, article_id)` for tag filter.
- [ ] Concept scoring only on capped candidate set, not all rows.
- [ ] DB client pool: `max: 5` too low for concurrent users. Use pooled connection, raise limit.
- [ ] Cache query embeddings and concept results.

## 3. Storage (before ~100k articles or at 500 MB)

- [ ] Do not store chunk text. Store offsets `(article_id, chunk_no, start, end)`, read text from `articles.body`.
- [ ] Drop `article_chunks.tsv` if offsets used. Use `ts_headline` for snippets.
- [ ] Move bodies to object storage (Supabase Storage / S3). Keep metadata + indexes in DB.
- [ ] Partition `articles` and chunks by year.
- [ ] Decide retention: keep all, or tier old data. Needs legal review.

## 4. Millions of articles

- [ ] Postgres stays source of truth. Consider OpenSearch/Elasticsearch for BM25 + kNN + Bangla analyzers at ~1M chunks.
- [ ] Load test at 1M synthetic rows before public launch.
- [ ] Measure HNSW build time and RAM.

## 5. Ingest and operations

- [ ] Enable Ittefaq, Dainik Azadi, DMPNews after validation (they returned items; Dhaka Post, Priyo, Dhaka Times 24, FE BD not usable yet).
- [ ] Re-validate Banglanews24 and Dhaka Post later (Cloudflare 403 at last check).
- [ ] Sync Takedown Watch incrementally (currently one-off import). Flag updated/removed articles.
- [ ] Dedup syndicated stories (cluster by embedding, "also in: X, Y").
- [ ] Per-outlet ingest budgets. Backfill job queue with retries.
- [ ] Monitoring: table sizes, p95 search latency, per-outlet zero-item alerts.
- [ ] Backups: Supabase Pro point-in-time restore, test once.
- [ ] Internet Archive (SPN) push per URL. Required by Takedown Watch invariant 2.
- [ ] Re-embed in background when model changes (store `model` per vector).

## 6. Product and access

- [ ] Finish Impeccable flow: direction round, finish review, DESIGN.md (documenter).
- [ ] Verify mobile layout on a real phone or DevTools emulation.
- [ ] Verify results state visually (only empty states captured).
- [ ] "Harassment" facet showed accent colour by default (unexplained; check).
- [ ] Invite-only accounts for journalists. Access audit log (who searched, who opened).
- [ ] Answers with citations (LLM over top results, cited sources only, never invented).
- [ ] Public access only after legal review (Bangladesh Cyber Security Act 2026 §26A risk).

## 7. Decisions needed from the user

- [ ] Retention: keep all articles, or tier/expire.
- [ ] Number of users and who gets access.
- [ ] Acceptable search latency (e.g. under 1 s at 1M articles).
- [ ] Paid tools: Supabase Pro (when past 500 MB), LLM/reranker keys for better quality.
- [ ] Product name confirmation: "News Archive". Company spelling "Activate Rights".
- [ ] Real journalist queries (10–20) with expected articles. Becomes the eval set.
- [ ] Hosting: VPS for web + crawler, or keep current setup.
- [ ] Outlet permissions: ask Kaler Kantho, Jugantor, Daily Star, bdnews24 for feed/API access.

## 8. Known blocked outlets (do not evade Cloudflare)

- Kaler Kantho: CF 403, no feed. Ask for access.
- Jugantor: homepage CF 403, sitemap only.
- Daily Star: `/rss.xml` 403, sitemap works in Takedown Watch.
- Dailynayadiganta, Jagonews24, The Dissent, BSS News: no feed/sitemap or empty.
- Manab Zamin: not probed.

## Pointers

- Search route: `web/app/api/search/route.ts`
- Concept expansion: `web/lib/expand.ts`
- Semantic query: `web/lib/semantic.ts`
- Embedding: `ingest/embed.py` (Workers AI), `ingest/embed_backfill.py`; query embed in `web/lib/semantic.ts`
- Ingest: `ingest/run.py`, `ingest/fetch.py`, `ingest/import_takedown.py`
- Vendored Takedown Watch parsers/fetcher: `ingest/takedown/`
- Schema: `web/db/schema.ts`, migrations `web/db/migrations/`
- Design contract: `.impeccable/surfaces/` (web-app-page-tsx.md), `PRODUCT.md`
