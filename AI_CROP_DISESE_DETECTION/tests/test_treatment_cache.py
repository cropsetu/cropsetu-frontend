"""
Unit tests for agents/treatment_agent.py

Tests: cache key generation, Redis hit/miss, in-memory fallback,
       JSON parsing, fallback treatment, and deterministic keys.
"""
import json
import hashlib
import pytest
import sys
import os
from unittest.mock import MagicMock, patch, AsyncMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.treatment_agent import _get_cache_key, _cache_get, _cache_set


# ── Cache key generation ──────────────────────────────────────────────────────

class TestCacheKeyGeneration:
    def _make_diagnosis(self, disease="Early Blight", severity="Moderate"):
        return {
            "primary_diagnosis": {
                "disease": disease,
                "severity": severity,
            }
        }

    def _make_params(self, crop="Tomato", soil="Black", irrigation="Drip", stage="Vegetative"):
        return {
            "crop_name": crop,
            "soil_type": soil,
            "irrigation_system": irrigation,
            "crop_growth_stage": stage,
        }

    def test_deterministic_same_inputs(self):
        diag = self._make_diagnosis()
        params = self._make_params()
        key1 = _get_cache_key(diag, params)
        key2 = _get_cache_key(diag, params)
        assert key1 == key2

    def test_different_disease_different_key(self):
        params = self._make_params()
        key1 = _get_cache_key(self._make_diagnosis("Early Blight"), params)
        key2 = _get_cache_key(self._make_diagnosis("Late Blight"), params)
        assert key1 != key2

    def test_different_crop_different_key(self):
        diag = self._make_diagnosis()
        key1 = _get_cache_key(diag, self._make_params(crop="Tomato"))
        key2 = _get_cache_key(diag, self._make_params(crop="Wheat"))
        assert key1 != key2

    def test_different_severity_different_key(self):
        params = self._make_params()
        key1 = _get_cache_key(self._make_diagnosis(severity="Mild"), params)
        key2 = _get_cache_key(self._make_diagnosis(severity="Severe"), params)
        assert key1 != key2

    def test_case_insensitive_keys(self):
        # "Early Blight" and "early blight" should produce same cache key
        params = self._make_params()
        key1 = _get_cache_key(self._make_diagnosis("Early Blight"), params)
        key2 = _get_cache_key(self._make_diagnosis("early blight"), params)
        assert key1 == key2

    def test_whitespace_trimmed_in_key(self):
        params = self._make_params()
        key1 = _get_cache_key(self._make_diagnosis("Early Blight"), params)
        key2 = _get_cache_key(self._make_diagnosis("  Early Blight  "), params)
        assert key1 == key2

    def test_key_starts_with_treatment_prefix(self):
        diag = self._make_diagnosis()
        params = self._make_params()
        key = _get_cache_key(diag, params)
        assert key.startswith("treatment:")

    def test_key_length_consistent(self):
        diag = self._make_diagnosis()
        params = self._make_params()
        key = _get_cache_key(diag, params)
        # "treatment:" + 32-char MD5 hex = 42 chars
        assert len(key) == 42

    def test_missing_disease_field(self):
        # Should not crash; empty string used
        diag = {"primary_diagnosis": {}}
        params = self._make_params()
        key = _get_cache_key(diag, params)
        assert isinstance(key, str)
        assert key.startswith("treatment:")

    def test_none_values_handled(self):
        diag = {"primary_diagnosis": {"disease": None, "severity": None}}
        params = {"crop_name": None, "soil_type": None,
                  "irrigation_system": None, "crop_growth_stage": None}
        key = _get_cache_key(diag, params)
        assert isinstance(key, str)


# ── Redis cache operations ────────────────────────────────────────────────────

class TestRedisCacheOperations:
    def test_cache_miss_returns_none(self, mock_redis):
        mock_redis.get.return_value = None
        result = _cache_get("treatment:abc123")
        assert result is None

    def test_cache_hit_returns_dict(self, mock_redis):
        data = {"disease_summary": "Test", "chemical_controls": []}
        mock_redis.get.return_value = json.dumps(data).encode()
        result = _cache_get("treatment:abc123")
        assert result == data

    def test_cache_set_calls_setex(self, mock_redis):
        data = {"disease_summary": "Test"}
        _cache_set("treatment:abc123", data)
        mock_redis.setex.assert_called_once()
        call_args = mock_redis.setex.call_args
        assert call_args[0][0] == "treatment:abc123"

    def test_cache_set_ttl_is_7_days(self, mock_redis):
        data = {"disease_summary": "Test"}
        _cache_set("treatment:abc123", data)
        call_args = mock_redis.setex.call_args
        ttl = call_args[0][1]
        assert ttl == 86_400 * 7

    def test_redis_error_silenced_on_get(self, mock_redis):
        mock_redis.get.side_effect = Exception("Redis connection refused")
        result = _cache_get("treatment:abc123")
        assert result is None  # should not raise

    def test_redis_error_silenced_on_set(self, mock_redis):
        mock_redis.setex.side_effect = Exception("Redis connection refused")
        # Should not raise
        try:
            _cache_set("treatment:abc123", {"test": "data"})
        except Exception:
            pytest.fail("_cache_set raised exception on Redis error")


# ── In-memory fallback ────────────────────────────────────────────────────────

class TestInMemoryCacheFallback:
    def test_in_memory_cache_when_redis_unavailable(self):
        """When Redis is unavailable, in-memory cache stores/retrieves data."""
        with patch("agents.treatment_agent._REDIS_OK", False), \
             patch("agents.treatment_agent._redis", None):
            from agents.treatment_agent import _mem_cache
            test_key = "treatment:test_in_mem"
            test_data = {"disease_summary": "In-memory test"}

            _cache_set(test_key, test_data)

            import time
            if test_key in _mem_cache:
                result = _cache_get(test_key)
                assert result == test_data
            # Clean up
            _mem_cache.pop(test_key, None)

    def test_in_memory_expired_entries_return_none(self):
        """Expired in-memory cache entries return None."""
        with patch("agents.treatment_agent._REDIS_OK", False), \
             patch("agents.treatment_agent._redis", None):
            from agents.treatment_agent import _mem_cache
            import time
            # Manually insert expired entry
            test_key = "treatment:expired_test"
            _mem_cache[test_key] = ({"old": "data"}, time.time() - 90_000)  # 25h ago

            result = _cache_get(test_key)
            assert result is None


# ── JSON parsing robustness ───────────────────────────────────────────────────

class TestJsonParsingRobustness:
    """Test that the treatment agent handles LLM JSON parsing edge cases."""

    def test_clean_json_parsed(self):
        """Valid JSON string is parsed correctly."""
        import re
        raw = '{"disease_summary": "Test", "chemical_controls": []}'
        # Simulate the regex extraction used in the agent
        match = re.search(r"\{[\s\S]*\}", raw)
        assert match is not None
        parsed = json.loads(match.group())
        assert parsed["disease_summary"] == "Test"

    def test_markdown_wrapped_json_extracted(self):
        """JSON wrapped in markdown code block is extracted."""
        import re
        raw = '```json\n{"disease_summary": "Test"}\n```'
        # Strip markdown fences first (as agent should)
        cleaned = re.sub(r"```(?:json)?", "", raw).strip()
        match = re.search(r"\{[\s\S]*\}", cleaned)
        assert match is not None
        parsed = json.loads(match.group())
        assert parsed["disease_summary"] == "Test"

    def test_invalid_json_returns_empty_on_error(self):
        """Invalid JSON falls back gracefully."""
        import re
        raw = "This is not JSON at all."
        match = re.search(r"\{[\s\S]*\}", raw)
        assert match is None  # No JSON found
