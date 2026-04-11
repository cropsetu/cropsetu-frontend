"""
Chat Routes — POST /ai/chat
Called by Express proxy; auth already verified by Express (userId in header).
"""
from __future__ import annotations
import logging
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from services.chat_service import chat_with_farmmind

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["Chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[dict[str, Any]] = Field(default_factory=list)
    farm_profile: dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    success: bool = True
    data: dict[str, Any]
    message: str = "OK"


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="FarmMind AI chat — Groq → Gemini fallback",
)
async def ai_chat(
    body: ChatRequest,
    x_user_id: Optional[str] = Header(None, alias="x-user-id"),
):
    """
    Express passes `x-user-id` header after verifying the JWT.
    This endpoint is purely AI inference — no DB access.
    """
    if not body.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="message is required")

    try:
        result = await chat_with_farmmind(
            message=body.message.strip(),
            history=body.history,
            farm_profile=body.farm_profile,
        )
        return ChatResponse(data=result)

    except Exception as exc:
        logger.warning(f"[ChatRoute] Error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Chat service error: {str(exc)}",
        )
