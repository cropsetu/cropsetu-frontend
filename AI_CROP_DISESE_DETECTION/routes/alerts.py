"""
Alerts Route — POST /ai/alerts
Generates smart farm alerts. Express caches them; FastAPI generates fresh on cache miss.
"""
from __future__ import annotations
import logging
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel

from services.alert_service import generate_smart_alerts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["Alerts"])


class AlertsRequest(BaseModel):
    crop: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    day_of_season: Optional[int] = 45
    season: Optional[str] = None
    month: Optional[str] = None
    irrigationType: Optional[str] = None
    soilType: Optional[str] = None
    previousCrop: Optional[str] = None
    landSize: Optional[str] = None
    currentCrops: Optional[Any] = None


@router.post(
    "/alerts",
    summary="Generate smart farm alerts (Groq → Gemini)",
)
async def ai_alerts(
    body: AlertsRequest,
    x_user_id: Optional[str] = Header(None, alias="x-user-id"),
):
    try:
        alerts = await generate_smart_alerts(body.model_dump(exclude_none=True))
        return {"success": True, "data": alerts, "message": "OK"}
    except Exception as exc:
        logger.warning(f"[AlertsRoute] Error: {exc}")
        # Return empty rather than error — alerts are non-critical
        return {"success": True, "data": [], "message": str(exc)}
