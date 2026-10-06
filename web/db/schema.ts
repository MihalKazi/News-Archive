import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Plain SQL in ingest/store.py targets these exact table and column names.
// Change here = change ingest SQL too.

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

export const tagSource = pgEnum("tag_source", ["auto", "human"]);

export const outlets = pgTable("outlets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull().unique(),
  feedUrl: text("feed_url").notNull(),
  active: boolean("active").notNull().default(true),
});

export const articles = pgTable(
  "articles",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    outletId: integer("outlet_id")
      .notNull()
      .references(() => outlets.id),
    url: text("url").notNull().unique(),
    title: text("title").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    body: text("body"),
    summary: text("summary"),
    language: text("language"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // 'simple' config: no stemming, no stopwords. Bangla-safe (no English
    // stemmer mangling Bangla). Upgrade config when a Bangla dictionary exists.
    searchTsv: tsvector("search_tsv").generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))`,
    ),
  },
  (t) => [
    index("articles_search_idx").using("gin", t.searchTsv),
    index("articles_published_idx").on(t.publishedAt),
    index("articles_outlet_idx").on(t.outletId),
  ],
);

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
});

export const articleTags = pgTable(
  "article_tags",
  {
    articleId: bigint("article_id", { mode: "number" })
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    source: tagSource("source").notNull().default("auto"),
    confidence: real("confidence"),
    model: text("model"),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.tagId] })],
);

// pgvector. Create extension once: create extension if not exists vector;
const vector = (name: string, dims: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType: () => `vector(${dims})`,
    toDriver: (v) => `[${v.join(",")}]`,
    fromDriver: (v) => v.slice(1, -1).split(",").map(Number),
  })(name);

export const articleEmbeddings = pgTable(
  "article_embeddings",
  {
    articleId: bigint("article_id", { mode: "number" })
      .primaryKey()
      .references(() => articles.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    embedding: vector("embedding", 384).notNull(),
  },
  (t) => [
    index("article_embeddings_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

// Passages of long articles. Each article splits into ~1,000-char chunks so every part
// of a long story is searchable and embeddable. Ranking runs over chunks, then groups to articles.
export const articleChunks = pgTable(
  "article_chunks",
  {
    articleId: bigint("article_id", { mode: "number" })
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    chunkNo: integer("chunk_no").notNull(),
    text: text("text").notNull(),
    tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('simple', text)`),
    embedding: vector("embedding", 384),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.chunkNo] }),
    index("article_chunks_tsv_idx").using("gin", t.tsv),
    index("article_chunks_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);
