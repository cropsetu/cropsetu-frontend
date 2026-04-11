"""
Tests for orchestrator error-handling and outer try/except wrapper.

These tests mock the agent calls to simulate various failure modes
and verify the orchestrator raises RuntimeError with sanitized messages.
"""
import sys
import os
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# Minimal params for orchestrator tests
SAMPLE_PARAMS = {
    "crop_name": "Wheat",
    "crop_growth_stage": "Vegetative",
    "soil_type": "Alluvial",
    "irrigation_system": "Drip",
    "planting_date": "2025-01-01",
    "farm_size_acres": 1.0,
    "language": "en",
}

SAMPLE_IMAGES = [{"path": "/tmp/test.jpg", "type": "close_up"}]


class TestOrchestratorErrorWrapper:
    """Test the outer try/except in run_diagnosis()."""

    @pytest.mark.asyncio
    async def test_raises_runtime_error_on_image_quality_failure(self):
        """If image quality agent raises, run_diagnosis raises RuntimeError (not the raw exception)."""
        with patch("orchestrator.run_image_quality_agent", new_callable=AsyncMock) as mock_iq, \
             patch("orchestrator.fetch_weather", new_callable=AsyncMock) as mock_wx, \
             patch("orchestrator.get_weather_coords", new_callable=AsyncMock) as mock_coords:
            mock_coords.return_value = (None, None, "none")
            mock_wx.return_value = None
            mock_iq.side_effect = RuntimeError("CUDA OOM")

            from orchestrator import run_diagnosis
            with pytest.raises(RuntimeError) as exc_info:
                await run_diagnosis(SAMPLE_PARAMS, SAMPLE_IMAGES)

            # Should be a sanitized message, not the raw CUDA OOM
            assert "Diagnosis pipeline failed" in str(exc_info.value)
            assert "CUDA OOM" not in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_raises_runtime_error_on_diagnosis_failure(self):
        """If disease diagnosis agent raises, outer handler wraps it."""
        good_iq = {"quality_score": 0.85, "usable": True, "enhancement_notes": "", "suggestions": []}
        good_weather = {"overall_disease_risk": "MODERATE", "risk_factors": [], "favorable_diseases": [],
                        "soil_risk": "LOW", "forecast_risk": "", "advisory": "", "weather_used": False}

        with patch("orchestrator.run_image_quality_agent", return_value=good_iq), \
             patch("orchestrator.fetch_weather", new_callable=AsyncMock, return_value=None), \
             patch("orchestrator.get_weather_coords", new_callable=AsyncMock, return_value=(None, None, "none")), \
             patch("orchestrator.analyze_weather_risk_rules", return_value=good_weather), \
             patch("orchestrator.run_disease_diagnosis_agent", new_callable=AsyncMock) as mock_diag:
            mock_diag.side_effect = ValueError("Gemini API down")

            from orchestrator import run_diagnosis
            with pytest.raises(RuntimeError) as exc_info:
                await run_diagnosis(SAMPLE_PARAMS, SAMPLE_IMAGES)

            assert "Diagnosis pipeline failed" in str(exc_info.value)
            # Raw exception class name in message, but not detail
            assert "ValueError" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_raises_runtime_error_on_treatment_failure(self):
        """If treatment agent raises, outer handler wraps it."""
        good_iq = {"quality_score": 0.85, "usable": True, "enhancement_notes": "", "suggestions": []}
        good_weather = {"overall_disease_risk": "LOW", "risk_factors": [], "favorable_diseases": [],
                        "soil_risk": "LOW", "forecast_risk": "", "advisory": "", "weather_used": False}
        good_diagnosis = (
            {"primary_diagnosis": {"disease": "Rust", "severity": "Moderate", "scientific_name": ""},
             "confidence_score": 0.82, "spread_risk": "MODERATE", "causal_factors": [],
             "needs_advisor": False, "differentials": []},
            {}
        )

        with patch("orchestrator.run_image_quality_agent", return_value=good_iq), \
             patch("orchestrator.fetch_weather", new_callable=AsyncMock, return_value=None), \
             patch("orchestrator.get_weather_coords", new_callable=AsyncMock, return_value=(None, None, "none")), \
             patch("orchestrator.analyze_weather_risk_rules", return_value=good_weather), \
             patch("orchestrator.run_disease_diagnosis_agent", new_callable=AsyncMock, return_value=good_diagnosis), \
             patch("orchestrator.run_treatment_agent", new_callable=AsyncMock) as mock_tx:
            mock_tx.side_effect = ConnectionError("Groq unreachable")

            from orchestrator import run_diagnosis
            with pytest.raises(RuntimeError):
                await run_diagnosis(SAMPLE_PARAMS, SAMPLE_IMAGES)

    @pytest.mark.asyncio
    async def test_successful_pipeline_returns_dict(self):
        """Happy path: all agents return success → run_diagnosis returns a report dict."""
        good_iq = {"quality_score": 0.90, "usable": True, "enhancement_notes": "", "suggestions": []}
        good_weather = {"overall_disease_risk": "MODERATE", "risk_factors": [], "favorable_diseases": [],
                        "soil_risk": "LOW", "forecast_risk": "", "advisory": "", "weather_used": False}
        good_diagnosis = (
            {"primary_diagnosis": {"disease": "Rust", "severity": "Moderate", "scientific_name": "Puccinia triticina",
                                   "description": "Wheat leaf rust"},
             "confidence_score": 0.87, "spread_risk": "MODERATE", "causal_factors": ["humidity"],
             "needs_advisor": False, "differentials": []},
            {"model": "gemini-2.5-flash", "input_tokens": 100, "output_tokens": 200,
             "total_tokens": 300, "cost_usd": 0.0001}
        )
        good_treatment = (
            {"immediate_actions": ["Remove infected leaves"], "chemical_controls": [],
             "medicine_combinations": [], "organic_alternatives": [], "fertilizer_recommendations": [],
             "preventive_measures": [], "long_term_recommendations": [], "spray_timing_advisory": "",
             "relevance_score": 0.8},
            {"model": "llama-3.3-70b-versatile", "input_tokens": 200, "output_tokens": 300,
             "total_tokens": 500, "cost_usd": 0.0002}
        )
        good_report = (
            {"report_id": "test-id", "generated_at": "2025-01-01T00:00:00Z",
             "disease": {"name_common": "Rust"}, "farmer_summary": "Test summary",
             "next_steps": ["Step 1"], "weather_outlook": {}, "meta": {}},
            {"model": "template", "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost_usd": 0.0}
        )

        with patch("orchestrator.run_image_quality_agent", return_value=good_iq), \
             patch("orchestrator.fetch_weather", new_callable=AsyncMock, return_value=None), \
             patch("orchestrator.get_weather_coords", new_callable=AsyncMock, return_value=(None, None, "none")), \
             patch("orchestrator.analyze_weather_risk_rules", return_value=good_weather), \
             patch("orchestrator.run_disease_diagnosis_agent", new_callable=AsyncMock, return_value=good_diagnosis), \
             patch("orchestrator.run_treatment_agent", new_callable=AsyncMock, return_value=good_treatment), \
             patch("orchestrator.run_report_generator_agent", new_callable=AsyncMock, return_value=good_report):
            from orchestrator import run_diagnosis
            result = await run_diagnosis(SAMPLE_PARAMS, SAMPLE_IMAGES)

        assert isinstance(result, dict)
        assert "report_id" in result or "disease" in result

    @pytest.mark.asyncio
    async def test_low_quality_image_short_circuits(self):
        """Images with quality < 0.4 and not usable trigger needs_rescan response without calling diagnosis."""
        bad_iq = {"quality_score": 0.2, "usable": False, "enhancement_notes": "",
                  "suggestions": ["Retake in better light"]}
        good_weather = {"overall_disease_risk": "LOW", "risk_factors": [], "favorable_diseases": [],
                        "soil_risk": "LOW", "forecast_risk": "", "advisory": "", "weather_used": False}

        with patch("orchestrator.run_image_quality_agent", return_value=bad_iq), \
             patch("orchestrator.fetch_weather", new_callable=AsyncMock, return_value=None), \
             patch("orchestrator.get_weather_coords", new_callable=AsyncMock, return_value=(None, None, "none")), \
             patch("orchestrator.analyze_weather_risk_rules", return_value=good_weather), \
             patch("orchestrator.run_disease_diagnosis_agent", new_callable=AsyncMock) as mock_diag:
            from orchestrator import run_diagnosis
            result = await run_diagnosis(SAMPLE_PARAMS, SAMPLE_IMAGES)

        # Should short-circuit without calling diagnosis
        mock_diag.assert_not_called()
        assert result["report_id"] == "needs_rescan"
        assert result["confidence_score"] == 0.0
