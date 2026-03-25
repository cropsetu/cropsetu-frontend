/**
 * Animal Trade Routes
 * GET    /api/v1/animals             ?animal&search&minPrice&maxPrice&page&limit
 * GET    /api/v1/animals/:id
 * POST   /api/v1/animals             (auth, multipart)
 * PUT    /api/v1/animals/:id         (auth, owner)
 * DELETE /api/v1/animals/:id         (auth, owner)
 * GET    /api/v1/animals/my          (auth) — my listings
 * GET    /api/v1/animals/:id/chats   (auth) — chat list for a listing
 * POST   /api/v1/animals/:id/chat    (auth) — initiate chat
 * GET    /api/v1/chats/:chatId/messages
 * POST   /api/v1/chats/:chatId/messages { text }
 */
import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createUploader, uploadFiles } from '../config/cloudinary.js';
import prisma from '../config/db.js';
import {
  sendSuccess, sendCreated, sendError, sendNotFound, sendForbidden, paginationMeta,
} from '../utils/response.js';

const router = Router();
const imageUpload = createUploader(8);

// ── Listings ──────────────────────────────────────────────────────────────────
router.get(
  '/',
  optionalAuth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('minPrice').optional().isFloat({ min: 0 }),
    query('maxPrice').optional().isFloat({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    const page  = parseInt(req.query.page  || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const { animal, search, minPrice, maxPrice, district } = req.query;

    const where = { status: 'ACTIVE' };
    if (animal)   where.animal = { equals: animal, mode: 'insensitive' };
    if (district) where.district = { contains: district, mode: 'insensitive' };
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    if (search) {
      where.OR = [
        { animal: { contains: search, mode: 'insensitive' } },
        { breed:  { contains: search, mode: 'insensitive' } },
        { sellerLocation: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [listings, total] = await Promise.all([
      prisma.animalListing.findMany({
        where,
        include: {
          seller: { select: { id: true, name: true, avatar: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ verified: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.animalListing.count({ where }),
    ]);

    return sendSuccess(res, listings, 200, paginationMeta(total, page, limit));
  }
);

router.get('/my', authenticate, async (req, res) => {
  const listings = await prisma.animalListing.findMany({
    where: { sellerId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  return sendSuccess(res, listings);
});

router.get('/:id', async (req, res) => {
  const listing = await prisma.animalListing.findUnique({
    where: { id: req.params.id },
    include: {
      seller: { select: { id: true, name: true, avatar: true, phone: true } },
    },
  });
  if (!listing) return sendNotFound(res, 'Animal listing');

  // Increment view count (fire-and-forget)
  prisma.animalListing.update({
    where: { id: listing.id },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {});

  return sendSuccess(res, listing);
});

router.post(
  '/',
  authenticate,
  (req, res, next) => imageUpload(req, res, (err) => {
    if (err) return sendError(res, err.message, 400);
    next();
  }),
  [
    body('animal').notEmpty().trim(),
    body('breed').notEmpty().trim(),
    body('age').notEmpty().trim(),
    body('gender').isIn(['MALE', 'FEMALE']),
    body('weight').notEmpty().trim(),
    body('price').isFloat({ min: 0 }),
    body('sellerLocation').notEmpty().trim(),
    body('tags').optional().isArray(),
    body('milkYield').optional().trim(),
    body('description').optional().trim(),
  ],
  validate,
  async (req, res) => {
    const images = await uploadFiles(req.files || [], 'animals');
    const { animal, breed, age, gender, weight, price, milkYield, description, sellerLocation, tags } = req.body;

    const listing = await prisma.animalListing.create({
      data: {
        sellerId: req.user.id,
        animal, breed, age,
        gender: gender,
        weight,
        price: parseFloat(price),
        milkYield: milkYield || null,
        description,
        sellerLocation,
        images,
        tags: tags || [],
      },
    });

    return sendCreated(res, listing);
  }
);

router.put(
  '/:id',
  authenticate,
  (req, res, next) => imageUpload(req, res, (err) => {
    if (err) return sendError(res, err.message, 400);
    next();
  }),
  async (req, res) => {
    const listing = await prisma.animalListing.findUnique({ where: { id: req.params.id } });
    if (!listing) return sendNotFound(res, 'Animal listing');
    if (listing.sellerId !== req.user.id) return sendForbidden(res);

    const { animal, breed, age, gender, weight, price, milkYield, description, sellerLocation, tags, status } = req.body;
    const newImages = await uploadFiles(req.files || [], 'animals');

    const updated = await prisma.animalListing.update({
      where: { id: listing.id },
      data: {
        ...(animal         && { animal }),
        ...(breed          && { breed }),
        ...(age            && { age }),
        ...(gender         && { gender }),
        ...(weight         && { weight }),
        ...(price          && { price: parseFloat(price) }),
        ...(milkYield      !== undefined && { milkYield }),
        ...(description    !== undefined && { description }),
        ...(sellerLocation && { sellerLocation }),
        ...(tags           && { tags }),
        ...(status         && { status }),
        ...(newImages.length && { images: [...listing.images, ...newImages] }),
      },
    });

    return sendSuccess(res, updated);
  }
);

router.delete('/:id', authenticate, async (req, res) => {
  const listing = await prisma.animalListing.findUnique({ where: { id: req.params.id } });
  if (!listing) return sendNotFound(res, 'Animal listing');
  if (listing.sellerId !== req.user.id && req.user.role !== 'ADMIN') return sendForbidden(res);

  await prisma.animalListing.update({
    where: { id: listing.id },
    data: { status: 'INACTIVE' },
  });

  return sendSuccess(res, { deleted: true });
});

// ── Chat ──────────────────────────────────────────────────────────────────────
router.post('/:id/chat', authenticate, async (req, res) => {
  const listing = await prisma.animalListing.findUnique({ where: { id: req.params.id } });
  if (!listing || listing.status !== 'ACTIVE') return sendNotFound(res, 'Animal listing');
  if (listing.sellerId === req.user.id) return sendError(res, 'Cannot chat with yourself', 400);

  const chat = await prisma.chat.upsert({
    where: { listingId_buyerId: { listingId: listing.id, buyerId: req.user.id } },
    create: { listingId: listing.id, sellerId: listing.sellerId, buyerId: req.user.id },
    update: {},
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
  });

  return sendSuccess(res, chat);
});

router.get('/:id/chats', authenticate, async (req, res) => {
  const listing = await prisma.animalListing.findUnique({ where: { id: req.params.id } });
  if (!listing) return sendNotFound(res, 'Animal listing');
  if (listing.sellerId !== req.user.id) return sendForbidden(res);

  const chats = await prisma.chat.findMany({
    where: { listingId: listing.id },
    include: {
      buyer: { select: { id: true, name: true, avatar: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return sendSuccess(res, chats);
});

export default router;
