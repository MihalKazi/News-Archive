-- Switch embeddings from local e5-small (384) to Workers AI bge-m3 (1024).
-- Old vectors are a different model and cannot be compared, so they are removed.
-- Keyword search is unaffected. Semantic results return only after ingest/embed_backfill.py re-runs.
DROP INDEX IF EXISTS "article_embeddings_hnsw_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "article_chunks_hnsw_idx";--> statement-breakpoint
TRUNCATE "article_embeddings";--> statement-breakpoint
UPDATE "article_chunks" SET "embedding" = NULL;--> statement-breakpoint
ALTER TABLE "article_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(1024);--> statement-breakpoint
ALTER TABLE "article_embeddings" ALTER COLUMN "embedding" SET DATA TYPE vector(1024);--> statement-breakpoint
CREATE INDEX "article_embeddings_hnsw_idx" ON "article_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "article_chunks_hnsw_idx" ON "article_chunks" USING hnsw ("embedding" vector_cosine_ops);
