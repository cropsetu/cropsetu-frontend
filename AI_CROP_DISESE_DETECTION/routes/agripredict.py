"""
AgriPredict Routes — Real data.gov.in + Claude predictions

GET  /agripredict/filters/states
GET  /agripredict/filters/districts?state=Maharashtra
GET  /agripredict/filters/commodities?state=Maharashtra&district=Pune
GET  /agripredict/prices/history?commodity=Onion&state=Maharashtra&district=Pune
POST /agripredict/predict          { "commodity": "Onion", "state": "Maharashtra", "district": "" }
GET  /agripredict/compare?commodity=Onion&state=Maharashtra&district=Nashik
POST /agripredict/sync/trigger     { "commodity": "Onion", "state": "Maharashtra", "district": null, "max_pages": 10 }
GET  /agripredict/sync/status?commodity=Onion&state=Maharashtra

All heavy work (data.gov.in paged fetches, Claude calls, DB writes) runs async.
Sync trigger uses FastAPI BackgroundTasks — returns 202 immediately.
Express forwards all these under /api/v1/agripredict/*.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from services.agripredict_service import (
    sync_commodity_data,
    get_historical_prices,
    get_prediction,
    compare_nearby,
    get_sync_status,
    get_states,
    get_districts,
    get_commodities,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agripredict", tags=["AgriPredict"])


def _ok(data, **meta):
    return {"success": True, "data": data, **meta}


def _err(msg: str, code: int = 400):
    raise HTTPException(status_code=code, detail=msg)


# ── Filters ───────────────────────────────────────────────────────────────────

@router.get("/filters/states")
async def filters_states():
    try:
        states = await get_states()
        return _ok({"states": states})
    except Exception as exc:
        logger.exception("filters/states error")
        _err(str(exc), 500)


@router.get("/filters/districts")
async def filters_districts(state: str = Query(..., min_length=1)):
    try:
        districts = await get_districts(state)
        return _ok({"state": state, "districts": districts})
    except Exception as exc:
        logger.exception("filters/districts error")
        _err(str(exc), 500)


@router.get("/filters/commodities")
async def filters_commodities(
    state:    str = Query(..., min_length=1),
    district: Optional[str] = Query(None),
):
    try:
        commodities = await get_commodities(state, district)
        return _ok({"state": state, "district": district, "commodities": commodities})
    except Exception as exc:
        logger.exception("filters/commodities error")
        _err(str(exc), 500)


# ── Historical prices ─────────────────────────────────────────────────────────

@router.get("/prices/history")
async def prices_history(
    commodity: str = Query(..., min_length=1, max_length=80),
    state:     str = Query(..., min_length=1),
    district:  Optional[str] = Query(None),
):
    try:
        result = await get_historical_prices(commodity, state, district)
        if not result["monthlySummary"]:
            raise HTTPException(
                status_code=404,
                detail=f"No historical data for {commodity} in {district or state}. Trigger a sync first.",
            )
        return _ok(result)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("prices/history error")
        _err(f"Failed to load historical prices: {exc}", 500)


# ── Prediction (cache-first → Claude) ────────────────────────────────────────

class PredictRequest(BaseModel):
    commodity: str = Field(..., min_length=1, max_length=80)
    state:     str = Field(..., min_length=1)
    district:  str = Field("")


@router.post("/predict")
async def predict(body: PredictRequest):
    try:
        result = await get_prediction(body.commodity, body.state, body.district)
        if result.get("error") in ("insufficient_data", "no_data"):
            raise HTTPException(status_code=404, detail=result.get("message", "No price data available for this selection."))
        return _ok(
            result,
            cached=result.get("cached"),
            cachedAt=result.get("cachedAt"),
            expiresAt=result.get("expiresAt"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("predict error")
        _err(f"Prediction failed: {exc}", 503)


# ── Nearby comparison ─────────────────────────────────────────────────────────

@router.get("/compare")
async def compare(
    commodity: str = Query(..., min_length=1, max_length=80),
    state:     str = Query(..., min_length=1),
    district:  Optional[str] = Query(""),
):
    try:
        result = await compare_nearby(commodity, state, district or "")
        return _ok(result)
    except Exception as exc:
        logger.exception("compare error")
        _err(str(exc), 500)


# ── Data sync (BackgroundTasks — returns 202 immediately) ─────────────────────

class SyncRequest(BaseModel):
    commodity:  str = Field(..., min_length=1, max_length=80)
    state:      str = Field(..., min_length=1)
    district:   Optional[str] = Field(None)
    max_pages:  int = Field(10, ge=1, le=50)


@router.post("/sync/trigger", status_code=202)
async def sync_trigger(body: SyncRequest, background_tasks: BackgroundTasks):
    """
    Non-blocking: kicks off the data.gov.in sync in a background task
    and returns 202 immediately. Poll /sync/status to check progress.
    """
    logger.info(
        "[AgriPredict] background sync queued — %s/%s district=%s pages=%d",
        body.commodity, body.state, body.district, body.max_pages,
    )
    background_tasks.add_task(
        sync_commodity_data,
        body.commodity, body.state, body.district, body.max_pages,
    )
    return _ok({
        "message":   "Sync started in background",
        "commodity": body.commodity,
        "state":     body.state,
        "district":  body.district,
    })


@router.get("/sync/status")
async def sync_status(
    commodity: Optional[str] = Query(None),
    state:     Optional[str] = Query(None),
):
    try:
        row = await get_sync_status(commodity, state)
        return _ok(row or {"message": "No sync record found"})
    except Exception as exc:
        logger.exception("sync/status error")
        _err(str(exc), 500)
