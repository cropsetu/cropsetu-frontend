"""
Pytest configuration and shared fixtures for CropGuard AI tests.
All external API calls (Gemini, Groq, Weather, Redis) are mocked.
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── Mock LLM responses ────────────────────────────────────────────────────────

MOCK_DIAGNOSIS_RESPONSE = {
    "primary_diagnosis": {
        "disease": "Early Blight",
        "pathogen": "Alternaria solani",
        "confidence_score": 0.87,
        "severity": "Moderate",
        "affected_parts": ["Leaves", "Stems"],
    },
    "alternative_diagnoses": [
        {"disease": "Late Blight", "confidence_score": 0.12, "distinguishing_factors": "Lower temperature preference"},
    ],
    "visual_evidence": ["Dark brown concentric rings on lower leaves", "Yellow halo around lesions"],
    "crop_impact_assessment": {
        "yield_loss_risk": "20-30%",
        "spread_speed": "Fast under humid conditions",
        "critical_window": "Next 7 days",
    },
    "urgency": "HIGH",
    "needs_advisor": False,
}

MOCK_TREATMENT_RESPONSE = {
    "disease_summary": "Early Blight caused by Alternaria solani fungus.",
    "organic_controls": [
        {"method": "Neem oil spray", "dosage": "3ml per litre", "frequency": "Every 7 days"},
    ],
    "chemical_controls": [
        {
            "product": "Mancozeb 75% WP",
            "brands": [{"name": "Dithane M-45", "company": "Dow AgroSciences"}],
            "dosage": "2-2.5g per litre",
            "application": "Foliar spray",
            "phi_days": 7,
        }
    ],
    "fertilizer_adjustments": [
        {"nutrient": "Potassium", "reason": "Improves disease resistance", "product": "MOP 60%"}
    ],
    "immediate_actions": ["Remove and destroy infected leaves", "Improve canopy airflow"],
    "preventive_measures": ["Crop rotation", "Avoid overhead irrigation"],
    "recovery_timeline": "2-3 weeks with proper treatment",
    "follow_up_schedule": "Inspect every 3-4 days",
}

MOCK_WEATHER_RESPONSE = {
    "temperature": 26.5,
    "humidity": 82.0,
    "wind_speed": 12.0,
    "rainfall_last_24h": 5.2,
    "vpd": 0.8,
    "leaf_wet_hours": 6,
    "daily_forecast": [],
}

MOCK_WEATHER_RISK = {
    "risk_level": "HIGH",
    "risk_score": 2,
    "favorable_diseases": ["Early Blight", "Late Blight"],
    "primary_concern": "High humidity with leaf wetness hours exceed fungal infection threshold",
    "forecast_summary": "Rain expected on 3/7 days — disease risk elevated mid-week",
    "advisory": "Apply fungicide within 48 hours. Avoid overhead irrigation.",
}

MOCK_IMAGE_QUALITY = {
    "quality_score": 0.82,
    "passed": True,
    "issues": [],
    "enhancement_notes": "Image quality acceptable for diagnosis",
    "image_path": "/tmp/test_image.jpg",
}

MOCK_TOKEN_INFO = {
    "model": "gemini-2.5-flash",
    "input_tokens": 1200,
    "output_tokens": 450,
    "cost_usd": 0.0009,
}


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_gemini_vision():
    """Mock Gemini vision LLM call."""
    with patch("agents.llm_utils.call_gemini_vision") as mock:
        mock.return_value = (json.dumps(MOCK_DIAGNOSIS_RESPONSE), MOCK_TOKEN_INFO)
        yield mock


@pytest.fixture
def mock_gemini_text():
    """Mock Gemini text LLM call."""
    with patch("agents.llm_utils.call_gemini_text") as mock:
        mock.return_value = (json.dumps(MOCK_WEATHER_RISK), MOCK_TOKEN_INFO)
        yield mock


@pytest.fixture
def mock_groq():
    """Mock Groq LLM call."""
    with patch("agents.llm_utils.call_groq_text") as mock:
        mock.return_value = (json.dumps(MOCK_TREATMENT_RESPONSE), MOCK_TOKEN_INFO)
        yield mock


@pytest.fixture
def mock_weather_fetch():
    """Mock weather API fetch."""
    with patch("weather_service.fetch_weather") as mock:
        mock.return_value = MOCK_WEATHER_RESPONSE
        yield mock


@pytest.fixture
def mock_redis():
    """Mock Redis connection (cache miss → cache set)."""
    mock_r = MagicMock()
    mock_r.get.return_value = None   # always cache miss
    mock_r.setex.return_value = True
    mock_r.ping.return_value = True
    with patch("agents.treatment_agent._redis", mock_r), \
         patch("agents.treatment_agent._REDIS_OK", True):
        yield mock_r


@pytest.fixture
def mock_redis_hit(mock_redis):
    """Mock Redis returning a cached treatment response."""
    mock_redis.get.return_value = json.dumps(MOCK_TREATMENT_RESPONSE).encode()
    return mock_redis


@pytest.fixture
def sample_farm_context():
    """Minimal valid farm context."""
    return {
        "cropName": "Tomato",
        "cropAge": 45,
        "soilType": "Black",
        "irrigationType": "Drip",
        "state": "Maharashtra",
        "district": "Nashik",
        "season": "Kharif (Monsoon)",
        "symptoms": ["Brown spots", "Yellow leaves"],
        "firstNoticed": "2-3 days ago",
        "affectedArea": "25-50%",
        "additionalSymptoms": "Concentric ring pattern on leaves",
    }


@pytest.fixture
def sample_diagnosis():
    """Sample diagnosis dict."""
    return MOCK_DIAGNOSIS_RESPONSE


@pytest.fixture
def sample_treatment():
    """Sample treatment dict."""
    return MOCK_TREATMENT_RESPONSE


@pytest.fixture
def sample_weather_risk():
    """Sample weather risk dict."""
    return MOCK_WEATHER_RISK


@pytest.fixture
def tmp_image(tmp_path):
    """Write a minimal valid JPEG to a temp file and return its path."""
    import struct
    # Minimal valid JPEG (SOI + APP0 + EOI)
    jpeg_bytes = (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        + b"\xff\xd9"
    )
    # Pad to ~50KB so image quality agent passes
    jpeg_bytes += b"\x00" * (50_000 - len(jpeg_bytes))
    img_file = tmp_path / "test_crop.jpg"
    img_file.write_bytes(jpeg_bytes)
    return str(img_file)
