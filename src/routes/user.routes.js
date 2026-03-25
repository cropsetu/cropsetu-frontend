/**
 * User Routes
 * GET  /api/v1/users/me           → get own profile
 * PUT  /api/v1/users/me           → update name, avatar, language
 * PUT  /api/v1/users/me/farm      → upsert farm details
 * POST /api/v1/users/me/push-token → register Expo push token
 */
import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createUploader, uploadFiles } from '../config/cloudinary.js';
import prisma from '../config/db.js';
import {
  sendSuccess, sendError, sendNotFound,
} from '../utils/response.js';

const router = Router();
router.use(authenticate); // all user routes require auth

const avatarUpload = createUploader(1);

// ── GET /me ───────────────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true, phone: true, name: true, avatar: true,
      role: true, language: true, createdAt: true,
      statusQuote: true, district: true, city: true,
      pincode: true, state: true, isOnline: true, lastSeenAt: true,
      farmDetail: true,
      _count: {
        select: {
          orders: true,
          animalListings: true,
          posts: true,
          bookings: true,
        },
      },
    },
  });

  if (!user) return sendNotFound(res, 'User');
  return sendSuccess(res, user);
});

// ── PUT /me ───────────────────────────────────────────────────────────────────
router.put(
  '/me',
  (req, res, next) => avatarUpload(req, res, (err) => {
    if (err) return sendError(res, err.message, 400);
    next();
  }),
  [
    body('name').optional().trim().isLength({ min: 2, max: 80 }),
    body('language').optional().isIn(['en', 'hi', 'mr']),
    body('statusQuote').optional().trim().isLength({ max: 200 }),
    body('district').optional().trim().isLength({ max: 100 }),
    body('city').optional().trim().isLength({ max: 100 }),
    body('state').optional().trim().isLength({ max: 100 }),
    body('pincode').optional().matches(/^\d{6}$/),
  ],
  validate,
  async (req, res) => {
    const { name, language, statusQuote, district, city, pincode, state } = req.body;
    const urls = await uploadFiles(req.files || [], 'avatars');
    const avatar = urls[0] || undefined;

    const data = {};
    if (name)        data.name        = name;
    if (language)    data.language    = language;
    if (avatar)      data.avatar      = avatar;
    if (statusQuote !== undefined) data.statusQuote = statusQuote;
    if (district)    data.district    = district;
    if (city)        data.city        = city;
    if (state)       data.state       = state;
    if (pincode)     data.pincode     = pincode;

    if (!Object.keys(data).length) {
      return sendError(res, 'No fields to update', 400);
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true, phone: true, name: true, avatar: true, language: true, role: true,
        statusQuote: true, district: true, city: true, pincode: true, state: true,
      },
    });

    return sendSuccess(res, user);
  }
);

// ── PUT /me/farm ──────────────────────────────────────────────────────────────
router.put(
  '/me/farm',
  [
    body('village').optional().trim().isLength({ max: 100 }),
    body('district').optional().trim().isLength({ max: 100 }),
    body('state').optional().trim().isLength({ max: 100 }),
    body('pincode').optional().matches(/^\d{6}$/),
    body('landAcres').optional().isFloat({ min: 0 }),
    body('cropTypes').optional().isArray(),
    body('soilType').optional().trim(),
    body('irrigationType').optional().trim(),
  ],
  validate,
  async (req, res) => {
    const { village, district, state, pincode, landAcres, cropTypes, soilType, irrigationType } = req.body;

    const farm = await prisma.farmDetail.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        village, district, state, pincode,
        landAcres: landAcres ? parseFloat(landAcres) : undefined,
        cropTypes: cropTypes || [],
        soilType, irrigationType,
      },
      update: {
        ...(village         !== undefined && { village }),
        ...(district        !== undefined && { district }),
        ...(state           !== undefined && { state }),
        ...(pincode         !== undefined && { pincode }),
        ...(landAcres       !== undefined && { landAcres: parseFloat(landAcres) }),
        ...(cropTypes       !== undefined && { cropTypes }),
        ...(soilType        !== undefined && { soilType }),
        ...(irrigationType  !== undefined && { irrigationType }),
      },
    });

    return sendSuccess(res, farm);
  }
);

// ── POST /me/push-token ────────────────────────────────────────────────────────
router.post(
  '/me/push-token',
  [
    body('token').notEmpty().withMessage('Expo push token required'),
    body('platform').isIn(['ios', 'android']).withMessage('platform must be ios or android'),
  ],
  validate,
  async (req, res) => {
    const { token, platform } = req.body;

    await prisma.pushToken.upsert({
      where: { token },
      create: { token, userId: req.user.id, platform },
      update: { userId: req.user.id },
    });

    return sendSuccess(res, { registered: true });
  }
);

export default router;
