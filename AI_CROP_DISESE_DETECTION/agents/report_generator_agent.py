"""
Report Generator Agent — CropGuard Agentic AI
Strategy: Template-based (no LLM) — deterministic, instant, $0 cost.
          Saves ~$0.0005/request and 2-3 seconds latency.

The LLM path is kept as an optional enhancement but NOT the default.
"""
from __future__ import annotations
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

from config import GROQ_API_KEY, GEMINI_API_KEY
from agents.llm_utils import empty_token_info


def _report_id() -> str:
    return str(uuid.uuid4())


def _generated_at() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Template-based narrative builder ─────────────────────────────────────────

def _build_farmer_summary(disease_name: str, confidence: float, severity: str,
                           treatment: dict, crop: str) -> str:
    """2-3 plain sentences. No jargon."""
    conf_pct = round(confidence * 100)
    first_chem = ""
    if treatment.get("chemical_controls"):
        c = treatment["chemical_controls"][0]
        first_chem = c.get("product") or (
            c.get("brands", [{}])[0].get("name") if c.get("brands") else ""
        )
    first_action = (treatment.get("immediate_actions") or ["Monitor crop carefully"])[0]

    if conf_pct >= 70:
        summary = (
            f"Your {crop.lower()} crop has been diagnosed with {disease_name} "
            f"at {conf_pct}% confidence (severity: {severity}). "
        )
    else:
        summary = (
            f"Your {crop.lower()} crop shows signs possibly consistent with {disease_name} "
            f"({conf_pct}% confidence — please take fresh close-up photos for a better diagnosis). "
        )

    summary += first_action.rstrip(".") + "."
    if first_chem:
        summary += f" Spray {first_chem} as soon as possible to control the spread."
    return summary


def _build_next_steps(treatment: dict, disease_name: str, irrigation: str) -> list[str]:
    """3-5 numbered action items derived from treatment data."""
    steps: list[str] = []

    immediate = treatment.get("immediate_actions", [])
    if immediate:
        steps.append(f"TODAY: {immediate[0]}")
    if len(immediate) > 1:
        steps.append(f"TODAY: {immediate[1]}")

    # Irrigation adjustment
    irr = (irrigation or "").lower()
    if "overhead" in irr or "sprinkler" in irr or "flood" in irr:
        steps.append("WITHIN 24 HRS: Switch to drip or furrow irrigation — wet leaves accelerate disease spread")
    else:
        steps.append("WITHIN 24 HRS: Avoid wetting leaves during irrigation — use targeted watering")

    # Primary chemical
    if treatment.get("chemical_controls"):
        c = treatment["chemical_controls"][0]
        prod = c.get("product", "recommended fungicide")
        dose = c.get("dosage", "as per label")
        steps.append(f"THIS WEEK: Spray {prod} ({dose}), preferably early morning before 9 AM")

    # 7-day follow-up
    steps.append(f"IN 7 DAYS: Inspect all plants. Repeat spray if {disease_name} symptoms persist")

    # Long-term
    if treatment.get("long_term_recommendations"):
        steps.append(f"LONG TERM: {treatment['long_term_recommendations'][0]}")

    return steps[:5]


def _build_causes(diagnosis: dict) -> list[str]:
    causal = diagnosis.get("causal_factors", [])
    if causal:
        return causal[:5]
    disease = diagnosis.get("primary_diagnosis", {}).get("disease", "this disease")
    return [
        f"Environmental conditions favorable for {disease} development",
        "Possible moisture stress or excessive irrigation",
        "Weakened plant immunity from nutrient imbalance",
    ]


def _build_weather_outlook(weather_risk: dict) -> dict:
    return {
        "risk":               weather_risk.get("overall_disease_risk", "UNKNOWN"),
        "forecast_risk":      weather_risk.get("forecast_risk", ""),
        "advisory":           weather_risk.get("advisory", ""),
        "risk_factors":       weather_risk.get("risk_factors", []),
        "favorable_diseases": weather_risk.get("favorable_diseases", []),
        "soil_risk":          weather_risk.get("soil_risk", "UNKNOWN"),
        "weather_used":       weather_risk.get("weather_used", False),
        "summary": (
            f"{weather_risk.get('forecast_risk', '')}  {weather_risk.get('advisory', '')}"
        ).strip(),
    }


def _generate_template_report(
    diagnosis: dict,
    treatment: dict,
    weather_risk: dict,
    image_quality: dict,
    params: dict,
    report_id: str,
    generated_at: str,
) -> dict:
    """
    Deterministic template report — no LLM, ~0ms, $0.
    """
    disease_info  = diagnosis.get("primary_diagnosis", {})
    disease_name  = disease_info.get("disease", "Unknown")
    confidence    = diagnosis.get("confidence_score", 0.0)
    severity      = disease_info.get("severity", "Unknown")
    needs_advisor = diagnosis.get("needs_advisor", False)
    crop          = params.get("crop_name", "Unknown")
    irrigation    = params.get("irrigation_system", "")

    farmer_summary = _build_farmer_summary(disease_name, confidence, severity, treatment, crop)
    next_steps     = _build_next_steps(treatment, disease_name, irrigation)
    causes         = _build_causes(diagnosis)
    weather_out    = _build_weather_outlook(weather_risk)

    advisor_trigger = (
        "Consult your local KVK (Krishi Vigyan Kendra) if disease spreads to more than 30% "
        "of your field after 7 days of treatment, or if symptoms worsen rapidly."
        if needs_advisor else
        f"Visit a KVK advisor if disease spreads beyond {params.get('affected_area_percent', 30)}% "
        "of field after treatment."
    )

    return {
        "report_id":      report_id,
        "generated_at":   generated_at,
        "language":       params.get("language", "en"),
        "farm": {
            "crop":            crop,
            "variety":         params.get("crop_variety", ""),
            "growth_stage":    params.get("crop_growth_stage", ""),
            "location":        f"Lat {params.get('field_latitude', '?')}, Lon {params.get('field_longitude', '?')}",
            "farm_size_acres": params.get("farm_size_acres"),
            "soil_type":       params.get("soil_type", ""),
            "irrigation":      irrigation,
        },
        "disease": {
            "name_common":    disease_name,
            "name_scientific": disease_info.get("scientific_name", ""),
            "confidence_pct": round(confidence * 100),
            "severity":       severity,
            "spread_risk":    diagnosis.get("spread_risk", "UNKNOWN"),
            "description":    disease_info.get("description", ""),
        },
        "causes":    causes,
        "treatment": {
            "immediate":      treatment.get("immediate_actions", []),
            "chemical":       treatment.get("chemical_controls", []),
            "organic":        treatment.get("organic_alternatives", []),
            "fertilizer":     treatment.get("fertilizer_recommendations", []),
            "preventive":     treatment.get("preventive_measures", []),
            "spray_timing":   treatment.get("spray_timing_advisory", ""),
            "combinations":   treatment.get("medicine_combinations", []),
        },
        "next_steps":     next_steps,
        "advisor_needed": needs_advisor,
        "weather_outlook": weather_out,
        "farmer_summary": farmer_summary,
        "confidence_score": confidence,
        "risk_level":     weather_risk.get("overall_disease_risk", "UNKNOWN"),
        "image_quality": {
            "score":      image_quality.get("quality_score", 0),
            "usable":     image_quality.get("usable", False),
            "suggestions": image_quality.get("suggestions", []),
        },
        "meta": {
            "report_id":       report_id,
            "model_diagnosis": "gemini-2.5-flash",
            "needs_advisor":   needs_advisor,
            "differentials":   diagnosis.get("differentials", []),
            "advisor_trigger": advisor_trigger,
            "_template":       True,  # generated without LLM
        },
    }


# ── Public entry point ────────────────────────────────────────────────────────

async def run_report_generator_agent(
    diagnosis: dict,
    treatment: dict,
    weather_risk: dict,
    image_quality: dict,
    params: dict,
) -> tuple[dict, dict]:
    """
    Generates the final report card.
    Uses template-based generation (no LLM) — instant, $0.
    Returns (report_dict, token_info).
    """
    report_id    = _report_id()
    generated_at = _generated_at()

    report = _generate_template_report(
        diagnosis, treatment, weather_risk, image_quality, params,
        report_id, generated_at,
    )

    logger.info("Template report built — id=%s disease=%s cost=$0.0000", report_id[:8], report['disease']['name_common'])
    return report, empty_token_info("template")
