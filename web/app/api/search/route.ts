import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, gte, inArray, lt, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { articleEmbeddings, articleTags, articles, outlets, tags } from "@/db/schema";
import { TAG_SLUGS } from "@/lib/tags";
import { conceptQueries, expandQuery } from "@/lib/expand";
import { SEMANTIC_MIN_SIM, SEMANTIC_STRICT_SIM, embedQuery, toPgVector } from "@/lib/semantic";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

// Words that carry no topic. Dropped before matching.
const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "and", "or", "with",
  "by", "from", "is", "are", "was", "were", "be", "as", "that", "this", "it",
  "about", "into", "after", "before", "over",
]);

// Build tsquery: every term must match (AND), prefix match so "harassment" hits "harass".
// Bare years are dropped here; use from/to for dates. Only letters/digits survive
// sanitising (letters, marks such as Bangla vowel signs and virama, digits), so the
// string is safe for to_tsquery.
function buildTsQuery(q: string): string | null {
  const terms = q
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d{4}$/.test(t));
  if (!terms.length) return null;
  return [...new Set(terms)].map((t) => `${t}:*`).join(" & ");
}

function parseDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  const q = (p.get("q") ?? "").trim();
  const tagSlugs = (p.get("tags") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const outletDomain = (p.get("outlet") ?? "").trim();
  const fromRaw = (p.get("from") ?? "").trim();
  const toRaw = (p.get("to") ?? "").trim();

  const limit = Math.min(
    Math.max(parseInt(p.get("limit") ?? "", 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(parseInt(p.get("offset") ?? "", 10) || 0, 0);

  const unknown = tagSlugs.filter((s) => !TAG_SLUGS.includes(s));
  if (unknown.length) return badRequest(`unknown tag: ${unknown.join(", ")}`);

  // Always on: drop index/stub pages (not articles). Tag index titles, date-only titles,
  // and bodies too short to be a story.
  const conditions: SQL[] = [
    sql`${articles.title} not like 'Tags :%'`,
    sql`${articles.title} !~ '^[0-9/ .:-]+$'`,
    sql`coalesce(length(${articles.body}), 0) >= 200`,
  ];
  // Relevance first when a text query is given, then newest. Date-only browse keeps date order.
  const orderBy: SQL[] = [];

  if (q) {
    // Hybrid. Keyword side: LLM concepts (or plain keywords if LLM down).
    // Semantic side: multilingual embedding similarity (if embed service up).
    // An article passes if either side passes. Order: combined score, then date.
    const [concepts, vec] = await Promise.all([expandQuery(q), embedQuery(q)]);

    const cqs = concepts ? conceptQueries(concepts) : [];
    let kwPass: SQL | null = null;
    let kwHits: SQL = sql`0`;
    if (cqs.length) {
      // Prefilter OR over all concepts (GIN index), then keep articles matching enough
      // concepts: all when 1-2, all but one when 3+.
      const anyMatch = sql`to_tsquery('simple', ${cqs.map((c) => `(${c})`).join(" | ")})`;
      kwHits = sql`(${sql.join(
        cqs.map((c) => sql`(case when ${articles.searchTsv} @@ to_tsquery('simple', ${c}) then 1 else 0 end)`),
        sql` + `,
      )})`;
      const need = cqs.length >= 3 ? cqs.length - 1 : cqs.length;
      kwPass = sql`(${sql`${articles.searchTsv} @@ ${anyMatch}`} and ${kwHits} >= ${need})`;
    } else if (!vec) {
      const tsquery = buildTsQuery(q);
      if (tsquery) {
        const match = sql`to_tsquery('simple', ${tsquery})`;
        kwPass = sql`${articles.searchTsv} @@ ${match}`;
        orderBy.push(sql`ts_rank(${articles.searchTsv}, ${match}) desc`);
      }
    }

    let semPass: SQL | null = null;
    let sim: SQL = sql`0`;
    if (vec) {
      sim = sql`(1 - (${articleEmbeddings.embedding} <=> ${toPgVector(vec)}::vector))`;
      // Semantic alone needs STRICT. With a keyword concept hit, MIN is enough.
      semPass = cqs.length
        ? sql`(${sim} >= ${SEMANTIC_STRICT_SIM} or (${sim} >= ${SEMANTIC_MIN_SIM} and ${kwHits} >= 1))`
        : sql`${sim} >= ${SEMANTIC_STRICT_SIM}`;
    }

    const passes = [kwPass, semPass].filter((p): p is SQL => p !== null);
    if (passes.length) {
      conditions.push(sql`(${sql.join(passes, sql` or `)})`);
      orderBy.unshift(sql`(coalesce(${sim}, 0) + 0.1 * ${kwHits}) desc`);
    }
  }

  if (fromRaw) {
    const from = parseDate(fromRaw);
    if (!from) return badRequest("invalid from date");
    conditions.push(gte(articles.publishedAt, from));
  }

  if (toRaw) {
    const to = parseDate(toRaw);
    if (!to) return badRequest("invalid to date");
    // Date-only "to" is inclusive of the whole day.
    if (DATE_ONLY.test(toRaw)) {
      conditions.push(lt(articles.publishedAt, new Date(to.getTime() + DAY_MS)));
    } else {
      conditions.push(lte(articles.publishedAt, to));
    }
  }

  if (outletDomain) {
    conditions.push(eq(outlets.domain, outletDomain));
  }

  if (tagSlugs.length) {
    const slugList = sql.join(
      tagSlugs.map((s) => sql`${s}`),
      sql`, `,
    );
    conditions.push(sql`exists (
      select 1 from ${articleTags} at
      join ${tags} t on t.id = at.tag_id
      where at.article_id = ${articles.id} and t.slug in (${slugList})
    )`);
  }

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      url: articles.url,
      publishedAt: articles.publishedAt,
      outletName: outlets.name,
      outletDomain: outlets.domain,
    })
    .from(articles)
    .innerJoin(outlets, eq(outlets.id, articles.outletId))
    .leftJoin(articleEmbeddings, eq(articleEmbeddings.articleId, articles.id))
    .where(and(...conditions))
    .orderBy(...orderBy, sql`${articles.publishedAt} desc nulls last`, desc(articles.id))
    .limit(limit)
    .offset(offset);

  const ids = rows.map((r) => r.id);
  const tagRows = ids.length
    ? await db
        .select({
          articleId: articleTags.articleId,
          slug: tags.slug,
          label: tags.label,
          source: articleTags.source,
          confidence: articleTags.confidence,
        })
        .from(articleTags)
        .innerJoin(tags, eq(tags.id, articleTags.tagId))
        .where(inArray(articleTags.articleId, ids))
        .orderBy(asc(tags.slug))
    : [];

  const tagsByArticle = new Map<number, typeof tagRows>();
  for (const t of tagRows) {
    const list = tagsByArticle.get(t.articleId) ?? [];
    list.push(t);
    tagsByArticle.set(t.articleId, list);
  }

  const results = rows.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    publishedAt: r.publishedAt,
    outlet: { name: r.outletName, domain: r.outletDomain },
    tags: (tagsByArticle.get(r.id) ?? []).map((t) => ({
      slug: t.slug,
      label: t.label,
      source: t.source,
      confidence: t.confidence,
    })),
  }));

  return NextResponse.json({ results, count: results.length, limit, offset });
}
