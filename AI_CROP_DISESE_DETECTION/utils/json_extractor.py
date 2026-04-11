"""
Robust JSON extraction from LLM responses.

Handles:
- Markdown ```json ... ``` fences
- Explanation text before / after JSON
- Multiple JSON objects in one response (returns the first complete one)
- Nested braces and escaped quotes inside strings
"""
from __future__ import annotations
import json
import logging
import re

logger = logging.getLogger(__name__)


def extract_json(raw: str | None) -> dict | None:
    """
    Extract the first valid JSON object from an LLM response string.
    Returns None if no valid JSON is found.
    """
    if not raw or not raw.strip():
        return None

    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    text = re.sub(r"```(?:json|JSON)?\s*", "", raw)
    text = text.replace("```", "").strip()

    # Fast path — entire stripped text is valid JSON
    try:
        result = json.loads(text)
        if isinstance(result, dict):
            return result
    except (json.JSONDecodeError, ValueError):
        pass

    # Find the first opening brace
    start = text.find("{")
    if start == -1:
        logger.warning("[JSONExtractor] No '{' found in LLM response (%d chars)", len(raw))
        return None

    # Walk forward tracking brace depth; respect quoted strings and escapes
    depth = 0
    in_string = False
    escape_next = False
    end = -1

    for i in range(start, len(text)):
        ch = text[i]

        if escape_next:
            escape_next = False
            continue

        if ch == "\\":
            escape_next = True
            continue

        if ch == '"':
            in_string = not in_string
            continue

        if in_string:
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    if end == -1:
        logger.warning("[JSONExtractor] Unbalanced braces in LLM response (%d chars)", len(raw))
        return None

    candidate = text[start:end]
    try:
        result = json.loads(candidate)
        if isinstance(result, dict):
            return result
        logger.warning("[JSONExtractor] Extracted JSON is not a dict (type=%s)", type(result).__name__)
        return None
    except json.JSONDecodeError as exc:
        logger.warning("[JSONExtractor] JSON parse failed: %s — snippet: %.100s...", exc, candidate)
        return None


def extract_json_strict(raw: str | None, required_keys: list[str]) -> dict | None:
    """
    Extract JSON and verify that all required_keys are present.
    Returns None if JSON is missing or any key is absent.
    """
    data = extract_json(raw)
    if data is None:
        return None

    missing = [k for k in required_keys if k not in data]
    if missing:
        logger.warning("[JSONExtractor] Missing required keys: %s", missing)
        return None

    return data
