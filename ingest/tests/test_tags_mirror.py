import re
from pathlib import Path

import tagging

WEB_TAGS = Path(__file__).resolve().parents[2] / "web" / "lib" / "tags.ts"


def test_python_tags_match_web_tags():
    source = WEB_TAGS.read_text(encoding="utf-8")
    web_slugs = tuple(re.findall(r'slug: "([a-z-]+)"', source))
    assert web_slugs == tagging.TAGS
