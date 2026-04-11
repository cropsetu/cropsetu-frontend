/**
 * Market Price Routes
 * GET /api/v1/market/prices?crop=Tomato&state=Maharashtra          — current prices (AI)
 * GET /api/v1/market/predict?crop=Tomato&state=Maharashtra         — 7-day prediction (AI)
 * GET /api/v1/market/forecast?crop=Tomato&state=Maharashtra&period=3m — 3/6/12-month forecast (AI)
 * GET /api/v1/market/crops                                         — supported crops + states list
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import {
  getMarketPrices,
  getPricePrediction,
  getExtendedForecast,
  SUPPORTED_CROPS,
  SUPPORTED_STATES,
  SUPPORTED_PERIODS,
} from '../services/market.data.service.js';

const router = Router();

// ── GET /api/v1/market/prices ─────────────────────────────────────────────────
router.get('/prices', authenticate, async (req, res) => {
  const crop  = req.query.crop   || 'Tomato';
  const state = req.query.state  || req.user.state || 'Maharashtra';
  const city  = req.query.city   || req.user.city  || null;

  if (!crop || typeof crop !== 'string' || crop.trim().length === 0 || crop.length > 60) {
    return sendError(res, 'Invalid crop name', 400);
  }

  try {
    const data = await getMarketPrices(crop, state, city);
    return sendSuccess(res, data);
  } catch (err) {
    console.error('[Market]', err.message);
    return sendError(res, 'Market data unavailable. Please try again.', 503);
  }
});

// ── GET /api/v1/market/predict ────────────────────────────────────────────────
router.get('/predict', authenticate, async (req, res) => {
  const crop  = req.query.crop  || 'Tomato';
  const state = req.query.state || req.user.state || 'Maharashtra';

  if (!crop || typeof crop !== 'string' || crop.trim().length === 0 || crop.length > 60) {
    return sendError(res, 'Invalid crop name', 400);
  }

  try {
    const data = await getPricePrediction(crop, state);
    return sendSuccess(res, data);
  } catch (err) {
    console.error('[Market Predict]', err.message);
    return sendError(res, 'Price prediction unavailable. Please try again.', 503);
  }
});

// ── GET /api/v1/market/forecast ───────────────────────────────────────────────
// period: 3m | 6m | 12m — returns monthly price breakdown
router.get('/forecast', authenticate, async (req, res) => {
  const crop   = req.query.crop   || 'Tomato';
  const state  = req.query.state  || req.user.state || 'Maharashtra';
  const period = req.query.period || '3m';

  if (!crop || typeof crop !== 'string' || crop.trim().length === 0 || crop.length > 60) {
    return sendError(res, 'Invalid crop name', 400);
  }
  if (!['3m', '6m', '12m'].includes(period)) {
    return sendError(res, 'period must be 3m, 6m, or 12m', 400);
  }

  try {
    const data = await getExtendedForecast(crop, state, period);
    return sendSuccess(res, data);
  } catch (err) {
    console.error('[Market Forecast]', err.message);
    return sendError(res, 'Extended forecast unavailable. Please try again.', 503);
  }
});

// ── GET /api/v1/market/crops ──────────────────────────────────────────────────
router.get('/crops', (_req, res) => {
  return sendSuccess(res, { crops: SUPPORTED_CROPS, states: SUPPORTED_STATES, periods: SUPPORTED_PERIODS });
});

export default router;
