"""Article extraction via Takedown Watch extractor. Language guess is ours.

No content invented: None when nothing found.
"""

from takedown.extractor import Extraction, extract

BANGLA_BLOCK = range(0x0980, 0x0A00)
BANGLA_SHARE_THRESHOLD = 0.3


def extract_article(html_bytes: bytes, url: str) -> Extraction:
    return extract(html_bytes, url)


def extract_text(html_bytes: bytes, url: str) -> str | None:
    text = extract_article(html_bytes, url).body_text
    if not text:
        return None
    text = text.strip()
    return text or None


def detect_language(text: str) -> str | None:
    """Heuristic: 'bn' if Bangla script dominates letters, else 'en'."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return None
    bangla = sum(1 for c in letters if ord(c) in BANGLA_BLOCK)
    return "bn" if bangla / len(letters) >= BANGLA_SHARE_THRESHOLD else "en"
