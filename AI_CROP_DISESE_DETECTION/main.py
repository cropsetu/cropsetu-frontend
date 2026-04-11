"""
CropGuard Agentic AI — FastAPI service
Exposes all AI endpoints that Express proxies to.

Endpoints:
  POST /ai/chat                              — FarmMind chat (Groq → Gemini)
  POST /ai/scan                              — Crop disease (5-agent Claude pipeline)
  POST /ai/alerts                            — Smart farm alerts
  POST /api/v1/crop-disease/agentic-predict  — Direct multipart endpoint (Postman / testing)
  GET  /health                               — Health check

Run:
  cd AI_CROP_DISESE_DETECTION
  .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001 --reload
"""
from __future__ import annotations
import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from logging_config import setup_logging
setup_logging()

from config import API_HOST, API_PORT, GROQ_API_KEY, GEMINI_API_KEY
from routes.chat   import router as chat_router
from routes.scan   import router as scan_router
from routes.alerts import router as alerts_router

logger = logging.getLogger(__name__)

# ── Rate limiter ──────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

# ── App ───────────────────────────────────────────────────────────────────────

IS_PROD = os.getenv("ENV", "development") == "production"

ALLOWED_ORIGINS = os.getenv(
    "AI_ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://localhost:5173"
).split(",")

app = FastAPI(
    title="CropGuard Agentic AI",
    description=(
        "FarmEasy AI backend — 5-agent crop disease pipeline (Claude), "
        "FarmMind chat (Groq → Gemini), smart alerts, and weather-aware diagnosis."
    ),
    version="2.0.0",
    docs_url=None if IS_PROD else "/docs",
    redoc_url=None if IS_PROD else "/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(chat_router)    # POST /ai/chat
app.include_router(scan_router)    # POST /ai/scan  +  POST /api/v1/crop-disease/agentic-predict
app.include_router(alerts_router)  # POST /ai/alerts

# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "service": "CropGuard AI"}


# ── Startup config check ──────────────────────────────────────────────────────

@app.on_event("startup")
async def _check_config():
    keys = {
        "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY"),
        "GROQ_API_KEY":   os.getenv("GROQ_API_KEY"),
    }
    for name, val in keys.items():
        if not val:
            logger.warning("[Config] %s not set — feature will be disabled", name)
        else:
            logger.info("[Config] %s configured", name)


# ── Entrypoint ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=True)
