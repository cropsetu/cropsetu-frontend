"""
Unit tests for agents/report_generator_agent.py

Tests: farmer summary text, next-steps generation, causes, weather outlook,
       full template report structure, report ID uniqueness, async entry point.
"""
import pytest
import asyncio
import sys
import os
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.report_generator_agent import (
    _build_farmer_summary,
    _build_next_steps,
    _build_causes,
    _build_weather_outlook,
    _generate_template_report,
    _report_id,
    run_report_generator_agent,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _treatment(immediate=None, chemical=None):
    # Use 'is None' check so callers can pass [] to mean "no chemicals"
    return {
        "immediate_actions": immediate if immediate is not None else ["Remove infected leaves", "Improve airflow"],
        "chemical_controls": chemical if chemical is not None else [
            {"product": "Mancozeb 75% WP", "dosage": "2g/L", "brands": [{"name": "Dithane M-45"}]}
        ],
        "organic_alternatives": [],
        "fertilizer_recommendations": [],
        "preventive_measures": ["Crop rotation"],
        "spray_timing_advisory": "Early morning",
    }


def _diagnosis(disease="Early Blight", severity="Moderate", confidence=0.87,
               needs_advisor=False):
    return {
        "primary_diagnosis": {
            "disease": disease,
            "severity": severity,
            "scientific_name": "Alternaria solani",
        },
        "confidence_score": confidence,
        "needs_advisor": needs_advisor,
        "spread_risk": "HIGH",
        "differentials": [],
    }


def _weather_risk(risk="HIGH"):
    return {
        "overall_disease_risk": risk,
        "forecast_risk": "Rain expected 3/7 days",
        "advisory": "Apply fungicide within 48 hours",
        "risk_factors": ["High humidity"],
        "favorable_diseases": ["Early Blight"],
        "soil_risk": "MODERATE",
        "weather_used": True,
    }


def _params():
    return {
        "crop_name": "Tomato",
        "soil_type": "Black",
        "irrigation_system": "Drip",
        "crop_growth_stage": "Vegetative",
        "field_latitude": 19.9,
        "field_longitude": 73.8,
        "farm_size_acres": 2.5,
        "language": "en",
        "affected_area_percent": 25,
    }


def _image_quality():
    return {"quality_score": 0.82, "usable": True, "suggestions": []}


# ── _build_farmer_summary ─────────────────────────────────────────────────────

class TestBuildFarmerSummary:
    def test_high_confidence_contains_percentage(self):
        summary = _build_farmer_summary("Early Blight", 0.87, "Moderate", _treatment(), "Tomato")
        assert "87%" in summary

    def test_high_confidence_contains_disease_name(self):
        summary = _build_farmer_summary("Early Blight", 0.87, "Moderate", _treatment(), "Tomato")
        assert "Early Blight" in summary

    def test_high_confidence_contains_severity(self):
        summary = _build_farmer_summary("Early Blight", 0.87, "Moderate", _treatment(), "Tomato")
        assert "Moderate" in summary

    def test_high_confidence_mentions_chemical(self):
        summary = _build_farmer_summary("Early Blight", 0.87, "Moderate", _treatment(), "Tomato")
        assert "Mancozeb" in summary or "Dithane" in summary

    def test_low_confidence_uses_hedged_language(self):
        summary = _build_farmer_summary("Early Blight", 0.55, "Mild", _treatment(), "Tomato")
        assert "possibly" in summary.lower() or "fresh" in summary.lower()

    def test_crop_name_lowercased_in_summary(self):
        summary = _build_farmer_summary("Early Blight", 0.87, "Moderate", _treatment(), "Tomato")
        assert "tomato" in summary.lower()

    def test_no_chemical_skips_spray_sentence(self):
        t = _treatment(chemical=[])
        summary = _build_farmer_summary("Rust", 0.80, "Moderate", t, "Wheat")
        assert "Spray" not in summary

    def test_returns_string(self):
        summary = _build_farmer_summary("Unknown", 0.50, "Unknown", {}, "Crop")
        assert isinstance(summary, str)

    def test_immediate_action_included(self):
        t = _treatment(immediate=["Apply neem oil immediately"])
        summary = _build_farmer_summary("Late Blight", 0.90, "Severe", t, "Potato")
        assert "neem oil" in summary.lower() or "Apply" in summary

    def test_threshold_exactly_70(self):
        # 70% confidence should use high-confidence path
        summary = _build_farmer_summary("Powdery Mildew", 0.70, "Mild", _treatment(), "Wheat")
        assert "70%" in summary
        assert "possibly" not in summary.lower()


# ── _build_next_steps ─────────────────────────────────────────────────────────

class TestBuildNextSteps:
    def test_returns_list(self):
        steps = _build_next_steps(_treatment(), "Early Blight", "Drip")
        assert isinstance(steps, list)

    def test_max_5_steps(self):
        steps = _build_next_steps(_treatment(), "Early Blight", "Drip")
        assert len(steps) <= 5

    def test_at_least_3_steps(self):
        steps = _build_next_steps(_treatment(), "Early Blight", "Drip")
        assert len(steps) >= 3

    def test_first_step_is_today(self):
        steps = _build_next_steps(_treatment(), "Early Blight", "Drip")
        assert steps[0].startswith("TODAY:")

    def test_7_day_followup_present(self):
        steps = _build_next_steps(_treatment(), "Early Blight", "Drip")
        combined = " ".join(steps)
        assert "7 DAYS" in combined or "IN 7" in combined

    def test_sprinkler_irrigation_gets_drip_warning(self):
        steps = _build_next_steps(_treatment(), "Early Blight", "Sprinkler")
        combined = " ".join(steps)
        assert "drip" in combined.lower() or "overhead" in combined.lower() or "wet" in combined.lower()

    def test_drip_irrigation_no_switch_warning(self):
        steps = _build_next_steps(_treatment(), "Early Blight", "Drip")
        combined = " ".join(steps)
        # Should mention targeted watering, not switch to drip
        assert "Switch to drip" not in combined

    def test_chemical_in_steps(self):
        steps = _build_next_steps(_treatment(), "Early Blight", "Drip")
        combined = " ".join(steps)
        assert "Mancozeb" in combined or "Spray" in combined

    def test_empty_treatment_no_crash(self):
        steps = _build_next_steps({}, "Unknown", "Drip")
        assert isinstance(steps, list)

    def test_disease_name_in_followup(self):
        steps = _build_next_steps(_treatment(), "Late Blight", "Drip")
        combined = " ".join(steps)
        assert "Late Blight" in combined


# ── _build_causes ─────────────────────────────────────────────────────────────

class TestBuildCauses:
    def test_returns_list(self):
        causes = _build_causes(_diagnosis())
        assert isinstance(causes, list)

    def test_at_least_one_cause(self):
        causes = _build_causes(_diagnosis())
        assert len(causes) >= 1

    def test_uses_causal_factors_when_present(self):
        diag = _diagnosis()
        diag["causal_factors"] = ["Excessive rain", "Poor drainage"]
        causes = _build_causes(diag)
        assert "Excessive rain" in causes

    def test_max_5_causes(self):
        diag = _diagnosis()
        diag["causal_factors"] = [f"Cause {i}" for i in range(10)]
        causes = _build_causes(diag)
        assert len(causes) <= 5

    def test_fallback_causes_when_no_causal_factors(self):
        causes = _build_causes(_diagnosis())
        assert any("Environmental" in c or "moisture" in c.lower() for c in causes)


# ── _build_weather_outlook ────────────────────────────────────────────────────

class TestBuildWeatherOutlook:
    def test_risk_key_present(self):
        outlook = _build_weather_outlook(_weather_risk())
        assert "risk" in outlook

    def test_risk_value_correct(self):
        outlook = _build_weather_outlook(_weather_risk("CRITICAL"))
        assert outlook["risk"] == "CRITICAL"

    def test_advisory_preserved(self):
        outlook = _build_weather_outlook(_weather_risk())
        assert "fungicide" in outlook["advisory"].lower() or "Apply" in outlook["advisory"]

    def test_summary_combines_forecast_and_advisory(self):
        outlook = _build_weather_outlook(_weather_risk())
        assert len(outlook["summary"]) > 0

    def test_weather_used_flag_preserved(self):
        outlook = _build_weather_outlook(_weather_risk())
        assert outlook["weather_used"] is True

    def test_empty_weather_risk_no_crash(self):
        outlook = _build_weather_outlook({})
        assert "risk" in outlook


# ── _generate_template_report ─────────────────────────────────────────────────

class TestGenerateTemplateReport:
    def _make_report(self, **kwargs):
        d = dict(
            diagnosis=_diagnosis(),
            treatment=_treatment(),
            weather_risk=_weather_risk(),
            image_quality=_image_quality(),
            params=_params(),
            report_id="test-report-id",
            generated_at="2026-04-11T00:00:00+00:00",
        )
        d.update(kwargs)
        return _generate_template_report(**d)

    def test_report_id_echoed(self):
        report = self._make_report()
        assert report["report_id"] == "test-report-id"

    def test_generated_at_echoed(self):
        report = self._make_report()
        assert report["generated_at"] == "2026-04-11T00:00:00+00:00"

    def test_required_top_level_keys(self):
        report = self._make_report()
        required = ["report_id", "generated_at", "language", "farm", "disease",
                    "causes", "treatment", "next_steps", "advisor_needed",
                    "weather_outlook", "farmer_summary", "confidence_score",
                    "risk_level", "image_quality", "meta"]
        for key in required:
            assert key in report, f"Missing key: {key}"

    def test_disease_name_correct(self):
        report = self._make_report()
        assert report["disease"]["name_common"] == "Early Blight"

    def test_confidence_pct_rounded(self):
        report = self._make_report()
        assert report["disease"]["confidence_pct"] == 87  # 0.87 * 100

    def test_farm_crop_name(self):
        report = self._make_report()
        assert report["farm"]["crop"] == "Tomato"

    def test_meta_template_flag(self):
        report = self._make_report()
        assert report["meta"]["_template"] is True

    def test_image_quality_score(self):
        report = self._make_report()
        assert report["image_quality"]["score"] == 0.82

    def test_language_from_params(self):
        report = self._make_report()
        assert report["language"] == "en"

    def test_needs_advisor_false(self):
        report = self._make_report()
        assert report["advisor_needed"] is False

    def test_needs_advisor_true(self):
        diag = _diagnosis(needs_advisor=True)
        report = self._make_report(diagnosis=diag)
        assert report["advisor_needed"] is True
        assert "KVK" in report["meta"]["advisor_trigger"]

    def test_next_steps_non_empty(self):
        report = self._make_report()
        assert len(report["next_steps"]) > 0

    def test_weather_outlook_structure(self):
        report = self._make_report()
        assert "risk" in report["weather_outlook"]
        assert "advisory" in report["weather_outlook"]

    def test_farmer_summary_non_empty(self):
        report = self._make_report()
        assert len(report["farmer_summary"]) > 20


# ── _report_id uniqueness ─────────────────────────────────────────────────────

class TestReportIdUniqueness:
    def test_each_call_unique(self):
        ids = {_report_id() for _ in range(20)}
        assert len(ids) == 20

    def test_is_valid_uuid_format(self):
        import re
        rid = _report_id()
        assert re.match(
            r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}",
            rid
        )


# ── async run_report_generator_agent ─────────────────────────────────────────

class TestRunReportGeneratorAgent:
    def test_returns_tuple(self):
        async def _run():
            return await run_report_generator_agent(
                diagnosis=_diagnosis(),
                treatment=_treatment(),
                weather_risk=_weather_risk(),
                image_quality=_image_quality(),
                params=_params(),
            )
        report, token_info = asyncio.run(_run())
        assert isinstance(report, dict)
        assert isinstance(token_info, dict)

    def test_token_info_model_is_template(self):
        async def _run():
            return await run_report_generator_agent(
                diagnosis=_diagnosis(),
                treatment=_treatment(),
                weather_risk=_weather_risk(),
                image_quality=_image_quality(),
                params=_params(),
            )
        _, token_info = asyncio.run(_run())
        assert token_info.get("model") == "template"

    def test_zero_cost(self):
        async def _run():
            return await run_report_generator_agent(
                diagnosis=_diagnosis(),
                treatment=_treatment(),
                weather_risk=_weather_risk(),
                image_quality=_image_quality(),
                params=_params(),
            )
        _, token_info = asyncio.run(_run())
        assert token_info.get("cost_usd", 0) == 0.0

    def test_report_has_disease_field(self):
        async def _run():
            return await run_report_generator_agent(
                diagnosis=_diagnosis(),
                treatment=_treatment(),
                weather_risk=_weather_risk(),
                image_quality=_image_quality(),
                params=_params(),
            )
        report, _ = asyncio.run(_run())
        assert "disease" in report
        assert report["disease"]["name_common"] == "Early Blight"
