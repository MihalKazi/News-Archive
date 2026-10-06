// Natural-language query -> search concepts. Each concept is one idea in the query with its
// English and Bangla synonyms. Concepts are AND-ed, synonyms OR-ed. The LLM only writes search
// terms. It never answers, and results always come from stored articles.
//
// Provider call lives in complete() only: swap Groq for another provider there.

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 500;
const MAX_CONCEPTS = 4;
const MAX_TERMS = 10;

const SYSTEM_PROMPT = [
  "You turn a news search query into search concepts for a Bangladeshi news archive.",
  "Output JSON only: {\"concepts\": [[\"term\", ...], ...]}.",
  "Each inner list is ONE idea from the query: its direct synonyms and inflections,",
  "in English and in Bangla script. 2 to 4 concepts. At most 8 terms each.",
  "Write the words news reports would use. For an action against someone (criticism,",
  "insult, defamation, offence) include the medium words too: post, social media, Facebook,",
  "defamation, remarks, ফেসবুক, মন্তব্য, মানহানি.",
  "Do not put two different ideas in one list. Do not use phrases describing outcomes",
  "(e.g. 'caught and died'). Do not answer the question. Do not add facts.",
].join(" ");

export type Concepts = string[][];

const cache = new Map<string, { at: number; concepts: Concepts }>();

async function complete(query: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");
  const model = process.env.SEARCH_MODEL || "openai/gpt-oss-20b";

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1500,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Query: ${query}` },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function parseConcepts(raw: string): Concepts | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const list = (data as { concepts?: unknown })?.concepts;
  if (!Array.isArray(list)) return null;

  const out: Concepts = [];
  for (const group of list.slice(0, MAX_CONCEPTS)) {
    if (!Array.isArray(group)) continue;
    const terms = group
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, MAX_TERMS);
    if (terms.length) out.push(terms);
  }
  return out.length ? out : null;
}

// Returns null when the LLM is unavailable or output is unusable. Caller falls back to keywords.
export async function expandQuery(query: string): Promise<Concepts | null> {
  const k = query.trim().toLowerCase();
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.concepts;

  try {
    const concepts = parseConcepts(await complete(query));
    if (!concepts) return null;
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(k, { at: Date.now(), concepts });
    return concepts;
  } catch {
    return null;
  }
}

const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "and", "or", "with",
  "by", "from", "is", "are", "was", "were", "be", "as", "that", "this", "it",
]);

// One term -> tsquery fragment. Multi-word terms become a phrase ("prime <-> minister").
// Only letters, marks and digits survive, so the result is safe for to_tsquery.
function termToTs(term: string): string | null {
  const parts = term
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((p) => p.length > 0 && !STOPWORDS.has(p));
  if (!parts.length) return null;
  return parts.map((p) => `${p}:*`).join(" <-> ");
}

// One tsquery per concept: OR across its synonyms. Caller scores articles by how many match.
export function conceptQueries(concepts: Concepts): string[] {
  const out: string[] = [];
  for (const terms of concepts) {
    const alts = [...new Set(terms.map(termToTs).filter((x): x is string => !!x))];
    if (alts.length) out.push(alts.join(" | "));
  }
  return out;
}
