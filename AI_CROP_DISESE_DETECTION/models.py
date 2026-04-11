"""
Pydantic models for request / response — CropGuard Agentic AI
"""
from __future__ import annotations
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────────────────

class GrowthStage(str, Enum):
    seedling   = "Seedling"
    vegetative = "Vegetative"
    flowering  = "Flowering"
    fruiting   = "Fruiting"
    maturity   = "Maturity"

class SoilType(str, Enum):
    black    = "Black"
    red      = "Red"
    alluvial = "Alluvial"
    laterite = "Laterite"
    sandy    = "Sandy"
    clay     = "Clay"
    loamy    = "Loamy"

class IrrigationSystem(str, Enum):
    drip       = "Drip"
    sprinkler  = "Sprinkler"
    flood      = "Flood"
    rainfed    = "Rainfed"
    canal      = "Canal"

class RiskLevel(str, Enum):
    low      = "LOW"
    moderate = "MODERATE"
    high     = "HIGH"
    critical = "CRITICAL"
    unknown  = "UNKNOWN"

class Severity(str, Enum):
    low      = "Low"
    moderate = "Moderate"
    high     = "High"
    critical = "Critical"
    unknown  = "Unknown"


# ── Agent output models ───────────────────────────────────────────────────────

class PerImageScore(BaseModel):
    index: int
    type: str = "unknown"
    quality_score: float = 0.0
    usable: bool = True
    issues: list[str] = []
    visible_symptoms: str = ""

class ImageQualityResult(BaseModel):
    quality_score: float = 0.0
    scores: dict[str, float] = {}
    usable: bool = False
    enhancement_notes: str = ""
    suggestions: list[str] = []
    per_image: list[PerImageScore] = []

class WeatherRiskResult(BaseModel):
    overall_disease_risk: RiskLevel = RiskLevel.unknown
    risk_factors: list[str] = []
    favorable_diseases: list[str] = []
    soil_risk: str = "UNKNOWN"
    forecast_risk: str = ""
    advisory: str = ""
    weather_used: bool = False

class PrimaryDiagnosis(BaseModel):
    disease: str = "Unknown"
    confidence: float = 0.0
    severity: Severity = Severity.unknown
    scientific_name: str = ""
    description: str = ""
    evidence: list[str] = []

class Differential(BaseModel):
    disease: str
    type: str = "disease"
    probability: float = 0.0
    reason: str = ""

class DiagnosisResult(BaseModel):
    primary_diagnosis: PrimaryDiagnosis = PrimaryDiagnosis()
    differentials: list[Differential] = []
    severity: Severity = Severity.unknown
    spread_risk: RiskLevel = RiskLevel.unknown
    is_certain: bool = False
    needs_advisor: bool = False
    causal_factors: list[str] = []
    confidence_score: float = 0.0

class Chemical(BaseModel):
    product: str
    active_ingredient: str = ""
    dosage: str = ""
    application_method: str = ""
    phi_days: Optional[int] = None
    safety_precautions: list[str] = []

class Fertilizer(BaseModel):
    product: str
    npk: str = ""
    dosage_per_acre: str = ""
    timing: str = ""
    reason: str = ""

class TreatmentResult(BaseModel):
    immediate_actions: list[str] = []
    chemical_controls: list[Chemical] = []
    organic_alternatives: list[Chemical] = []
    fertilizer_recommendations: list[Fertilizer] = []
    preventive_measures: list[str] = []
    long_term_recommendations: list[str] = []
    spray_timing_advisory: str = ""
    relevance_score: float = 0.0

class ReportCard(BaseModel):
    report_id: str
    generated_at: str
    language: str = "en"
    farm: dict[str, Any] = {}
    disease: dict[str, Any] = {}
    causes: list[str] = []
    treatment: dict[str, Any] = {}
    next_steps: list[str] = []
    advisor_needed: bool = False
    weather_outlook: dict[str, Any] = {}
    farmer_summary: str = ""
    confidence_score: float = 0.0
    risk_level: RiskLevel = RiskLevel.unknown
    # Full intermediate results for debugging / client detail views
    image_quality: Optional[dict[str, Any]] = None
    weather_risk: Optional[dict[str, Any]] = None
    meta: dict[str, Any] = {}


# ── API response wrapper ──────────────────────────────────────────────────────

class DiagnoseResponse(BaseModel):
    success: bool = True
    data: ReportCard
    message: str = "Diagnosis complete"
