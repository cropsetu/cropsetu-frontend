"""
Unit tests for utils/json_extractor.py

Tests: clean JSON, markdown fences, text before/after, nested braces,
       two objects (takes first), string escapes, edge cases, strict mode.
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.json_extractor import extract_json, extract_json_strict


class TestExtractJson:
    def test_clean_json(self):
        assert extract_json('{"a": 1}') == {"a": 1}

    def test_json_with_markdown_fence(self):
        raw = '```json\n{"disease": "Rust", "confidence": 85}\n```'
        result = extract_json(raw)
        assert result["disease"] == "Rust"
        assert result["confidence"] == 85

    def test_json_with_uppercase_json_fence(self):
        raw = '```JSON\n{"disease": "Rust"}\n```'
        assert extract_json(raw)["disease"] == "Rust"

    def test_json_with_text_before(self):
        raw = 'Here is the analysis:\n{"disease": "Blight"}'
        assert extract_json(raw)["disease"] == "Blight"

    def test_json_with_text_after(self):
        raw = '{"disease": "Rust"}\n\nLet me know if you need more info.'
        assert extract_json(raw)["disease"] == "Rust"

    def test_json_with_text_before_and_after(self):
        raw = 'Analysis:\n```json\n{"disease": "Rust"}\n```\nHope this helps!'
        assert extract_json(raw)["disease"] == "Rust"

    def test_nested_braces(self):
        raw = '{"outer": {"inner": {"deep": 1}}, "list": [{"a": 1}]}'
        result = extract_json(raw)
        assert result["outer"]["inner"]["deep"] == 1

    def test_two_json_objects_takes_first(self):
        raw = '{"first": 1}\n{"second": 2}'
        assert extract_json(raw) == {"first": 1}

    def test_braces_inside_strings(self):
        raw = '{"msg": "use {brackets} here", "val": 1}'
        result = extract_json(raw)
        assert result["msg"] == "use {brackets} here"
        assert result["val"] == 1

    def test_escaped_quotes(self):
        raw = r'{"msg": "he said \"hello\"", "val": 1}'
        result = extract_json(raw)
        assert result["val"] == 1

    def test_empty_string(self):
        assert extract_json("") is None

    def test_whitespace_only(self):
        assert extract_json("   \n  ") is None

    def test_no_json(self):
        assert extract_json("This is just plain text with no JSON.") is None

    def test_unbalanced_braces(self):
        assert extract_json('{"broken": "json"') is None

    def test_none_input(self):
        assert extract_json(None) is None

    def test_json_with_newlines(self):
        raw = '{\n  "disease": "Rust",\n  "confidence": 90\n}'
        result = extract_json(raw)
        assert result["confidence"] == 90

    def test_json_with_unicode(self):
        """Indian language text in JSON values should parse correctly."""
        raw = '{"disease_local": "गेहूं का रतुआ", "confidence": 85}'
        result = extract_json(raw)
        assert result["confidence"] == 85

    def test_json_with_special_chars_in_strings(self):
        """Dosage strings with slashes and dashes."""
        raw = '{"dosage": "2.5 g/L water — apply before 9 AM", "phi": 30}'
        result = extract_json(raw)
        assert result["phi"] == 30

    def test_gemini_response_with_explanation(self):
        """Gemini often wraps JSON in explanation text."""
        raw = """Based on my analysis of the wheat crop image, here are my findings:

```json
{
  "primary_disease": "Leaf Rust",
  "confidence": 87,
  "severity": "Moderate"
}
```

This diagnosis is based on the orange-brown pustules visible on the leaf surface."""
        result = extract_json(raw)
        assert result is not None
        assert result["primary_disease"] == "Leaf Rust"

    def test_groq_truncated_json_returns_none(self):
        """Groq sometimes truncates output at max_tokens boundary."""
        raw = '{"disease": "Rust", "treatments": [{"name": "Propicon'
        assert extract_json(raw) is None

    def test_deeply_nested(self):
        raw = '{"a": {"b": {"c": {"d": {"e": 42}}}}}'
        result = extract_json(raw)
        assert result["a"]["b"]["c"]["d"]["e"] == 42

    def test_array_value_preserved(self):
        raw = '{"diseases": ["Rust", "Blight", "Wilt"]}'
        result = extract_json(raw)
        assert result["diseases"] == ["Rust", "Blight", "Wilt"]

    def test_boolean_values(self):
        raw = '{"usable": true, "needs_advisor": false}'
        result = extract_json(raw)
        assert result["usable"] is True
        assert result["needs_advisor"] is False

    def test_null_values(self):
        raw = '{"disease": null, "confidence": 0}'
        result = extract_json(raw)
        assert result["disease"] is None


class TestExtractJsonStrict:
    def test_all_keys_present(self):
        raw = '{"disease": "Rust", "confidence": 85, "severity": "HIGH"}'
        result = extract_json_strict(raw, ["disease", "confidence"])
        assert result is not None
        assert result["disease"] == "Rust"

    def test_missing_required_key_returns_none(self):
        raw = '{"disease": "Rust"}'
        result = extract_json_strict(raw, ["disease", "confidence"])
        assert result is None

    def test_empty_required_keys_passes(self):
        raw = '{"disease": "Rust"}'
        result = extract_json_strict(raw, [])
        assert result == {"disease": "Rust"}

    def test_no_json_returns_none(self):
        result = extract_json_strict("no json here", ["disease"])
        assert result is None

    def test_all_required_keys_present(self):
        raw = '{"primary_diagnosis": {}, "confidence_score": 0.87, "severity": "Moderate"}'
        result = extract_json_strict(raw, ["primary_diagnosis", "confidence_score", "severity"])
        assert result is not None

    def test_partial_keys_missing(self):
        raw = '{"primary_diagnosis": {}}'
        result = extract_json_strict(raw, ["primary_diagnosis", "confidence_score"])
        assert result is None
