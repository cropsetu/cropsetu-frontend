/**
 * Crop Disease Prediction Routes — FarmEasy Krishi Raksha
 * POST /api/v1/crop-disease/predict
 * Accepts multipart/form-data (with optional images) OR JSON.
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';

import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { getWeatherData } from '../services/weather.service.js';
import { getSoilData } from '../services/soildata.service.js';
import { predictCropDisease } from '../services/ai.predict.service.js';

const router = Router();

// ─── Multer — store to OS temp dir ───────────────────────────────────────────
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },  // 5 MB per image, max 3
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ─── Cleanup temp files ───────────────────────────────────────────────────────
function cleanupFiles(files = []) {
  files.forEach((f) => {
    try { fs.unlinkSync(f.path); } catch { /* ignore */ }
  });
}

// ─── POST /api/v1/crop-disease/predict ───────────────────────────────────────
router.post(
  '/predict',
  authenticate,
  upload.array('images', 3),
  async (req, res) => {
    const uploadedFiles = req.files || [];

    try {
      // ── 1. Parse body fields (supports both JSON body and multipart) ────────
      const body = req.body;

      const {
        pincode,
        cropType,
        growthStage,
        variety,
        sowingDate,
        fieldArea,
        irrigationMethod,
        lastIrrigatedDate,
        fertilizerType,
        prevCrop,
        waterQuality,
        soilPh,
        organicCarbon,
        nitrogenLevel,
        phosphorusLevel,
        potassiumLevel,
        soilMoisture,
        lastFungicideDate,
      } = body;

      // Parse symptoms (may be JSON string or comma-separated)
      let symptoms = body.symptoms || [];
      if (typeof symptoms === 'string') {
        try {
          symptoms = JSON.parse(symptoms);
        } catch {
          symptoms = symptoms.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }

      // ── 2. Validate required fields ────────────────────────────────────────
      if (!pincode || !cropType || !growthStage) {
        cleanupFiles(uploadedFiles);
        return sendError(res, 'pincode, cropType, and growthStage are required', 400);
      }

      const pincodeNum = String(pincode).replace(/\D/g, '');
      if (pincodeNum.length !== 6) {
        cleanupFiles(uploadedFiles);
        return sendError(res, 'Invalid pincode — must be 6 digits', 400);
      }

      // ── 3. Fetch weather + soil data in parallel ───────────────────────────
      const [weatherData, soilData] = await Promise.allSettled([
        getWeatherData(pincodeNum),
        Promise.resolve(getSoilData(pincodeNum)),
      ]);

      const weather = weatherData.status === 'fulfilled' ? weatherData.value : null;
      const soil = soilData.status === 'fulfilled' ? soilData.value : null;

      if (!weather) {
        // Weather is important but not fatal — AI can still work with soil data
        console.warn('[CropDisease] Weather fetch failed:', weatherData.reason?.message);
      }

      // ── 4. Call AI prediction ──────────────────────────────────────────────
      const imagePaths = uploadedFiles.map((f) => f.path);

      const prediction = await predictCropDisease(
        {
          pincode: pincodeNum,
          cropType, growthStage, variety, sowingDate, fieldArea,
          irrigationMethod, lastIrrigatedDate, fertilizerType, prevCrop, waterQuality,
          soilPh, organicCarbon, nitrogenLevel, phosphorusLevel, potassiumLevel, soilMoisture,
          lastFungicideDate, symptoms,
          weather, soilData: soil,
        },
        imagePaths,
      );

      // ── 5. Cleanup temp images ─────────────────────────────────────────────
      cleanupFiles(uploadedFiles);

      // ── 6. Return enriched response ────────────────────────────────────────
      return sendSuccess(res, {
        ...prediction,
        weatherSummary: weather
          ? {
              current: {
                temp: weather.current.temp,
                humidity: weather.current.humidity,
                weatherDesc: weather.current.weatherDesc,
                windSpeed: weather.current.windSpeed,
                dewPoint: weather.current.dewPoint,
              },
              riskLevel: weather.weatherRisk.riskLevel,
              riskFactors: weather.weatherRisk.riskFactors,
              forecast3Days: weather.forecast.slice(0, 3),
            }
          : null,
        soilSummary: soil
          ? {
              district: soil.district,
              zone: `Zone ${soil.agroClimaticZone.id} — ${soil.agroClimaticZone.name}`,
              soilType: soil.soil.soilType,
              avgPH: soil.soil.soilPH?.avg,
              organicCarbon: soil.soil.organicCarbon?.avg,
              kvkContact: soil.kvkContact,
            }
          : null,
      });
    } catch (err) {
      cleanupFiles(uploadedFiles);
      console.error('[CropDisease] Prediction error:', err.message);

      if (err.message?.includes('AI key configured')) {
        return sendError(res, 'AI service not configured. Set GEMINI_API_KEY in .env (free).', 503);
      }
      if (err.status === 429) {
        return sendError(res, 'AI service rate limit reached. Please try again in a moment.', 429);
      }

      return sendError(res, 'Prediction failed. Please try again.', 500);
    }
  },
);

// ─── GET /api/v1/crop-disease/soil-info?pincode=413704 ───────────────────────
// Quick endpoint to preview soil data for a pincode (no AI, no auth needed)
router.get('/soil-info', async (req, res) => {
  const { pincode } = req.query;
  if (!pincode || String(pincode).length !== 6) {
    return sendError(res, 'Valid 6-digit pincode required', 400);
  }
  const soilData = getSoilData(pincode);
  return sendSuccess(res, soilData);
});

// ─── GET /api/v1/crop-disease/weather?pincode=413704 ─────────────────────────
// Quick endpoint to check weather for a pincode
router.get('/weather', authenticate, async (req, res) => {
  const { pincode } = req.query;
  if (!pincode || String(pincode).length !== 6) {
    return sendError(res, 'Valid 6-digit pincode required', 400);
  }
  try {
    const weatherData = await getWeatherData(pincode);
    return sendSuccess(res, weatherData);
  } catch (err) {
    return sendError(res, err.message, 503);
  }
});

export default router;
