"""
Weather Analysis Agent — CropGuard Agentic AI
Model : claude-haiku-4-5-20251001  (fast + cheap — structured text analysis)
Role  : Interpret weather API data for disease-favourable conditions.
Output: WeatherRiskResult dict
"""
from __future__ import annotations
import json
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

from config import GROQ_API_KEY, GEMINI_API_KEY
from agents.llm_utils import call_groq_text, call_gemini_text, empty_token_info

SYSTEM_PROMPT = """You are an agricultural meteorologist AI for Indian farming conditions.

Given weather data, produce a disease risk assessment JSON.

ANALYSIS RULES:
1. HUMIDITY × TEMPERATURE MATRIX:
   - Humidity > 80% + temp 20–30°C  → HIGH fungal risk
   - Humidity < 40% + temp > 35°C   → HIGH pest/mite risk
   - Prolonged leaf wetness (VPD < 0.4 kPa) → CRITICAL fungal risk

2. DISEASE-FAVOURABLE CONDITIONS MAP:
   - Powdery Mildew  : 20–25°C, 40–70% humidity, dry leaves
   - Downy Mildew    : 15–22°C, >85% humidity, wet leaves
   - Bacterial Blight: >25°C,   >80% humidity, rain/irrigation splash
   - Rust            : 15–25°C, >95% humidity, 6+ hrs leaf wetness
   - Fusarium Wilt   : soil temp >25°C, waterlogged soil
   - Late Blight     : 10–24°C, >90% humidity, cool nights
   - Early Blight    : 24–29°C, >80% humidity, warm days
   - Anthracnose     : >25°C,   >90% humidity, rain splash
   - Cercospora      : 25–30°C, >80% humidity
   - Thrips/Aphids   : dry hot weather (>30°C, <50% humidity)

3. SOIL CONDITIONS:
   - High soil moisture + warm temp → root rot / wilt risk
   - Low VPD → high leaf wetness duration

4. FORECAST RISK:
   - Check 7-day forecast for upcoming rainy / high-humidity windows

RISK LEVELS: LOW | MODERATE | HIGH | CRITICAL

OUTPUT: Valid JSON only. No markdown.

{
  "overall_disease_risk": "HIGH",
  "risk_factors": ["High humidity (85%) + warm temp (26°C) strongly favours fungal spread"],
  "favorable_diseases": ["Downy Mildew", "Bacterial Blight"],
  "soil_risk": "MODERATE",
  "forecast_risk": "Rain expected in 2 of next 3 days — disease window extends through the week",
  "advisory": "Avoid overhead irrigation. Apply preventive fungicide before rain."
}"""


def _parse_json(raw: str) -> Optional[dict]:
    from utils.json_extractor import extract_json
    return extract_json(raw)


def _fallback_defaults() -> dict:
    """Used when weather API is down — conservative defaults."""
    return {
        "overall_disease_risk": "MODERATE",
        "risk_factors": ["Weather data unavailable — using conservative MODERATE risk defaults"],
        "favorable_diseases": [],
        "soil_risk": "UNKNOWN",
        "forecast_risk": "Forecast data not available",
        "advisory": "Monitor weather manually. Apply preventive fungicide if humidity exceeds 80%.",
        "weather_used": False,
    }


async def run_weather_analysis_agent(
    weather_data: Optional[dict],
    crop_name: str,
    soil_type: str,
    growth_stage: str,
) -> tuple[dict, dict]:
    """
    weather_data: dict from weather_service.fetch_weather() or None
    Returns (weather_risk_dict, token_info).
    """
    if not weather_data:
        return _fallback_defaults(), empty_token_info()

    # Build user prompt (shared by Claude, Groq, and Gemini paths)
    current = weather_data.get("current", {})
    forecast = weather_data.get("daily_forecast", [])[:7]
    soil = weather_data.get("soil", {})
    loc = weather_data.get("location", {})

    user_prompt = f"""Analyze the following weather data for {crop_name} crop at {growth_stage} stage
growing in {soil_type} soil (lat {loc.get('latitude', '?')}, lon {loc.get('longitude', '?')}).

CURRENT CONDITIONS:
- Temperature    : {current.get('temperature', '?')}°C (feels like {current.get('apparent_temperature', '?')}°C)
- Humidity       : {current.get('humidity', '?')}%
- Dew Point      : {current.get('dew_point', '?')}°C
- VPD            : {current.get('vpd', '?')} kPa
- Wind Speed     : {current.get('wind_speed', '?')} km/h
- Cloud Cover    : {current.get('cloud_cover', '?')}%
- Precipitation  : {current.get('precipitation', 0)} mm
- Condition      : {current.get('weather_desc', '?')}
- Evapotranspiration: {current.get('evapotranspiration', '?')} mm/day

SOIL CONDITIONS:
- Surface temp   : {soil.get('temperature_surface', '?')}°C
- 6 cm temp      : {soil.get('temperature_6cm', '?')}°C
- Moisture 0-1cm : {soil.get('moisture_0_1cm', '?')} m³/m³
- Moisture 1-3cm : {soil.get('moisture_1_3cm', '?')} m³/m³

7-DAY FORECAST:
{chr(10).join(
    f"  Day {i+1} ({d['date']}): {d.get('temp_min','?')}–{d.get('temp_max','?')}°C | "
    f"Humidity {d.get('humidity_max','?')}% | Rain {d.get('rainfall', 0)} mm | "
    f"Rain prob {d.get('rain_prob', 0)}%"
    for i, d in enumerate(forecast)
)}

Identify disease risk level, list risk factors, name diseases favoured by current conditions,
assess soil-borne disease risk, describe forecast risk window, and give a brief advisory.
Return JSON only."""

    def _finalise(result: Optional[dict]) -> dict:
        if not result:
            return _fallback_defaults()
        result.setdefault("overall_disease_risk", "MODERATE")
        result.setdefault("risk_factors", [])
        result.setdefault("favorable_diseases", [])
        result.setdefault("soil_risk", "UNKNOWN")
        result.setdefault("forecast_risk", "")
        result.setdefault("advisory", "")
        result["weather_used"] = True
        return result

    # ── Groq (primary text LLM) ──────────────────────────────────────────────
    if GROQ_API_KEY:
        try:
            raw, tok = await call_groq_text(SYSTEM_PROMPT, user_prompt, GROQ_API_KEY)
            return _finalise(_parse_json(raw)), tok
        except Exception as exc:
            logger.exception("Groq call failed")

    # ── Fallback: Gemini text ─────────────────────────────────────────────────
    if GEMINI_API_KEY:
        try:
            raw, tok = await call_gemini_text(SYSTEM_PROMPT, user_prompt, GEMINI_API_KEY)
            return _finalise(_parse_json(raw)), tok
        except Exception as exc:
            logger.exception("Gemini fallback also failed")

    return _fallback_defaults(), empty_token_info()
