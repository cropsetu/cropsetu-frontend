"""
Unit tests for services/input_normalizer.py

Tests: fuzzy crop matching, soil normalization, irrigation normalization,
       growth stage estimation, edge cases, and clean_farm_context().
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.input_normalizer import (
    normalize_crop_name,
    normalize_soil_type,
    normalize_irrigation,
    estimate_growth_stage,
    clean_farm_context,
    VALID_CROPS,
    VALID_SOILS,
    VALID_IRRIGATION,
)


# ── normalize_crop_name ───────────────────────────────────────────────────────

class TestNormalizeCropName:
    def test_exact_match(self):
        assert normalize_crop_name("Tomato") == "Tomato"

    def test_case_insensitive(self):
        assert normalize_crop_name("tomato") == "Tomato"
        assert normalize_crop_name("WHEAT") == "Wheat"

    def test_typo_correction(self):
        result = normalize_crop_name("wheqt")
        assert result == "Wheat"

    def test_partial_typo(self):
        result = normalize_crop_name("Tomatoe")
        assert result == "Tomato"

    def test_unknown_crop_returned_as_is(self):
        # "Dragon Fruit" not in list but no close match → returned as titled
        result = normalize_crop_name("Dragon Fruit")
        assert result == "Dragon Fruit"

    def test_empty_string(self):
        assert normalize_crop_name("") == ""

    def test_none_input(self):
        assert normalize_crop_name(None) == ""

    def test_whitespace_only(self):
        assert normalize_crop_name("   ") == ""

    def test_all_valid_crops_exact(self):
        for crop in VALID_CROPS:
            assert normalize_crop_name(crop) == crop

    def test_chilli_vs_chili(self):
        # 'Chili' is 1 char off from 'Chilli' — should fuzzy match
        result = normalize_crop_name("Chili")
        assert result == "Chilli"

    def test_numeric_input_handled(self):
        result = normalize_crop_name(123)
        # Should not crash; result is either empty or the string
        assert isinstance(result, str)


# ── normalize_soil_type ───────────────────────────────────────────────────────

class TestNormalizeSoilType:
    def test_exact_match(self):
        assert normalize_soil_type("Black") == "Black"
        assert normalize_soil_type("Alluvial") == "Alluvial"

    def test_case_insensitive(self):
        assert normalize_soil_type("black") == "Black"
        assert normalize_soil_type("RED") == "Red"

    def test_keyword_substring(self):
        assert normalize_soil_type("Black cotton soil") == "Black"

    def test_alluvial_default_on_none(self):
        assert normalize_soil_type(None) == "Alluvial"

    def test_alluvial_default_on_unknown(self):
        result = normalize_soil_type("Volcanic")
        # unknown soil → should return title-cased input or "Alluvial"
        assert isinstance(result, str)

    def test_all_valid_soils_exact(self):
        for soil in VALID_SOILS:
            assert normalize_soil_type(soil) == soil

    def test_sandy_loam_maps_to_sandy_or_loamy(self):
        result = normalize_soil_type("Sandy Loam")
        assert result in ("Sandy", "Loamy", "Sandy Loam")


# ── normalize_irrigation ──────────────────────────────────────────────────────

class TestNormalizeIrrigation:
    def test_exact_match(self):
        assert normalize_irrigation("Drip") == "Drip"
        assert normalize_irrigation("Sprinkler") == "Sprinkler"

    def test_case_insensitive(self):
        assert normalize_irrigation("drip") == "Drip"

    def test_keyword_in_phrase(self):
        assert normalize_irrigation("Drip Irrigation") == "Drip"

    def test_rainfed_default_on_none(self):
        assert normalize_irrigation(None) == "Rainfed"

    def test_rainfed_default_on_empty(self):
        assert normalize_irrigation("") == "Rainfed"

    def test_all_valid_types_exact(self):
        for irr in VALID_IRRIGATION:
            assert normalize_irrigation(irr) == irr

    def test_flood_irrigation_phrase(self):
        result = normalize_irrigation("Flood irrigation")
        assert result == "Flood"


# ── estimate_growth_stage ─────────────────────────────────────────────────────

class TestEstimateGrowthStage:
    def test_wheat_seedling(self):
        assert estimate_growth_stage("Wheat", 10) == "Seedling"

    def test_wheat_tillering(self):
        assert estimate_growth_stage("Wheat", 35) == "Tillering"

    def test_wheat_flowering(self):
        assert estimate_growth_stage("Wheat", 75) == "Flowering"

    def test_wheat_maturity(self):
        assert estimate_growth_stage("Wheat", 130) == "Maturity"

    def test_rice_seedling(self):
        assert estimate_growth_stage("Rice", 15) == "Seedling"

    def test_rice_heading(self):
        assert estimate_growth_stage("Rice", 80) == "Heading"

    def test_sugarcane_grand_growth(self):
        assert estimate_growth_stage("Sugarcane", 200) == "Grand Growth"

    def test_default_crop_vegetative(self):
        assert estimate_growth_stage("Tomato", 40) == "Vegetative"

    def test_default_crop_flowering(self):
        assert estimate_growth_stage("Tomato", 70) == "Flowering"

    def test_none_age_returns_vegetative(self):
        assert estimate_growth_stage("Wheat", None) == "Vegetative"

    def test_zero_age(self):
        result = estimate_growth_stage("Wheat", 0)
        assert isinstance(result, str)

    def test_very_old_crop(self):
        # Any crop at 500 days = Maturity
        assert estimate_growth_stage("Cotton", 500) == "Maturity"

    def test_string_age(self):
        # "45" as string should work
        result = estimate_growth_stage("Tomato", "45")
        assert result == "Vegetative"

    def test_float_age(self):
        result = estimate_growth_stage("Wheat", 25.7)
        assert result == "Tillering"

    def test_invalid_age_string(self):
        # Should not crash; returns "Vegetative"
        result = estimate_growth_stage("Wheat", "forty-five")
        assert result == "Vegetative"


# ── clean_farm_context ────────────────────────────────────────────────────────

class TestCleanFarmContext:
    def test_basic_normalization(self):
        ctx = {
            "cropName": "tomato",
            "soilType": "black",
            "irrigationType": "drip",
            "cropAge": 45,
        }
        result = clean_farm_context(ctx)
        assert result["cropName"] == "Tomato"
        assert result["soilType"] == "Black"
        assert result["irrigationType"] == "Drip"

    def test_primary_crop_name_merged(self):
        ctx = {"primaryCropName": "Wheat", "cropAge": 30}
        result = clean_farm_context(ctx)
        assert result["cropName"] == "Wheat"

    def test_primary_crop_age_merged(self):
        ctx = {"cropName": "Rice", "primaryCropAge": 50}
        result = clean_farm_context(ctx)
        assert result["cropAge"] == 50

    def test_growth_stage_auto_estimated(self):
        ctx = {"cropName": "Wheat", "cropAge": 35}
        result = clean_farm_context(ctx)
        assert result["growthStage"] == "Tillering"

    def test_existing_growth_stage_preserved(self):
        ctx = {"cropName": "Wheat", "cropAge": 35, "growthStage": "Flowering"}
        result = clean_farm_context(ctx)
        assert result["growthStage"] == "Flowering"  # not overwritten

    def test_empty_context(self):
        result = clean_farm_context({})
        assert isinstance(result, dict)
        # Should not crash
        assert "growthStage" in result

    def test_previous_crop_normalized(self):
        ctx = {"cropName": "Tomato", "previousCrop": "wheqt"}
        result = clean_farm_context(ctx)
        assert result["previousCrop"] == "Wheat"

    def test_returns_same_dict(self):
        ctx = {"cropName": "Onion"}
        result = clean_farm_context(ctx)
        assert result is ctx  # modifies in-place and returns same object
