CREATE TABLE "article_chunks" (
	"article_id" bigint NOT NULL,
	"chunk_no" integer NOT NULL,
	"text" text NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED,
	"embedding" vector(384),
	CONSTRAINT "article_chunks_article_id_chunk_no_pk" PRIMARY KEY("article_id","chunk_no")
);
--> statement-breakpoint
ALTER TABLE "article_chunks" ADD CONSTRAINT "article_chunks_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_chunks_tsv_idx" ON "article_chunks" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "article_chunks_hnsw_idx" ON "article_chunks" USING hnsw ("embedding" vector_cosine_ops);