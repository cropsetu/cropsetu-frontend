/**
 * AgriStore Routes
 * GET  /api/v1/agristore/categories
 * GET  /api/v1/agristore/products           ?category&search&page&limit
 * GET  /api/v1/agristore/products/:id
 * GET  /api/v1/agristore/cart
 * POST /api/v1/agristore/cart               { productId, quantity }
 * PUT  /api/v1/agristore/cart/:productId    { quantity }
 * DELETE /api/v1/agristore/cart/:productId
 * POST /api/v1/agristore/orders             { deliveryAddress, paymentMethod, notes }
 * GET  /api/v1/agristore/orders
 * GET  /api/v1/agristore/orders/:id
 * POST /api/v1/agristore/products/:id/review { rating, comment }
 */
import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import prisma from '../config/db.js';
import { sendSuccess, sendCreated, sendError, sendNotFound, paginationMeta } from '../utils/response.js';

const router = Router();

// ── Categories (public) ───────────────────────────────────────────────────────
router.get('/categories', async (_req, res) => {
  const cats = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  return sendSuccess(res, cats);
});

// ── Products list (public) ────────────────────────────────────────────────────
router.get(
  '/products',
  optionalAuth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  async (req, res) => {
    const page  = parseInt(req.query.page  || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const { category, search, featured, district } = req.query;

    const { subcategory } = req.query;
    const where = { isActive: true };
    if (category)    where.categoryId  = category;
    if (subcategory) where.subcategory = subcategory;
    if (featured)    where.isFeatured  = true;
    if (search) {
      where.OR = [
        { name:        { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags:        { has: search.toLowerCase() } },
      ];
    }

    // District filter: show products for that district + products with no restriction (national)
    if (district) {
      where.AND = [{
        OR: [
          { district: { equals: district, mode: 'insensitive' } },
          { district: null },
        ],
      }];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true, icon: true, color: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ isFeatured: 'desc' }, { rating: 'desc' }],
      }),
      prisma.product.count({ where }),
    ]);

    return sendSuccess(res, products, 200, paginationMeta(total, page, limit));
  }
);

// ── Single product ────────────────────────────────────────────────────────────
router.get('/products/:id', async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: {
      category: true,
      reviews: {
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
  if (!product) return sendNotFound(res, 'Product');
  return sendSuccess(res, product);
});

// ── Cart (auth required) ──────────────────────────────────────────────────────
router.get('/cart', authenticate, async (req, res) => {
  const items = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: { product: { include: { category: { select: { name: true } } } } },
  });
  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  return sendSuccess(res, { items, total });
});

router.post(
  '/cart',
  authenticate,
  [
    body('productId').notEmpty(),
    body('quantity').isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const { productId, quantity } = req.body;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) return sendNotFound(res, 'Product');
    if (product.stock < quantity) return sendError(res, 'Insufficient stock', 400);

    const item = await prisma.cartItem.upsert({
      where: { userId_productId: { userId: req.user.id, productId } },
      create: { userId: req.user.id, productId, quantity },
      update: { quantity: { increment: quantity } },
      include: { product: true },
    });

    return sendCreated(res, item);
  }
);

router.put(
  '/cart/:productId',
  authenticate,
  [body('quantity').isInt({ min: 1, max: 100 })],
  validate,
  async (req, res) => {
    const item = await prisma.cartItem.updateMany({
      where: { userId: req.user.id, productId: req.params.productId },
      data: { quantity: req.body.quantity },
    });
    if (!item.count) return sendNotFound(res, 'Cart item');
    return sendSuccess(res, { updated: true });
  }
);

router.delete('/cart/:productId', authenticate, async (req, res) => {
  await prisma.cartItem.deleteMany({
    where: { userId: req.user.id, productId: req.params.productId },
  });
  return sendSuccess(res, { deleted: true });
});

// ── Orders ────────────────────────────────────────────────────────────────────
router.post(
  '/orders',
  authenticate,
  [
    body('paymentMethod').optional().isIn(['cod', 'upi', 'card']),
    // Accept either a saved address id OR an inline address object
    body('deliveryAddressId').optional().isString(),
    body('deliveryAddress').optional().isObject(),
  ],
  validate,
  async (req, res) => {
    let { deliveryAddress, deliveryAddressId, paymentMethod = 'cod', notes } = req.body;

    // Resolve address from saved address if id provided
    if (deliveryAddressId) {
      const saved = await prisma.savedAddress.findFirst({
        where: { id: deliveryAddressId, userId: req.user.id },
      });
      if (!saved) return sendError(res, 'Saved address not found', 400);
      deliveryAddress = {
        type:    saved.type,
        name:    saved.name,
        phone:   saved.phone,
        flat:    saved.flat,
        street:  saved.street,
        city:    saved.city,
        state:   saved.state,
        pincode: saved.pincode,
        ...(saved.landmark ? { landmark: saved.landmark } : {}),
      };
    }

    if (!deliveryAddress || typeof deliveryAddress !== 'object') {
      return sendError(res, 'deliveryAddress or deliveryAddressId is required', 400);
    }

    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: { product: true },
    });
    if (!cartItems.length) return sendError(res, 'Cart is empty', 400);

    // Validate stock
    for (const item of cartItems) {
      if (item.product.stock < item.quantity) {
        return sendError(res, `Insufficient stock for ${item.product.name}`, 400);
      }
    }

    const totalAmount = cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

    // Create order + items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          userId: req.user.id,
          totalAmount,
          deliveryAddress,
          paymentMethod,
          notes,
          items: {
            // sellerId is denormalised on each OrderItem so seller order queries
            // hit the index directly instead of joining through products.
            create: cartItems.map((i) => ({
              productId:  i.productId,
              sellerId:   i.product.sellerId || null,
              quantity:   i.quantity,
              unitPrice:  i.product.price,
              totalPrice: i.product.price * i.quantity,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      // Decrement stock
      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Clear cart
      await tx.cartItem.deleteMany({ where: { userId: req.user.id } });

      return o;
    });

    return sendCreated(res, order);
  }
);

router.get('/orders', authenticate, async (req, res) => {
  const page  = parseInt(req.query.page  || '1', 10);
  const limit = parseInt(req.query.limit || '10', 10);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: { include: { product: { select: { name: true, images: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where: { userId: req.user.id } }),
  ]);

  return sendSuccess(res, orders, 200, paginationMeta(total, page, limit));
});

router.get('/orders/:id', authenticate, async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: { items: { include: { product: true } } },
  });
  if (!order) return sendNotFound(res, 'Order');
  return sendSuccess(res, order);
});

// ── Seller: product CRUD ──────────────────────────────────────────────────────
// POST   /seller/products        → create a new product listing
// GET    /seller/products        → list own products
// PUT    /seller/products/:id    → update own product
// DELETE /seller/products/:id    → delete own product
// GET    /seller/stats           → dashboard stats
// GET    /seller/orders          → orders that include seller's products

router.post(
  '/seller/products',
  authenticate,
  [
    body('name').trim().notEmpty().withMessage('name required'),
    body('categoryId').notEmpty(),
    body('price').isFloat({ min: 0.01 }),
    body('stock').isInt({ min: 0 }),
    body('unit').notEmpty(),
    body('description').optional().trim(),
    body('mrp').optional().isFloat({ min: 0 }),
    body('minOrderQty').optional().isInt({ min: 1 }),
    body('tags').optional().isArray(),
    body('images').optional().isArray(),
    body('district').optional().trim(),
    body('taluka').optional().trim(),
    body('village').optional().trim(),
    body('state').optional().trim(),
    body('sellScope').optional().isIn(['village', 'taluka', 'district', 'state', 'all_india']),
    body('harvestDate').optional().trim(),
    body('subcategory').optional().trim(),
    body('brand').optional().trim(),
    body('manufacturer').optional().trim(),
    body('countryOfOrigin').optional().trim(),
    body('highlights').optional().isArray(),
    body('specifications').optional().isObject(),
  ],
  validate,
  async (req, res) => {
    const {
      name, nameHi, nameMr, categoryId, description,
      price, mrp, unit, stock, minOrderQty,
      images = [], tags = [],
      district, taluka, village, state, sellScope, harvestDate, subcategory,
      brand, manufacturer, countryOfOrigin, highlights = [], specifications,
    } = req.body;

    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) return sendError(res, 'Invalid category', 400);

    const product = await prisma.product.create({
      data: {
        name, nameHi, nameMr, categoryId, description,
        price:       parseFloat(price),
        mrp:         mrp ? parseFloat(mrp) : null,
        unit,
        stock:       parseInt(stock),
        minOrderQty: minOrderQty ? parseInt(minOrderQty) : 1,
        images, tags,
        district:    district    || null,
        taluka:      taluka      || null,
        village:     village     || null,
        state:       state       || null,
        sellScope:   sellScope   || 'district',
        harvestDate: harvestDate || null,
        subcategory: subcategory || null,
        brand:           brand           || null,
        manufacturer:    manufacturer    || null,
        countryOfOrigin: countryOfOrigin || null,
        highlights:      highlights,
        specifications:  specifications  || null,
        sellerId:    req.user.id,
      },
      include: { category: { select: { id: true, name: true, icon: true, color: true } } },
    });
    return sendCreated(res, product);
  }
);

router.get('/seller/products', authenticate, async (req, res) => {
  const page  = parseInt(req.query.page  || '1', 10);
  const limit = parseInt(req.query.limit || '20', 10);
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { sellerId: req.user.id },
      include: { category: { select: { id: true, name: true, icon: true, color: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where: { sellerId: req.user.id } }),
  ]);
  return sendSuccess(res, products, 200, paginationMeta(total, page, limit));
});

router.put(
  '/seller/products/:id',
  authenticate,
  [
    body('name').optional().trim().notEmpty(),
    body('price').optional().isFloat({ min: 0.01 }),
    body('stock').optional().isInt({ min: 0 }),
    body('minOrderQty').optional().isInt({ min: 1 }),
    body('sellScope').optional().isIn(['village', 'taluka', 'district', 'state', 'all_india']),
    body('harvestDate').optional().trim(),
    body('brand').optional().trim(),
    body('manufacturer').optional().trim(),
    body('countryOfOrigin').optional().trim(),
    body('highlights').optional().isArray(),
    body('specifications').optional().isObject(),
  ],
  validate,
  async (req, res) => {
    const product = await prisma.product.findFirst({ where: { id: req.params.id, sellerId: req.user.id } });
    if (!product) return sendNotFound(res, 'Product');

    const {
      name, nameHi, nameMr, description,
      price, mrp, unit, stock, minOrderQty,
      images, tags, isActive,
      district, taluka, village, state, sellScope, harvestDate,
      brand, manufacturer, countryOfOrigin, highlights, specifications,
    } = req.body;

    const data = {};
    if (name            !== undefined) data.name            = name;
    if (nameHi          !== undefined) data.nameHi          = nameHi;
    if (nameMr          !== undefined) data.nameMr          = nameMr;
    if (description     !== undefined) data.description     = description;
    if (price           !== undefined) data.price           = parseFloat(price);
    if (mrp             !== undefined) data.mrp             = mrp ? parseFloat(mrp) : null;
    if (unit            !== undefined) data.unit            = unit;
    if (stock           !== undefined) data.stock           = parseInt(stock);
    if (minOrderQty     !== undefined) data.minOrderQty     = parseInt(minOrderQty);
    if (images          !== undefined) data.images          = images;
    if (tags            !== undefined) data.tags            = tags;
    if (isActive        !== undefined) data.isActive        = isActive;
    if (district        !== undefined) data.district        = district        || null;
    if (taluka          !== undefined) data.taluka          = taluka          || null;
    if (village         !== undefined) data.village         = village         || null;
    if (state           !== undefined) data.state           = state           || null;
    if (sellScope       !== undefined) data.sellScope       = sellScope;
    if (harvestDate     !== undefined) data.harvestDate     = harvestDate     || null;
    if (brand           !== undefined) data.brand           = brand           || null;
    if (manufacturer    !== undefined) data.manufacturer    = manufacturer    || null;
    if (countryOfOrigin !== undefined) data.countryOfOrigin = countryOfOrigin || null;
    if (highlights      !== undefined) data.highlights      = highlights;
    if (specifications  !== undefined) data.specifications  = specifications  || null;
    if (req.body.subcategory !== undefined) data.subcategory = req.body.subcategory || null;

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: { category: { select: { id: true, name: true, icon: true, color: true } } },
    });
    return sendSuccess(res, updated);
  }
);

router.delete('/seller/products/:id', authenticate, async (req, res) => {
  const product = await prisma.product.findFirst({ where: { id: req.params.id, sellerId: req.user.id } });
  if (!product) return sendNotFound(res, 'Product');
  await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
  return sendSuccess(res, { deleted: true });
});

router.get('/seller/stats', authenticate, async (req, res) => {
  const [totalProducts, activeProducts, revenueAgg] = await Promise.all([
    prisma.product.count({ where: { sellerId: req.user.id } }),
    prisma.product.count({ where: { sellerId: req.user.id, isActive: true } }),
    // Uses denormalised sellerId index — no join through products
    prisma.orderItem.aggregate({
      where: { sellerId: req.user.id },
      _sum: { totalPrice: true, quantity: true },
    }),
  ]);
  return sendSuccess(res, {
    totalProducts,
    activeProducts,
    totalRevenue: revenueAgg._sum.totalPrice || 0,
    totalSold:    revenueAgg._sum.quantity   || 0,
  });
});

// ── Seller: update order status ───────────────────────────────────────────────
// Only allows updating orders that contain this seller's products
router.put(
  '/seller/orders/:orderId/status',
  authenticate,
  [
    body('status')
      .isIn(['CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
      .withMessage('status must be one of CONFIRMED, SHIPPED, DELIVERED, CANCELLED'),
  ],
  validate,
  async (req, res) => {
    const { orderId } = req.params;
    const { status }  = req.body;

    // Ensure this order actually has items from this seller
    // Uses the denormalised sellerId index — no product join needed
    const item = await prisma.orderItem.findFirst({
      where: { orderId, sellerId: req.user.id },
    });
    if (!item) return sendNotFound(res, 'Order');

    const order = await prisma.order.update({
      where: { id: orderId },
      data:  { status },
      select: { id: true, status: true },
    });
    return sendSuccess(res, order);
  }
);

router.get('/seller/orders', authenticate, async (req, res) => {
  const page  = parseInt(req.query.page  || '1', 10);
  const limit = parseInt(req.query.limit || '15', 10);
  // Uses the denormalised sellerId index — O(1) lookup, no join through products
  const [items, total] = await Promise.all([
    prisma.orderItem.findMany({
      where: { sellerId: req.user.id },
      include: {
        product: { select: { id: true, name: true, images: true, unit: true } },
        order: {
          select: {
            id: true, status: true, paymentMethod: true, paymentStatus: true,
            deliveryAddress: true, createdAt: true,
            user: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { order: { createdAt: 'desc' } },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.orderItem.count({ where: { sellerId: req.user.id } }),
  ]);
  return sendSuccess(res, items, 200, paginationMeta(total, page, limit));
});

// ── Product review ────────────────────────────────────────────────────────────
router.post(
  '/products/:id/review',
  authenticate,
  [
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  async (req, res) => {
    const { rating, comment } = req.body;
    const productId = req.params.id;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return sendNotFound(res, 'Product');

    const review = await prisma.$transaction(async (tx) => {
      const r = await tx.review.upsert({
        where: { userId_productId: { userId: req.user.id, productId } },
        create: { userId: req.user.id, productId, rating, comment },
        update: { rating, comment },
      });

      // Recalculate average rating
      const agg = await tx.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.product.update({
        where: { id: productId },
        data: {
          rating: agg._avg.rating || 0,
          ratingCount: agg._count.rating,
        },
      });

      return r;
    });

    return sendCreated(res, review);
  }
);

export default router;
