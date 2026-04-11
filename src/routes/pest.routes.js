/**
 * Pest Alert Routes
 *
 * GET  /api/v1/pest/alerts?lat=18.52&lon=73.85&crops=soybean,tur
 * GET  /api/v1/pest/alerts/:id
 * GET  /api/v1/pest/forecast?district=Pune&crop=soybean
 * POST /api/v1/pest/report        — farmer reports a pest sighting
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { isEnabled } from '../services/featureFlag.service.js';
import { generatePestAlerts } from '../services/pestRisk.service.js';
import prisma from '../config/db.js';

const router = Router();

// ── GET /api/v1/pest/alerts ───────────────────────────────────────────────────
// Live weather-based risk assessment OR cached DB alerts for the area
router.get('/alerts', authenticate, async (req, res) => {
  if (!await isEnabled('pest_alerts')) {
    return sendError(res, 'कीट चेतावनी सेवा अभी उपलब्ध नहीं है।', 503);
  }

  const lat      = parseFloat(req.query.lat      || '18.52');
  const lon      = parseFloat(req.query.lon      || '73.85');
  const state    = req.query.state    || req.user?.state    || 'Maharashtra';
  const district = req.query.district || req.user?.district || 'Pune';
  const cropsRaw = req.query.crops    || '';
  const dayOfSeason = parseInt(req.query.dayOfSeason || '45', 10);
  const crops    = cropsRaw ? cropsRaw.split(',').map(c => c.trim()) : [];

  if (isNaN(lat) || isNaN(lon)) return sendError(res, 'Valid lat and lon are required', 400);

  // Check for existing DB alerts (within last 24 hours) for this area
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existingAlerts = await prisma.pestAlert.findMany({
    where: {
      state:     { contains: state, mode: 'insensitive' },
      isActive:  true,
      validUntil: { gt: new Date() },
      createdAt: { gte: since },
    },
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
  });

  // Severity sort: critical first
  const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
  existingAlerts.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

  if (existingAlerts.length > 0) {
    return sendSuccess(res, existingAlerts, 200, {
      source: 'cached', generatedAt: existingAlerts[0].createdAt, attribution: 'स्रोत: Open-Meteo + ICAR NCIPM नियम',
    });
  }

  // Generate fresh alerts via risk engine
  const freshAlerts = await generatePestAlerts({ lat, lon, state, district, crops, dayOfSeason });

  if (!freshAlerts.length) {
    return sendSuccess(res, [], 200, {
      message: '✅ वर्तमान मौसम में कोई सक्रिय कीट जोखिम नहीं है।',
      source: 'Open-Meteo + ICAR rules',
      attribution: 'स्रोत: Open-Meteo + ICAR NCIPM नियम',
    });
  }

  // Persist to DB for caching
  const saved = [];
  for (const alert of freshAlerts) {
    const record = await prisma.pestAlert.create({ data: alert }).catch(() => null);
    if (record) saved.push(record);
  }

  saved.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));
  return sendSuccess(res, saved, 200, {
    source: 'live', generatedAt: new Date(), attribution: 'स्रोत: Open-Meteo + ICAR NCIPM नियम',
  });
});

// ── GET /api/v1/pest/alerts/:id ───────────────────────────────────────────────
router.get('/alerts/:id', authenticate, async (req, res) => {
  const alert = await prisma.pestAlert.findUnique({ where: { id: req.params.id } });
  if (!alert) return sendError(res, 'Pest alert not found', 404);
  return sendSuccess(res, alert);
});

// ── GET /api/v1/pest/forecast ─────────────────────────────────────────────────
// Returns upcoming 7-day pest risk for a specific crop and district
router.get('/forecast', authenticate, async (req, res) => {
  if (!await isEnabled('pest_alerts')) return sendError(res, 'कीट चेतावनी सेवा अभी उपलब्ध नहीं है।', 503);

  const district    = req.query.district || req.user?.district || 'Pune';
  const crop        = req.query.crop     || 'soybean';
  const dayOfSeason = parseInt(req.query.dayOfSeason || '45', 10);

  // Get alerts from DB for this crop + district (last 7 days)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const alerts = await prisma.pestAlert.findMany({
    where: {
      districts: { has: district },
      affectedCrops: { has: crop.toLowerCase() },
      isActive:  true,
      validUntil: { gt: new Date() },
    },
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    take: 10,
  });

  return sendSuccess(res, alerts, 200, {
    district, crop, dayOfSeason, attribution: 'स्रोत: Open-Meteo + ICAR NCIPM नियम',
  });
});

// ── POST /api/v1/pest/report ──────────────────────────────────────────────────
// Farmer reports a pest sighting (community crowdsourcing)
router.post('/report', authenticate, async (req, res) => {
  const { pest, crop, description, severity, district, state } = req.body;

  if (!pest || !crop) return sendError(res, 'pest and crop are required', 400);

  const report = await prisma.pestAlert.create({
    data: {
      pest:          pest.trim(),
      pestHi:        null,
      affectedCrops: [crop.trim().toLowerCase()],
      severity:      ['low', 'moderate', 'high', 'critical'].includes(severity) ? severity : 'moderate',
      state:         state || req.user?.state    || 'Maharashtra',
      districts:     [district || req.user?.district || ''],
      symptoms:      description ? [{ description, descriptionHi: '' }] : [],
      solutions:     {},
      validFrom:     new Date(),
      validUntil:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      source:        'farmer_report',
      isActive:      true,
    },
  });

  return sendSuccess(res, report, 201);
});

export default router;
