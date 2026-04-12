"""
Scan Routes
  POST /ai/scan                        — base64 image from Express proxy
  POST /api/v1/crop-disease/agentic-predict — original multipart endpoint (kept)
"""
from __future__ import annotations
import logging
import os
import tempfile
from typing import Any, Optional

from fastapi import APIRouter, File, Form, Header, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import GEMINI_API_KEY
from orchestrator import run_diagnosis
from services.scan_service import run_scan_from_base64

limiter = Limiter(key_func=get_remote_address)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Crop Scan"])


# ── Proxy-facing endpoint (JSON body with base64 image) ───────────────────────

MAX_B64_LEN = 8 * 1024 * 1024  # ~6 MB decoded


class ScanRequest(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded crop image")
    mime_type: str    = Field("image/jpeg")
    farm_ctx: dict[str, Any] = Field(default_factory=dict, description="camelCase farm context from Express")
    lat: Optional[float] = Field(None, ge=6.0, le=37.0)
    lon: Optional[float] = Field(None, ge=68.0, le=97.0)
    image_view: str = Field("close_up", description="field_view|whole_plant|close_up|underside|other")


@router.post(
    "/ai/scan",
    summary="Crop disease diagnosis via agentic pipeline (Express proxy endpoint)",
)
@limiter.limit("10/minute")
async def ai_scan(
    request: Request,
    body: ScanRequest,
    x_user_id: Optional[str] = Header(None, alias="x-user-id"),
):
    """
    Accepts base64-encoded image from Express (already auth-checked).
    Runs the 5-agent Claude pipeline and returns the report.
    Express then saves the report to Prisma DB.
    """
    logger.info("/ai/scan received — user=%s mime=%s img_len=%d ctx_keys=%s",
                x_user_id, body.mime_type, len(body.image_base64), list(body.farm_ctx.keys()))

    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GEMINI_API_KEY not configured",
        )
    if not body.image_base64:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="image_base64 is required")
    if len(body.image_base64) > MAX_B64_LEN:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image too large. Maximum size is 6 MB.")

    try:
        report = await run_scan_from_base64(
            image_base64=body.image_base64,
            mime_type=body.mime_type or "image/jpeg",
            farm_ctx=body.farm_ctx,
            lat=body.lat,
            lon=body.lon,
            image_view=body.image_view,
        )
        disease = report.get('disease', {})
        logger.info("Report ready — disease=%s risk=%s weather_used=%s",
                    disease.get('name_common') if isinstance(disease, dict) else disease,
                    report.get('risk_level'),
                    report.get('weather_outlook', {}).get('weather_used'))
        return {"success": True, "data": report, "message": "Diagnosis complete"}

    except Exception as exc:
        err_str = str(exc)
        logger.exception("Scan endpoint error: %s", err_str)
        # Surface specific causes so the Express layer can pass them to the app
        if "429" in err_str or "rate" in err_str.lower() or "quota" in err_str.lower():
            raise HTTPException(status_code=429, detail=f"AI rate limit: {err_str[:200]}")
        if "GEMINI_API_KEY" in err_str:
            raise HTTPException(status_code=503, detail="Gemini API key not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scan failed: {err_str[:300]}",
        )


# ── Original multipart endpoint (kept for direct API / Postman testing) ───────

@router.post(
    "/api/v1/crop-disease/agentic-predict",
    summary="Agentic crop disease diagnosis — multipart (direct API)",
)
async def agentic_predict(
    crop_name: str = Form(...),
    crop_growth_stage: str = Form(...),
    soil_type: str = Form(...),
    irrigation_system: str = Form(...),
    planting_date: str = Form(...),
    field_latitude: Optional[float] = Form(None),
    field_longitude: Optional[float] = Form(None),
    crop_variety: Optional[str] = Form(None),
    previous_crop: Optional[str] = Form(None),
    affected_area_percent: Optional[float] = Form(None, ge=0, le=100),
    symptom_description: Optional[str] = Form(None),
    recent_pesticide_used: Optional[str] = Form(None),
    fertilizer_history: Optional[str] = Form(None),
    farm_size_acres: Optional[float] = Form(1.0, gt=0),
    language: Optional[str] = Form("en"),
    image_types: Optional[str] = Form(None),
    images: list[UploadFile] = File(default=[]),
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")

    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
    view_types    = [t.strip() for t in (image_types or "").split(",") if t.strip()]
    valid_views   = {"field_view", "whole_plant", "close_up", "underside", "other"}
    temp_files: list[str] = []
    image_list: list[dict] = []

    try:
        for idx, upload in enumerate(images[:5]):
            ct = upload.content_type or "image/jpeg"
            if ct not in allowed_types:
                raise HTTPException(status_code=400, detail=f"Image {idx+1}: unsupported type '{ct}'")
            contents = await upload.read()
            if len(contents) > 5 * 1024 * 1024:
                raise HTTPException(status_code=400, detail=f"Image {idx+1} exceeds 5 MB")
            ext = (upload.filename or "img.jpg").rsplit(".", 1)[-1].lower()
            tmp = tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False)
            tmp.write(contents); tmp.flush(); tmp.close()
            view = view_types[idx] if idx < len(view_types) else "other"
            if view not in valid_views: view = "other"
            temp_files.append(tmp.name)
            image_list.append({"path": tmp.name, "type": view})

        params = dict(
            crop_name=crop_name, crop_growth_stage=crop_growth_stage,
            soil_type=soil_type, irrigation_system=irrigation_system,
            planting_date=planting_date, field_latitude=field_latitude,
            field_longitude=field_longitude, crop_variety=crop_variety,
            previous_crop=previous_crop, affected_area_percent=affected_area_percent,
            symptom_description=symptom_description, recent_pesticide_used=recent_pesticide_used,
            fertilizer_history=fertilizer_history, farm_size_acres=farm_size_acres or 1.0,
            language=language or "en",
        )
        report = await run_diagnosis(params=params, images=image_list)
        return JSONResponse(status_code=200, content={"success": True, "data": report, "message": "Diagnosis complete"})

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Diagnosis failed: {str(exc)}")
    finally:
        for path in temp_files:
            try: os.unlink(path)
            except OSError: pass
