# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing: Next.js (App Router), TypeScript, Tailwind, Drizzle ORM, Postgres (Supabase). Search API at `web/app/api/search/route.ts`. Demo gate: basic auth in `web/proxy.ts`.

## Users

Journalists and newsroom staff. They check what Bangladeshi outlets published, find stories to follow up, and verify coverage. Secondary use by researchers is not the design target for this release.

## Product Purpose

A searchable archive of stored news articles from Bangladeshi outlets. Each result is the article itself, with its outlet, date, tags, and a link to the original. Success: a journalist finds the right stories in seconds and opens the source.

## Positioning

Shows the articles themselves with their original links. It does not generate answers. Results come only from stored articles.

## Operating Context

Used at a desk, on laptop and phone, often in Bangla and English. Users scan lists of headlines quickly, then open sources. Search is repeated many times per session with varied wording.

## Capabilities and Constraints

- Keyword search (Bangla and English), concept expansion via LLM, semantic search via local embeddings.
- Filters: outlet, tag, date range.
- Results sorted by relevance, then newest.
- Not yet built: answers with citations, accounts for individual users, Internet Archive copies.
- Article bodies are raw as extracted. Stub and index pages are filtered at query time.
- Undecided: final product name. "News Archive" is a working title.

## Brand Commitments

- Results are articles with source links. No generated or uncited answer text.
- Internal use only until legal review. Sister project Takedown Watch keeps its internal data private until its milestone M4. The search stays behind the login gate.
- Never present a result as more than the article says. Never invent a title, date, or claim.

## Evidence on Hand

- About 14,100 stored articles, each with title, outlet, date, source URL, and body text where extracted.
- Tags on a subset (auto-generated; labeled as auto).
- Outlets in the archive: 13 with articles. Only 3 fetched live.
- No customer, testimonial, or benchmark claims exist. Do not fabricate any.

## Product Principles

1. The article is the answer. Show it, date it, source it.
2. Scanning beats decoration. A journalist should read ten results without effort.
3. Bangla is first-class. Headlines in Bangla are set to read well, not as a fallback.
4. Provenance is always visible: outlet, date, and whether a tag is automatic or human.
5. Restraint in tone. The archive is a record, not a product pitch.

## Accessibility & Inclusion

Bangla and English both set legibly on phone and desktop. Keyboard-operable search and results. Respect dark mode and reduced motion.
