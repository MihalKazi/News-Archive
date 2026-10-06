# News Archive

Daily ingest of Bangladeshi outlet RSS feeds, auto-tagging, and search.
Search results always link to source. No LLM answers in phase 1.

## Setup

1. Postgres: create Neon or Supabase DB. Copy pooled `DATABASE_URL`.
2. Web env: `cp .env.example web/.env.local`, fill values.
3. Schema + seed:
   ```
   cd web
   npm install
   npm run db:migrate
   npm run db:seed
   ```
4. Enable outlets: `web/db/seed/outlets.json` feed URLs are unverified and ship `"active": false`. Check each `feedUrl`, set `active: true`, then re-seed or run `update outlets set active = true where domain = '...'`.
5. Web dev: `npm run dev` (basic auth via `DEMO_USER` / `DEMO_PASSWORD`).

## Ingest

```
cd ingest
python -m venv .venv && .venv\Scripts\activate   # or source .venv/bin/activate
pip install -r requirements.txt
pytest tests -q
export DATABASE_URL=... GROQ_API_KEY=... TAGGING_MODEL=... INGEST_USER_AGENT=...
python run.py
```

Daily run: `.github/workflows/ingest.yml` (02:00 UTC). Set repo secrets `DATABASE_URL`, `GROQ_API_KEY`; optional vars `TAGGING_MODEL`, `MAX_ARTICLES_PER_RUN`, `INGEST_USER_AGENT`.

## Notes

- Tag list lives in `web/lib/tags.ts` and mirrors `ingest/tagging.py`. `ingest/tests/test_tags_mirror.py` enforces sync.
- LLM provider: only `tagging.complete()` touches Groq.
- Bangla search uses Postgres `simple` config: no stemming. Matches whole tokens only.
