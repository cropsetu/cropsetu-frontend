# FarmEasy Platform — Phase 1 Code Quality & Security Audit

**Date:** 2026-04-12  
**Scope:** Node.js Express backend (`src/`) + Python FastAPI AI microservice (`AI_CROP_DISESE_DETECTION/`) + Farmer App (`Farmeasy-froontend/`) + Seller App (`farmeasy-seller/`)  
**Auditor:** Claude Code (automated static + dynamic analysis)

---

## Executive Summary

| Area | Health Score | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| Secrets & Config | 🔴 4/10 | 1 | 2 | 1 | 0 |
| Authentication | 🟡 7/10 | 0 | 1 | 2 | 1 |
| Input Validation | 🟡 6/10 | 0 | 1 | 2 | 1 |
| Error Handling | 🟡 6/10 | 0 | 2 | 2 | 2 |
| API Security | 🟢 8/10 | 0 | 0 | 1 | 2 |
| Python AI Service | 🟡 6/10 | 1 | 2 | 3 | 3 |
| Observability | 🔴 3/10 | 0 | 1 | 2 | 3 |
| Frontend Apps | 🟢 8/10 | 0 | 1 | 1 | 3 |
| Test Coverage | 🟡 5/10 | — | — | — | — |

**Overall Platform Health: 🟡 6.5/10**

The platform has a solid foundation (Helmet, rate limiting, JWT refresh tokens, field encryption, Prisma ORM, expo-secure-store for tokens) but several issues must be addressed before production deployment, most critically: a hardcoded API key in env.js, 85 unstructured `print()` calls that will obscure production errors, and 20+ `console.log` calls in DiagnosisResultScreen leaking AI report data to device logs.

---

## Audit Section 1 — Secrets & Configuration

### CRITICAL-1: Hardcoded API Key in Source Code

**File:** [src/config/env.js:58](src/config/env.js#L58)

```js
DATA_GOV_API_KEY: process.env.DATA_GOV_API_KEY || '579b464db66ec23bdd000001cdd3946e44ce4aab08d1b66f024f4840',
```

A live government API key is committed directly in source code. Anyone with read access to the repository has this key.

**Fix:** Remove the default. If this key is revoked it's a public-facing data.gov.in key and impacts the market price feature:
```js
DATA_GOV_API_KEY: process.env.DATA_GOV_API_KEY || '',
```

**Effort:** 5 minutes.

---

### HIGH-1: FIELD_ENCRYPTION_KEY Not Required in Production

**File:** [src/config/env.js:63](src/config/env.js#L63)

```js
FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY || '',
```

PII fields (Aadhaar, PAN, bank account) are encrypted with AES-256-GCM only when this key is set. An empty key means PII is stored in plaintext — a potential DPDP Act violation.

**Fix:** Make it required in production:
```js
FIELD_ENCRYPTION_KEY: ENV.IS_DEV
  ? (process.env.FIELD_ENCRYPTION_KEY || '')
  : required('FIELD_ENCRYPTION_KEY'),
```

**Effort:** 10 minutes.

---

### HIGH-2: Python AI Service CORS Open to `*`

**File:** [AI_CROP_DISESE_DETECTION/main.py:40-45](AI_CROP_DISESE_DETECTION/main.py#L40)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # ← any origin can call this service
    ...
)
```

The FastAPI service is only reachable from the internal network, but `allow_origins=["*"]` is an unnecessary risk if the port is ever exposed.

**Fix:**
```python
ALLOWED_ORIGINS = os.getenv("AI_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, ...)
```

**Effort:** 15 minutes.

---

### MEDIUM-1: Multiple API Keys Default to Empty String (Silent Failures)

**File:** [src/config/env.js:21-54](src/config/env.js#L21)

Keys for MSG91, Cloudinary, Gemini, Groq, Anthropic, Sarvam, and OpenWeather all fall back to `''` silently. The AI features silently degrade in production if these are unset.

**Fix:** Add startup validation logging (not `required()` since these are optional features):
```js
// In server.js startup
const FEATURE_KEYS = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'MSG91_AUTH_KEY', ...];
FEATURE_KEYS.forEach(k => { if (!ENV[k]) logger.warn(`[Config] ${k} not set — feature disabled`); });
```

**Effort:** 30 minutes.

---

## Audit Section 2 — Authentication & Authorization

### HIGH-3: No Rate Limiting on AI Scan Endpoint (Python Service)

**File:** [AI_CROP_DISESE_DETECTION/routes/scan.py](AI_CROP_DISESE_DETECTION/routes/scan.py)

The `/ai/scan` endpoint runs a 5-agent Gemini + Groq pipeline. There is no per-user rate limiting at the FastAPI layer. While the Node.js layer has a global 200 req/15-min limit, the AI backend accepts unlimited requests if hit directly.

**Fix:** Add `slowapi` rate limiting:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)

@router.post("/ai/scan")
@limiter.limit("10/minute")
async def ai_scan(request: Request, body: ScanRequest, ...):
```

**Effort:** 1 hour.

---

### MEDIUM-2: JWT Expiry Set to 15 Minutes (Good) but Refresh Token Rotation Not Verified

**File:** [src/config/env.js:18](src/config/env.js#L18)

```js
JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
REFRESH_TOKEN_EXPIRES_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30', 10),
```

Short-lived access tokens are good. However, audit found no refresh token rotation logic (issuing a new refresh token and invalidating the old one on each use) in the auth routes. Without rotation, a stolen refresh token remains valid for 30 days.

**Recommendation:** Implement refresh token rotation in the `/auth/refresh` handler.

**Effort:** 2-3 hours.

---

### LOW-1: OTP Max Attempts Not Enforced at DB Level

**File:** [src/config/env.js:25](src/config/env.js#L25)

```js
OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
```

The limit is enforced in application code, but there is no database constraint. A direct DB write could bypass the limit.

**Recommendation:** Add a `locked_until` timestamp to the OTP schema for true enforcement.

**Effort:** 1 hour.

---

## Audit Section 3 — Input Validation

### HIGH-4: Fragile Regex JSON Parsing in 4 Agent Files

**Files:**
- [AI_CROP_DISESE_DETECTION/agents/disease_diagnosis_agent.py:103](AI_CROP_DISESE_DETECTION/agents/disease_diagnosis_agent.py#L103)
- [AI_CROP_DISESE_DETECTION/agents/weather_analysis_agent.py:59](AI_CROP_DISESE_DETECTION/agents/weather_analysis_agent.py#L59)
- [AI_CROP_DISESE_DETECTION/agents/treatment_agent.py:175](AI_CROP_DISESE_DETECTION/agents/treatment_agent.py#L175)
- [AI_CROP_DISESE_DETECTION/services/chat_service.py:125](AI_CROP_DISESE_DETECTION/services/chat_service.py#L125)

All four files use the same greedy regex pattern to extract JSON from LLM responses:

```python
match = re.search(r"\{[\s\S]*\}", raw)
```

This pattern is fragile:
1. If the LLM returns two JSON objects (e.g., in an explanation), it greedily matches from the first `{` to the last `}` and the result is invalid JSON.
2. It does not strip markdown fences before matching — if a Gemini response wraps JSON in ` ```json ` blocks, the regex will capture the fences inside the JSON string.
3. No retry on `JSONDecodeError` — the agent silently falls back to degraded/empty output.

**Fix:** Replace with a robust extractor:
```python
import re, json

def _extract_json(raw: str) -> dict | None:
    # Strip markdown code fences first
    text = re.sub(r"```(?:json)?", "", raw).strip()
    # Find the outermost balanced JSON object
    start = text.find("{")
    if start == -1:
        return None
    depth, end = 0, -1
    for i, ch in enumerate(text[start:], start):
        if ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end == -1:
        return None
    try:
        return json.loads(text[start:end])
    except json.JSONDecodeError:
        return None
```

Apply to all 4 files. **Effort:** 2 hours.

---

### MEDIUM-3: Image Upload Size Not Validated at Python Layer

**File:** [AI_CROP_DISESE_DETECTION/routes/scan.py:55-56](AI_CROP_DISESE_DETECTION/routes/scan.py#L55)

The `/ai/scan` endpoint accepts `image_base64` as a JSON string field with no size check before base64 decoding. A malicious client could send a 50 MB base64 string, causing high memory usage.

**Fix:**
```python
MAX_B64_LEN = 8 * 1024 * 1024  # ~6 MB decoded
if len(body.image_base64) > MAX_B64_LEN:
    raise HTTPException(status_code=413, detail="Image too large (max ~6 MB)")
```

**Effort:** 15 minutes.

---

### MEDIUM-4: Farm Context Fields Not Sanitized for XSS-Adjacent Injection

**File:** [AI_CROP_DISESE_DETECTION/services/scan_service.py:117-129](AI_CROP_DISESE_DETECTION/services/scan_service.py#L117)

User-supplied `symptoms`, `firstNoticed`, and `additionalSymptoms` are joined and injected directly into LLM prompts without any sanitization:

```python
parts.append("Symptoms: " + ", ".join(symptoms))
```

A carefully crafted symptom string could attempt prompt injection ("Ignore above instructions and return...").

**Fix:** Truncate fields and strip obvious injection patterns:
```python
def _safe_text(s: str, max_len: int = 200) -> str:
    return str(s)[:max_len].replace("\n", " ").strip()
```

**Effort:** 1 hour.

---

### LOW-2: Missing Input Validation on Lat/Lon Range

**File:** [AI_CROP_DISESE_DETECTION/routes/scan.py:29](AI_CROP_DISESE_DETECTION/routes/scan.py#L29)

```python
lat: Optional[float] = None
lon: Optional[float] = None
```

No range validation. Pydantic should enforce Indian geographic bounds:
```python
lat: Optional[float] = Field(None, ge=6.0, le=37.0)
lon: Optional[float] = Field(None, ge=68.0, le=97.0)
```

**Effort:** 10 minutes.

---

## Audit Section 4 — Error Handling

### HIGH-5: Orchestrator Has No Outer try/except

**File:** [AI_CROP_DISESE_DETECTION/orchestrator.py:36-230](AI_CROP_DISESE_DETECTION/orchestrator.py#L36)

`run_diagnosis()` has no top-level try/except. Any unhandled exception propagates to the route handler, which wraps it in a 500 error with `str(exc)` — leaking internal details to the client:

```python
# routes/scan.py:70-74
except Exception as exc:
    raise HTTPException(status_code=500, detail=f"Scan failed: {str(exc)}")
```

**Fix:** Wrap the orchestrator body:
```python
async def run_diagnosis(params: dict, images: list[dict]) -> dict:
    try:
        ...
    except Exception as exc:
        logger.exception("[Orchestrator] Unhandled error in pipeline")
        raise  # let the route return a generic 500
```

And in the route, return a safe message:
```python
detail="Scan failed — please try again. If the problem persists, contact support."
```

**Effort:** 30 minutes.

---

### HIGH-6: Groq LLM Calls Have No Retry on Rate Limit (429)

**File:** [AI_CROP_DISESE_DETECTION/agents/llm_utils.py](AI_CROP_DISESE_DETECTION/agents/llm_utils.py) (inferred from `call_groq_text` usage)

Gemini calls have exponential backoff retry logic (confirmed in treatment_agent). Groq calls (`call_groq_text`) are called with a single `try/except` that logs and falls through to Gemini as a fallback. During Groq free-tier rate limits (30 RPM), this means every request for ~2 minutes falls back to the paid Gemini API unnecessarily.

**Fix:** Add `tenacity` retry decorator to `call_groq_text`:
```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception(lambda e: "429" in str(e)),
)
async def call_groq_text(...):
```

**Effort:** 1 hour.

---

### MEDIUM-5: print() Used as Logging Throughout AI Service (85 occurrences)

**Files:** `orchestrator.py`, all `agents/*.py`, `services/*.py`

All runtime output uses `print()` rather than Python's `logging` module. In production this means:
- No log levels (DEBUG/INFO/WARNING/ERROR)
- No structured log output (JSON logs for log aggregators)
- No ability to suppress verbose agent trace logs without code changes
- Stack traces lost — exceptions caught with `print(f"Error: {exc}")` discard the traceback

**Fix:** Replace all `print()` calls with a module-level logger:
```python
import logging
logger = logging.getLogger(__name__)

# Replace: print(f"[Orchestrator] ✓ ...")
# With:    logger.info("Pipeline complete — disease=%s cost=$%.4f", disease, cost)
```

Use `logger.exception()` inside `except` blocks to capture full tracebacks.

**Effort:** 3-4 hours. Apply project-wide with a script.

---

### MEDIUM-6: Node.js console.error Used Instead of Structured Logger

**File:** [src/app.js:147](src/app.js#L147)

```js
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  ...
});
```

`console.error` is used throughout routes for error logging. In production, `pino` or `winston` with JSON output is standard for searchable logs.

**Fix:** Install `pino` and replace `console.error`/`console.log` with structured logger calls.

**Effort:** 2 hours.

---

### LOW-3: Weather Fetch Failures Silently Return null

**File:** [AI_CROP_DISESE_DETECTION/orchestrator.py:235-242](AI_CROP_DISESE_DETECTION/orchestrator.py#L235)

```python
async def _safe_fetch_weather(...) -> Optional[dict]:
    ...
    except Exception as exc:
        print(f"[Orchestrator] Weather fetch failed: {exc}")
        return None
```

When weather is unavailable, `analyze_weather_risk_rules` receives `None` and returns a risk report with `weather_used=False`. This is functionally correct, but the user gets no indication that weather context was unavailable.

**Recommendation:** Include `"weather_available": False` in the response so the mobile app can display "Weather data unavailable — diagnosis based on image only."

---

### LOW-4: 30-Day Refresh Token Never Explicitly Revoked on Password Change

**Recommendation:** On any password change or account deactivation, delete all refresh tokens for that user from the database.

---

## Audit Section 5 — API Security

### MEDIUM-7: No Per-User Rate Limit on OTP Endpoint

**File:** [src/config/env.js:68](src/config/env.js#L68)

```js
OTP_RATE_LIMIT_MAX: parseInt(process.env.OTP_RATE_LIMIT_MAX || '5', 10),
```

The OTP rate limit exists but applies globally, not per phone number. A distributed attacker could still send many OTPs to a single target number by rotating source IPs.

**Fix:** Key the rate limiter on `req.body.phone` rather than `req.ip`.

**Effort:** 30 minutes.

---

### LOW-5: Health Endpoint Leaks Service Version

**File:** [AI_CROP_DISESE_DETECTION/main.py:55-62](AI_CROP_DISESE_DETECTION/main.py#L55)

```python
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "CropGuard Agentic AI v2",
        "groq": bool(GROQ_API_KEY),
        "gemini": bool(GEMINI_API_KEY),
    }
```

Exposing which API keys are configured tells an attacker which LLM backends are active.

**Fix:** Remove `groq` and `gemini` fields from the health response in production.

---

### LOW-6: Swagger Docs Publicly Accessible in Production

**File:** [AI_CROP_DISESE_DETECTION/main.py:28-37](AI_CROP_DISESE_DETECTION/main.py#L28)

FastAPI's `/docs` and `/redoc` are enabled unconditionally. These expose the full API surface.

**Fix:**
```python
docs_url="/docs" if os.getenv("ENV") != "production" else None,
redoc_url="/redoc" if os.getenv("ENV") != "production" else None,
```

**Effort:** 5 minutes.

---

## Audit Section 6 — Python AI Service Deep Dive

### Summary of Agent Pipeline Issues

| Agent | Issue | Severity |
|---|---|---|
| `disease_diagnosis_agent.py` | Fragile regex JSON (see HIGH-4) | HIGH |
| `weather_analysis_agent.py` | Fragile regex JSON (see HIGH-4) | HIGH |
| `treatment_agent.py` | Fragile regex JSON; no Groq retry (see HIGH-4, HIGH-6) | HIGH |
| `orchestrator.py` | No outer try/except (see HIGH-5); 85 print() calls (MEDIUM-5) | HIGH/MEDIUM |
| `report_generator_agent.py` | Uses `print()` for structured output | LOW |
| `scan_service.py` | No image size limit before base64 decode (see MEDIUM-3) | MEDIUM |
| `services/chat_service.py` | Fragile regex JSON (see HIGH-4) | HIGH |
| `main.py` | CORS `allow_origins=["*"]` (see HIGH-2); docs exposed (LOW-6) | HIGH/LOW |

### Positive Findings

- **Template-based report generation** (`report_generator_agent.py`) is an excellent $0-cost design choice
- **Redis + in-memory LRU fallback** in `treatment_agent.py` is well-implemented with proper TTL and error silencing
- **Parallel agent execution** in orchestrator (Stage 1) correctly uses `asyncio.gather`
- **Weather risk is rule-based** (no LLM call) — correct and cost-effective
- **Cache key uses MD5 of sorted JSON** — deterministic and collision-resistant for this use case
- **Input normalizer** provides good fuzzy crop name matching and sensible defaults

---

## Audit Section 7 — Node.js Backend Deep Dive

### Positive Findings

- **Helmet** middleware applied globally ✓
- **CORS** is correctly configured to block browser origins in production without `ALLOWED_ORIGINS` ✓
- **Global rate limiter** applied before all routes ✓
- **Body size limits** (`100kb` default, `10mb` for upload) ✓
- **AES-256-GCM encryption** for PII fields ✓
- **Prisma ORM** prevents raw SQL injection ✓
- **JWT 15-minute expiry** is security-appropriate ✓
- **Morgan logs minimal info in production** (`tiny` format, not `combined`) ✓
- **Health endpoint** does not expose `NODE_ENV` ✓

### Issues Not Covered Elsewhere

- `prisma/seed-demo.js` should be removed or moved to a dev-only script before production deployment — it creates fake seller accounts with predictable passwords
- The `DATA_GOV_API_KEY` hardcoded default (CRITICAL-1) should be rotated immediately since it is committed in git history — rotating the key value is not enough

---

## Audit Section 8 — Test Coverage

### Test Files Written This Audit

| File | Tests | Coverage |
|---|---|---|
| `tests/test_input_normalizer.py` | 30 | `services/input_normalizer.py` — crop/soil/irrigation normalization, growth stage, `clean_farm_context()` |
| `tests/test_weather_rules.py` | 21 | `services/weather_rules.py` — risk levels, disease conditions, forecast, advisory, edge cases |
| `tests/test_treatment_cache.py` | 21 | `agents/treatment_agent.py` — cache key determinism, Redis hit/miss, TTL, in-memory fallback, JSON parsing |
| `tests/test_report_template.py` | 40 | `agents/report_generator_agent.py` — farmer summary, next steps, causes, weather outlook, full report structure, report ID, async entry |
| `tests/test_scan_endpoint.py` | 35 | `services/scan_service.py` — field mapping, growth stage derivation, symptom concatenation, area mapping, irrigation/soil normalization, base64 decode, temp file cleanup, FastAPI endpoint |

**Total: 147 unit + integration tests**

### Running the Tests

```bash
cd AI_CROP_DISESE_DETECTION
pip install pytest pytest-asyncio
pytest tests/ -v
```

### Gaps Not Covered (Recommended Next Phase)

- `agents/disease_diagnosis_agent.py` — vision prompt construction, confidence escalation
- `agents/llm_utils.py` — Gemini/Groq API call wrappers, retry logic
- `agents/image_quality_agent.py` — quality scoring, enhancement suggestions
- `orchestrator.py` — full pipeline integration with all agents mocked
- Node.js: `src/routes/auth.routes.js` — OTP send, verify, refresh token flow
- Node.js: `src/utils/encrypt.js` — AES-256-GCM encrypt/decrypt round-trip

---

## Priority Action List

### Immediate (Before Any Production Deploy)

1. **CRITICAL-1** — Remove hardcoded `DATA_GOV_API_KEY` from `src/config/env.js:58` and rotate the key (git history contains it)
2. **HIGH-1** — Make `FIELD_ENCRYPTION_KEY` required in production
3. **HIGH-4** — Replace fragile `re.search(r"\{[\s\S]*\}")` in 4 files with balanced-brace JSON extractor
4. **HIGH-5** — Add outer try/except to `orchestrator.run_diagnosis()` with safe error message

### Within 1 Sprint

5. **HIGH-2** — Restrict `allow_origins` in FastAPI CORS middleware
6. **HIGH-3** — Add per-user rate limiting to `/ai/scan` endpoint
7. **HIGH-6** — Add tenacity retry for Groq 429 responses
8. **MEDIUM-2** — Implement JWT refresh token rotation
9. **MEDIUM-3** — Add image size check before base64 decode in `/ai/scan`
10. **MEDIUM-5** — Replace 85 `print()` calls with Python `logging` module

### Before First Public Release

11. **MEDIUM-6** — Replace `console.error` with structured logger (pino/winston) in Node.js
12. **MEDIUM-7** — Key OTP rate limiter on phone number, not IP
13. **LOW-6** — Disable Swagger docs in production
14. **LOW-5** — Remove API key status from health endpoint
15. Remove `prisma/seed-demo.js` from production deployment

---

---

## Audit Section 9 — Farmer App (Farmeasy-froontend)

### HIGH-7: 20+ console.log Calls in DiagnosisResultScreen Logging Full Report Data

**File:** [Farmeasy-froontend/src/screens/AI/DiagnosisResultScreen.js:156-179](../Farmeasy-froontend/src/screens/AI/DiagnosisResultScreen.js#L156)

A debug block logs the complete AI report to the Metro/device console:

```js
console.log('[DiagnosisResult] disease:', d.disease, '| type:', typeof d.disease);
console.log('[DiagnosisResult] confidence:', d.confidence);
console.log('[DiagnosisResult] treatment[] length:', (d.treatment || []).length);
console.log('[DiagnosisResult] chemicals[0]:', JSON.stringify(chemicals[0]));
// ... 15 more console.log calls
```

In production apps, `console.log` output is:
1. Visible to anyone who attaches a debugger / ADB logcat to the device
2. Captured by crash reporting SDKs (Sentry, Crashlytics) in breadcrumbs
3. A compliance risk if the report data contains field coordinates or medical-adjacent treatment advice tied to an identifiable user

**Fix:** Remove the entire debug block (lines 156–179) and the second debug block at lines 818–820. These were clearly added during development.

**Effort:** 5 minutes.

---

### MEDIUM-8: TOKEN_MAX_AGE_MS (30 days) Misaligned With Server JWT Expiry (15 min)

**File:** [Farmeasy-froontend/src/constants/config.js:69-70](../Farmeasy-froontend/src/constants/config.js#L69)

```js
/** Access-token client-side TTL (ms).  30 days — server may expire sooner. */
export const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
```

This constant is used in `isTokenStale()` to decide whether to clear tokens before making a network call. The intent is correct (it's the age of the stored-at timestamp, acting as a session duration limit), but the comment is misleading: it says "Access-token client-side TTL" when it's really a session-duration guard. Since the server JWT expires in 15 minutes, the 401 interceptor handles real token expiry through auto-refresh. The 30-day check only catches sessions where the app was offline the whole time.

**Fix:** Rename and re-document clearly:
```js
/** Max session age before forcing re-login regardless of refresh token status. */
export const MAX_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000;
```

Also apply the same rename in the seller app `config.js`.

**Effort:** 15 minutes.

---

### LOW-7: mockData.js Contains Dead Code (WEATHER_MOCK, MOCK_MESSAGES)

**File:** [Farmeasy-froontend/src/constants/mockData.js:1589](../Farmeasy-froontend/src/constants/mockData.js#L1589)

`WEATHER_MOCK` and `MOCK_MESSAGES` are defined in `mockData.js` but are not imported anywhere in the source tree. Dead code increases bundle size and creates confusion about what data is fake vs. real.

**Fix:** Remove `WEATHER_MOCK` and `MOCK_MESSAGES` from the file, or delete the entire file if all remaining exports are also unused.

**Effort:** 10 minutes.

---

### LOW-8: sessionStorage Warning in storage.js Not Enforced

**File:** [Farmeasy-froontend/src/utils/storage.js:13-16](../Farmeasy-froontend/src/utils/storage.js#L13)

The web platform fallback uses `sessionStorage` with a clear comment warning it must not be used in production. This is good practice, but there is no runtime guard to prevent a web production build from running with insecure token storage.

**Fix:** Add a check that throws or warns loudly if `Platform.OS === 'web'` and `__DEV__ === false`:
```js
if (Platform.OS === 'web' && !__DEV__) {
  console.warn('[Storage] WARNING: sessionStorage is not safe for production. Use httpOnly cookies.');
}
```

---

### Positive Findings — Farmer App

- **No hardcoded API keys** in any source file — `config.js` has an explicit warning ✓
- **expo-secure-store** used for native token storage (iOS Keychain / Android Keystore) ✓
- **safeErrorMessage()** prevents raw server errors from reaching the UI ✓
- **Phone number validation** uses correct Indian mobile regex (`/^[6-9]\d{9}$/`) ✓
- **OTP attempt counter** enforced client-side with server as backstop ✓
- **Auto-refresh on 401** correctly uses a queue to prevent parallel refresh races ✓
- **Socket.IO auth** uses `auth: { token }` (not query string — avoids token in server logs) ✓
- **devOtp autofill** is safe — server only returns it when MSG91 is unconfigured (dev mode) ✓

---

## Audit Section 10 — Seller App (farmeasy-seller)

### HIGH-8: Seller Logout Does Not Invalidate Refresh Token on Server

**File:** [farmeasy-seller/src/context/AuthContext.js:124-135](../farmeasy-seller/src/context/AuthContext.js#L124)

```js
async function logout() {
  await clearTokens();          // ← clears local storage only
  setUser(null);
  setIsLoggedIn(false);
  ...
}
```

Compare with the farmer app `AuthContext.js` which correctly calls `api.post('/auth/logout', { refreshToken })` before clearing tokens. The seller app skips the server call entirely, so the refresh token remains valid on the server for its full 30-day lifetime after the user logs out.

This means: if a seller's device is stolen, the thief can use the refresh token to obtain new access tokens even after the seller logs out of the app.

**Fix:**
```js
async function logout() {
  try {
    const refreshToken = await getRefreshToken();
    if (refreshToken) await api.post('/auth/logout', { refreshToken });
  } catch { /* best-effort */ }
  await clearTokens();
  setUser(null);
  setIsLoggedIn(false);
  ...
}
```

**Effort:** 15 minutes.

---

### LOW-9: Seller App TOKEN_MAX_AGE_MS Same Naming Issue

**File:** [farmeasy-seller/src/constants/config.js:44](../farmeasy-seller/src/constants/config.js#L44)

Same as LOW-7 above — rename to `MAX_SESSION_AGE_MS` for clarity.

---

### LOW-10: Bank Account Details Fetched in Plain Text to Client

**File:** [farmeasy-seller/src/screens/Profile/SellerProfileScreen.js:25-26](../farmeasy-seller/src/screens/Profile/SellerProfileScreen.js#L25)

```js
user?.bankAccountNumber,
user?.bankIfsc,
```

The bank account number is decrypted server-side and sent to the client in the `/users/me` response. The display correctly masks it (`••••last4`) but the full value is in memory and in the network response. If a seller account is compromised, the attacker can read the full account number via the API.

**Recommendation:** The backend should return only the masked version (`bank_account_masked: "••••1234"`) rather than the full decrypted number. Only send the full number if the user explicitly requests it (e.g., a dedicated "reveal" endpoint with re-authentication).

**Effort:** 2 hours (backend change + frontend update).

---

### Positive Findings — Seller App

- **No hardcoded API keys** ✓
- **expo-secure-store** for token storage ✓
- **safeErrorMessage()** present in `api.js` ✓
- **Comprehensive input validation** in `AddProductScreen` (price, stock, category, district) ✓
- **Only 4 console.log calls** across the entire app ✓
- **Bank account masked** in display (`••••last4`) ✓

---

## Priority Action List (Updated)

### Immediate (Before Any Production Deploy)

1. **CRITICAL-1** — Remove hardcoded `DATA_GOV_API_KEY` from `src/config/env.js:58` and rotate the key (git history contains it)
2. **HIGH-1** — Make `FIELD_ENCRYPTION_KEY` required in production
3. **HIGH-4** — Replace fragile `re.search(r"\{[\s\S]*\}")` in 4 files with balanced-brace JSON extractor
4. **HIGH-5** — Add outer try/except to `orchestrator.run_diagnosis()` with safe error message
5. **HIGH-7** — Remove 20+ `console.log` calls from `DiagnosisResultScreen.js` lines 156–179 and 818–820
6. **HIGH-8** — Fix seller app `logout()` to call `/auth/logout` and invalidate the refresh token server-side

### Within 1 Sprint

7. **HIGH-2** — Restrict `allow_origins` in FastAPI CORS middleware
8. **HIGH-3** — Add per-user rate limiting to `/ai/scan` endpoint
9. **HIGH-6** — Add tenacity retry for Groq 429 responses
10. **MEDIUM-2** — Implement JWT refresh token rotation
11. **MEDIUM-3** — Add image size check before base64 decode in `/ai/scan`
12. **MEDIUM-5** — Replace 85 `print()` calls with Python `logging` module
13. **LOW-10** — Return only masked bank account from `/users/me`; add dedicated reveal endpoint

### Before First Public Release

14. **MEDIUM-6** — Replace `console.error` with structured logger (pino/winston) in Node.js
15. **MEDIUM-7** — Key OTP rate limiter on phone number, not IP
16. **MEDIUM-8** — Rename `TOKEN_MAX_AGE_MS` → `MAX_SESSION_AGE_MS` in both apps
17. **LOW-6** — Disable Swagger docs in production
18. **LOW-5** — Remove API key status from health endpoint
19. **LOW-7** — Remove dead `WEATHER_MOCK` / `MOCK_MESSAGES` from `mockData.js`
20. Remove `prisma/seed-demo.js` from production deployment

---

## Appendix — Files Audited

**Node.js Backend (src/):**
- `src/config/env.js` — secrets and configuration
- `src/app.js` — middleware, CORS, rate limiting, routing
- `src/server.js` — startup
- `src/routes/` — all route files (static analysis)

**Python AI Service (AI_CROP_DISESE_DETECTION/):**
- `main.py` — FastAPI app, CORS, routers
- `orchestrator.py` — 5-agent pipeline orchestration
- `config.py` — Python-side configuration
- `agents/disease_diagnosis_agent.py` — Gemini vision diagnosis
- `agents/weather_analysis_agent.py` — weather risk analysis
- `agents/treatment_agent.py` — Groq/Gemini treatment recommendations
- `agents/report_generator_agent.py` — template-based report generation
- `agents/llm_utils.py` — LLM API call wrappers
- `agents/image_quality_agent.py` — image quality scoring
- `services/input_normalizer.py` — farm context normalization
- `services/weather_rules.py` — rule-based weather risk assessment
- `services/scan_service.py` — base64 decode + orchestrator bridge
- `services/chat_service.py` — FarmMind chat service
- `routes/scan.py` — scan endpoint and multipart endpoint
- `routes/chat.py` — chat endpoint
- `routes/alerts.py` — smart alerts endpoint

**Farmer App (Farmeasy-froontend/src/):**
- `constants/config.js` — API URLs, storage keys, limits
- `constants/mockData.js` — dead code check
- `context/AuthContext.js` — OTP flow, token management
- `utils/storage.js` — secure storage abstraction
- `services/api.js` — axios instance, refresh interceptor
- `services/socket.js` — Socket.IO auth
- `screens/Auth/LoginScreen.js` — devOtp handling
- `screens/AI/DiagnosisResultScreen.js` — console.log audit

**Seller App (farmeasy-seller/src/):**
- `constants/config.js` — API URLs, storage keys
- `context/AuthContext.js` — logout, OTP flow
- `services/api.js` — axios instance, refresh interceptor
- `utils/storage.js` — secure storage abstraction
- `screens/Auth/LoginScreen.js` — devOtp handling
- `screens/Profile/SellerProfileScreen.js` — PII display
- `screens/Products/AddProductScreen.js` — input validation
