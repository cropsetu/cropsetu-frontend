"""
FarmMind Chat Service — CropGuard AI Backend
Groq (llama-3.3-70b-versatile) primary → Gemini (gemini-2.0-flash) fallback.

Input : message, history (role/content pairs), farm_profile dict
Output: { reply, type, structured_data }
  type: "text" | "diagnosis" | "market"
"""
from __future__ import annotations
import logging
import json
import re
from datetime import datetime
from typing import Any, Optional

import httpx

from config import GROQ_API_KEY, GEMINI_API_KEY, MODEL_GROQ_CHAT, MODEL_GEMINI_CHAT

logger = logging.getLogger(__name__)


# ── Season helper ─────────────────────────────────────────────────────────────

def _current_season() -> str:
    m = datetime.now().month
    if 6 <= m <= 9:   return "Kharif (Monsoon)"
    if 10 <= m <= 11: return "Rabi sowing"
    if m >= 12 or m <= 2: return "Rabi (Winter)"
    return "Zaid (Summer)"


# ── System prompt ─────────────────────────────────────────────────────────────

def _build_system_prompt(farm_profile: dict) -> str:
    lang    = farm_profile.get("language", "en")
    crops   = farm_profile.get("crops", [])
    state   = farm_profile.get("state", "India")
    district = farm_profile.get("district", "")
    season  = _current_season()
    month   = datetime.now().strftime("%B")

    crop_list = ""
    if crops:
        parts = []
        for c in crops[:3]:
            name = c.get("name", "")
            age  = c.get("ageInDays")
            parts.append(f"{name} ({age} days old)" if age else name)
        crop_list = f"Current crops: {', '.join(parts)}."

    location_hint = f"Located in {district}, {state}." if district else f"Located in {state}."

    lang_instruction = ""
    if lang in ("hi", "hi-IN", "hi-in"):
        lang_instruction = "Always respond in Hindi (Devanagari script). Keep English technical terms as-is."
    elif lang in ("mr", "mr-IN", "mr-in"):
        lang_instruction = "Always respond in Marathi (Devanagari script). Keep English technical terms as-is."
    elif lang in ("ta", "ta-IN"):
        lang_instruction = "Always respond in Tamil. Keep English technical terms as-is."
    elif lang in ("te", "te-IN"):
        lang_instruction = "Always respond in Telugu. Keep English technical terms as-is."
    elif lang in ("kn", "kn-IN"):
        lang_instruction = "Always respond in Kannada."
    elif lang in ("gu", "gu-IN"):
        lang_instruction = "Always respond in Gujarati."
    elif lang in ("pa", "pa-IN"):
        lang_instruction = "Always respond in Punjabi."
    elif lang not in ("en", "en-IN", "en-in"):
        lang_instruction = f"Respond in the farmer's preferred language ({lang}) where possible."

    soil_hint      = farm_profile.get("soilType", "")
    irr_hint       = farm_profile.get("irrigationType", "")
    land_hint      = farm_profile.get("landSize", "")

    return f"""You are FarmMind, a senior agronomist and agricultural advisor built by FarmEasy for Indian farmers. You have deep expertise equivalent to an ICAR scientist combined with hands-on field experience across Maharashtra and all major farming states.

EXPERTISE: Crop diseases & pest management (ICAR guidelines), mandi prices & MSP, government schemes (PM-KISAN, PMFBY, Kisan Credit Card), soil health & fertilizers, irrigation & water management, weather-based advisory, seed selection, post-harvest storage, district-level ICAR contingency plans.

FARMER PROFILE:
  {location_hint}
  Season: {season} ({month})
  {crop_list}
  {f"Soil type: {soil_hint}" if soil_hint else "Soil type: unknown (ask if relevant)"}
  {f"Irrigation: {irr_hint}" if irr_hint else "Irrigation: unknown (ask if relevant)"}
  {f"Land size: {land_hint} acres" if land_hint else ""}

RESPONSE QUALITY RULES:
1. Match depth to question complexity:
   - Complex decisions (crop planning, disease management, soil correction, financial planning):
     Write 350–600 words. Use **bold headers** for sections. Give specific, differentiated advice.
   - Moderate questions (variety selection, fertilizer schedule, pest control):
     Write 200–350 words. Be specific with doses, timing, variety names.
   - Simple factual queries (what is MSP, scheme eligibility, single yes/no):
     Write 80–150 words. Direct answer first, brief context after.
2. Always use real Indian product/brand names (Mancozeb 75WP, DAP, Urea, Chlorpyrifos 20EC, etc.) with exact dosage and timing.
3. Never give one-size-fits-all advice. Always differentiate by:
   - Rainfed vs irrigated land
   - Soil type (black cotton / red laterite / alluvial / sandy loam)
   - Current season and optimal sowing windows
   - District or taluka-level agro-climatic variation when relevant
4. For crop recommendations, ALWAYS cover:
   - Best 2–3 crops for rainfed conditions
   - Best 2–3 crops if irrigation is available
   - ICAR-recommended varieties for that district/region
   - Sowing window and key management tips
   - Market/cash crop potential
   - If taluka or soil type is unknown, mention it affects the answer and ask at the end.
5. For disease queries with symptoms, return the DIAGNOSIS JSON block below.
6. For market/price queries, return the MARKET JSON block below.
7. End complex answers with ONE targeted follow-up question to get missing info (taluka, soil type, water source) that would sharpen the advice further.
8. {lang_instruction or "Respond in English unless the farmer writes in another language."}

DIAGNOSIS JSON FORMAT (use ONLY when farmer describes symptoms or shares disease name):
{{
  "type": "diagnosis",
  "disease": "<Disease name>",
  "confidence": <0-100 integer>,
  "severity": "low|moderate|high|critical",
  "immediateAction": "<single most urgent step>",
  "treatment": {{
    "chemical": "<product + dosage>",
    "organic": "<organic option>",
    "preventive": "<prevention measure>"
  }},
  "expectedRecovery": "<timeframe>",
  "additionalNotes": "<extra context>"
}}

MARKET JSON FORMAT (use ONLY when asked about prices):
{{
  "type": "market",
  "crop": "<crop>",
  "msp": "<MSP in Rs/quintal>",
  "marketRange": "<min-max Rs/quintal>",
  "trend": "rising|stable|falling",
  "bestMarket": "<nearest recommended mandi>",
  "sellingAdvice": "<when/where to sell>"
}}

IMPORTANT: For JSON responses, output ONLY the JSON block — no extra text before or after. For all other responses, output plain text with **bold** for section headers."""


# ── JSON extraction ───────────────────────────────────────────────────────────

def _try_extract_json(text: str) -> Optional[dict]:
    """Pull first JSON object from response, if any."""
    from utils.json_extractor import extract_json
    return extract_json(text)


def _classify_response(text: str, structured: Optional[dict]) -> tuple[str, Optional[dict]]:
    """Return (type, structuredData)."""
    if structured:
        t = structured.get("type", "")
        if t == "diagnosis" or "disease" in structured:
            return "diagnosis", structured
        if t == "market" or "msp" in structured or "marketRange" in structured:
            return "market", structured
    return "text", None


# ── Groq call ─────────────────────────────────────────────────────────────────

async def _call_groq(system: str, messages: list[dict]) -> str:
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL_GROQ_CHAT,
                "messages": [{"role": "system", "content": system}] + messages,
                "temperature": 0.7,
                "max_tokens": 2048,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


# ── Gemini fallback ───────────────────────────────────────────────────────────

async def _call_gemini(system: str, messages: list[dict]) -> str:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not set")

    # Convert OpenAI-style history to Gemini contents
    contents = []
    for m in messages:
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})

    # Prepend system as first user turn
    contents = [{"role": "user", "parts": [{"text": system}]},
                {"role": "model", "parts": [{"text": "Understood. I am FarmMind, ready to help Indian farmers."}]}] + contents

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_GEMINI_CHAT}:generateContent",
            params={"key": GEMINI_API_KEY},
            json={"contents": contents, "generationConfig": {"maxOutputTokens": 2048, "temperature": 0.7}},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()


# ── Public function ───────────────────────────────────────────────────────────

async def chat_with_farmmind(
    message: str,
    history: list[dict],            # [{"role": "user"|"assistant", "content": str}]
    farm_profile: dict,
) -> dict[str, Any]:
    """
    Returns: { reply: str, type: str, structured_data: dict|None }
    """
    system   = _build_system_prompt(farm_profile)
    messages = [{"role": m["role"], "content": m["content"]} for m in history[-20:]]
    messages.append({"role": "user", "content": message})

    reply = None

    # Try Groq first
    if GROQ_API_KEY:
        try:
            reply = await _call_groq(system, messages)
        except Exception as exc:
            logger.warning(f"[ChatService] Groq failed: {exc} — trying Gemini")

    # Fallback to Gemini
    if not reply and GEMINI_API_KEY:
        try:
            reply = await _call_gemini(system, messages)
        except Exception as exc:
            logger.warning(f"[ChatService] Gemini failed: {exc}")

    if not reply:
        reply = "I'm sorry, the AI service is temporarily unavailable. Please try again in a moment."

    structured = _try_extract_json(reply)
    resp_type, structured_data = _classify_response(reply, structured)

    # For structured responses, build a natural-language intro instead of showing raw JSON
    if structured_data:
        if resp_type == "diagnosis":
            disease = structured_data.get("disease", "a crop condition")
            action  = structured_data.get("immediateAction", "")
            notes   = structured_data.get("additionalNotes", "")
            reply   = f"I've diagnosed your crop with **{disease}**. {action}" if action else \
                      f"I've detected **{disease}** in your crop. {notes}".strip()
        elif resp_type == "market":
            crop   = structured_data.get("crop", "your crop")
            advice = structured_data.get("sellingAdvice", "")
            reply  = advice if advice else f"Here are the current market details for {crop}."

    return {"reply": reply, "type": resp_type, "structured_data": structured_data}
