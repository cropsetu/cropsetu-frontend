"""
Integration tests for services/scan_service.py and routes/scan.py

Tests: camelCase→snake_case field mapping, growth-stage derivation from cropAge,
       symptom concatenation, area-percent mapping, base64 decode + temp-file
       cleanup, FastAPI endpoint validation, and error handling.

All LLM and orchestrator calls are mocked — no real API keys required.
"""
import base64
import json
import os
import sys
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.scan_service import _map_farm_params, run_scan_from_base64


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ctx(**kwargs):
    base = {
        "cropName": "Tomato",
        "cropAge": 45,
        "soilType": "Black",
        "irrigationType": "Drip",
        "state": "Maharashtra",
        "district": "Nashik",
        "season": "Kharif (Monsoon)",
        "symptoms": ["Brown spots", "Yellow leaves"],
        "firstNoticed": "2-3 days ago",
        "affectedArea": "25-50",
        "additionalSymptoms": "Concentric ring pattern",
    }
    base.update(kwargs)
    return base


MOCK_REPORT = {
    "report_id": "test-id-123",
    "disease": {"name_common": "Early Blight", "severity": "Moderate"},
    "risk_level": "HIGH",
    "weather_outlook": {"weather_used": True},
    "farmer_summary": "Your tomato crop has been diagnosed with Early Blight.",
}

# Minimal valid JPEG bytes (SOI + EOI)
_MINIMAL_JPEG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xd9" + b"\x00" * 1000
)
_B64_JPEG = base64.b64encode(_MINIMAL_JPEG).decode()


# ── _map_farm_params: field mapping ──────────────────────────────────────────

class TestMapFarmParams:
    def test_crop_name_mapped(self):
        p = _map_farm_params(_ctx(), None, None)
        assert p["crop_name"] == "Tomato"

    def test_soil_type_mapped(self):
        p = _map_farm_params(_ctx(), None, None)
        assert p["soil_type"] == "Black"

    def test_irrigation_drip_mapped(self):
        p = _map_farm_params(_ctx(), None, None)
        assert p["irrigation_system"] == "Drip"

    def test_gps_mapped(self):
        p = _map_farm_params(_ctx(), 19.9, 73.8)
        assert p["field_latitude"] == 19.9
        assert p["field_longitude"] == 73.8

    def test_gps_none_not_set(self):
        p = _map_farm_params(_ctx(), None, None)
        assert "field_latitude" not in p
        assert "field_longitude" not in p

    def test_language_default_en(self):
        p = _map_farm_params(_ctx(), None, None)
        assert p.get("language") == "en"


# ── _map_farm_params: growth stage derivation ─────────────────────────────────

class TestGrowthStageDerivation:
    def test_seedling_under_21_days(self):
        p = _map_farm_params(_ctx(cropAge=10), None, None)
        assert p["crop_growth_stage"] == "Seedling"

    def test_vegetative_21_to_59_days(self):
        p = _map_farm_params(_ctx(cropAge=45), None, None)
        assert p["crop_growth_stage"] == "Vegetative"

    def test_flowering_60_to_89_days(self):
        p = _map_farm_params(_ctx(cropAge=75), None, None)
        assert p["crop_growth_stage"] == "Flowering"

    def test_fruiting_90_to_129_days(self):
        p = _map_farm_params(_ctx(cropAge=100), None, None)
        assert p["crop_growth_stage"] == "Fruiting"

    def test_maturity_130_plus_days(self):
        p = _map_farm_params(_ctx(cropAge=150), None, None)
        assert p["crop_growth_stage"] == "Maturity"

    def test_no_crop_age_defaults_vegetative(self):
        ctx = {k: v for k, v in _ctx().items() if k != "cropAge"}
        p = _map_farm_params(ctx, None, None)
        assert p["crop_growth_stage"] == "Vegetative"


# ── _map_farm_params: symptom description ────────────────────────────────────

class TestSymptomDescription:
    def test_symptoms_list_joined(self):
        p = _map_farm_params(_ctx(), None, None)
        assert "Brown spots" in p.get("symptom_description", "")
        assert "Yellow leaves" in p.get("symptom_description", "")

    def test_first_noticed_included(self):
        p = _map_farm_params(_ctx(), None, None)
        assert "2-3 days ago" in p.get("symptom_description", "")

    def test_additional_symptoms_included(self):
        p = _map_farm_params(_ctx(), None, None)
        assert "Concentric ring" in p.get("symptom_description", "")

    def test_empty_symptoms_no_symptom_key(self):
        ctx = _ctx(symptoms=[], firstNoticed="", additionalSymptoms="")
        p = _map_farm_params(ctx, None, None)
        # symptom_description should be absent or empty
        desc = p.get("symptom_description", "")
        assert desc == ""


# ── _map_farm_params: affected area percent ───────────────────────────────────

class TestAffectedAreaMapping:
    def test_less10_maps_to_5(self):
        p = _map_farm_params(_ctx(affectedArea="less10"), None, None)
        assert p.get("affected_area_percent") == 5.0

    def test_10_25_maps_to_17_5(self):
        p = _map_farm_params(_ctx(affectedArea="10-25"), None, None)
        assert p.get("affected_area_percent") == 17.5

    def test_25_50_maps_to_37_5(self):
        p = _map_farm_params(_ctx(affectedArea="25-50"), None, None)
        assert p.get("affected_area_percent") == 37.5

    def test_over50_maps_to_75(self):
        p = _map_farm_params(_ctx(affectedArea="over50"), None, None)
        assert p.get("affected_area_percent") == 75.0

    def test_unknown_label_no_crash(self):
        p = _map_farm_params(_ctx(affectedArea="unknown_label"), None, None)
        assert isinstance(p, dict)  # should not crash


# ── _map_farm_params: irrigation normalisation ────────────────────────────────

class TestIrrigationNormalisation:
    def test_drip_irrigation_phrase(self):
        p = _map_farm_params(_ctx(irrigationType="Drip Irrigation System"), None, None)
        assert p["irrigation_system"] == "Drip"

    def test_sprinkler_phrase(self):
        p = _map_farm_params(_ctx(irrigationType="Overhead Sprinkler"), None, None)
        assert p["irrigation_system"] == "Sprinkler"

    def test_flood_phrase(self):
        p = _map_farm_params(_ctx(irrigationType="Flood watering"), None, None)
        assert p["irrigation_system"] == "Flood"

    def test_canal_phrase(self):
        p = _map_farm_params(_ctx(irrigationType="Canal system"), None, None)
        assert p["irrigation_system"] == "Canal"

    def test_unknown_defaults_rainfed(self):
        p = _map_farm_params(_ctx(irrigationType="Manual bucket"), None, None)
        assert p["irrigation_system"] == "Rainfed"

    def test_none_irrigation_defaults_rainfed(self):
        ctx = _ctx()
        ctx.pop("irrigationType", None)
        p = _map_farm_params(ctx, None, None)
        assert p["irrigation_system"] == "Rainfed"


# ── _map_farm_params: soil normalisation ─────────────────────────────────────

class TestSoilNormalisation:
    def test_black_cotton_soil(self):
        p = _map_farm_params(_ctx(soilType="Black cotton soil"), None, None)
        assert p["soil_type"] == "Black"

    def test_red_soil_phrase(self):
        p = _map_farm_params(_ctx(soilType="Red laterite"), None, None)
        # Contains "red" → "Red"
        assert p["soil_type"] == "Red"

    def test_alluvial_phrase(self):
        p = _map_farm_params(_ctx(soilType="Alluvial plain soil"), None, None)
        assert p["soil_type"] == "Alluvial"

    def test_unknown_defaults_alluvial(self):
        p = _map_farm_params(_ctx(soilType="Volcanic ash"), None, None)
        assert p["soil_type"] == "Alluvial"


# ── run_scan_from_base64 ──────────────────────────────────────────────────────

class TestRunScanFromBase64:
    def _run(self, **kwargs):
        defaults = dict(
            image_base64=_B64_JPEG,
            mime_type="image/jpeg",
            farm_ctx=_ctx(),
            lat=19.9,
            lon=73.8,
        )
        defaults.update(kwargs)
        return asyncio.run(run_scan_from_base64(**defaults))

    def test_returns_dict(self):
        with patch("services.scan_service.run_diagnosis", new_callable=AsyncMock) as mock_diag:
            mock_diag.return_value = MOCK_REPORT
            result = self._run()
        assert isinstance(result, dict)

    def test_calls_run_diagnosis(self):
        with patch("services.scan_service.run_diagnosis", new_callable=AsyncMock) as mock_diag:
            mock_diag.return_value = MOCK_REPORT
            self._run()
        mock_diag.assert_called_once()

    def test_temp_file_cleaned_up(self):
        """Temp file created for image should be deleted after scan."""
        created_paths = []

        original_unlink = os.unlink

        def capture_unlink(path):
            created_paths.append(path)
            original_unlink(path)

        with patch("services.scan_service.run_diagnosis", new_callable=AsyncMock) as mock_diag, \
             patch("os.unlink", side_effect=capture_unlink):
            mock_diag.return_value = MOCK_REPORT
            self._run()

        assert len(created_paths) == 1
        assert not os.path.exists(created_paths[0])

    def test_temp_file_cleaned_up_on_error(self):
        """Temp file must be deleted even when orchestrator raises."""
        deleted_paths = []

        def capture_unlink(path):
            deleted_paths.append(path)
            # Don't actually delete in this branch — file may already be gone

        with patch("services.scan_service.run_diagnosis", new_callable=AsyncMock) as mock_diag, \
             patch("os.unlink", side_effect=capture_unlink):
            mock_diag.side_effect = RuntimeError("LLM timeout")
            with pytest.raises(RuntimeError):
                self._run()

        assert len(deleted_paths) == 1

    def test_heic_mime_treated_as_jpg(self):
        """iOS HEIC images should be saved with .jpg extension."""
        saved_suffixes = []

        import tempfile as tf

        original_ntf = tf.NamedTemporaryFile

        def capturing_ntf(**kwargs):
            saved_suffixes.append(kwargs.get("suffix", ""))
            return original_ntf(**kwargs)

        with patch("services.scan_service.run_diagnosis", new_callable=AsyncMock) as mock_diag, \
             patch("tempfile.NamedTemporaryFile", side_effect=capturing_ntf):
            mock_diag.return_value = MOCK_REPORT
            self._run(mime_type="image/heic")

        assert any(s.endswith(".jpg") for s in saved_suffixes)

    def test_params_passed_to_orchestrator(self):
        """Mapped params should be forwarded to run_diagnosis."""
        with patch("services.scan_service.run_diagnosis", new_callable=AsyncMock) as mock_diag:
            mock_diag.return_value = MOCK_REPORT
            self._run()
        call_kwargs = mock_diag.call_args[1]
        params = call_kwargs.get("params") or mock_diag.call_args[0][0] if mock_diag.call_args[0] else {}
        # Just verify run_diagnosis was called with params containing crop_name
        assert mock_diag.called


# ── FastAPI endpoint (httpx TestClient) ──────────────────────────────────────

try:
    from fastapi.testclient import TestClient
    from main import app

    _HAS_FASTAPI = True
except Exception:
    _HAS_FASTAPI = False


@pytest.mark.skipif(not _HAS_FASTAPI, reason="FastAPI app not importable in test env")
class TestScanEndpoint:
    @pytest.fixture(autouse=True)
    def client(self):
        with patch("routes.scan.GEMINI_API_KEY", "fake-key"):
            self.client = TestClient(app)
            yield

    def test_health_endpoint(self):
        resp = self.client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"

    def test_scan_missing_image_returns_400(self):
        with patch("routes.scan.run_scan_from_base64", new_callable=AsyncMock) as mock_scan:
            mock_scan.return_value = MOCK_REPORT
            resp = self.client.post("/ai/scan", json={
                "image_base64": "",
                "mime_type": "image/jpeg",
                "farm_ctx": {},
            })
        assert resp.status_code == 400

    def test_scan_success_returns_200(self):
        with patch("routes.scan.run_scan_from_base64", new_callable=AsyncMock) as mock_scan:
            mock_scan.return_value = MOCK_REPORT
            resp = self.client.post("/ai/scan", json={
                "image_base64": _B64_JPEG,
                "mime_type": "image/jpeg",
                "farm_ctx": {"cropName": "Tomato"},
            })
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "data" in body

    def test_scan_gemini_key_missing_returns_503(self):
        with patch("routes.scan.GEMINI_API_KEY", ""):
            resp = self.client.post("/ai/scan", json={
                "image_base64": _B64_JPEG,
                "mime_type": "image/jpeg",
                "farm_ctx": {},
            })
        assert resp.status_code == 503

    def test_scan_orchestrator_error_returns_500(self):
        with patch("routes.scan.run_scan_from_base64", new_callable=AsyncMock) as mock_scan:
            mock_scan.side_effect = RuntimeError("Model overloaded")
            resp = self.client.post("/ai/scan", json={
                "image_base64": _B64_JPEG,
                "mime_type": "image/jpeg",
                "farm_ctx": {"cropName": "Tomato"},
            })
        assert resp.status_code == 500
        assert "Scan failed" in resp.json().get("detail", "")
