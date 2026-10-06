import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TAGS } from "../lib/tags";

config({ path: ".env.local" });

type OutletSeed = {
  name: string;
  domain: string;
  feedUrl: string;
  active: boolean;
};

async function main() {
  // Dynamic import: client.ts throws if DATABASE_URL is missing, so load env first.
  const { db } = await import("./client");
  const { outlets, tags } = await import("./schema");

  const outletRows = JSON.parse(
    readFileSync(path.join(process.cwd(), "db", "seed", "outlets.json"), "utf8"),
  ) as OutletSeed[];

  await db
    .insert(outlets)
    .values(outletRows)
    .onConflictDoNothing({ target: outlets.domain });

  await db
    .insert(tags)
    .values(TAGS.map((t) => ({ slug: t.slug, label: t.label })))
    .onConflictDoNothing({ target: tags.slug });

  console.log(`seeded ${outletRows.length} outlets, ${TAGS.length} tags`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
