CREATE TABLE "article_embeddings" (
	"article_id" bigint PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"embedding" vector(384) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_embeddings" ADD CONSTRAINT "article_embeddings_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_embeddings_hnsw_idx" ON "article_embeddings" USING hnsw ("embedding" vector_cosine_ops);