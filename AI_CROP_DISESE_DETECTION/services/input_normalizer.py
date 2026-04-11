"""
Input Normalizer — Fuzzy-match and deduplicate farm context fields.

Handles:
  - Typos in crop names ("wheqt" → "Wheat")
  - Duplicate fields (primaryCropName / cropName → crop_name)
  - Soil type and irrigation type normalization
  - Growth stage estimation from crop age
"""
from __future__ import annotations
import logging
from difflib import get_close_matches

logger = logging.getLogger(__name__)


# ── Canonical lookup tables ───────────────────────────────────────────────────

VALID_CROPS = [
    "Wheat", "Rice", "Cotton", "Sugarcane", "Soybean", "Maize",
    "Tomato", "Onion", "Potato", "Chilli", "Gram", "Tur", "Lentil",
    "Jowar", "Bajra", "Groundnut", "Sunflower", "Mustard", "Garlic",
    "Ginger", "Turmeric", "Brinjal", "Cauliflower", "Cabbage", "Spinach",
    "Okra", "Cucumber", "Pumpkin", "Watermelon", "Mango", "Banana",
    "Papaya", "Pomegranate", "Grapes", "Orange", "Lemon", "Guava",
    "Peas", "Beans", "Capsicum", "Carrot", "Radish", "Beetroot",
]

VALID_SOILS = [
    "Black", "Red", "Alluvial", "Laterite", "Sandy", "Clay", "Loamy",
]

VALID_IRRIGATION = [
    "Drip", "Sprinkler", "Flood", "Rainfed", "Canal",
]

# ── Growth-stage estimation (generic by age in days) ─────────────────────────
# Crop-specific overrides can be added here.
_STAGE_OVERRIDES: dict[str, list[tuple[int, str]]] = {
    # (age_cutoffs, stage_name) — sorted ascending
    "Sugarcane": [(30, "Germination"), (120, "Tillering"), (270, "Grand Growth"), (360, "Maturity")],
    "Rice":      [(20, "Seedling"),    (60,  "Tillering"), (90,  "Heading"),       (130, "Maturity")],
    "Wheat":     [(20, "Seedling"),    (50,  "Tillering"), (90,  "Flowering"),     (120, "Maturity")],
}
_DEFAULT_STAGES = [(20, "Seedling"), (60, "Vegetative"), (90, "Flowering"), (130, "Fruiting"), (9999, "Maturity")]


def estimate_growth_stage(crop: str, age_days) -> str:
    """Derive growth stage from crop type and age in days."""
    if age_days is None:
        return "Vegetative"
    try:
        age = int(float(age_days))
    except (ValueError, TypeError):
        return "Vegetative"

    stages = _STAGE_OVERRIDES.get(crop, _DEFAULT_STAGES)
    for cutoff, label in stages:
        if age <= cutoff:
            return label
    return "Maturity"


# ── Fuzzy normalizers ─────────────────────────────────────────────────────────

def normalize_crop_name(raw: str | None) -> str:
    """Fuzzy-match user input against known crop names."""
    if not raw or not str(raw).strip():
        return ""
    raw = str(raw).strip().title()
    if raw in VALID_CROPS:
        return raw
    matches = get_close_matches(raw, VALID_CROPS, n=1, cutoff=0.6)
    corrected = matches[0] if matches else raw
    if corrected != raw:
        logger.info(f"[InputNormalizer] Crop fuzzy-matched: '{raw}' → '{corrected}'")
    return corrected


def normalize_soil_type(raw: str | None) -> str:
    """Fuzzy-match soil type."""
    if not raw:
        return "Alluvial"
    raw = str(raw).strip()
    title = raw.title()
    if title in VALID_SOILS:
        return title
    lower = raw.lower()
    # Quick keyword check first
    for soil in VALID_SOILS:
        if soil.lower() in lower or lower in soil.lower():
            return soil
    matches = get_close_matches(lower, [s.lower() for s in VALID_SOILS], n=1, cutoff=0.6)
    if matches:
        corrected = VALID_SOILS[[s.lower() for s in VALID_SOILS].index(matches[0])]
        logger.info(f"[InputNormalizer] Soil fuzzy-matched: '{raw}' → '{corrected}'")
        return corrected
    return title or "Alluvial"


def normalize_irrigation(raw: str | None) -> str:
    """Fuzzy-match irrigation type."""
    if not raw:
        return "Rainfed"
    raw = str(raw).strip()
    title = raw.title()
    if title in VALID_IRRIGATION:
        return title
    lower = raw.lower()
    for irr in VALID_IRRIGATION:
        if irr.lower() in lower or lower in irr.lower():
            return irr
    matches = get_close_matches(lower, [i.lower() for i in VALID_IRRIGATION], n=1, cutoff=0.6)
    if matches:
        corrected = VALID_IRRIGATION[[i.lower() for i in VALID_IRRIGATION].index(matches[0])]
        logger.info(f"[InputNormalizer] Irrigation fuzzy-matched: '{raw}' → '{corrected}'")
        return corrected
    return title or "Rainfed"


# ── Main cleaner ──────────────────────────────────────────────────────────────

def clean_farm_context(ctx: dict) -> dict:
    """
    Normalize and deduplicate farm context fields from Express farmContext.

    Handles:
    - Merges primaryCropName / cropName → single 'cropName'
    - Merges primaryCropAge / cropAge → 'cropAge'
    - Fuzzy-matches crop, soil, irrigation
    - Estimates growthStage from age if missing

    Returns the cleaned dict (same keys, Express camelCase preserved).
    Modifies in-place and returns for convenience.
    """
    # ── Merge duplicate primary* fields ──────────────────────────────────────
    if not ctx.get("cropName") and ctx.get("primaryCropName"):
        ctx["cropName"] = ctx["primaryCropName"]
    if not ctx.get("cropAge") and ctx.get("primaryCropAge"):
        ctx["cropAge"] = ctx["primaryCropAge"]

    # ── Fuzzy-normalize key fields ────────────────────────────────────────────
    crop = normalize_crop_name(ctx.get("cropName", ""))
    if crop and crop != ctx.get("cropName"):
        ctx["cropName"] = crop

    soil = normalize_soil_type(ctx.get("soilType", ""))
    if soil:
        ctx["soilType"] = soil

    irrigation = normalize_irrigation(ctx.get("irrigationType", ""))
    if irrigation:
        ctx["irrigationType"] = irrigation

    prev_crop = normalize_crop_name(ctx.get("previousCrop", ""))
    if prev_crop:
        ctx["previousCrop"] = prev_crop

    # ── Growth stage estimation ───────────────────────────────────────────────
    if not ctx.get("growthStage"):
        age = ctx.get("cropAge") or ctx.get("primaryCropAge")
        ctx["growthStage"] = estimate_growth_stage(crop, age)

    logger.info(
        f"[InputNormalizer] Normalized → crop='{ctx.get('cropName')}' "
        f"soil='{ctx.get('soilType')}' irr='{ctx.get('irrigationType')}' "
        f"stage='{ctx.get('growthStage')}' prevCrop='{ctx.get('previousCrop', '')}'"
    )

    return ctx
