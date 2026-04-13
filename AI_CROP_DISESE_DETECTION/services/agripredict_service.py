"""
AgriPredict Service — Real mandi data + Claude-powered predictions

Fully async:
  - httpx.AsyncClient  for paginated data.gov.in fetches
  - asyncpg pool       for non-blocking PostgreSQL reads/writes
  - anthropic.AsyncAnthropic for Claude predictions

Architecture:
  1. sync_commodity_data() — fetch pages from data.gov.in → bulk-upsert mandi_prices
  2. get_historical_prices() — SQL monthly aggregation (no LLM)
  3. get_prediction()        — cache-first (prediction_cache) → Claude on miss
  4. compare_nearby()        — 30-day district comparison
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import re
import uuid
from datetime import date, datetime, timezone
from typing import Any, Optional

import asyncpg
import httpx
from groq import AsyncGroq

from config import GROQ_API_KEY, DATA_GOV_API_KEY, DATABASE_URL

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
DATA_GOV_BASE    = "https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24"
RECORDS_PER_PAGE = 1_000
FETCH_DELAY_S    = 0.5          # polite delay between pages
GROQ_MODEL        = "llama-3.3-70b-versatile"
PRED_MAX_TOKENS   = 800

# ── DB pool (module-level singleton) ─────────────────────────────────────────
_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
    return _pool


# ── Commodity name normaliser ─────────────────────────────────────────────────
_ALIAS: dict[str, str] = {
    "soybean":    "Soyabean", "soybeans":  "Soyabean",
    "tur":        "Arhar/Tur", "arhar":    "Arhar/Tur", "tur dal": "Arhar/Tur",
    "sunflower":  "Sunflower Seed",
    "chilli":     "Green Chilli", "red chilli": "Chilli",
    "groundnut":  "Groundnut(Shell)",
}

# Maps our canonical state names → what data.gov.in expects in filters.
# Only states that differ are listed; all others pass through unchanged.
_STATE_MAP: dict[str, str] = {
    "Jammu and Kashmir":                          "Jammu And Kashmir",
    "Dadra and Nagar Haveli and Daman and Diu":   "Dadra And Nagar Haveli And Daman And Diu",
    "Andaman and Nicobar Islands":                "Andaman And Nicobar",
}

# States/UTs with no agricultural mandi data on data.gov.in
_NO_MANDI_STATES: frozenset[str] = frozenset({
    "Ladakh", "Lakshadweep",
    "Andaman and Nicobar Islands",
    "Dadra and Nagar Haveli and Daman and Diu",
})


def _norm(name: str) -> str:
    return _ALIAS.get(name.lower().strip(), name)


def _norm_state(state: str) -> str:
    """Normalise our canonical state name to what data.gov.in expects."""
    return _STATE_MAP.get(state, state)


# ── Date helpers — naive datetimes only (Prisma uses TIMESTAMP, not TIMESTAMPTZ) ─
def _parse_gov_date(s: str | None) -> datetime | None:
    if not s:
        return None
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s.strip())
    if m:
        d, mo, y = int(m[1]), int(m[2]), int(m[3])
        return datetime(y, mo, d)   # naive
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.replace(tzinfo=None)  # strip tz
    except ValueError:
        return None


def _now() -> datetime:
    return datetime.utcnow()   # naive UTC


def _current_month() -> str:
    now = _now()
    return f"{now.year}-{now.month:02d}"


def _first_of_next_month() -> datetime:
    now = _now()
    if now.month == 12:
        return datetime(now.year + 1, 1, 1)
    return datetime(now.year, now.month + 1, 1)


# ── Fetch one page from data.gov.in ──────────────────────────────────────────
async def _fetch_page(
    client: httpx.AsyncClient,
    commodity: str,
    state: str,
    district: str | None,
    offset: int,
) -> list[dict]:
    if not DATA_GOV_API_KEY:
        raise RuntimeError("DATA_GOV_API_KEY not configured")

    params: dict[str, Any] = {
        "api-key":            DATA_GOV_API_KEY,
        "format":             "json",
        "limit":              RECORDS_PER_PAGE,
        "offset":             offset,
        "filters[State]":     _norm_state(state),
        "filters[Commodity]": _norm(commodity),
    }
    if district:
        params["filters[District]"] = district

    resp = await client.get(
        DATA_GOV_BASE,
        params=params,
        timeout=20.0,
        headers={"User-Agent": "FarmEasy/1.0 (farmeasy.app)"},
    )
    resp.raise_for_status()
    return resp.json().get("records", [])


# ── Sync: data.gov.in → mandi_prices table ───────────────────────────────────
async def sync_commodity_data(
    commodity: str,
    state: str,
    district: str | None = None,
    max_pages: int = 10,
) -> dict[str, Any]:
    pool = await get_pool()
    sync_id = str(uuid.uuid4())

    # Log sync start
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO price_data_sync
              (id, "syncType", state, commodity, "recordsFetched", status, "startedAt")
            VALUES ($1, 'backfill', $2, $3, 0, 'running', NOW())
            """,
            sync_id, state, commodity,
        )

    total = 0
    try:
        async with httpx.AsyncClient() as client:
            for page in range(max_pages):
                offset = page * RECORDS_PER_PAGE
                records = await _fetch_page(client, commodity, state, district, offset)
                if not records:
                    break

                # Bulk-upsert into mandi_prices
                async with pool.acquire() as conn:
                    for r in records:
                        price_date = _parse_gov_date(
                            r.get("Arrival_Date") or r.get("arrival_date")
                        )
                        if not price_date:
                            continue
                        min_p   = float(r.get("Min_Price")   or r.get("min_price")   or 0)
                        max_p   = float(r.get("Max_Price")   or r.get("max_price")   or 0)
                        modal   = float(r.get("Modal_Price") or r.get("modal_price") or 0)
                        if not modal and not min_p:
                            continue

                        rec_id = str(uuid.uuid4())
                        await conn.execute(
                            """
                            INSERT INTO mandi_prices
                              (id, commodity, variety, market, district, state,
                               "minPrice", "maxPrice", "modalPrice",
                               "priceDate", source, "fetchedAt", "expiresAt")
                            VALUES
                              ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'data.gov.in',NOW(),
                               NOW() + INTERVAL '90 days')
                            ON CONFLICT DO NOTHING
                            """,
                            rec_id,
                            _norm(commodity),
                            r.get("Variety") or r.get("variety") or "",
                            r.get("Market")  or r.get("market")  or "",
                            r.get("District") or r.get("district") or district or "",
                            r.get("State")   or r.get("state")   or state,
                            min_p, max_p, modal,
                            price_date,
                        )
                        total += 1

                if len(records) < RECORDS_PER_PAGE:
                    break   # last page
                await asyncio.sleep(FETCH_DELAY_S)

        # Mark completed
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE price_data_sync
                SET status='completed', "recordsFetched"=$2, "completedAt"=NOW()
                WHERE id=$1
                """,
                sync_id, total,
            )
        logger.info("[AgriPredict] sync done — %s/%s: %d records", commodity, state, total)
        return {"success": True, "records_fetched": total, "sync_id": sync_id}

    except Exception as exc:
        logger.error("[AgriPredict] sync failed: %s", exc)
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE price_data_sync
                SET status='failed', "errorMessage"=$2, "completedAt"=NOW()
                WHERE id=$1
                """,
                sync_id, str(exc)[:300],
            )
        raise


# ── Monthly aggregation (last N months) ──────────────────────────────────────
async def _build_monthly_summary(
    commodity: str,
    state: str,
    district: str | None,
    months: int = 60,
) -> list[dict]:
    pool = await get_pool()
    since = _now().replace(day=1)
    # Go back `months` months
    year_offset  = (since.month - 1 - months) // 12
    month_offset = (since.month - 1 - months) % 12
    since = since.replace(year=since.year + year_offset, month=month_offset + 1)

    district_clause = (
        'AND LOWER(district) LIKE LOWER($4)' if district else ''
    )
    args: list[Any] = [_norm(commodity), state, since]
    if district:
        args.append(f"%{district}%")

    query = f"""
        SELECT
            TO_CHAR("priceDate", 'YYYY-MM')          AS month,
            ROUND(AVG("modalPrice"))::INT             AS avg_modal_price,
            MIN("minPrice")::FLOAT                    AS min_price,
            MAX("maxPrice")::FLOAT                    AS max_price,
            COUNT(*)::INT                             AS record_count,
            COUNT(DISTINCT market)::INT               AS markets_reporting
        FROM mandi_prices
        WHERE LOWER(commodity) LIKE LOWER('%' || $1 || '%')
          AND LOWER(state)     LIKE LOWER('%' || $2 || '%')
          AND "priceDate" >= $3
          {district_clause}
        GROUP BY TO_CHAR("priceDate", 'YYYY-MM')
        ORDER BY month ASC
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *args)

    return [dict(r) for r in rows]


# ── Local stats: YoY, seasonal index, 3-month moving avg ─────────────────────
def _compute_stats(summary: list[dict]) -> dict:
    if len(summary) < 2:
        return {"yoy": [], "seasonal": [], "moving_avg3": []}

    # YoY per calendar-month
    by_cal: dict[int, list[float]] = {}
    for row in summary:
        m = int(row["month"][5:7])
        by_cal.setdefault(m, []).append(row["avg_modal_price"])

    yoy = []
    for row in summary:
        m = int(row["month"][5:7])
        vals = by_cal[m]
        if len(vals) < 2:
            yoy.append({"month": row["month"], "yoy_pct": None})
            continue
        last, prev = vals[-1], vals[-2]
        pct = round(((last - prev) / prev) * 100, 1) if prev > 0 else None
        yoy.append({"month": row["month"], "yoy_pct": pct})

    # Seasonal index
    overall_avg = sum(r["avg_modal_price"] for r in summary) / len(summary)
    seasonal = [
        {
            "month_num": m,
            "avg_price": round(sum(vals) / len(vals)),
            "index_vs_overall": round(sum(vals) / len(vals) / overall_avg * 100) if overall_avg else 100,
        }
        for m, vals in sorted(by_cal.items())
    ]

    # 3-month moving avg
    moving_avg3 = []
    for i, row in enumerate(summary):
        if i < 2:
            moving_avg3.append({"month": row["month"], "ma3": None})
            continue
        slice_ = [summary[j]["avg_modal_price"] for j in range(i - 2, i + 1)
                  if summary[j]["avg_modal_price"] > 0]
        moving_avg3.append({
            "month": row["month"],
            "ma3": round(sum(slice_) / len(slice_)) if slice_ else None,
        })

    return {"yoy": yoy, "seasonal": seasonal, "moving_avg3": moving_avg3}


# ── Nearby district prices (last 30 days) ────────────────────────────────────
async def _get_nearby_prices(
    commodity: str,
    state: str,
    exclude_district: str,
) -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT district, "modalPrice", market, "priceDate"
            FROM mandi_prices
            WHERE LOWER(commodity) LIKE LOWER('%' || $1 || '%')
              AND LOWER(state)     LIKE LOWER('%' || $2 || '%')
              AND "priceDate" >= NOW() - INTERVAL '30 days'
              AND LOWER(district)  NOT LIKE LOWER('%' || $3 || '%')
            ORDER BY "priceDate" DESC
            LIMIT 500
            """,
            _norm(commodity), state, exclude_district or "____NONE____",
        )

    by_dist: dict[str, list[float]] = {}
    for r in rows:
        by_dist.setdefault(r["district"], []).append(r["modalPrice"])

    result = []
    for dist, prices in sorted(by_dist.items(), key=lambda x: -len(x[1])):
        if len(prices) < 2:
            continue
        valid = [p for p in prices if p > 0]
        if not valid:
            continue
        avg    = round(sum(valid) / len(valid))
        recent = valid[0]
        older  = valid[min(len(valid) - 1, 6)]
        trend  = "up" if recent > older * 1.03 else "down" if recent < older * 0.97 else "stable"
        result.append({
            "district":   dist,
            "currentAvg": avg,
            "trend":      trend,
            "dataPoints": len(valid),
        })
        if len(result) >= 5:
            break
    return result


# ── Fetch current live prices from data.gov.in (resource: current daily) ─────
LIVE_RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070"

async def _fetch_live_prices(commodity: str, state: str, district: str | None) -> list[dict]:
    """Returns today's mandi prices for a commodity+state. Works with demo key."""
    if not DATA_GOV_API_KEY:
        return []
    if state in _NO_MANDI_STATES:
        return []
    params: dict[str, Any] = {
        "api-key": DATA_GOV_API_KEY,
        "format": "json",
        "limit": 100,
        "filters[commodity]": commodity,
        "filters[state]": _norm_state(state),
    }
    if district:
        params["filters[district]"] = district
    try:
        async with httpx.AsyncClient() as c:
            r = await c.get(
                f"https://api.data.gov.in/resource/{LIVE_RESOURCE}",
                params=params, timeout=12,
                headers={"User-Agent": "FarmEasy/1.0"},
            )
            r.raise_for_status()
            return r.json().get("records", [])
    except Exception as exc:
        logger.warning("[AgriPredict] live fetch failed: %s", exc)
        return []


# ── LLM prediction call (Groq) ───────────────────────────────────────────────
async def _call_claude(
    commodity: str,
    state: str,
    district: str,
    summary: list[dict],
    stats: dict,
    nearby: list[dict],
) -> dict:
    client = AsyncGroq(api_key=GROQ_API_KEY)

    now = _now()
    next_month = now.replace(day=1)
    if now.month == 12:
        next_month = next_month.replace(year=now.year + 1, month=1)
    else:
        next_month = next_month.replace(month=now.month + 1)
    target = next_month.strftime("%B %Y")

    location = f"{district + ', ' if district else ''}{state}"
    user_prompt = (
        f"Analyze monthly price data for {commodity} in {location} "
        f"and predict the trend for {target}.\n\n"
        f"MONTHLY PRICE DATA (₹/quintal, newest last):\n"
        f"{json.dumps(summary[-24:], indent=2)}\n\n"
        f"SEASONAL PATTERN:\n{json.dumps(stats['seasonal'], indent=2)}\n\n"
        f"YEAR-OVER-YEAR (recent):\n{json.dumps(stats['yoy'][-12:], indent=2)}\n\n"
        f"NEARBY MARKETS:\n{json.dumps(nearby, indent=2)}\n\n"
        f"Respond with ONLY this JSON:\n"
        f'{{\n'
        f'  "predicted_price_range": {{"min": number, "max": number, "expected": number}},\n'
        f'  "trend": "up"|"down"|"stable",\n'
        f'  "trend_percentage": number,\n'
        f'  "confidence": "low"|"medium"|"high",\n'
        f'  "seasonal_insight": "1-2 sentences",\n'
        f'  "market_comparison": "1-2 sentences",\n'
        f'  "key_factors": ["factor1","factor2","factor3"],\n'
        f'  "recommendation": "1 sentence for farmer"\n'
        f'}}'
    )

    resp = await client.chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=PRED_MAX_TOKENS,
        messages=[
            {"role": "system", "content": "You are an agricultural market analyst specializing in Indian mandi prices. Respond ONLY with valid JSON — no markdown, no explanation."},
            {"role": "user", "content": user_prompt},
        ],
    )
    raw   = resp.choices[0].message.content or "{}"
    clean = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.I).rstrip("` \n")
    return json.loads(clean)


async def _call_claude_live_only(
    commodity: str,
    state: str,
    district: str,
    live_prices: list[dict],
) -> dict:
    """Prediction using current live prices + LLM seasonal knowledge."""
    client = AsyncGroq(api_key=GROQ_API_KEY)

    now = _now()
    next_month = now.replace(day=1)
    if now.month == 12:
        next_month = next_month.replace(year=now.year + 1, month=1)
    else:
        next_month = next_month.replace(month=now.month + 1)
    target = next_month.strftime("%B %Y")
    current_month_name = now.strftime("%B %Y")
    location = f"{district + ', ' if district else ''}{state}"

    price_summary = [
        {
            "market":      r.get("market", r.get("Market", "")),
            "district":    r.get("district", r.get("District", "")),
            "modal_price": r.get("modal_price", r.get("Modal_Price", 0)),
            "min_price":   r.get("min_price",   r.get("Min_Price",   0)),
            "max_price":   r.get("max_price",   r.get("Max_Price",   0)),
            "date":        r.get("arrival_date", r.get("Arrival_Date", "")),
        }
        for r in live_prices[:20]
    ]

    prices = [float(p["modal_price"]) for p in price_summary if p["modal_price"]]
    avg_current = round(sum(prices) / len(prices)) if prices else 0

    user_prompt = (
        f"You are analyzing {commodity} prices in {location} for {current_month_name}.\n\n"
        f"CURRENT MANDI PRICES (₹/quintal):\n"
        f"{json.dumps(price_summary, indent=2)}\n\n"
        f"Average current modal price: ₹{avg_current}/quintal\n\n"
        f"Based on:\n"
        f"1. These current mandi prices\n"
        f"2. Your knowledge of seasonal price patterns for {commodity} in India\n"
        f"3. Typical supply/demand cycles for {state}\n\n"
        f"Predict the price trend for {target}.\n\n"
        f"Respond with ONLY this JSON:\n"
        f'{{\n'
        f'  "predicted_price_range": {{"min": number, "max": number, "expected": number}},\n'
        f'  "trend": "up"|"down"|"stable",\n'
        f'  "trend_percentage": number,\n'
        f'  "confidence": "medium",\n'
        f'  "seasonal_insight": "1-2 sentences about seasonal pattern for this crop",\n'
        f'  "market_comparison": "1-2 sentences about current mandi price spread",\n'
        f'  "key_factors": ["factor1","factor2","factor3"],\n'
        f'  "recommendation": "1 sentence advice for farmer"\n'
        f'}}'
    )

    resp = await client.chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=PRED_MAX_TOKENS,
        messages=[
            {"role": "system", "content": "You are an expert in Indian agricultural mandi prices with deep knowledge of seasonal patterns, regional supply chains, and crop price cycles across all Indian states. Respond ONLY with valid JSON — no markdown, no explanation."},
            {"role": "user", "content": user_prompt},
        ],
    )
    raw   = resp.choices[0].message.content or "{}"
    clean = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.I).rstrip("` \n")
    return json.loads(clean)


# ── Public: get historical prices ────────────────────────────────────────────
async def get_historical_prices(
    commodity: str,
    state: str,
    district: str | None = None,
) -> dict:
    summary = await _build_monthly_summary(commodity, state, district, 60)
    stats   = _compute_stats(summary)

    cur     = summary[-1] if summary else None
    last12  = summary[-12:]
    last2   = summary[-2:]
    last3   = summary[-3:]

    avg30d = round(sum(r["avg_modal_price"] for r in last2) / max(len(last2), 1)) if last2 else None
    avg90d = round(sum(r["avg_modal_price"] for r in last3) / max(len(last3), 1)) if last3 else None

    yoy_pct = None
    if len(summary) >= 13 and cur:
        same_last_year = next(
            (r for r in summary[-13:-1]
             if r["month"][5:7] == cur["month"][5:7]), None
        )
        if same_last_year and same_last_year["avg_modal_price"] > 0:
            yoy_pct = round(
                (cur["avg_modal_price"] - same_last_year["avg_modal_price"])
                / same_last_year["avg_modal_price"] * 100,
                1,
            )

    return {
        "commodity": commodity,
        "state":     state,
        "district":  district,
        "monthlySummary": summary,
        "stats":     stats,
        "summary": {
            "currentPrice":  cur["avg_modal_price"] if cur else None,
            "avg30d":        avg30d,
            "avg90d":        avg90d,
            "yoyChangePct":  yoy_pct,
            "dataPoints":    sum(r["record_count"] for r in summary),
            "dateRange": {
                "from": summary[0]["month"]  if summary else None,
                "to":   summary[-1]["month"] if summary else None,
            },
        },
    }


# ── Public: cache-first prediction ───────────────────────────────────────────
async def get_prediction(
    commodity: str,
    state: str,
    district: str = "",
) -> dict:
    if state in _NO_MANDI_STATES:
        return {
            "cached": False,
            "error":  "no_data",
            "message": f"{state} does not have agricultural mandi price data on data.gov.in.",
            "query":  {"state": state, "district": district or "", "commodity": commodity},
        }

    pool = await get_pool()
    month = _current_month()
    dist_key = district or ""

    # 1. Check cache
    async with pool.acquire() as conn:
        cached = await conn.fetchrow(
            """
            SELECT analysis, confidence, "nearbyMarkets", "createdAt", "expiresAt"
            FROM prediction_cache
            WHERE LOWER(state)     LIKE LOWER('%' || $1 || '%')
              AND LOWER(district)  = LOWER($2)
              AND LOWER(commodity) LIKE LOWER('%' || $3 || '%')
              AND "predictionMonth" = $4
              AND "expiresAt" > NOW()
            LIMIT 1
            """,
            state, dist_key, _norm(commodity), month,
        )

    if cached:
        return {
            "cached":       True,
            "cachedAt":     cached["createdAt"].isoformat(),
            "expiresAt":    cached["expiresAt"].isoformat(),
            "query":        {"state": state, "district": dist_key, "commodity": commodity},
            "prediction":   json.loads(cached["analysis"]),
            "confidence":   cached["confidence"],
            "nearbyMarkets": json.loads(cached["nearbyMarkets"]) if cached["nearbyMarkets"] else [],
        }

    # 2. Build data — try DB first, fall back to live API
    summary = await _build_monthly_summary(commodity, state, district, 60)
    nearby  = await _get_nearby_prices(commodity, state, dist_key)

    if len(summary) >= 3:
        # ── Path A: enough DB history → full Claude analysis
        stats = _compute_stats(summary)
        try:
            prediction = await _call_claude(commodity, state, district, summary, stats, nearby)
        except Exception as exc:
            logger.warning("[AgriPredict] Claude failed: %s — MA3 fallback", exc)
            recent_prices = [r["avg_modal_price"] for r in summary[-3:] if r["avg_modal_price"] > 0]
            ma3 = round(sum(recent_prices) / len(recent_prices)) if recent_prices else 0
            prediction = {
                "predicted_price_range": {"min": round(ma3 * 0.9), "max": round(ma3 * 1.1), "expected": ma3},
                "trend": "stable", "trend_percentage": 0, "confidence": "low",
                "seasonal_insight": "Statistical estimate (3-month moving avg).",
                "market_comparison": (
                    "Nearby: " + ", ".join(f"{m['district']} \u20b9{m['currentAvg']}" for m in nearby[:2])
                    if nearby else "No nearby data."
                ),
                "key_factors": ["Moving average estimate"],
                "recommendation": "Check local mandi for current rates.",
            }
    else:
        # ── Path B: no DB history → fetch live prices + Claude seasonal knowledge
        logger.info("[AgriPredict] No DB history for %s/%s — using live prices + Claude", commodity, state)
        live_prices = await _fetch_live_prices(_norm(commodity), state, district or None)
        if not live_prices:
            return {
                "cached": False,
                "error":  "no_data",
                "message": f"No current price data available for {commodity} in {district or state}. DATA_GOV_API_KEY may not be configured.",
                "query":  {"state": state, "district": dist_key, "commodity": commodity},
            }
        try:
            prediction = await _call_claude_live_only(commodity, state, district, live_prices)
            prediction["data_source"] = "live_prices_only"
        except Exception as exc:
            logger.warning("[AgriPredict] Claude live failed: %s", exc)
            prices = [float(r.get("modal_price", r.get("Modal_Price", 0))) for r in live_prices if r.get("modal_price") or r.get("Modal_Price")]
            avg = round(sum(prices) / len(prices)) if prices else 0
            prediction = {
                "predicted_price_range": {"min": round(avg * 0.85), "max": round(avg * 1.15), "expected": avg},
                "trend": "stable", "trend_percentage": 0, "confidence": "low",
                "seasonal_insight": "Based on current market prices only.",
                "market_comparison": f"Current avg ₹{avg}/quintal across {len(live_prices)} mandis.",
                "key_factors": ["Current market prices", "Seasonal estimate"],
                "recommendation": "Monitor local mandi prices closely.",
                "data_source": "live_prices_only",
            }
        summary = []  # no monthly summary available

    # 4. Cache result
    first = summary[0]  if summary else None
    last  = summary[-1] if summary else None
    expires_at = _first_of_next_month()
    cache_id   = str(uuid.uuid4())
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO prediction_cache
                  (id, state, district, commodity, "predictionMonth",
                   "priceTrend", analysis, confidence, "nearbyMarkets",
                   "dataFromDate", "dataToDate", "recordCount", "expiresAt")
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                ON CONFLICT (state, district, commodity, "predictionMonth")
                DO UPDATE SET
                  "priceTrend"   = EXCLUDED."priceTrend",
                  analysis       = EXCLUDED.analysis,
                  confidence     = EXCLUDED.confidence,
                  "nearbyMarkets"= EXCLUDED."nearbyMarkets",
                  "expiresAt"    = EXCLUDED."expiresAt"
                """,
                cache_id,
                state.strip(), dist_key.strip(), _norm(commodity).strip(), month,
                json.dumps(prediction.get("predicted_price_range", {})),
                json.dumps(prediction),
                prediction.get("confidence", "medium"),
                json.dumps(nearby),
                datetime.fromisoformat(first["month"] + "-01") if first else None,
                datetime.fromisoformat(last["month"]  + "-01") if last  else None,
                sum(r["record_count"] for r in summary),
                expires_at,
            )
    except Exception as e:
        logger.warning("[AgriPredict] cache write failed: %s", e)

    return {
        "cached":    False,
        "expiresAt": expires_at.isoformat(),
        "query":     {"state": state, "district": dist_key, "commodity": commodity},
        "prediction": prediction,
        "nearbyMarkets": nearby,
        "dataUsed": {
            "months":     len(summary),
            "from":       first["month"] if first else None,
            "to":         last["month"]  if last  else None,
            "dataPoints": sum(r["record_count"] for r in summary),
        },
    }


# ── Public: nearby comparison ─────────────────────────────────────────────────
async def compare_nearby(commodity: str, state: str, district: str = "") -> dict:
    nearby = await _get_nearby_prices(commodity, state, district)
    return {"commodity": commodity, "state": state, "district": district, "nearbyMarkets": nearby}


# ── Public: sync status ───────────────────────────────────────────────────────
async def get_sync_status(commodity: str | None, state: str | None) -> dict | None:
    pool = await get_pool()
    conditions = []
    args: list[Any] = []
    if commodity:
        args.append(f"%{commodity}%")
        conditions.append(f"LOWER(commodity) LIKE LOWER(${len(args)})")
    if state:
        args.append(f"%{state}%")
        conditions.append(f"LOWER(state) LIKE LOWER(${len(args)})")

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
            SELECT id, "syncType", state, commodity,
                   "recordsFetched", status, "errorMessage",
                   "startedAt", "completedAt"
            FROM price_data_sync
            {where}
            ORDER BY "startedAt" DESC
            LIMIT 1
            """,
            *args,
        )
    if not row:
        return None
    r = dict(row)
    # serialise datetimes
    for k in ("startedAt", "completedAt"):
        if r.get(k):
            r[k] = r[k].isoformat()
    return r


# ── Public: filter helpers ────────────────────────────────────────────────────
async def get_states() -> list[str]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT DISTINCT state FROM mandi_prices ORDER BY state"
        )
    return [r["state"] for r in rows if r["state"]]


async def get_districts(state: str) -> list[str]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT DISTINCT district FROM mandi_prices
            WHERE LOWER(state) LIKE LOWER('%' || $1 || '%')
            ORDER BY district
            """,
            state,
        )
    return [r["district"] for r in rows if r["district"]]


async def get_commodities(state: str, district: str | None = None) -> list[str]:
    pool = await get_pool()
    cond = "AND LOWER(district) LIKE LOWER('%' || $2 || '%')" if district else ""
    args = [state] + ([district] if district else [])
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT DISTINCT commodity FROM mandi_prices
            WHERE LOWER(state) LIKE LOWER('%' || $1 || '%')
            {cond}
            ORDER BY commodity
            """,
            *args,
        )
    return [r["commodity"] for r in rows if r["commodity"]]
