// TEMP: backfill progress. Remove with app/progress once embedding backfill is done.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const [row] = await db.execute<{
    articles: number;
    embedded: number;
    tagged: number;
    outlets_active: number;
    latest: string | null;
  }>(sql`
    select
      (select count(*)::int from articles) as articles,
      (select count(*)::int from article_embeddings) as embedded,
      (select count(distinct article_id)::int from article_tags) as tagged,
      (select count(*)::int from outlets where active) as outlets_active,
      (select max(fetched_at)::text from articles) as latest
  `);
  return NextResponse.json({ ...row, at: new Date().toISOString() });
}
