// Runs tests/search-cases.json against the running dev server. Prints PASS/FAIL per case.
// Usage: node scripts/search-eval.mjs [baseUrl]   (reads DEMO_USER/DEMO_PASSWORD from .env.local)
import { readFileSync } from "node:fs";

const base = process.argv[2] || "http://localhost:3000";
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}
const auth = "Basic " + Buffer.from(`${process.env.DEMO_USER}:${process.env.DEMO_PASSWORD}`).toString("base64");
const cases = JSON.parse(readFileSync("tests/search-cases.json", "utf8")).cases;

let failed = 0;
for (const c of cases) {
  const res = await fetch(`${base}/api/search?q=${encodeURIComponent(c.query)}&limit=${c.topN ?? 10}`, {
    headers: { Authorization: auth },
  });
  const data = await res.json();
  const urls = (data.results ?? []).map((r) => r.url);
  const problems = [];

  if (c.expectCount !== undefined && data.count !== c.expectCount) {
    problems.push(`count ${data.count}, want ${c.expectCount}`);
  }
  if (c.expectMinCount !== undefined && data.count < c.expectMinCount) {
    problems.push(`count ${data.count}, want >= ${c.expectMinCount}`);
  }
  for (const u of c.expectUrls ?? []) {
    if (!urls.includes(u)) problems.push(`missing in top ${c.topN}: ${u.slice(0, 90)}`);
  }

  if (problems.length) failed++;
  console.log(`${problems.length ? "FAIL" : "PASS"}  ${c.id}  (${data.count ?? "?"} results)`);
  for (const p of problems) console.log(`      - ${p}`);
}
console.log(failed ? `\n${failed}/${cases.length} failed` : `\nall ${cases.length} passed`);
process.exit(failed ? 1 : 0);
