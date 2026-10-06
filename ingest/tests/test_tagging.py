import json

import pytest

import tagging


def test_parse_tags_keeps_known_and_drops_unknown():
    raw = json.dumps(
        {
            "tags": [
                {"slug": "arrest", "confidence": 0.9},
                {"slug": "made-up-tag", "confidence": 0.8},
                {"slug": "custodial-death", "confidence": 0.7},
            ]
        }
    )
    assert tagging.parse_tags(raw) == [
        {"slug": "arrest", "confidence": 0.9},
        {"slug": "custodial-death", "confidence": 0.7},
    ]


def test_parse_tags_clamps_confidence_and_dedupes():
    raw = json.dumps(
        {
            "tags": [
                {"slug": "injury", "confidence": 3},
                {"slug": "injury", "confidence": 0.2},
                {"slug": "harassment", "confidence": "bad"},
            ]
        }
    )
    assert tagging.parse_tags(raw) == [
        {"slug": "injury", "confidence": 0.2},
        {"slug": "harassment", "confidence": None},
    ]


def test_parse_tags_empty_list_is_valid():
    assert tagging.parse_tags('{"tags": []}') == []


@pytest.mark.parametrize("raw", ["not json", '{"labels": []}', "[]"])
def test_parse_tags_rejects_bad_shape(raw):
    with pytest.raises(tagging.TaggingError):
        tagging.parse_tags(raw)
