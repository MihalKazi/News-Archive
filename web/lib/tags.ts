// Fixed tag list. Mirrored in ingest/tagging.py (TAGS). Keep in sync;
// ingest/tests/test_tags_mirror.py fails on drift.
export const TAGS = [
  { slug: "arrest", label: "Arrest" },
  { slug: "detention", label: "Detention" },
  { slug: "custodial-death", label: "Custodial death" },
  { slug: "state-violence", label: "State violence" },
  { slug: "police-violence", label: "Police violence" },
  { slug: "harassment", label: "Harassment" },
  { slug: "sexual-violence", label: "Sexual violence" },
  { slug: "violence-against-women", label: "Violence against women" },
  { slug: "injury", label: "Injury" },
  { slug: "internet-shutdown", label: "Internet shutdown" },
  { slug: "other", label: "Other" },
] as const;

export type TagSlug = (typeof TAGS)[number]["slug"];

export const TAG_SLUGS: readonly string[] = TAGS.map((t) => t.slug);
