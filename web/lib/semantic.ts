// Query embedding via Cloudflare Workers AI (@cf/baai/bge-m3, 1024-dim).
// Null when unconfigured or unreachable: the route then falls back to keyword search.
//
// Swap providers here only. Stored vectors (ingest/embed.py) must come from the same model.

const TIMEOUT_MS = 5000;
export const EMBED_DIMS = 1024;
const MODEL = "@cf/baai/bge-m3";

export async function embedQuery(text: string): Promise<number[] | null> {
  const account = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!account || !token) return null;
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODEL}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: [text] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { success?: boolean; result?: { data?: number[][] } };
    const v = data.result?.data?.[0];
    return data.success && Array.isArray(v) && v.length === EMBED_DIMS ? v : null;
  } catch {
    return null;
  }
}

export function toPgVector(v: number[]): string {
  return "[" + v.map((x) => x.toFixed(7)).join(",") + "]";
}

// Semantic gate. Thresholds were tuned for e5-small (384-dim) and must be re-tuned for bge-m3 after re-embed.
// Two tiers:
// - alone: needs STRICT (high confidence on its own)
// - with a keyword concept hit: needs MIN (similar enough plus a real term match)
export const SEMANTIC_MIN_SIM = Number(process.env.SEMANTIC_MIN_SIM || 0.84);
export const SEMANTIC_STRICT_SIM = Number(process.env.SEMANTIC_STRICT_SIM || 0.88);
