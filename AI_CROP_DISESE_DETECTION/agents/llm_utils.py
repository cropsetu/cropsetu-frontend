"""
Shared LLM utilities — Gemini vision + Groq text for all agents.
Claude is NOT used. All inference goes through Gemini (vision) and Groq (text).

Token tracking: every call returns (text, token_info) where token_info = {
  model, input_tokens, output_tokens, total_tokens, cost_usd
}
The orchestrator accumulates these into pipeline_token_usage on the report.
"""
from __future__ import annotations
import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

GEMINI_VISION_MODEL = "gemini-2.5-flash"
GEMINI_TEXT_MODEL   = "gemini-2.5-flash"
GROQ_TEXT_MODEL     = "llama-3.3-70b-versatile"

# ── Token cost estimates (USD per 1K tokens) ────────────────────────────────
# Gemini 2.5 Flash: $0.075/1M input, $0.30/1M output (text); images counted as tokens
# Groq llama-3.3-70b: $0.59/1M input, $0.79/1M output (approx)
COST_PER_1K = {
    "gemini-2.5-flash":           {"input": 0.000075, "output": 0.000300},
    "llama-3.3-70b-versatile":    {"input": 0.000590, "output": 0.000790},
}

def _calc_cost(model: str, input_tok: int, output_tok: int) -> float:
    rates = COST_PER_1K.get(model, {"input": 0.001, "output": 0.001})
    return round((input_tok / 1000) * rates["input"] + (output_tok / 1000) * rates["output"], 6)

def _empty_token_info(model: str) -> dict:
    return {"model": model, "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost_usd": 0.0}

def empty_token_info(model: str = "none") -> dict:
    """Public helper — returns a zero token_info dict (use when an LLM call is skipped)."""
    return _empty_token_info(model)


# ── Gemini vision (with 429 retry) ───────────────────────────────────────────

async def call_gemini_vision(
    system_prompt: str,
    text_context: str,
    images_b64: list[dict],          # [{"data": str, "mime_type": str}]
    api_key: str,
    model: str = GEMINI_VISION_MODEL,
    max_retries: int = 3,
) -> tuple[str, dict]:
    """Returns (text, token_info)"""
    parts: list[dict] = [{"text": text_context}]
    for img in images_b64:
        parts.append({"inline_data": {"mime_type": img["mime_type"], "data": img["data"]}})

    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=90) as client:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                    params={"key": api_key},
                    json={
                        "systemInstruction": {"parts": [{"text": system_prompt}]},
                        "contents": [{"role": "user", "parts": parts}],
                        "generationConfig": {
                            "maxOutputTokens": 4096,
                            "temperature": 0.0,
                            "responseMimeType": "application/json",
                        },
                    },
                )
                if resp.status_code == 429:
                    wait = 20 * attempt
                    logger.warning("Gemini Vision 429 rate limit — waiting %ds (attempt %d/%d)", wait, attempt, max_retries)
                    if attempt < max_retries:
                        await asyncio.sleep(wait)
                        continue
                resp.raise_for_status()
                data = resp.json()

                usage = data.get("usageMetadata", {})
                inp  = usage.get("promptTokenCount",     0)
                out  = usage.get("candidatesTokenCount", 0)
                tot  = usage.get("totalTokenCount",      inp + out)
                cost = _calc_cost(model, inp, out)
                token_info = {"model": model, "input_tokens": inp, "output_tokens": out,
                              "total_tokens": tot, "cost_usd": cost}
                logger.debug("Gemini Vision tokens: input=%d output=%d total=%d cost=$%.4f", inp, out, tot, cost)

                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                return text, token_info

        except httpx.HTTPStatusError:
            if attempt == max_retries:
                raise
            await asyncio.sleep(20 * attempt)

    raise RuntimeError("Gemini vision: max retries exceeded")


# ── Gemini text-only (with 429 retry) ────────────────────────────────────────

async def call_gemini_text(
    system_prompt: str,
    user_prompt: str,
    api_key: str,
    model: str = GEMINI_TEXT_MODEL,
    max_retries: int = 2,
) -> tuple[str, dict]:
    """Returns (text, token_info)"""
    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                    params={"key": api_key},
                    json={
                        "systemInstruction": {"parts": [{"text": system_prompt}]},
                        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                        "generationConfig": {
                            "maxOutputTokens": 2048,
                            "temperature": 0.0,
                            "responseMimeType": "application/json",
                        },
                    },
                )
                if resp.status_code == 429:
                    wait = 15 * attempt
                    logger.warning("Gemini Text 429 rate limit — waiting %ds", wait)
                    if attempt < max_retries:
                        await asyncio.sleep(wait)
                        continue
                resp.raise_for_status()
                data = resp.json()

                usage = data.get("usageMetadata", {})
                inp  = usage.get("promptTokenCount",     0)
                out  = usage.get("candidatesTokenCount", 0)
                tot  = usage.get("totalTokenCount",      inp + out)
                cost = _calc_cost(model, inp, out)
                token_info = {"model": model, "input_tokens": inp, "output_tokens": out,
                              "total_tokens": tot, "cost_usd": cost}
                logger.debug("Gemini Text tokens: input=%d output=%d total=%d cost=$%.4f", inp, out, tot, cost)

                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                return text, token_info
        except httpx.HTTPStatusError:
            if attempt == max_retries:
                raise
            await asyncio.sleep(15 * attempt)

    raise RuntimeError("Gemini text: max retries exceeded")


# ── Groq text-only (with 429 retry + backoff) ────────────────────────────────

def _is_rate_limit(exc: Exception) -> bool:
    exc_str = str(exc).lower()
    return "429" in exc_str or "rate" in exc_str or "too many" in exc_str


async def call_groq_text(
    system_prompt: str,
    user_prompt: str,
    api_key: str,
    model: str = GROQ_TEXT_MODEL,
    max_retries: int = 3,
) -> tuple[str, dict]:
    """Returns (text, token_info). Retries up to max_retries on 429 rate limits."""
    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user",   "content": user_prompt},
                        ],
                        "temperature": 0.0,
                        "max_tokens":  2048,
                        "response_format": {"type": "json_object"},
                    },
                )
                if resp.status_code == 429:
                    wait = min(2 ** attempt, 15)  # exponential backoff, cap at 15s
                    logger.warning("Groq 429 rate limit — retry %d/%d in %ds", attempt, max_retries, wait)
                    if attempt < max_retries:
                        await asyncio.sleep(wait)
                        continue
                    resp.raise_for_status()

                resp.raise_for_status()
                data = resp.json()

                usage = data.get("usage", {})
                inp   = usage.get("prompt_tokens",     0)
                out   = usage.get("completion_tokens", 0)
                tot   = usage.get("total_tokens",      inp + out)
                cost  = _calc_cost(model, inp, out)
                token_info = {"model": model, "input_tokens": inp, "output_tokens": out,
                              "total_tokens": tot, "cost_usd": cost}
                logger.debug("Groq Text tokens: input=%d output=%d total=%d cost=$%.4f", inp, out, tot, cost)

                return data["choices"][0]["message"]["content"].strip(), token_info

        except httpx.HTTPStatusError as exc:
            if _is_rate_limit(exc) and attempt < max_retries:
                wait = min(2 ** attempt, 15)
                logger.warning("Groq HTTP error (rate limit) — retry %d/%d in %ds", attempt, max_retries, wait)
                await asyncio.sleep(wait)
                continue
            raise

    raise RuntimeError("Groq: max retries exceeded")
