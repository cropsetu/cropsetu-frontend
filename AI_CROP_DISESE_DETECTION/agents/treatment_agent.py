"""
Treatment & Fertilizer Agent — CropGuard Agentic AI
Model : Groq llama-3.3-70b (primary) / Gemini 2.5 Flash (fallback)
Role  : Recommend treatment + pesticides + fertilizers with Indian brand names.
Cache : Redis (7-day TTL) keyed on disease+crop+soil+irrigation+severity+stage.
        Falls back to in-memory LRU cache if Redis unavailable.
"""
from __future__ import annotations
import hashlib
import json
import logging
import re
import time
from typing import Optional

logger = logging.getLogger(__name__)

from config import GROQ_API_KEY, GEMINI_API_KEY
from agents.llm_utils import call_groq_text, call_gemini_text, empty_token_info

# ── Redis cache (optional — falls back to in-memory if Redis unavailable) ─────
try:
    import redis as _redis_lib
    _redis = _redis_lib.Redis(host="localhost", port=6379, db=0, socket_connect_timeout=2)
    _redis.ping()
    _REDIS_OK = True
    logger.info("Redis connected — treatment results cached for 7 days")
except Exception:
    _redis = None
    _REDIS_OK = False
    logger.warning("Redis unavailable — using in-memory LRU cache (500 entries)")

TREATMENT_CACHE_TTL = 86_400 * 7   # 7 days

# In-memory fallback LRU (max 500 entries, 24-hour TTL)
_mem_cache: dict[str, tuple[dict, float]] = {}
_MEM_MAX   = 500
_MEM_TTL   = 86_400


def _get_cache_key(diagnosis: dict, params: dict) -> str:
    """Deterministic cache key from disease identity + farm context."""
    pd = diagnosis.get("primary_diagnosis", {})
    payload = {
        "disease":       (pd.get("disease") or "").lower().strip(),
        "crop":          (params.get("crop_name") or "").lower().strip(),
        "soil":          (params.get("soil_type") or "").lower().strip(),
        "irrigation":    (params.get("irrigation_system") or "").lower().strip(),
        "severity":      (pd.get("severity") or "").lower().strip(),
        "growth_stage":  (params.get("crop_growth_stage") or "").lower().strip(),
    }
    key_str = json.dumps(payload, sort_keys=True)
    return f"treatment:{hashlib.md5(key_str.encode()).hexdigest()}"


def _cache_get(key: str) -> Optional[dict]:
    if _REDIS_OK:
        try:
            raw = _redis.get(key)
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    # In-memory fallback
    entry = _mem_cache.get(key)
    if entry:
        result, ts = entry
        if time.time() - ts < _MEM_TTL:
            return result
        del _mem_cache[key]
    return None


def _cache_set(key: str, value: dict) -> None:
    if _REDIS_OK:
        try:
            _redis.setex(key, TREATMENT_CACHE_TTL, json.dumps(value))
            return
        except Exception:
            pass
    # In-memory fallback — evict oldest if full
    if len(_mem_cache) >= _MEM_MAX:
        oldest_key = min(_mem_cache, key=lambda k: _mem_cache[k][1])
        del _mem_cache[oldest_key]
    _mem_cache[key] = (value, time.time())


# ── Prompts ───────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an Indian agricultural treatment advisor with expert knowledge of
CIB&RC-registered pesticides, organic inputs, and fertilizers available in the Indian market.

Given a confirmed disease diagnosis, recommend precise treatments with SPECIFIC INDIAN MARKET BRANDS.

RULES:
- NEVER recommend pesticides banned by India CIB&RC (Monocrotophos, Endosulfan, etc.)
- Include PHI (Pre-Harvest Interval) for every chemical
- Do NOT recommend spraying if rain expected within 4 hours
- Adjust dosage for the farmer's actual farm_size_acres
- Include safety precautions (PPE + re-entry interval)
- Provide both CHEMICAL and ORGANIC alternatives
- Suggest 2 medicine COMBINATIONS (curative + preventive)
- Include REAL Indian brand names with approximate MRP in INR

OUTPUT: Valid JSON only. No markdown fences.

{
  "immediate_actions": ["Remove and bag infected leaves immediately"],
  "chemical_controls": [
    {
      "product": "Mancozeb 75% WP",
      "active_ingredient": "Mancozeb",
      "brands": [
        {"name": "Dithane M-45", "company": "UPL", "pack": "500g", "mrp_approx": 280},
        {"name": "Indofil M-45", "company": "Indofil", "pack": "500g", "mrp_approx": 260}
      ],
      "dosage": "2.5 g per litre water",
      "dosage_per_acre": "600–800 g in 200–300 L water",
      "application_method": "Foliar spray — early morning or evening",
      "phi_days": 3,
      "safety_precautions": ["Wear gloves, mask, and goggles", "Re-entry after 24 hours"]
    }
  ],
  "medicine_combinations": [
    {
      "name": "Curative + Preventive",
      "recommended": true,
      "description": "Systemic for active infection + contact for prevention",
      "components": [
        {"product": "Propiconazole 25% EC", "role": "Curative (systemic)", "dosage": "1 ml/L"},
        {"product": "Mancozeb 75% WP", "role": "Preventive (contact)", "dosage": "2.5 g/L"}
      ],
      "brands": [
        {"combo_brand": "Nativo 75 WG", "company": "Bayer", "note": "Pre-mixed Tebuconazole+Trifloxystrobin", "mrp_approx": 900}
      ],
      "application": "Tank mix in single spray, early morning before 9 AM"
    },
    {
      "name": "Organic + Systemic",
      "recommended": false,
      "description": "For organic farmers or pesticide-sensitive markets",
      "components": [
        {"product": "Bordeaux Mixture 1%", "role": "Curative", "dosage": "10g CuSO4 + 10g lime / L"},
        {"product": "Trichoderma harzianum", "role": "Biological control", "dosage": "5 g/L"}
      ],
      "brands": [],
      "application": "Alternate spray every 7 days"
    }
  ],
  "organic_alternatives": [
    {
      "product": "Trichoderma viride",
      "brands": [{"name": "Ecosense Tricho", "company": "Multiplex", "pack": "1kg", "mrp_approx": 280}],
      "dosage": "5 g per litre water",
      "dosage_per_acre": "1 kg in 200 L water",
      "application_method": "Soil drench around root zone",
      "phi_days": 0,
      "safety_precautions": []
    }
  ],
  "fertilizer_recommendations": [
    {
      "product": "Potassium Nitrate (13-0-45)",
      "npk": "13-0-45",
      "dosage_per_acre": "5 kg per 200 L water (foliar)",
      "timing": "Apply 3 days after fungicide spray",
      "reason": "Potassium strengthens cell walls and improves disease resistance"
    }
  ],
  "preventive_measures": ["Spray every 7 days during humid weather"],
  "long_term_recommendations": ["Rotate with non-solanaceous crop next season"],
  "spray_timing_advisory": "Best window: early morning before 9 AM. Avoid spraying before expected rain.",
  "relevance_score": 0.88
}"""


def _parse_json(raw: str) -> Optional[dict]:
    from utils.json_extractor import extract_json
    return extract_json(raw)


def _fallback_treatment(disease_name: str) -> dict:
    return {
        "immediate_actions": [
            f"Isolate affected plants to prevent spread of {disease_name}",
            "Remove and destroy visibly infected plant parts",
            "Consult your local KVK (Krishi Vigyan Kendra) for specific product recommendations",
        ],
        "chemical_controls": [],
        "medicine_combinations": [],
        "organic_alternatives": [],
        "fertilizer_recommendations": [],
        "preventive_measures": ["Monitor field daily", "Maintain optimal irrigation schedule"],
        "long_term_recommendations": ["Practice crop rotation", "Use resistant varieties next season"],
        "spray_timing_advisory": "Spray in early morning or evening. Avoid spraying before expected rain.",
        "relevance_score": 0.3,
    }


async def run_treatment_agent(
    diagnosis: dict,
    weather_risk: dict,
    params: dict,
) -> tuple[dict, dict]:
    """Returns (treatment_dict, token_info)"""
    disease = diagnosis.get("primary_diagnosis", {})
    disease_name = disease.get("disease", "Unknown")

    if disease_name in ("Unknown", "UNCERTAIN") or diagnosis.get("confidence_score", 0) < 0.3:
        return _fallback_treatment(disease_name), empty_token_info()

    # ── Cache lookup ──────────────────────────────────────────────────────────
    cache_key = _get_cache_key(diagnosis, params)
    cached = _cache_get(cache_key)
    if cached:
        logger.info("Cache HIT — key=...%s disease=%s cost=$0.0000", cache_key[-8:], disease_name)
        cached["_cached"] = True
        return cached, empty_token_info("cache-hit")

    # ── Build user prompt ─────────────────────────────────────────────────────
    forecast_advisory = ""
    if weather_risk.get("weather_used"):
        forecast_advisory = f"\nWeather advisory: {weather_risk.get('advisory', '')}"
        if weather_risk.get("forecast_risk"):
            forecast_advisory += f"\nForecast: {weather_risk.get('forecast_risk')}"

    user_prompt = f"""Provide complete treatment for:

DIAGNOSIS:
  Disease         : {disease_name} ({disease.get('scientific_name', '')})
  Confidence      : {diagnosis.get('confidence_score', 0):.0%}
  Severity        : {disease.get('severity', 'Unknown')}
  Spread Risk     : {diagnosis.get('spread_risk', 'Unknown')}
  Causal Factors  : {', '.join(diagnosis.get('causal_factors', []))}

CROP & FIELD:
  Crop            : {params.get('crop_name', 'Unknown')}
  Variety         : {params.get('crop_variety', 'Not specified')}
  Growth Stage    : {params.get('crop_growth_stage', 'Unknown')}
  Soil Type       : {params.get('soil_type', 'Unknown')}
  Irrigation      : {params.get('irrigation_system', 'Unknown')}
  Farm Size       : {params.get('farm_size_acres', 1)} acres
  Previous Crop   : {params.get('previous_crop', 'Unknown')}
  Recent Pesticide: {params.get('recent_pesticide_used', 'None')}
  Fertilizer Used : {params.get('fertilizer_history', 'Not provided')}

WEATHER CONTEXT:
  Current Risk    : {weather_risk.get('overall_disease_risk', 'UNKNOWN')}
  Risk Factors    : {', '.join(weather_risk.get('risk_factors', [])[:3])}
{forecast_advisory}

Include 2 medicine_combinations (curative+preventive and organic+systemic).
Include real Indian brand names with approximate MRP in INR.
Scale all dosages for {params.get('farm_size_acres', 1)} acres. Return JSON only."""

    def _finalise(result):
        if not result:
            return _fallback_treatment(disease_name)
        result.setdefault("immediate_actions", [])
        result.setdefault("chemical_controls", [])
        result.setdefault("medicine_combinations", [])
        result.setdefault("organic_alternatives", [])
        result.setdefault("fertilizer_recommendations", [])
        result.setdefault("preventive_measures", [])
        result.setdefault("long_term_recommendations", [])
        result.setdefault("spray_timing_advisory", "")
        result.setdefault("relevance_score", 0.8)
        result["_cached"] = False
        return result

    # ── Groq (primary) ────────────────────────────────────────────────────────
    if GROQ_API_KEY:
        try:
            raw, tok = await call_groq_text(SYSTEM_PROMPT, user_prompt, GROQ_API_KEY)
            result = _finalise(_parse_json(raw))
            _cache_set(cache_key, result)
            logger.info("LLM response cached — key=...%s", cache_key[-8:])
            return result, tok
        except Exception as exc:
            logger.exception("Groq call failed")

    # ── Gemini fallback ───────────────────────────────────────────────────────
    if GEMINI_API_KEY:
        try:
            raw, tok = await call_gemini_text(SYSTEM_PROMPT, user_prompt, GEMINI_API_KEY)
            result = _finalise(_parse_json(raw))
            _cache_set(cache_key, result)
            return result, tok
        except Exception as exc:
            logger.exception("Gemini fallback also failed")

    return _fallback_treatment(disease_name), empty_token_info()
