"""
Unit tests for services/weather_rules.py

Tests: risk levels, disease condition matching, forecast analysis,
       advisory text, edge cases, and missing data handling.
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.weather_rules import analyze_weather_risk_rules


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_weather(
    temp=25.0,
    humidity=60.0,
    rainfall=0.0,
    vpd=1.2,
    wind_speed=10.0,
    leaf_wet_hours=0,
    daily_forecast=None,
):
    return {
        "current": {
            "temperature": temp,
            "humidity": humidity,
            "precipitation": rainfall,
            "vpd": vpd,
            "wind_speed": wind_speed,
            "dew_point": (temp - 5) if temp is not None else 15,
            "cloud_cover": 0,
        },
        "daily_forecast": daily_forecast or [],
        "soil": {},
    }


# ── Risk level classification ─────────────────────────────────────────────────

class TestRiskLevelClassification:
    def test_low_risk_dry_conditions(self):
        weather = make_weather(temp=30, humidity=40, rainfall=0, leaf_wet_hours=0)
        result = analyze_weather_risk_rules(weather)
        assert result["overall_disease_risk"] in ("LOW", "MODERATE")

    def test_high_risk_humid_conditions(self):
        # 82% humidity + 26°C + 6h leaf wetness → HIGH risk
        weather = make_weather(temp=26, humidity=82, rainfall=5, leaf_wet_hours=6)
        result = analyze_weather_risk_rules(weather)
        assert result["overall_disease_risk"] in ("HIGH", "CRITICAL")

    def test_critical_risk_extreme_conditions(self):
        # >90% humidity + 18°C + 8h leaf wetness → CRITICAL
        weather = make_weather(temp=18, humidity=92, rainfall=15, leaf_wet_hours=9, vpd=0.3)
        result = analyze_weather_risk_rules(weather)
        assert result["overall_disease_risk"] == "CRITICAL"

    def test_moderate_risk_mid_range(self):
        # Moderate humidity, some rainfall
        weather = make_weather(temp=24, humidity=72, rainfall=2, leaf_wet_hours=2)
        result = analyze_weather_risk_rules(weather)
        assert result["overall_disease_risk"] in ("MODERATE", "HIGH")

    def test_dry_hot_triggers_pest_risk(self):
        # Dry + hot → Thrips / Aphids
        weather = make_weather(temp=38, humidity=30, rainfall=0, leaf_wet_hours=0)
        result = analyze_weather_risk_rules(weather)
        assert any("Thrips" in d or "Aphid" in d for d in result.get("favorable_diseases", []))


# ── Disease condition matching ────────────────────────────────────────────────

class TestDiseaseConditions:
    def test_late_blight_conditions(self):
        # Late Blight: 10-24°C, >90% humidity, >4h leaf wetness
        weather = make_weather(temp=18, humidity=92, rainfall=12, leaf_wet_hours=5)
        result = analyze_weather_risk_rules(weather)
        diseases = result.get("favorable_diseases", [])
        assert "Late Blight" in diseases

    def test_early_blight_conditions(self):
        # Early Blight: 24-30°C, >80% humidity
        weather = make_weather(temp=27, humidity=82, rainfall=3, leaf_wet_hours=0)
        result = analyze_weather_risk_rules(weather)
        diseases = result.get("favorable_diseases", [])
        assert "Early Blight" in diseases

    def test_rust_conditions(self):
        # Rust: 15-25°C, >90% humidity, >6h leaf wetness
        # Use low VPD (0.3) to drive derived leaf_wet_hrs to 6+4=10 hours
        weather = make_weather(temp=22, humidity=92, rainfall=8, leaf_wet_hours=7, vpd=0.3)
        result = analyze_weather_risk_rules(weather)
        diseases = result.get("favorable_diseases", [])
        assert "Rust" in diseases

    def test_no_diseases_in_ideal_conditions(self):
        # Perfect conditions: low humidity, warm temp, no rain
        weather = make_weather(temp=25, humidity=45, rainfall=0, leaf_wet_hours=0)
        result = analyze_weather_risk_rules(weather)
        diseases = result.get("favorable_diseases", [])
        # Should have few or no diseases
        assert len(diseases) <= 2


# ── Forecast summary ──────────────────────────────────────────────────────────

class TestForecastSummary:
    def test_heavy_rain_forecast(self):
        daily = [{"rainfall": 5, "humidity_max": 85} for _ in range(5)]
        weather = make_weather(daily_forecast=daily)
        result = analyze_weather_risk_rules(weather)
        summary = result.get("forecast_risk", "")
        assert "5/7" in summary or "rain" in summary.lower()

    def test_dry_forecast(self):
        daily = [{"rainfall": 0, "humidity_max": 50} for _ in range(7)]
        weather = make_weather(daily_forecast=daily)
        result = analyze_weather_risk_rules(weather)
        summary = result.get("forecast_risk", "")
        assert "dry" in summary.lower() or "ease" in summary.lower()

    def test_empty_forecast(self):
        weather = make_weather(daily_forecast=[])
        result = analyze_weather_risk_rules(weather)
        # Should not crash; forecast_risk present
        assert "forecast_risk" in result


# ── Advisory text ─────────────────────────────────────────────────────────────

class TestAdvisoryText:
    def test_critical_advisory_mentions_immediate(self):
        weather = make_weather(temp=18, humidity=95, rainfall=20, leaf_wet_hours=10, vpd=0.2)
        result = analyze_weather_risk_rules(weather)
        advisory = result.get("advisory", "")
        assert "CRITICAL" in advisory or "IMMEDIATELY" in advisory

    def test_high_advisory_mentions_48h(self):
        weather = make_weather(temp=26, humidity=85, rainfall=6, leaf_wet_hours=6)
        result = analyze_weather_risk_rules(weather)
        advisory = result.get("advisory", "")
        assert "48" in advisory or "fungicide" in advisory.lower()

    def test_advisory_always_present(self):
        weather = make_weather()
        result = analyze_weather_risk_rules(weather)
        assert "advisory" in result
        assert len(result["advisory"]) > 10


# ── Response structure ────────────────────────────────────────────────────────

class TestResponseStructure:
    def test_required_keys_present(self):
        weather = make_weather()
        result = analyze_weather_risk_rules(weather)
        required = ["overall_disease_risk", "risk_factors", "favorable_diseases",
                    "soil_risk", "forecast_risk", "advisory", "weather_used"]
        for key in required:
            assert key in result, f"Missing key: {key}"

    def test_risk_level_is_valid_enum(self):
        weather = make_weather()
        result = analyze_weather_risk_rules(weather)
        assert result["overall_disease_risk"] in ("LOW", "MODERATE", "HIGH", "CRITICAL")

    def test_risk_factors_is_list(self):
        weather = make_weather()
        result = analyze_weather_risk_rules(weather)
        assert isinstance(result["risk_factors"], list)

    def test_favorable_diseases_is_list(self):
        weather = make_weather()
        result = analyze_weather_risk_rules(weather)
        assert isinstance(result["favorable_diseases"], list)


# ── Edge cases ────────────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_missing_temperature(self):
        # Flat dict without "current" key — service uses empty current, falls back to defaults
        weather = {"humidity": 80, "rainfall_last_24h": 5, "daily_forecast": []}
        result = analyze_weather_risk_rules(weather)
        assert "overall_disease_risk" in result  # should not crash; use defaults

    def test_missing_humidity(self):
        weather = {"temperature": 25, "rainfall_last_24h": 5, "daily_forecast": []}
        result = analyze_weather_risk_rules(weather)
        assert "overall_disease_risk" in result

    def test_empty_weather_dict(self):
        result = analyze_weather_risk_rules({})
        assert "overall_disease_risk" in result  # must not crash

    def test_none_weather_values(self):
        weather = make_weather(temp=None, humidity=None)
        # Should not crash; use defaults
        try:
            result = analyze_weather_risk_rules(weather)
            assert "overall_disease_risk" in result
        except (TypeError, AttributeError):
            pytest.fail("analyze_weather_risk_rules crashed on None values")

    def test_extreme_humidity_100(self):
        weather = make_weather(temp=20, humidity=100, rainfall=30, leaf_wet_hours=12)
        result = analyze_weather_risk_rules(weather)
        assert result["overall_disease_risk"] in ("HIGH", "CRITICAL")

    def test_freezing_temperature(self):
        weather = make_weather(temp=-5, humidity=90, rainfall=0)
        result = analyze_weather_risk_rules(weather)
        assert "overall_disease_risk" in result  # should not crash
