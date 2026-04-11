"""
Scan Service — bridges Express base64 image → orchestrator temp-file pipeline.

Express sends: { image_base64, mime_type, farm_params (camelCase), lat, lon }
Orchestrator expects: params (snake_case), images=[{"path": str, "type": str}]
"""
from __future__ import annotations
import base64
import logging
import os
import re
import tempfile
from typing import Optional

from orchestrator import run_diagnosis
from services.input_normalizer import clean_farm_context

logger = logging.getLogger(__name__)

# ── Input sanitization ────────────────────────────────────────────────────────

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]")
_PROMPT_INJECTION = re.compile(
    r"(ignore\s+(all\s+)?previous|disregard|new\s+instruction|system\s*:|assistant\s*:)",
    re.IGNORECASE,
)
_MAX_FIELD_LEN = 500


def sanitize_user_input(value: str) -> str:
    """
    Strip control characters and obvious prompt-injection patterns from a
    free-text field supplied by the user.
    """
    if not isinstance(value, str):
        return value
    # Remove control characters (keep \t, \n, \r which are safe)
    value = _CONTROL_CHARS.sub("", value)
    # Truncate long strings
    value = value[:_MAX_FIELD_LEN]
    # Neutralize prompt injection attempts
    if _PROMPT_INJECTION.search(value):
        logger.warning("[ScanService] Prompt injection pattern detected in user input — field sanitized")
        value = _PROMPT_INJECTION.sub("[REDACTED]", value)
    return value.strip()


def _sanitize_farm_ctx(farm_ctx: dict) -> dict:
    """Sanitize all string fields in the farm context dict."""
    sanitized: dict = {}
    for key, val in farm_ctx.items():
        if isinstance(val, str):
            sanitized[key] = sanitize_user_input(val)
        elif isinstance(val, list):
            sanitized[key] = [sanitize_user_input(v) if isinstance(v, str) else v for v in val]
        else:
            sanitized[key] = val
    return sanitized


# ── camelCase → snake_case field mapping ──────────────────────────────────────

_FIELD_MAP = {
    "cropName":             "crop_name",
    "cropAge":              None,           # derived → planting_date / growth_stage
    "cropVariety":          "crop_variety",
    "soilType":             "soil_type",
    "irrigationType":       "irrigation_system",
    "previousCrop":         "previous_crop",
    "landSize":             "farm_size_acres",
    "state":                "state",          # kept as-is (informational)
    "district":             "district",
    "season":               "season",
    "month":                "month",
    "symptoms":             None,             # joined → symptom_description
    "firstNoticed":         None,             # joined → symptom_description
    "affectedArea":         "affected_area_pct_label",
    "additionalSymptoms":   None,             # joined → symptom_description
    "language":             "language",
    # Already-snake fields from direct API callers
    "crop_name":            "crop_name",
    "crop_variety":         "crop_variety",
    "soil_type":            "soil_type",
    "irrigation_system":    "irrigation_system",
    "previous_crop":        "previous_crop",
    "affected_area_percent": "affected_area_percent",
    "symptom_description":  "symptom_description",
    "recent_pesticide_used": "recent_pesticide_used",
    "fertilizer_history":   "fertilizer_history",
    "farm_size_acres":      "farm_size_acres",
    "planting_date":        "planting_date",
    "crop_growth_stage":    "crop_growth_stage",
}

_AREA_PCT_MAP = {
    "less10":  5.0,
    "10-25":  17.5,
    "25-50":  37.5,
    "over50": 75.0,
}


def _map_farm_params(farm_ctx: dict, lat: Optional[float], lon: Optional[float]) -> dict:
    """Convert camelCase Express farmContext → orchestrator params dict."""
    p: dict = {}

    for src_key, dst_key in _FIELD_MAP.items():
        if src_key in farm_ctx and dst_key:
            p[dst_key] = farm_ctx[src_key]

    # Crop name fallback
    p.setdefault("crop_name", farm_ctx.get("cropName", "Unknown"))

    # Growth stage from cropAge (days)
    crop_age = farm_ctx.get("cropAge") or farm_ctx.get("crop_age")
    if crop_age is not None:
        age = int(crop_age)
        if age < 21:
            stage = "Seedling"
        elif age < 60:
            stage = "Vegetative"
        elif age < 90:
            stage = "Flowering"
        elif age < 130:
            stage = "Fruiting"
        else:
            stage = "Maturity"
        p.setdefault("crop_growth_stage", stage)
    p.setdefault("crop_growth_stage", "Vegetative")

    # Planting date — approximate from cropAge
    if crop_age and "planting_date" not in p:
        from datetime import datetime, timedelta
        p["planting_date"] = (datetime.today() - timedelta(days=int(crop_age))).strftime("%Y-%m-%d")
    p.setdefault("planting_date", "2025-01-01")

    # Irrigation system normalisation
    irr = p.get("irrigation_system", "")
    if irr and irr not in ("Drip", "Sprinkler", "Flood", "Rainfed", "Canal"):
        irr_lower = irr.lower()
        if "drip" in irr_lower:     p["irrigation_system"] = "Drip"
        elif "sprink" in irr_lower: p["irrigation_system"] = "Sprinkler"
        elif "flood" in irr_lower:  p["irrigation_system"] = "Flood"
        elif "canal" in irr_lower:  p["irrigation_system"] = "Canal"
        else:                        p["irrigation_system"] = "Rainfed"
    p.setdefault("irrigation_system", "Rainfed")

    # Soil type normalisation
    soil = p.get("soil_type", "")
    if soil and soil not in ("Black", "Red", "Alluvial", "Laterite", "Sandy", "Clay", "Loamy"):
        soil_lower = soil.lower()
        if "black" in soil_lower:    p["soil_type"] = "Black"
        elif "red" in soil_lower:    p["soil_type"] = "Red"
        elif "alluvial" in soil_lower: p["soil_type"] = "Alluvial"
        elif "sandy" in soil_lower:  p["soil_type"] = "Sandy"
        elif "clay" in soil_lower:   p["soil_type"] = "Clay"
        elif "loamy" in soil_lower:  p["soil_type"] = "Loamy"
        else:                        p["soil_type"] = "Alluvial"
    p.setdefault("soil_type", "Alluvial")

    # Symptom description — combine symptoms list + firstNoticed + additionalSymptoms
    parts = []
    symptoms = farm_ctx.get("symptoms", [])
    if symptoms:
        parts.append("Symptoms: " + ", ".join(symptoms))
    first_noticed = farm_ctx.get("firstNoticed", "")
    if first_noticed:
        parts.append(f"First noticed: {first_noticed}")
    additional = farm_ctx.get("additionalSymptoms", "") or farm_ctx.get("additionalText", "")
    if additional:
        parts.append(additional)
    if parts:
        p["symptom_description"] = ". ".join(parts)

    # Affected area %
    area_label = farm_ctx.get("affectedArea", "")
    pct = _AREA_PCT_MAP.get(area_label)
    if pct is not None:
        p["affected_area_percent"] = pct
    elif isinstance(farm_ctx.get("affected_area_percent"), (int, float)):
        p["affected_area_percent"] = farm_ctx["affected_area_percent"]

    # Farm size
    land = p.get("farm_size_acres", "")
    if isinstance(land, str):
        nums = [float(x) for x in land.split() if x.replace(".", "").isdigit()]
        p["farm_size_acres"] = nums[0] if nums else 1.0
    p.setdefault("farm_size_acres", 1.0)

    # GPS
    if lat is not None: p["field_latitude"] = lat
    if lon is not None: p["field_longitude"] = lon

    p.setdefault("language", farm_ctx.get("language", "en"))

    return p


async def run_scan_from_base64(
    image_base64: str,
    mime_type: str,
    farm_ctx: dict,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    image_view: str = "close_up",
) -> dict:
    """
    Decode base64 image → temp file → run 5-agent orchestrator → return report.
    """
    # Derive file extension
    ext = (mime_type or "image/jpeg").split("/")[-1].lower()
    if ext in ("jpeg", "jpg"): ext = "jpg"
    if ext == "heic": ext = "jpg"   # iOS HEIC decoded as JPEG on client

    # Sanitize free-text fields first, then normalize/deduplicate
    farm_ctx = _sanitize_farm_ctx(dict(farm_ctx))
    farm_ctx = clean_farm_context(farm_ctx)

    params = _map_farm_params(farm_ctx, lat, lon)

    # Write decoded image to temp file
    tmp_path = None
    try:
        img_bytes = base64.b64decode(image_base64)
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
            tmp.write(img_bytes)
            tmp_path = tmp.name

        images = [{"path": tmp_path, "type": image_view}]
        report = await run_diagnosis(params=params, images=images)
        return report

    finally:
        if tmp_path:
            try: os.unlink(tmp_path)
            except OSError: pass
