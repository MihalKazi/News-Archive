// Query embedding via the local embed service (ingest/embed_server.py). Null when unreachable:
// the route then falls back to keyword search.
//
// Swap providers here only. The stored vectors must come from the same model.

const TIMEOUT_MS = 5000;

export async function embedQuery(text: string): Promise<number[] | null> {
  const base = process.env.EMBED_URL || "http://127.0.0.1:8001";
  try {
    const res = await fetch(`${base}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [text], kind: "query" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { vectors?: number[][] };
    const v = data.vectors?.[0];
    return Array.isArray(v) && v.length === 384 ? v : null;
  } catch {
    return null;
  }
}

export function toPgVector(v: number[]): string {
  return "[" + v.map((x) => x.toFixed(7)).join(",") + "]";
}

// Semantic gate. Unrelated pairs sit ~0.73; generic junk ~0.82. Two tiers:
// - alone: needs STRICT (high confidence on its own)
// - with a keyword concept hit: needs MIN (similar enough plus a real term match)
export const SEMANTIC_MIN_SIM = Number(process.env.SEMANTIC_MIN_SIM || 0.84);
export const SEMANTIC_STRICT_SIM = Number(process.env.SEMANTIC_STRICT_SIM || 0.88);
